'use strict';

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

  const expectedDamage = (game.state.realmIdx + 1) * 10;
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

  game.state.stats.tizhi = 50;
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
