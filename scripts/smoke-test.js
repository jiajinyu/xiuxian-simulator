#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createEnvironment } = require('./game-test-harness');

const { game, config, getElementById } = createEnvironment();

game.toTalentSelection();
game.drawTalents();
game.toSetup();

game.state.points = 0;
game.updatePoints();
game.startGame();

assert.notStrictEqual(game.state.timer, null, 'timer should be started after startGame');

config.rules.oldAgeStart = 0;
config.rules.oldAgeStep = 1;
config.rules.oldAgeTizhiLoss = 5;
game.state.stats.tizhi = 1;

game.tick();

assert.strictEqual(game.state.isDead, true, 'game should settle to dead state');
assert.notStrictEqual(getElementById('end-title').innerText, '', 'settlement title should be rendered');

console.log('Smoke test passed: 开局 -> 修炼 -> 结算');
