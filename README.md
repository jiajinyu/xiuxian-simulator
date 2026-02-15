# xiuxian-simulator

一个无构建（no-build）的单页修仙模拟器项目。  
页面、游戏逻辑、运营配置已解耦，支持非技术同学独立调整策略和数值。

## 项目结构

- `app/index.html`: 页面入口（UI 结构 + 样式）
- `src/game-engine.js`: 游戏引擎与运行逻辑
- `config/game-config.js`: 当前生效的运营配置
- `config/game-config.ops-template.js`: 运营模板（可复制覆盖）
- `docs/运营配置说明.md`: 运营使用说明
- `tests/config-contract.test.js`: 配置契约测试（结构/类型/安全）
- `tests/engine-behavior.test.js`: 引擎行为测试（流程与状态变化）
- `tests/pinned-values.test.js`: 固定常量测试（应长期稳定的默认值）

## 运行方式

本项目不依赖 build 工具，直接打开页面即可：

1. 打开 `app/index.html`
2. 或使用任意静态服务器打开仓库目录后访问 `app/index.html`

WSL2 可一键启动（会自动拉起静态服务并打开 Chrome）：

```bash
bash scripts/serve.sh
```

可选自定义端口（默认 8000）：

```bash
bash scripts/serve.sh 8080
```

WSL2 同局域网手机访问可一键启动（会启动 WSL 静态服务，并拉起管理员 PowerShell 配置 Windows 端口转发与防火墙）：

```bash
bash scripts/mobile_serve.sh
```

可选参数：

```bash
bash scripts/mobile_serve.sh <端口> <页面路径> <WSL发行版名>
```

示例：

```bash
bash scripts/mobile_serve.sh 8080 /app/index.html Ubuntu-24.04
```

说明：

- 需要在弹出的 UAC 窗口中确认管理员授权。
- 默认会保持管理员 PowerShell 窗口不自动关闭，便于查看手机访问 URL。
- 如果未传发行版名，脚本会使用默认 WSL 发行版获取 IP。

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

说明：`scripts/check.sh` 会自动运行 `tests/*.test.js` 下的全部测试文件。

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

## 测试分层策略（避免运营调参误伤）

当前测试按三层拆分：

- `config-contract`: 只校验配置是否合法（字段、类型、概率范围、表达式安全），不校验具体运营数值。
- `engine-behavior`: 校验流程行为和状态变化（例如可触发、可结算、不崩溃），尽量避免写死配置常量。
- `pinned-values`: 仅保留少量必须固定的常量断言（例如默认存档形状、固定冷却窗口）。

这样运营同学日常改 `config/game-config.js` 时，只要满足契约，通常不需要联动改大量测试。

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

- GitHub Pages 部署：
  1. 在 GitHub 仓库 Settings -> Pages 中选择 Source 为 “GitHub Actions”。
  2. 推送到 `main` 后会触发 `Deploy to GitHub Pages` 工作流自动发布。
  3. 访问 `https://<username>.github.io/<repo>/`，入口会跳转到 `app/index.html`。
- Fly.io 部署与 GitHub Actions 配置见：`docs/deploy-flyio.md`
