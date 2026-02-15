const test = require('node:test');
const assert = require('assert');
const { createEnvironment } = require('../scripts/game-test-harness');

const CONDITION_OPS = new Set(['==', '!=', '>', '>=', '<', '<=', 'includes', 'includesAny', 'every']);
const ARITH_EXPR_TOKEN_PATTERN = /^\s*(?:realmIdx|\d+(?:\.\d+)?|[()+\-*/])(?:\s*(?:realmIdx|\d+(?:\.\d+)?|[()+\-*/]))*\s*$/;

function assertNoFunctionValues(value, path) {
  if (typeof value === 'function') {
    assert.fail(`${path} should not contain functions`);
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoFunctionValues(item, `${path}[${index}]`));
    return;
  }
  Object.keys(value).forEach(key => {
    assertNoFunctionValues(value[key], `${path}.${key}`);
  });
}

function isArithmeticExpressionCandidate(value) {
  return typeof value === 'string' && value.includes('realmIdx');
}

function assertConditionShape(condition, path) {
  if (!condition) return;
  assert.strictEqual(typeof condition, 'object', `${path} should be an object`);

  ['all', 'any'].forEach(groupKey => {
    if (!Object.prototype.hasOwnProperty.call(condition, groupKey)) return;
    const rules = condition[groupKey];
    assert.strictEqual(Array.isArray(rules), true, `${path}.${groupKey} should be an array`);
    rules.forEach((rule, index) => {
      const rulePath = `${path}.${groupKey}[${index}]`;
      assert.strictEqual(typeof rule.field, 'string', `${rulePath}.field should be a string`);
      assert.strictEqual(CONDITION_OPS.has(rule.op), true, `${rulePath}.op is not supported`);
      if (rule.op === 'includesAny') {
        assert.strictEqual(Array.isArray(rule.value), true, `${rulePath}.value should be an array`);
      }
      if (isArithmeticExpressionCandidate(rule.value)) {
        assert.strictEqual(
          ARITH_EXPR_TOKEN_PATTERN.test(rule.value),
          true,
          `${rulePath}.value has unsafe arithmetic tokens`
        );
      }
    });
  });
}

function assertEffectShape(effect, path) {
  assert.strictEqual(typeof effect, 'object', `${path} should be an object`);
  assert.strictEqual(typeof effect.field, 'string', `${path}.field should be a string`);
  const hasAdd = Object.prototype.hasOwnProperty.call(effect, 'add');
  const hasPercent = Object.prototype.hasOwnProperty.call(effect, 'percent') && effect.percent === true;
  assert.strictEqual(hasAdd || hasPercent, true, `${path} should define add or percent`);
  if (hasAdd) {
    assert.strictEqual(Number.isFinite(Number(effect.add)), true, `${path}.add should be a finite number`);
  }
  if (Object.prototype.hasOwnProperty.call(effect, 'percent')) {
    assert.strictEqual(typeof effect.percent, 'boolean', `${path}.percent should be boolean`);
  }
}

test('config contract keeps core collections and rule blocks valid', () => {
  const { config } = createEnvironment();

  assert.strictEqual(typeof config, 'object');
  assert.strictEqual(Array.isArray(config.realms), true);
  assert.strictEqual(config.realms.length > 1, true);
  assert.strictEqual(Array.isArray(config.talents), true);
  assert.strictEqual(config.talents.length > 0, true);
  assert.strictEqual(Array.isArray(config.events), true);
  assert.strictEqual(config.events.length > 0, true);
  assert.strictEqual(Array.isArray(config.titles), true);
  assert.strictEqual(config.titles.length > 0, true);

  assert.strictEqual(typeof config.rules, 'object');
  assert.strictEqual(Number.isFinite(Number(config.rules.startPoints)), true);
  assert.strictEqual(Number.isFinite(Number(config.rules.tickMs)), true);
  assert.strictEqual(typeof config.rules.baseStats, 'object');
  assert.strictEqual(typeof config.rules.breakthrough, 'object');
  assert.strictEqual(Array.isArray(config.rules.breakthrough.checkStats), true);
  assert.strictEqual(config.rules.breakthrough.checkStats.length > 0, true);
  config.rules.breakthrough.checkStats.forEach((statKey, index) => {
    assert.strictEqual(typeof statKey, 'string', `rules.breakthrough.checkStats[${index}] should be a string`);
  });
});

test('config contract uses declarative effects and safe conditions', () => {
  const { config } = createEnvironment();

  assertNoFunctionValues(config, 'GAME_CONFIG');

  config.talents.forEach((talent, index) => {
    const path = `talents[${index}]`;
    assert.strictEqual(typeof talent.name, 'string', `${path}.name should be a string`);
    assert.strictEqual(Array.isArray(talent.effects), true, `${path}.effects should be an array`);
    talent.effects.forEach((effect, effectIndex) => {
      assertEffectShape(effect, `${path}.effects[${effectIndex}]`);
    });
  });

  config.events.forEach((event, index) => {
    const path = `events[${index}]`;
    assert.strictEqual(typeof event.text, 'string', `${path}.text should be a string`);
    if (Object.prototype.hasOwnProperty.call(event, 'chance')) {
      assert.strictEqual(Number.isFinite(Number(event.chance)), true, `${path}.chance should be a finite number`);
      assert.strictEqual(event.chance >= 0 && event.chance <= 1, true, `${path}.chance should be in [0, 1]`);
    }
    assertConditionShape(event.trigger, `${path}.trigger`);
    if (Array.isArray(event.effects)) {
      event.effects.forEach((effect, effectIndex) => {
        assertEffectShape(effect, `${path}.effects[${effectIndex}]`);
      });
    }
  });

  config.titles.forEach((title, index) => {
    const path = `titles[${index}]`;
    assert.strictEqual(typeof title.name, 'string', `${path}.name should be a string`);
    assertConditionShape(title.condition, `${path}.condition`);
  });
});
