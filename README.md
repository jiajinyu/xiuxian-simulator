# xiuxian-simulator

一个无构建（no-build）的单页修仙模拟器项目。  
页面、游戏逻辑、运营配置已解耦，支持非技术同学独立调整策略和数值。

## 项目结构

- `app/index.html`: 页面入口（UI 结构 + 样式）
- `src/game-engine.js`: 游戏引擎与运行逻辑
- `config/game-config.js`: 当前生效的运营配置
- `config/game-config.ops-template.js`: 运营模板（可复制覆盖）
- `docs/运营配置说明.md`: 运营使用说明

## 运行方式

本项目不依赖 build 工具，直接打开页面即可：

1. 打开 `app/index.html`
2. 或使用任意静态服务器打开仓库目录后访问 `app/index.html`

WSL2 可一键启动（会自动拉起静态服务并打开浏览器）：

```bash
bash scripts/start-app-wsl.sh
```

可选自定义端口（默认 8000）：

```bash
bash scripts/start-app-wsl.sh 8080
```

## 运维 Git 脚本

创建新分支（会先检查并同步 `main` 与 `origin/main`）：

```bash
bash scripts/branch.sh
```

提交并推送当前分支（先做本地检查，再把未推送提交 squash 成 1 个提交并 push）：

```bash
bash scripts/push.sh
```

单独执行本地检查：

```bash
bash scripts/check.sh
```

启用 ESLint（仅需一次安装开发依赖）：

```bash
npm install
```

## 配置驱动说明

游戏核心内容由 `config/game-config.js` 驱动，包括：

- 境界 `realms`
- 天赋 `talents`
- 事件 `events`
- 称号 `titles`
- 全局规则 `rules`（节奏、突破、衰老、调试开关等）

引擎通过声明式条件和效果解释配置，不要求在配置里写函数。

## 常见修改

- 调整节奏：改 `rules.tickMs`
- 调整突破难度：改 `rules.breakthrough.*`
- 开关每回合修为调试日志：改 `rules.debug.logCultivationDeltaPerTick`
- 新增事件/称号：参考 `docs/运营配置说明.md`

## 开发约定

- 保持无 build 架构，优先原生 HTML/CSS/JS
- 运营改动尽量只触达 `config/game-config.js`
- 逻辑改动放在 `src/game-engine.js`
- 入口页面保持精简，只负责加载资源与 UI

## 部署

- Fly.io 部署与 GitHub Actions 配置见：`docs/deploy-flyio.md`
