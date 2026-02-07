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
