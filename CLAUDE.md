# CLAUDE.md

## Project Overview

修仙模拟器 — 无 build、可直接打开运行的浏览器游戏。入口：`app/index.html`。

## Directory Structure

- `app/` — 页面与样式（入口 `app/index.html`）
- `config/` — 配置数据（运营可改）
- `src/` — 引擎逻辑（开发可改）
- `docs/` — 说明文档
- `tests/` — 测试
- `scripts/` — 脚本工具

不要把引擎逻辑写回 `config/` 或 `app/`，不要把配置硬编码回 `src/`。

## Key Rules

- 先改配置，再考虑改引擎；能通过 `config/game-config.js` 完成的不动 `src/game-engine.js`
- 配置使用声明式结构（condition/effects），不引入函数
- 原生 ES 语法，不引入打包器
- 禁止 `eval`/`Function` 执行配置字符串
- DOM id 在 `app/index.html` 中必须存在；可选 UI 做空值兜底 `if (el) { ... }`

## Validation

每次改动后运行：

```bash
bash scripts/check.sh
```

包含 ESLint、JSON 验证、冒烟测试、单元测试。

## Test Files

- `tests/engine-behavior.test.js` — 引擎行为级测试
- `tests/config-contract.test.js` — 配置契约校验（结构/类型/安全）
- `tests/pinned-values.test.js` — 长期稳定常量
- 修复 bug 必须新增或更新回归测试
