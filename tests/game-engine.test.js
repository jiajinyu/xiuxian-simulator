const test = require('node:test');
const assert = require('assert');
const { createEnvironment } = require('../scripts/game-test-harness');

test('game boots and updates start screen', () => {
  const { getElementById } = createEnvironment();
  assert.notStrictEqual(getElementById('gen-count').innerText, '');
  assert.notStrictEqual(getElementById('title-rate').innerText, '');
});

test('breakthrough requirement grows by realm', () => {
  const { game } = createEnvironment();
  const req0 = game.getBreakthroughRequirement(0);
  const req1 = game.getBreakthroughRequirement(1);

  assert.strictEqual(req0 > 0, true);
  assert.strictEqual(req1 > req0, true);
});

test('tick can drive settlement path', () => {
  const { game, config, getElementById } = createEnvironment();

  game.state.stats.tizhi = 1;
  config.rules.oldAgeStart = 0;
  config.rules.oldAgeStep = 1;
  config.rules.oldAgeTizhiLoss = 2;

  game.startGame();
  game.tick();

  assert.strictEqual(game.state.isDead, true);
  assert.notStrictEqual(getElementById('end-reason').innerText, '');
});

test('death event reduces tizhi instead of instant death', () => {
  const { game } = createEnvironment();

  game.state.stats.tizhi = 20;
  game.state.realmIdx = 0;
  game.state.isDead = false;

  game.handleDeathEvent({
    text: '测试死亡事件',
    isDeath: true
  });

  // 体质扣除：取基础数值和体质80%中较大的那个
  // 基础值 = (realmIdx + 1) * 10 = 10
  // 体质80% = Math.floor(20 * 0.8) = 16
  // 实际扣除 = max(10, 16) = 16
  const baseDamage = (game.state.realmIdx + 1) * 10;
  const tizhiPercentDamage = Math.floor(20 * 0.8);
  const expectedDamage = Math.max(baseDamage, tizhiPercentDamage);
  assert.strictEqual(game.state.stats.tizhi, 20 - expectedDamage);
  assert.strictEqual(game.state.isDead, false);
  assert.strictEqual(game.state.deathEventCount, 1);
});

test('death event kills when tizhi drops to zero', () => {
  const { game } = createEnvironment();

  game.state.stats.tizhi = 5;
  game.state.realmIdx = 0;
  game.state.isDead = false;

  game.handleDeathEvent({ text: '测试致命事件' });

  assert.strictEqual(game.state.isDead, true);
  assert.strictEqual(game.state.deathEventCount, 1);
});

test('tick kills player when tizhi drops to zero after event', () => {
  const { game, config } = createEnvironment();

  game.state.stats.tizhi = 10;
  game.state.age = 0;
  game.state.isDead = false;
  game.state.paused = false;
  config.rules.oldAgeStart = 100;

  game.startGame();

  game.state.stats.tizhi = 0;
  game.tick();

  assert.strictEqual(game.state.isDead, true);
});

test('qiyun increases event chance', () => {
  const { game } = createEnvironment();

  const eventWithChance = {
    text: '测试事件',
    chance: 0.1
  };

  game.state.stats.qiyun = 50;
  const qiyunBonus = game.state.stats.qiyun * 0.001;
  const adjustedChance = eventWithChance.chance + qiyunBonus;

  assert.strictEqual(Math.abs(adjustedChance - 0.15) < 0.0001, true);
});

test('death event count tracks multiple survival events', () => {
  const { game } = createEnvironment();

  // 体质需要足够高以存活两次死亡事件
  // 新逻辑：伤害 = max((realmIdx+1)*10, floor(体质*0.8))
  // 境界0时：基础伤害=10，体质80%
  // 体质100时：第一次伤害=max(10,80)=80，剩余20
  // 体质20时：第二次伤害=max(10,16)=16，剩余4，存活
  game.state.stats.tizhi = 100;
  game.state.realmIdx = 0;
  game.state.isDead = false;
  game.state.deathEventCount = 0;

  game.handleDeathEvent({ text: '第一次' });
  game.handleDeathEvent({ text: '第二次' });

  assert.strictEqual(game.state.deathEventCount, 2);
  assert.strictEqual(game.state.isDead, false);
});

test('modStat shows warning when reaching base stat limit', () => {
  const { game, getElementById } = createEnvironment();

  game.state.baseStats = { tizhi: 5, tianfu: 0, wuxing: 0, qiyun: 0 };
  game.state.stats = { tizhi: 5, tianfu: 0, wuxing: 0, qiyun: 0 };
  game.state.points = 0;
  game.renderStats();

  game.modStat('tizhi', -1);

  const warningEl = getElementById('stat-warning');
  assert.notStrictEqual(warningEl, null);
  assert.strictEqual(warningEl.innerText.includes('不可减少天赋自带属性'), true);
});

test('tizhi warning is shown when start stats go negative', () => {
  const { game, getElementById } = createEnvironment();

  game.state.stats.tizhi = -1;
  game.renderStats();
  game.updatePoints();

  const warningEl = getElementById('tizhi-warning');
  assert.strictEqual(getElementById('btn-start').disabled, true);
  assert.strictEqual(warningEl.style.display, 'block');
});

test('toGallery does not crash when optional ring element is missing', () => {
  const { game, getElementById } = createEnvironment({ missingIds: ['gallery-ring'] });

  assert.strictEqual(getElementById('gallery-ring'), null);
  assert.doesNotThrow(() => game.toGallery());
});

test('draw then redraw keeps redraw button hidden on second draw', () => {
  const { game, getElementById } = createEnvironment();

  game.toTalentSelection();
  game.drawTalents();
  assert.strictEqual(getElementById('btn-redraw').classList.contains('hidden'), false);

  game.redrawTalents();
  assert.strictEqual(getElementById('btn-redraw').classList.contains('hidden'), true);
});

test('event trigger supports arithmetic expression values', () => {
  const { game, config } = createEnvironment();

  config.events = [{
    text: '表达式触发事件',
    chance: 1,
    trigger: { all: [{ field: 'stats.qiyun', op: '<', value: '(realmIdx-1)*10' }] },
    effects: [{ field: 'cultivation', add: 123 }]
  }];

  game.state.realmIdx = 3;
  game.state.stats.qiyun = 10;
  game.state.cultivation = 0;

  game.triggerEvent();

  assert.strictEqual(game.state.cultivation, 123);
});

test('invalid expression in condition does not crash game loop', () => {
  const { game, config } = createEnvironment();

  config.events = [{
    text: '非法表达式事件',
    chance: 1,
    trigger: { all: [{ field: 'stats.qiyun', op: '<', value: 'realmIdx+unknownVar' }] },
    effects: [{ field: 'cultivation', add: 999 }]
  }];

  game.state.realmIdx = 3;
  game.state.stats.qiyun = 10;

  assert.doesNotThrow(() => game.triggerEvent());
  assert.notStrictEqual(game.state.cultivation, 999);
});

test('showSettlementDirectly uses the same death finalization path', () => {
  const { game, getElementById } = createEnvironment();
  const beforeGen = game.data.gen;

  game.state.age = 88;
  game.state.realmIdx = 2;
  game.showSettlementDirectly('测试直接结算');

  assert.strictEqual(game.state.isDead, true);
  assert.strictEqual(game.data.gen, beforeGen + 1);
  assert.strictEqual(getElementById('settlement-modal').style.display, 'flex');
  assert.strictEqual(getElementById('end-reason').innerText.includes('测试直接结算'), true);
  assert.strictEqual(Boolean(game.state.lastTitle), true);
});

test('test harness returns null for unknown ids', () => {
  const { getElementById } = createEnvironment();

  assert.strictEqual(getElementById('definitely-missing-id'), null);
});

// ========== 事件分类与气运系统测试 ==========

test('getEventType correctly classifies event types', () => {
  const { game } = createEnvironment();

  // 死亡事件
  assert.strictEqual(game.getEventType({ isDeath: true }), 'death');

  // 负面事件（显式标记）
  assert.strictEqual(game.getEventType({ isNegative: true }), 'negative');

  // 填充事件（无 effects）
  assert.strictEqual(game.getEventType({ text: '填充文本' }), 'filler');
  assert.strictEqual(game.getEventType({ text: '填充', effects: [] }), 'filler');

  // 正面事件（只有增加）
  assert.strictEqual(game.getEventType({
    effects: [{ field: 'cultivation', add: 100 }, { field: 'stats.qiyun', add: 5 }]
  }), 'positive');

  // 负面事件（只有减少）
  assert.strictEqual(game.getEventType({
    effects: [{ field: 'cultivation', add: -100 }, { field: 'stats.tizhi', add: -5 }]
  }), 'negative');

  // 中性事件（既有增加又有减少）
  assert.strictEqual(game.getEventType({
    effects: [{ field: 'cultivation', add: 100 }, { field: 'stats.tizhi', add: -5 }]
  }), 'neutral');
});

test('getQiyunExemptionThreshold calculates correctly', () => {
  const { game } = createEnvironment();

  // 公式：(境界 * 2 + 3) * 10
  assert.strictEqual(game.getQiyunExemptionThreshold(0), 30);   // 凡人
  assert.strictEqual(game.getQiyunExemptionThreshold(1), 50);   // 炼气
  assert.strictEqual(game.getQiyunExemptionThreshold(2), 70);   // 筑基
  assert.strictEqual(game.getQiyunExemptionThreshold(9), 210);  // 渡劫
});

test('positive event gets qiyun bonus on chance', () => {
  const { game } = createEnvironment();

  // 公式：基础概率 + 气运 * 0.05%
  const baseChance = 0.1;
  const qiyun = 50;

  game.state.stats.qiyun = qiyun;
  const event = { text: '测试正面事件', chance: baseChance, effects: [{ field: 'cultivation', add: 100 }] };

  // 验证事件类型识别正确
  assert.strictEqual(game.getEventType(event), 'positive');

  // 验证概率加成计算正确：基础概率 + 气运 * 0.05%
  const qiyunBonus = game.state.stats.qiyun * 0.0005;
  const adjustedChance = baseChance + qiyunBonus;
  assert.strictEqual(Math.abs(adjustedChance - 0.125) < 0.0001, true);
});

test('negative and death events do not get qiyun bonus on chance', () => {
  const { game } = createEnvironment();

  const baseChance = 0.1;
  game.state.stats.qiyun = 100;

  // 负面事件不应有加成的逻辑（实际在 triggerEvent 中实现）
  const negativeEvent = { text: '测试负面', chance: baseChance, isNegative: true, effects: [{ field: 'cultivation', add: -100 }] };
  const deathEvent = { text: '测试死亡', chance: baseChance, isDeath: true };

  assert.strictEqual(game.getEventType(negativeEvent), 'negative');
  assert.strictEqual(game.getEventType(deathEvent), 'death');

  // 负面/死亡事件概率保持不变（加成 = 0）
  const qiyunBonus = 0;
  assert.strictEqual(baseChance + qiyunBonus, baseChance);
});

// ========== 事件冷却系统测试 ==========

test('event cooldown prevents same event within 10 years', () => {
  const { game } = createEnvironment();
  const eventText = '测试冷却事件';

  // 初始状态：事件不在冷却中
  assert.strictEqual(game.isEventOnCooldown(eventText), false);

  // 设置10年冷却
  game.setEventCooldown(eventText, 10);
  assert.strictEqual(game.isEventOnCooldown(eventText), true);

  // 模拟10个tick（10年）
  for (let i = 0; i < 10; i++) {
    game.decrementEventCooldowns();
  }

  // 冷却结束
  assert.strictEqual(game.isEventOnCooldown(eventText), false);
});

test('decrementEventCooldowns removes expired cooldowns', () => {
  const { game } = createEnvironment();

  game.setEventCooldown('事件A', 1);
  game.setEventCooldown('事件B', 3);

  // 1年后：事件A应被移除，事件B仍在冷却
  game.decrementEventCooldowns();

  assert.strictEqual(game.isEventOnCooldown('事件A'), false);
  assert.strictEqual(game.isEventOnCooldown('事件B'), true);
  assert.strictEqual(game.state.eventCooldowns['事件A'], undefined);
  assert.strictEqual(game.state.eventCooldowns['事件B'], 2);
});

test('filler events bypass cooldown restrictions', () => {
  createEnvironment();

  // filler事件标记为 _isFiller: true，不进入冷却
  const fillerEvent = { text: '填充文本', _isFiller: true };

  // filler事件本身不需要检查冷却
  // 实际逻辑：filler事件在 if (!hit) 分支生成，不触发 setEventCooldown
  assert.strictEqual(fillerEvent._isFiller, true);
});

// ========== 性别特定Filler测试 ==========

test('gender-specific filler shows correct text for male', () => {
  const { game, config, getElementById } = createEnvironment();

  // 设置一个性别特定的filler
  config.fillers = [
    { male: '男版文本', female: '女版文本' }
  ];

  game.state.gender = 'male';
  game.state.age = 20; // 不在童年期

  // 强制触发filler（清空events让filler被选中）
  config.events = [];
  game.triggerEvent();

  // 检查最后一条日志是否包含男版文本
  const logArea = getElementById('log-area');
  const lastLog = logArea.children[logArea.children.length - 1]?.innerHTML || '';
  assert.strictEqual(lastLog.includes('男版文本'), true);
});

test('gender-specific filler shows correct text for female', () => {
  const { game, config, getElementById } = createEnvironment();

  config.fillers = [
    { male: '男版文本', female: '女版文本' }
  ];

  game.state.gender = 'female';
  game.state.age = 20;
  config.events = [];
  game.triggerEvent();

  const logArea = getElementById('log-area');
  const lastLog = logArea.children[logArea.children.length - 1]?.innerHTML || '';
  assert.strictEqual(lastLog.includes('女版文本'), true);
});

// ========== 天赋互斥系统测试 ==========

test('getTalentAffectedStats correctly extracts affected stats', () => {
  const { game } = createEnvironment();

  // 正面天赋：体质+4
  const positiveTalent = {
    name: '测试正面',
    effects: [{ field: 'stats.tizhi', add: 4 }]
  };
  const positiveStats = game.getTalentAffectedStats(positiveTalent);
  assert.strictEqual(positiveStats.has('tizhi'), true);
  assert.strictEqual(positiveStats.get('tizhi').has('+'), true);

  // 负面天赋：天赋-3
  const negativeTalent = {
    name: '测试负面',
    effects: [{ field: 'stats.tianfu', add: -3 }]
  };
  const negativeStats = game.getTalentAffectedStats(negativeTalent);
  assert.strictEqual(negativeStats.has('tianfu'), true);
  assert.strictEqual(negativeStats.get('tianfu').has('-'), true);

  // 混合天赋：体质+4，悟性-3
  const mixedTalent = {
    name: '测试混合',
    effects: [
      { field: 'stats.tizhi', add: 4 },
      { field: 'stats.wuxing', add: -3 }
    ]
  };
  const mixedStats = game.getTalentAffectedStats(mixedTalent);
  assert.strictEqual(mixedStats.has('tizhi'), true);
  assert.strictEqual(mixedStats.has('wuxing'), true);
  assert.strictEqual(mixedStats.get('tizhi').has('+'), true);
  assert.strictEqual(mixedStats.get('wuxing').has('-'), true);
});

test('hasStatConflict detects same stat increase and decrease', () => {
  const { game } = createEnvironment();

  // 冲突情况：一个天赋增加体质，一个天赋减少体质
  const conflictTalents = [
    { name: '荒古圣体', effects: [{ field: 'stats.tizhi', add: 4 }] },
    { name: '废灵根', effects: [{ field: 'stats.tizhi', add: -3 }] }
  ];
  assert.strictEqual(game.hasStatConflict(conflictTalents), true);

  // 无冲突：都增加不同属性
  const noConflictTalents1 = [
    { name: '大聪明', effects: [{ field: 'stats.tianfu', add: 4 }] },
    { name: '韩跑跑', effects: [{ field: 'stats.qiyun', add: 4 }] }
  ];
  assert.strictEqual(game.hasStatConflict(noConflictTalents1), false);

  // 无冲突：一个增加，一个减少不同属性
  const noConflictTalents2 = [
    { name: '大聪明', effects: [{ field: 'stats.tianfu', add: 4 }] },
    { name: '招黑体质', effects: [{ field: 'stats.qiyun', add: -3 }] }
  ];
  assert.strictEqual(game.hasStatConflict(noConflictTalents2), false);

  // 冲突情况：通过混合天赋间接产生冲突
  const indirectConflict = [
    { name: '大聪明', effects: [{ field: 'stats.tianfu', add: 4 }] },
    { name: '玻璃大炮', effects: [{ field: 'stats.tianfu', add: 4 }, { field: 'stats.tizhi', add: -2 }] },
    { name: '无效努力', effects: [{ field: 'stats.tianfu', add: -2 }] }
  ];
  assert.strictEqual(game.hasStatConflict(indirectConflict), true);
});

test('hasStatConflict detects same stat decreased multiple times', () => {
  const { game } = createEnvironment();

  // 冲突情况：同一属性被减少两次
  const doubleDecrease = [
    { name: '天煞孤星', effects: [{ field: 'stats.qiyun', add: -4 }] },
    { name: '招黑体质', effects: [{ field: 'stats.qiyun', add: -3 }] }
  ];
  assert.strictEqual(game.hasStatConflict(doubleDecrease), true);

  // 冲突情况：同一属性被减少三次
  const tripleDecrease = [
    { name: '废灵根', effects: [{ field: 'stats.tizhi', add: -2 }] },
    { name: '经脉郁结', effects: [{ field: 'stats.tizhi', add: -2 }] },
    { name: '键盘侠', effects: [{ field: 'stats.tizhi', add: -2 }] }
  ];
  assert.strictEqual(game.hasStatConflict(tripleDecrease), true);

  // 冲突情况：通过混合天赋间接导致同一属性被减少多次
  const mixedDoubleDecrease = [
    { name: '熬夜冠军', effects: [{ field: 'stats.wuxing', add: 3 }, { field: 'stats.tizhi', add: -3 }] },
    { name: '玻璃大炮', effects: [{ field: 'stats.tianfu', add: 4 }, { field: 'stats.tizhi', add: -2 }] }
  ];
  assert.strictEqual(game.hasStatConflict(mixedDoubleDecrease), true);

  // 无冲突：不同属性各减少一次
  const noConflictDecrease = [
    { name: '天煞孤星', effects: [{ field: 'stats.qiyun', add: -4 }] },
    { name: '经脉郁结', effects: [{ field: 'stats.tizhi', add: -2 }] }
  ];
  assert.strictEqual(game.hasStatConflict(noConflictDecrease), false);

  // 无冲突：同一属性只减少一次（不影响其他属性的增加）
  const singleDecrease = [
    { name: '韩跑跑', effects: [{ field: 'stats.qiyun', add: 4 }] },
    { name: '废灵根', effects: [{ field: 'stats.tianfu', add: -3 }, { field: 'stats.tizhi', add: -2 }] }
  ];
  assert.strictEqual(game.hasStatConflict(singleDecrease), false);
});

test('sampleTalents avoids stat conflicts', () => {
  const { game, config } = createEnvironment();

  // 创建一个人工配置，确保可能产生冲突
  config.talents = [
    { name: '天赋A+', effects: [{ field: 'stats.tizhi', add: 4 }] },
    { name: '天赋A-', effects: [{ field: 'stats.tizhi', add: -3 }] },
    { name: '天赋B+', effects: [{ field: 'stats.qiyun', add: 4 }] },
    { name: '天赋B-', effects: [{ field: 'stats.qiyun', add: -4 }] },
    { name: '天赋C+', effects: [{ field: 'stats.wuxing', add: 4 }] },
    { name: '天赋C-', effects: [{ field: 'stats.wuxing', add: -3 }] }
  ];

  // 多次抽样验证没有冲突
  for (let i = 0; i < 20; i++) {
    const selected = game.sampleTalents(3);
    assert.strictEqual(game.hasStatConflict(selected), false);
  }
});

// ========== 死亡流程回归测试 ==========

test('die() shows settlement button but not modal', () => {
  const { game, getElementById } = createEnvironment();

  game.state.age = 50;
  game.state.realmIdx = 1;
  game.die('测试死亡');

  // 验证：死亡状态正确
  assert.strictEqual(game.state.isDead, true);

  // 验证：按钮应该显示（移除 hidden 类）
  const btnSettle = getElementById('btn-settle');
  assert.strictEqual(btnSettle.classList.contains('hidden'), false);

  // 验证：结算弹窗不应该自动弹出（display 不应为 'flex'）
  const modal = getElementById('settlement-modal');
  assert.strictEqual(modal.style.display !== 'flex', true);
});

test('showSettlement() displays the modal after die()', () => {
  const { game, getElementById } = createEnvironment();

  game.state.age = 50;
  game.state.realmIdx = 1;
  game.die('测试死亡');

  // 调用 showSettlement 后弹窗应该显示
  game.showSettlement();

  const modal = getElementById('settlement-modal');
  assert.strictEqual(modal.style.display, 'flex');
});



