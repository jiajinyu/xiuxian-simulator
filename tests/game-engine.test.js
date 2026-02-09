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
  const { game, config } = createEnvironment();

  game.state.stats.tizhi = 20;
  game.state.realmIdx = 0;
  game.state.isDead = false;

  const deathEvent = {
    text: "测试死亡事件",
    isDeath: true
  };

  game.handleDeathEvent(deathEvent);

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

  const deathEvent = {
    text: "测试致命事件"
  };

  game.handleDeathEvent(deathEvent);

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
  const { context, game, config } = createEnvironment();

  const eventWithChance = {
    text: "测试事件",
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

  game.handleDeathEvent({ text: "第一次" });
  game.handleDeathEvent({ text: "第二次" });

  assert.strictEqual(game.state.deathEventCount, 2);
  assert.strictEqual(game.state.isDead, false);
});

test('modStat shows warning when reaching base stat limit', () => {
  const { game, getElementById } = createEnvironment();

  game.state.baseStats = { tizhi: 5, tianfu: 0, wuxing: 0, qiyun: 0 };
  game.state.stats = { tizhi: 5, tianfu: 0, wuxing: 0, qiyun: 0 };
  game.state.points = 0;

  const btnStart = getElementById('btn-start');

  game.modStat('tizhi', -1);

  const warningEl = getElementById('stat-warning');
  assert.strictEqual(warningEl.innerText.includes('体质受天赋影响'), true);
});

test('tizhi cannot be negative at start', () => {
  const { game, getElementById } = createEnvironment();

  game.state.stats.tizhi = -1;
  game.updatePoints();

  const btnStart = getElementById('btn-start');
  const warningEl = getElementById('tizhi-warning');

  assert.strictEqual(btnStart.disabled, true);
  assert.strictEqual(warningEl.style.display, 'block');
});
