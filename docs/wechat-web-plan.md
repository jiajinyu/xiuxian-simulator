# Web + 微信小游戏并存改造方案（高复用版）

## 摘要

当前仓库可直接运行且检查全绿，但 `src/game-engine.js` 把核心逻辑、DOM、浏览器能力（`localStorage`/`location`/`navigator.share`/`html2canvas`/`qrcode`/GA）耦合在一起。  
要实现 Web 与微信小游戏并存并最大化复用，核心策略是：先拆核心，再做平台适配，再做双端入口。  
预计最终可复用代码占比约 65%~75%（配置 + 核心规则 + 大部分流程逻辑）。

## 现状评估（决定改造范围）

1. 入口与运行形态：
   1. `app/index.html` 通过脚本标签直接加载 `config/game-config.js` 和 `src/game-engine.js`，且大量 `onclick="game.xxx()"` 依赖全局 `window.game`。
2. 核心耦合点：
   1. `src/game-engine.js` 中有大量 `document.getElementById(...)`、`createElement`、`innerHTML/innerText`。
   2. 同文件直接使用 `localStorage`、`confirm`、`location.reload`、`navigator.share`、`fetch`、`File`、`alert`、`setInterval`。
3. 平台特有能力：
   1. Web 统计用 GA 脚本动态注入。
   2. 结算分享依赖 `html2canvas` 与二维码库。
4. 测试现状：
   1. 已有 `config-contract`、`engine-behavior`、`pinned-values` 与 smoke 测试，适合做“拆分后回归保护”。

## 目标与非目标

1. 目标：
   1. 保持现有 Web 无构建可运行。
   2. 新增微信小游戏工程，首版实现“流程等价 + UI重做 + 统一存档协议 + 基础分享”。
   3. 核心规则、配置与流程逻辑尽量共享。
2. 非目标（首版）：
   1. 不做微信广告/云开发/开放数据域。
   2. 不追求微信端视觉 1:1 复刻 Web。

## 目录与工程布局（决策已锁定）

1. 保持现有职责不变：
   1. `app/` 仍只放 Web 页面与样式。
   2. `config/` 仍只放配置数据。
   3. `src/` 仍放共享引擎逻辑。
2. 新增微信工程目录：
   1. `wxgame/` 作为小游戏工程根。
   2. `wxgame/minigame/` 放微信运行入口与构建产物。
   3. `wxgame/src/` 放微信端适配器与渲染层源码。

## 关键接口与类型改造（公共 API 变更）

1. 新增共享核心接口（`src/core/`）：
   1. `createGameCore({ config, platform, rng, now })`。
   2. `core.dispatch(action, payload)`，动作覆盖开局/抽天赋/分配属性/tick/结算等。
   3. `core.getState()` 返回纯数据状态（无 DOM 引用）。
2. 新增平台接口（`PlatformPort`）：
   1. `storage.get/set/remove`
   2. `scheduler.start/stop`
   3. `dialog.confirm`
   4. `lifecycle.restart`
   5. `analytics.trackEvent/trackFunnel`
   6. `share.shareSettlement`
3. 新增渲染接口（`RendererPort`）：
   1. `bindActions(actions)`
   2. `render(state)`
   3. `appendLog(logEntry)`
   4. `showSettlement(settlementViewModel)`
4. 存档协议统一（`SaveDataV2`）：
   1. 字段：`schemaVersion`、`gen`、`titles`、`highestStatFromLastLife`。
   2. 提供 `migrateSave(raw)`，兼容当前无版本旧存档。

## 具体改造步骤（可直接实施）

1. 第 1 阶段：核心抽离（最高优先级）
   1. 把表达式解析、条件匹配、事件触发、突破、死亡结算、称号判定、存档数据校验迁移到 `src/core/`。
   2. 核心层不得直接访问 DOM、`window`、`localStorage`。
   3. 保留 `config/game-config.js` 的声明式契约与向后兼容。
2. 第 2 阶段：Web 端重接（保持 no-build）
   1. 新增 `src/web/web-platform.js` 与 `src/web/web-renderer.js`。
   2. `src/game-engine.js` 降级为 Web bootstrap 适配层，仅做：组装 core + platform + renderer + 暴露 `window.game` 兼容旧 `onclick`。
   3. 保留 `app/index.html` 入口不变，避免破坏现有部署。
3. 第 3 阶段：微信小游戏工程接入
   1. 建立 `wxgame/minigame/game.js`、`game.json`、`project.config.json`。
   2. 新增 `wxgame/src/wx-platform.js`：
      1. 存储映射到 `wx.getStorageSync`/`wx.setStorageSync`。
      2. 对话框映射到 `wx.showModal`。
      3. 分享映射到 `wx.shareAppMessage`（基础文本分享）。
      4. analytics 默认 no-op，预留 `wx.reportAnalytics` 开关。
   3. 新增 `wxgame/src/wx-renderer.js`：
      1. 采用 Canvas + 命中区域按钮实现状态页（start/talent/setup/game/gallery/settlement）。
      2. 日志区用虚拟列表数据渲染，不用 HTML 字符串拼接。
4. 第 4 阶段：微信端构建（仅微信端）
   1. 增加 `scripts/build-wx.mjs`（建议 esbuild）把共享 core 与微信源码打到 `wxgame/minigame/`。
   2. Web 不引入构建，不改现有 `app/index.html` 直接运行模式。
5. 第 5 阶段：清理与文档
   1. 更新 `README.md` 增加双端运行说明。
   2. 新增 `docs/wechat-migration.md`（平台差异、限制、发布步骤）。
   3. 更新 `scripts/check.sh`：在不影响 Web 的前提下加入微信构建校验步骤（可用开关控制）。

## 测试方案与验收标准

1. 共享核心测试：
   1. 新增 `tests/core-engine.test.js`，直接测 `src/core`（不依赖 DOM）。
   2. 用固定 RNG 种子做“同输入同结果”回归。
2. Web 回归：
   1. 现有 `tests/engine-behavior.test.js`、`scripts/smoke-test.js` 全量通过。
   2. 保留“缺失可选节点不崩溃”测试。
3. 微信端测试：
   1. 新增 `tests/wx-platform-contract.test.js`（mock `wx` API）。
   2. 新增 `tests/cross-platform-parity.test.js`：同配置同随机序列下，Web core 与 wx core 关键状态一致（年龄/境界/死亡原因/称号/存档）。
4. 手动验收场景（双端都需通过）：
   1. 开局 -> 抽天赋 -> 分配属性 -> 修炼 -> 死亡 -> 结算。
   2. 重开后继承“转世福泽”正确。
   3. 存档损坏时安全降级，不崩溃。
   4. 事件表达式非法时不中断主流程。

## 风险与缓解

1. 风险：当前逻辑中大量 `innerHTML` 与 UI 文案拼接。
   1. 缓解：核心只产出结构化日志数据，渲染层各端自行格式化。
2. 风险：微信端无 DOM/CSS，UI重做量较大。
   1. 缓解：首版以流程等价为验收，视觉后续迭代。
3. 风险：双端行为漂移。
   1. 缓解：引入跨平台一致性测试与统一存档协议。

## 假设与默认决策（已按你的选择固化）

1. 微信首版采用“流程一致，UI重做”。
2. 允许“仅微信端”引入构建，Web 保持 no-build。
3. 微信首版做功能等价，不接广告/云能力。
4. Web 与微信使用统一存档协议（含旧存档迁移）。
5. 微信工程放在新目录 `wxgame/`，不破坏现有 `app/config/src` 职责边界。
