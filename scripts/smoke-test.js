#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createEnvironment } = require('./game-test-harness');

function toSetupAndStart(env) {
  const { game } = env;
  game.toTalentSelection();
  game.drawTalents();
  game.toSetup();
  game.state.points = 0;
  game.updatePoints();
  game.startGame();
}

function forceDeathInOneTick(env) {
  const { game, config } = env;
  config.rules.oldAgeStart = 0;
  config.rules.oldAgeStep = 1;
  config.rules.oldAgeTizhiLoss = 5;
  game.state.stats.tizhi = 1;
  game.tick();
}

function getLastLogText(getElementById) {
  const logArea = getElementById('log-area');
  const last = logArea.children[logArea.children.length - 1];
  return last ? last.innerText : '';
}

function runNavigationSmoke() {
  const env = createEnvironment();
  const { game, getElementById } = env;

  game.toGallery();
  assert.strictEqual(getElementById('panel-gallery').classList.contains('hidden'), false, 'gallery should be visible');
  game.backToStart();
  assert.strictEqual(getElementById('panel-start').classList.contains('hidden'), false, 'start panel should be visible');

  toSetupAndStart(env);
  assert.notStrictEqual(game.state.timer, null, 'timer should be started after startGame');
  assert.strictEqual(getElementById('panel-game').classList.contains('hidden'), false, 'game panel should be visible');
}

function runReincarnationSaveSmoke() {
  const env = createEnvironment();
  const { game, config, context, getElementById } = env;

  toSetupAndStart(env);
  forceDeathInOneTick(env);
  assert.strictEqual(game.state.isDead, true, 'game should settle to dead state');
  assert.notStrictEqual(getElementById('end-title').innerText, '', 'settlement title should be rendered');

  const saveRaw = context.localStorage.getItem('xiuxian_save');
  assert.notStrictEqual(saveRaw, null, 'save should be written on death');

  const saveData = JSON.parse(saveRaw);
  assert.strictEqual(saveData.gen > 1, true, 'generation should increase after death');
  assert.strictEqual(typeof saveData.highestStatFromLastLife, 'string', 'highestStatFromLastLife should be saved');

  game.data = { gen: 1, titles: [], highestStatFromLastLife: null };
  game.init();
  assert.strictEqual(game.data.gen, saveData.gen, 'init should restore saved generation');
  assert.strictEqual(
    game.data.highestStatFromLastLife,
    saveData.highestStatFromLastLife,
    'init should restore saved reincarnation bonus source'
  );

  game.toTalentSelection();
  const inherited = saveData.highestStatFromLastLife;
  assert.strictEqual(
    game.state.stats[inherited],
    Number(config.rules.baseStats[inherited] || 0) + 1,
    'selected inherited stat should gain +1 on next life'
  );
}

function runEventAgeRoutingSmoke() {
  const env = createEnvironment();
  const { game, config, getElementById } = env;
  const childMarker = 'SMOKE_CHILD_EVENT';
  const adultMarker = 'SMOKE_ADULT_EVENT';

  config.childhoodEvents = [{
    text: childMarker,
    chance: 1,
    trigger: { all: [{ field: 'always', op: '==', value: true }] },
    effects: [{ field: 'stats.qiyun', add: 1 }]
  }];
  config.events = [{
    text: adultMarker,
    chance: 1,
    trigger: { all: [{ field: 'always', op: '==', value: true }] },
    effects: [{ field: 'stats.qiyun', add: 1 }]
  }];
  config.childhoodFillers = ['SMOKE_CHILD_FILLER'];
  config.fillers = ['SMOKE_ADULT_FILLER'];

  const maxAgeProbe = 30;
  const routeByAge = new Map();

  for (let age = 0; age <= maxAgeProbe; age++) {
    game.state.age = age;
    game.state.eventCooldowns = {};
    game.triggerEvent();
    const text = getLastLogText(getElementById);
    if (text.includes(childMarker)) {
      routeByAge.set(age, 'child');
    } else if (text.includes(adultMarker)) {
      routeByAge.set(age, 'adult');
    } else {
      routeByAge.set(age, 'other');
    }
  }

  const childAges = [...routeByAge.entries()].filter(([, route]) => route === 'child').map(([age]) => age);
  const adultAges = [...routeByAge.entries()].filter(([, route]) => route === 'adult').map(([age]) => age);

  assert.strictEqual(childAges.length > 0, true, 'should find ages routed to childhood events');
  assert.strictEqual(adultAges.length > 0, true, 'should find ages routed to normal events');

  const firstChildAge = Math.min(...childAges);
  const lastChildAge = Math.max(...childAges);

  for (let age = firstChildAge; age <= lastChildAge; age++) {
    assert.strictEqual(routeByAge.get(age), 'child', 'childhood route should be contiguous');
  }
  for (let age = 0; age < firstChildAge; age++) {
    assert.strictEqual(routeByAge.get(age), 'adult', 'ages before childhood window should route to normal events');
  }
  for (let age = lastChildAge + 1; age <= maxAgeProbe; age++) {
    assert.strictEqual(routeByAge.get(age), 'adult', 'ages after childhood window should route to normal events');
  }
}

function runEventCooldownSmoke() {
  const env = createEnvironment();
  const { game, config, getElementById } = env;
  const marker = 'SMOKE_COOLDOWN_EVENT';

  config.childhoodEvents = [];
  config.events = [{
    text: marker,
    chance: 1,
    trigger: { all: [{ field: 'always', op: '==', value: true }] },
    effects: [{ field: 'stats.qiyun', add: 1 }]
  }];
  config.fillers = ['SMOKE_FALLBACK_FILLER'];

  game.state.age = 20;
  game.state.stats.qiyun = 0;
  game.state.eventCooldowns = {};

  game.triggerEvent();
  assert.strictEqual(getLastLogText(getElementById).includes(marker), true, 'first trigger should hit the event');
  assert.strictEqual(game.isEventOnCooldown(marker), true, 'event should enter cooldown after hit');

  game.triggerEvent();
  assert.strictEqual(getLastLogText(getElementById).includes(marker), false, 'cooldown should prevent immediate re-hit');
  assert.strictEqual(game.state.stats.qiyun, 1, 'event effect should only apply once during cooldown window');
}

function runBreakthroughFallbackSmoke() {
  const env = createEnvironment();
  const { game, config } = env;

  config.rules.breakthrough.baseChance = 'invalid-base';
  config.rules.breakthrough.perRealmPenalty = undefined;
  config.rules.breakthrough.statBonusMul = undefined;
  config.rules.breakthrough.successTizhiGainMul = undefined;
  config.rules.breakthrough.successTianfuGain = undefined;
  config.rules.breakthrough.failTizhiLossMul = undefined;
  config.rules.breakthrough.failCultivationKeep = undefined;
  config.rules.breakthrough.checkStats = 'invalid-check-stats';

  game.state.realmIdx = 0;
  game.state.cultivation = game.getBreakthroughRequirement(0);
  game.state.stats.wuxing = 200;
  game.state.stats.qiyun = 200;

  assert.doesNotThrow(() => game.checkBreakthrough(), 'breakthrough should be robust to invalid optional fields');
  assert.strictEqual(game.state.realmIdx, 1, 'fallback values should still allow a valid breakthrough path');
}

function runOptionalDomMissingSmoke() {
  const env = createEnvironment({ missingIds: ['gallery-ring', 'tizhi-warning'] });
  const { game, getElementById } = env;

  assert.strictEqual(getElementById('gallery-ring'), null, 'gallery-ring should be missing in harness');
  assert.strictEqual(getElementById('tizhi-warning'), null, 'tizhi-warning should be missing in harness');

  assert.doesNotThrow(() => game.toGallery(), 'toGallery should tolerate missing optional ring element');
  game.backToStart();

  assert.doesNotThrow(() => toSetupAndStart(env), 'main flow should tolerate missing optional warning element');
  forceDeathInOneTick(env);
  assert.strictEqual(game.state.isDead, true, 'game should still reach settlement with missing optional nodes');
}

runNavigationSmoke();
runReincarnationSaveSmoke();
runEventAgeRoutingSmoke();
runEventCooldownSmoke();
runBreakthroughFallbackSmoke();
runOptionalDomMissingSmoke();

console.log('Smoke test passed: multi-scenario flow checks');
