const test = require('node:test');
const assert = require('assert');
const { createEnvironment } = require('../scripts/game-test-harness');

test('event cooldown keeps a 10-year default window', () => {
  const { game } = createEnvironment();
  const eventText = '测试冷却事件';

  assert.strictEqual(game.isEventOnCooldown(eventText), false);
  game.setEventCooldown(eventText, 10);
  assert.strictEqual(game.isEventOnCooldown(eventText), true);

  for (let i = 0; i < 10; i++) {
    game.decrementEventCooldowns();
  }

  assert.strictEqual(game.isEventOnCooldown(eventText), false);
});

test('init resets to default data when localStorage save is invalid json', () => {
  const { game, context } = createEnvironment();

  context.localStorage.setItem('knight_save', '{ bad json');

  assert.doesNotThrow(() => game.init());
  assert.strictEqual(game.data.gen, 1);
  assert.strictEqual(Array.isArray(game.data.titles), true);
  assert.strictEqual(game.data.titles.length, 0);
  assert.strictEqual(game.data.highestStatFromLastLife, null);
  assert.strictEqual(context.localStorage.getItem('knight_save'), null);
});

test('init resets to default data when save shape is invalid', () => {
  const { game, context } = createEnvironment();

  context.localStorage.setItem('knight_save', JSON.stringify({ gen: 2 }));

  assert.doesNotThrow(() => game.init());
  assert.strictEqual(game.data.gen, 1);
  assert.strictEqual(Array.isArray(game.data.titles), true);
  assert.strictEqual(game.data.titles.length, 0);
  assert.strictEqual(game.data.highestStatFromLastLife, null);
  assert.strictEqual(context.localStorage.getItem('knight_save'), null);
});
