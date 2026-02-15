# 配置验证工具设计方案

## 问题分析

运营人员直接修改 `config/game-config.js` 后，单元测试和冒烟测试可能失败，主要原因：

1. **语法错误**：漏逗号、中文引号等
2. **配置结构错误**：缺少必需字段、字段类型错误
3. **数值范围错误**：如 `chance` 超出 0-1 范围
4. **条件表达式错误**：使用了不支持的语法或变量
5. **引用错误**：effects 中引用了不存在的字段

## 解决方案：配置验证工具

### 1. 核心组件

#### 1.1 配置 Schema 定义 (`scripts/config-schema.js`)
定义配置的完整结构和约束规则：

```javascript
const CONFIG_SCHEMA = {
  version: { type: 'string', required: true },
  rules: {
    type: 'object',
    required: true,
    fields: {
      startPoints: { type: 'number', min: 0 },
      tickMs: { type: 'number', min: 10 },
      oldAgeStart: { type: 'number', min: 0 },
      // ... 更多规则
    }
  },
  talents: {
    type: 'array',
    itemType: 'object',
    itemSchema: {
      name: { type: 'string', required: true },
      type: { type: 'string', enum: ['positive', 'negative', 'neutral'], required: true },
      desc: { type: 'string', required: true },
      effects: { type: 'array', validate: validateEffects }
    }
  },
  events: {
    type: 'array',
    itemType: 'object',
    itemSchema: {
      text: { type: 'string', required: true },
      chance: { type: 'number', min: 0, max: 1 },
      trigger: { type: 'object', validate: validateTrigger },
      effects: { type: 'array', validate: validateEffects },
      isDeath: { type: 'boolean' },
      isNegative: { type: 'boolean' },
      color: { type: 'string', pattern: /^c-[a-z]+$/ }
    }
  },
  // ... 更多配置节
}
```

#### 1.2 配置验证脚本 (`scripts/validate-config.js`)
主验证逻辑：

```javascript
#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { CONFIG_SCHEMA } = require('./config-schema');

// 验证结果收集
class ValidationResult {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  addError(path, message, suggestion) {
    this.errors.push({ path, message, suggestion });
  }

  addWarning(path, message) {
    this.warnings.push({ path, message });
  }

  isValid() {
    return this.errors.length === 0;
  }

  formatOutput() {
    // 格式化输出友好的错误信息
  }
}

// 主验证函数
function validateConfig(configPath) {
  const result = new ValidationResult();

  // 1. 语法检查（通过 vm.runInContext）
  const config = loadConfigSafely(configPath, result);
  if (!config) return result;

  // 2. 结构验证
  validateAgainstSchema(config, CONFIG_SCHEMA, '', result);

  // 3. 业务规则验证
  validateBusinessRules(config, result);

  return result;
}

// 安全加载配置
function loadConfigSafely(configPath, result) {
  try {
    const context = vm.createContext({ window: {} });
    vm.runInContext(fs.readFileSync(configPath, 'utf8'), context, { filename: configPath });
    return context.window.GAME_CONFIG;
  } catch (error) {
    result.addError('root', `语法错误: ${error.message}`, getSyntaxErrorSuggestion(error));
    return null;
  }
}

// Schema 验证
function validateAgainstSchema(config, schema, path, result) {
  // 递归验证每个字段
}

// 业务规则验证
function validateBusinessRules(config, result) {
  // 验证 chance 值总和
  // 验证条件表达式
  // 验证 effects 字段
}

// 条件表达式验证
function validateExpression(expr, result, path) {
  // 检查只允许的变量: realmIdx, age, failCount 等
  // 检查只允许的运算符: + - * / ( )
}

// Effects 验证
function validateEffects(effects, result, path) {
  const validFields = ['cultivation', 'stats.tianfu', 'stats.wuxing', 'stats.tizhi', 'stats.qiyun'];
  // 验证每个 effect 的 field 是否有效
  // 验证 add/percent/set 等操作符
}

// 主入口
function main() {
  const configPath = path.join(__dirname, '..', 'config', 'game-config.js');
  const result = validateConfig(configPath);

  console.log(result.formatOutput());

  process.exit(result.isValid() ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { validateConfig };
```

### 2. 验证规则详情

#### 2.1 语法检查
- 使用 `vm.runInContext` 加载配置，捕获语法错误
- 提供常见语法错误的修复建议

#### 2.2 结构验证
- 检查必需字段是否存在
- 检查字段类型是否正确
- 检查枚举值是否有效
- 检查数组元素结构

#### 2.3 数值范围验证
| 字段 | 约束 |
|------|------|
| `chance` | 0 ≤ value ≤ 1 |
| `tickMs` | ≥ 10 |
| `startPoints` | ≥ 0 |
| `oldAgeStart` | ≥ 0 |
| `oldAgeStep` | ≥ 1 |
| `oldAgeTizhiLoss` | ≥ 0 |

#### 2.4 条件表达式验证
允许的变量：
- `age`, `realmIdx`, `failCount`, `deathReason`, `gender`
- `stats.tianfu`, `stats.wuxing`, `stats.tizhi`, `stats.qiyun`

允许的运算符：
- 算术: `+`, `-`, `*`, `/`, `(`, `)`
- 比较: `==`, `!=`, `>`, `>=`, `<`, `<=`
- 字符串: `includes`, `includesAny`

禁止：
- 函数调用
- 未定义的变量
- 复杂表达式

#### 2.5 Effects 验证
允许的 field：
- `cultivation`
- `stats.tianfu`, `stats.wuxing`, `stats.tizhi`, `stats.qiyun`

允许的操作：
- `add`: 加减值
- `percent`: 百分比变化（仅 cultivation）
- `set`: 设置值

### 3. 输出格式

#### 成功输出
```
✓ 配置验证通过
  - 语法检查: 通过
  - 结构验证: 通过
  - 业务规则: 通过
  - 事件数: 45
  - 天赋数: 20
  - 称号数: 15
```

#### 错误输出
```
✗ 配置验证失败

错误 (2):
  1. [events.15.chance] 值 1.5 超出范围 [0, 1]
     建议: chance 应该在 0 到 1 之间，例如 0.015

  2. [talents.5.effects.0.field] 无效的字段名 'stats.xxx'
     有效字段: cultivation, stats.tianfu, stats.wuxing, stats.tizhi, stats.qiyun

警告 (1):
  1. [events.20.trigger] 条件表达式包含未知变量 'unknownVar'
     建议: 请检查变量名是否拼写正确

修复建议:
  1. 运行 `npm run validate-config` 查看详细错误
  2. 参考 docs/运营配置说明.md 了解配置格式
  3. 对比 config/game-config.ops-template.js 模板文件
```

### 4. 集成到开发流程

#### 4.1 更新 `check.sh`
```bash
# 在运行测试前先验证配置
echo "Validating game config..."
node scripts/validate-config.js

# 继续其他检查...
```

#### 4.2 更新 `package.json`
```json
{
  "scripts": {
    "validate-config": "node scripts/validate-config.js",
    "check": "bash scripts/check.sh"
  }
}
```

#### 4.3 更新运营文档
在 `docs/运营配置说明.md` 中添加：

```markdown
## 6. 配置验证

修改配置后，运行以下命令验证：

```bash
npm run validate-config
```

这会检查：
- 语法错误（逗号、引号等）
- 字段类型和范围
- 条件表达式是否合法
- 引用的字段是否存在

如果验证失败，会显示具体的错误位置和修复建议。
```

### 5. 错误提示示例

| 错误类型 | 示例 | 提示 |
|---------|------|------|
| 语法错误 | 漏逗号 | `[events.10] 语法错误: Unexpected token, expected ","` |
| 类型错误 | chance 为字符串 | `[events.5.chance] 期望类型为 number，实际为 string` |
| 范围错误 | chance = 1.5 | `[events.5.chance] 值 1.5 超出范围 [0, 1]` |
| 枚举错误 | type = "good" | `[talents.3.type] 无效的枚举值 "good"，有效值: positive, negative, neutral` |
| 表达式错误 | 包含函数调用 | `[events.8.trigger.value] 不允许函数调用` |
| 引用错误 | field = "stats.xxx" | `[events.2.effects.0.field] 无效的字段名 "stats.xxx"` |

### 6. 实现优先级

1. **P0 (必须)**: 语法检查、必需字段验证、数值范围验证
2. **P1 (重要)**: 条件表达式验证、effects 验证
3. **P2 (可选)**: 业务规则验证（如事件概率总和检查）

### 7. 扩展性考虑

- Schema 定义可扩展，方便添加新的配置节
- 验证规则可配置，支持自定义验证器
- 支持多配置文件验证（如验证模板文件）
- 可生成配置文档（从 schema 自动生成）
