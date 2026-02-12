/* global setTimeout */
(function () {
  const cfg = window.GAME_CONFIG;
  if (!cfg) {
    throw new Error("GAME_CONFIG 未加载");
  }
  const analyticsCfg = cfg.analytics || {};
  let analyticsReady = false;

  function ensureAnalytics() {
    if (!analyticsCfg.enabled || !analyticsCfg.gaMeasurementId) return false;
    if (!window.dataLayer) window.dataLayer = [];
    if (!window.gtag) {
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
    }
    if (!window.__gaScriptLoaded) {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${analyticsCfg.gaMeasurementId}`;
      document.head.appendChild(script);
      window.__gaScriptLoaded = true;
    }
    if (!analyticsReady) {
      window.gtag("js", new Date());
      window.gtag("config", analyticsCfg.gaMeasurementId, { send_page_view: false });
      analyticsReady = true;
    }
    return true;
  }

  function trackEvent(name, params) {
    if (!ensureAnalytics()) return;
    window.gtag("event", name, params || {});
  }

  function trackFunnelStep(stepName, stepIndex, extras) {
    trackEvent("funnel_step", {
      funnel_name: analyticsCfg.funnelName || "xiuxian-core",
      step_name: stepName,
      step_index: stepIndex,
      ...(extras || {})
    });
  }

  function getByPath(obj, path) {
    if (path === "always") return true;
    return path.split(".").reduce((acc, key) => (acc === null || acc === undefined ? undefined : acc[key]), obj);
  }

  function setByPath(obj, path, value) {
    const keys = path.split(".");
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (cur[keys[i]] === null || cur[keys[i]] === undefined) cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
  }

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function tokenizeExpression(expr) {
    const tokens = [];
    let i = 0;

    while (i < expr.length) {
      const ch = expr[i];
      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      if ("()+-*/".includes(ch)) {
        tokens.push(ch);
        i++;
        continue;
      }

      if (/[0-9.]/.test(ch)) {
        let j = i;
        let dotCount = 0;
        while (j < expr.length && /[0-9.]/.test(expr[j])) {
          if (expr[j] === ".") dotCount++;
          if (dotCount > 1) return null;
          j++;
        }
        const numberToken = expr.slice(i, j);
        if (numberToken === ".") return null;
        tokens.push(numberToken);
        i = j;
        continue;
      }

      if (/[A-Za-z_]/.test(ch)) {
        let j = i;
        while (j < expr.length && /[A-Za-z0-9_]/.test(expr[j])) j++;
        tokens.push(expr.slice(i, j));
        i = j;
        continue;
      }

      return null;
    }

    return tokens;
  }

  function toRpn(tokens) {
    const output = [];
    const operators = [];
    const precedence = { "+": 1, "-": 1, "*": 2, "/": 2, "u-": 3 };
    const rightAssociative = new Set(["u-"]);
    let expectingValue = true;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (/^\d+(\.\d+)?$/.test(token)) {
        if (!expectingValue) return null;
        output.push(token);
        expectingValue = false;
        continue;
      }

      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(token)) {
        if (!expectingValue) return null;
        output.push(token);
        expectingValue = false;
        continue;
      }

      if (token === "(") {
        if (!expectingValue) return null;
        operators.push(token);
        continue;
      }

      if (token === ")") {
        if (expectingValue) return null;
        while (operators.length > 0 && operators[operators.length - 1] !== "(") {
          output.push(operators.pop());
        }
        if (operators.length === 0) return null;
        operators.pop();
        expectingValue = false;
        continue;
      }

      if (!["+","-","*","/"].includes(token)) return null;

      let op = token;
      if (token === "-" && expectingValue) {
        op = "u-";
      } else if (expectingValue) {
        return null;
      }

      while (operators.length > 0) {
        const top = operators[operators.length - 1];
        if (top === "(") break;
        const shouldPop = rightAssociative.has(op)
          ? precedence[op] < precedence[top]
          : precedence[op] <= precedence[top];
        if (!shouldPop) break;
        output.push(operators.pop());
      }
      operators.push(op);
      expectingValue = true;
    }

    if (expectingValue) return null;

    while (operators.length > 0) {
      const op = operators.pop();
      if (op === "(" || op === ")") return null;
      output.push(op);
    }

    return output;
  }

  function evaluateRpn(rpn, vars) {
    const stack = [];
    for (let i = 0; i < rpn.length; i++) {
      const token = rpn[i];

      if (/^\d+(\.\d+)?$/.test(token)) {
        stack.push(Number(token));
        continue;
      }

      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(token)) {
        if (!Object.prototype.hasOwnProperty.call(vars, token)) return null;
        const variableValue = Number(vars[token]);
        if (!Number.isFinite(variableValue)) return null;
        stack.push(variableValue);
        continue;
      }

      if (token === "u-") {
        if (stack.length < 1) return null;
        stack.push(-stack.pop());
        continue;
      }

      if (stack.length < 2) return null;
      const right = stack.pop();
      const left = stack.pop();
      let result = null;

      if (token === "+") result = left + right;
      if (token === "-") result = left - right;
      if (token === "*") result = left * right;
      if (token === "/") {
        if (right === 0) return null;
        result = left / right;
      }

      if (!Number.isFinite(result)) return null;
      stack.push(result);
    }

    return stack.length === 1 ? stack[0] : null;
  }

  function evaluateArithmeticExpression(expr, vars) {
    if (typeof expr !== "string" || expr.trim() === "") return null;
    const tokens = tokenizeExpression(expr);
    if (!tokens || tokens.length === 0) return null;
    const rpn = toRpn(tokens);
    if (!rpn) return null;
    return evaluateRpn(rpn, vars);
  }

  function evaluateValue(context, value) {
    if (typeof value === "string") {
      const evaluated = evaluateArithmeticExpression(value, {
        realmIdx: Number(context.realmIdx || 0)
      });
      if (typeof evaluated === "number" && Number.isFinite(evaluated)) return evaluated;
    }
    return value;
  }

  function matchRule(context, rule) {
    const left = getByPath(context, rule.field);
    const right = evaluateValue(context, rule.value);

    switch (rule.op) {
      case "==":
        return left === right;
      case "!=":
        return left !== right;
      case ">":
        return left > right;
      case ">=":
        return left >= right;
      case "<":
        return left < right;
      case "<=":
        return left <= right;
      case "includes":
        return typeof left === "string" && left.includes(String(right));
      case "includesAny":
        return typeof left === "string" && Array.isArray(right) && right.some(k => left.includes(String(k)));
      default:
        return false;
    }
  }

  function matchCondition(context, condition) {
    if (!condition) return true;
    const all = Array.isArray(condition.all) ? condition.all : [];
    const any = Array.isArray(condition.any) ? condition.any : [];

    if (all.length > 0 && !all.every(rule => matchRule(context, rule))) return false;
    if (any.length > 0 && !any.some(rule => matchRule(context, rule))) return false;

    return true;
  }

  function applyEffects(state, effects) {
    if (!Array.isArray(effects)) return;
    effects.forEach(effect => {
      const oldValue = getByPath(state, effect.field);
      const delta = Number(effect.add || 0);
      if (typeof oldValue === "number") {
        setByPath(state, effect.field, oldValue + delta);
      }
    });
  }

  const game = {
    data: {
      gen: 1,
      titles: []
    },

    state: {
      stats: { ...cfg.rules.baseStats },
      baseStats: {},
      points: cfg.rules.startPoints,
      age: 0,
      cultivation: 0,
      realmIdx: 0,
      isDead: false,
      paused: false,
      timer: null,
      failCount: 0,
      deathReason: "",
      deathEventCount: 0,
      hasTriggeredRomance: false,
      gender: null,  // 'male' 或 'female'
      eventCooldowns: {}  // 事件冷却：{ eventText: 剩余冷却年数 }
    },

    init() {
      const saved = localStorage.getItem("xiuxian_save");
      if (saved) {
        this.data = JSON.parse(saved);
      }
      this.updateStartScreen();
      trackFunnelStep("start_view", 0);
    },

    updateStartScreen() {
      document.getElementById("gen-count").innerText = this.data.gen;
      const rate = Math.floor((this.data.titles.length / cfg.titles.length) * 100);
      document.getElementById("title-rate").innerText = `${rate}%`;
    },

    resetData() {
      if (confirm("确定要删除所有转世记录和称号吗？")) {
        localStorage.removeItem("xiuxian_save");
        location.reload();
      }
    },

    toTalentSelection() {
      document.getElementById("panel-start").classList.add("hidden");
      document.getElementById("panel-talent").classList.remove("hidden");
      // 保存初始状态（无任何天赋时的状态）
      this.state.initialStats = { ...cfg.rules.baseStats };
      this.state.stats = { ...cfg.rules.baseStats };
      this.state.baseStats = {};
      trackFunnelStep("talent_select", 1);
    },

    toGallery() {
      document.getElementById("panel-start").classList.add("hidden");
      document.getElementById("panel-gallery").classList.remove("hidden");
      trackEvent("view_gallery");

      const list = document.getElementById("gallery-list");
      list.innerHTML = "";

      let unlockedCount = 0;
      cfg.titles.forEach(t => {
        const isUnlocked = this.data.titles.includes(t.name);
        if (isUnlocked) unlockedCount++;

        const div = document.createElement("div");
        div.className = `title-card ${isUnlocked ? "unlocked" : ""}`;
        const nameColor = isUnlocked ? t.color : "#666";

        div.innerHTML = `
          <span class="tc-name" style="color:${nameColor}">${t.name}</span>
          <span class="tc-desc">${t.desc}</span>
        `;
        list.appendChild(div);
      });

      // 更新环形进度条
      const total = cfg.titles.length;
      const progress = unlockedCount / total;
      const circumference = 2 * Math.PI * 36; // r=36
      const offset = circumference - (progress * circumference);
      const ring = document.getElementById("gallery-ring");
      if (ring) {
        ring.style.strokeDashoffset = offset;
      }
      document.getElementById("gallery-progress").innerText = `${unlockedCount}/${total}`;
    },

    backToStart() {
      document.getElementById("panel-gallery").classList.add("hidden");
      document.getElementById("panel-start").classList.remove("hidden");
    },

    restartGame() {
      // 使用页面刷新来确保完全重置状态
      location.reload();
    },

    sampleTalents(count) {
      const pool = [...cfg.talents];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool.slice(0, count);
    },

    renderTalentCards(pool) {
      const list = document.getElementById("talent-list");
      list.innerHTML = "";

      pool.forEach(t => {
        applyEffects(this.state, t.effects);

        const div = document.createElement("div");
        div.className = `talent-card ${t.type}`;
        div.innerHTML = `<span class="t-name">${t.name}</span><span class="t-desc">${t.desc}</span>`;
        list.appendChild(div);
      });
    },

    finalizeTalentDraw(canRedraw) {
      this.state.baseStats = { ...this.state.stats };
      document.getElementById("btn-draw").classList.add("hidden");
      document.getElementById("btn-confirm-talent").classList.remove("hidden");
      const redrawBtn = document.getElementById("btn-redraw");
      if (canRedraw) {
        redrawBtn.classList.remove("hidden");
      } else {
        redrawBtn.classList.add("hidden");
      }
    },

    drawTalents() {
      const pool = this.sampleTalents(3);
      this.renderTalentCards(pool);
      this.finalizeTalentDraw(true);
    },

    redrawTalents() {
      // 重置状态到初始值（清除之前的天赋效果）
      this.state.stats = { ...this.state.initialStats };
      this.state.baseStats = {};

      const pool = this.sampleTalents(3);
      this.renderTalentCards(pool);
      this.finalizeTalentDraw(false);
    },

    toSetup() {
      document.getElementById("panel-talent").classList.add("hidden");
      document.getElementById("panel-setup").classList.remove("hidden");
      this.renderStats();
      this.updatePoints();
      trackFunnelStep("attribute_setup", 2);
    },

    renderStats() {
      const con = document.getElementById("stat-rows");
      con.innerHTML = "";
      Object.keys(cfg.rules.statLabels).forEach(key => {
        con.innerHTML += `
          <div class="stat-row">
            <div class="stat-row-info">
              <span class="stat-name">${cfg.rules.statLabels[key]}</span>
            </div>
            <div class="stat-ctrl">
              <button onclick="game.modStat('${key}', -1)">−</button>
              <span id="val-${key}" class="stat-val">${this.state.stats[key]}</span>
              <button onclick="game.modStat('${key}', 1)">+</button>
            </div>
          </div>`;
      });
    },

    modStat(key, delta) {
      if (delta > 0 && this.state.points > 0) {
        this.state.stats[key]++;
        this.state.points--;
        this.hideStatWarning();
      } else if (delta < 0 && this.state.stats[key] > this.state.baseStats[key]) {
        this.state.stats[key]--;
        this.state.points++;
        this.hideStatWarning();
      } else if (delta < 0 && this.state.stats[key] <= this.state.baseStats[key]) {
        this.showStatWarning("不可减少天赋自带属性");
      }
      // 检查体质是否小于0
      if (key === "tizhi" && this.state.stats[key] <= 0) {
        this.showStatWarning("初始体质不可小于0");
      }
      this.updatePoints();
    },

    showStatWarning(message) {
      let warningEl = document.getElementById("stat-warning");
      if (!warningEl) {
        warningEl = document.createElement("div");
        warningEl.id = "stat-warning";
        warningEl.style.cssText = "color:#ffaa00; text-align:center; margin:10px 0; font-size:13px; min-height:20px;";
        const panelSetup = document.getElementById("panel-setup");
        const btnStart = document.getElementById("btn-start");
        panelSetup.insertBefore(warningEl, btnStart);
      }
      warningEl.innerText = message;
      warningEl.style.display = "block";
      setTimeout(() => {
        warningEl.style.display = "none";
      }, 2000);
    },

    hideStatWarning() {
      const warningEl = document.getElementById("stat-warning");
      if (warningEl) {
        warningEl.style.display = "none";
      }
    },

    randomStats() {
      this.state.stats = { ...this.state.baseStats };
      this.state.points = cfg.rules.startPoints;
      const keys = Object.keys(cfg.rules.statLabels);

      while (this.state.points > 0) {
        const key = keys[Math.floor(Math.random() * keys.length)];
        this.state.stats[key]++;
        this.state.points--;
      }

      this.updatePoints();
    },

    updatePoints() {
      const pointsEl = document.getElementById("points-left");
      pointsEl.innerText = this.state.points;

      pointsEl.style.transform = "scale(1.2)";
      pointsEl.style.transition = "transform 0.2s ease";
      setTimeout(() => {
        pointsEl.style.transform = "scale(1)";
      }, 200);

      Object.keys(cfg.rules.statLabels).forEach(key => {
        document.getElementById(`val-${key}`).innerText = this.state.stats[key];
      });

      const tizhi = this.state.stats.tizhi;
      const btnStart = document.getElementById("btn-start");
      const tizhiWarning = document.getElementById("tizhi-warning");

      if (tizhi < 0) {
        btnStart.disabled = true;
        if (tizhiWarning) {
          tizhiWarning.style.display = "block";
          tizhiWarning.innerText = "体质不能为负，请调整属性！";
        }
      } else {
        btnStart.disabled = this.state.points !== 0;
        if (tizhiWarning) {
          tizhiWarning.style.display = "none";
        }
      }
    },

    startGame() {
      if (this.state.stats.tizhi <= 0) this.state.stats.tizhi = 1;
      document.getElementById("panel-setup").classList.add("hidden");
      document.getElementById("panel-game").classList.remove("hidden");

      // 随机生成性别
      this.state.gender = Math.random() < 0.5 ? "male" : "female";
      const genderText = this.state.gender === "male" ? "男婴" : "女婴";
      const birthDesc = cfg.birthDesc?.[this.state.gender] || [];
      const desc = birthDesc.length > 0 ? pickRandom(birthDesc) : "";

      this.log(`轮回转世，再踏仙途。你出生时为${genderText}。${desc}`, "c-legend");
      this.state.timer = setInterval(() => this.tick(), cfg.rules.tickMs);
      trackFunnelStep("game_start", 3);
    },

    togglePause() {
      this.state.paused = !this.state.paused;
      document.getElementById("btn-pause").innerText = this.state.paused ? "▶" : "II";
    },

    tick() {
      if (this.state.isDead || this.state.paused) return;
      const cultivationBeforeTick = this.state.cultivation;
      const statsBeforeTick = { ...this.state.stats };

      this.state.age++;
      // 递减事件冷却时间
      this.decrementEventCooldowns();
      if (
        this.state.age > cfg.rules.oldAgeStart &&
        this.state.age % cfg.rules.oldAgeStep === 0
      ) {
        this.state.stats.tizhi -= cfg.rules.oldAgeTizhiLoss;
      }

      if (this.state.stats.tizhi <= 0) {
        this.die("寿元耗尽，坐化于洞府。");
        return;
      }

      this.checkBreakthrough();
      this.triggerEvent();

      if (this.state.stats.tizhi <= 0 && !this.state.isDead) {
        this.showSettlementDirectly("寿元耗尽，坐化于洞府。");
        return;
      }

      this.logCultivationDelta(cultivationBeforeTick, this.state.cultivation, statsBeforeTick, this.state.stats);
      this.updateGameUI();
    },

    logCultivationDelta(before, after, statsBefore, statsAfter) {
      if (!cfg.rules.debug || !cfg.rules.debug.logCultivationDeltaPerTick) return;
      const delta = after - before;
      const sign = delta >= 0 ? "+" : "";

      const statChanges = [];
      Object.keys(cfg.rules.statLabels).forEach(key => {
        const statDelta = statsAfter[key] - statsBefore[key];
        if (statDelta !== 0) {
          const statSign = statDelta > 0 ? "+" : "";
          statChanges.push(`${cfg.rules.statLabels[key]}${statSign}${statDelta}`);
        }
      });

      let message = `<span class="log-age">${this.state.age}岁</span>【调试】本回合修为 ${sign}${delta.toFixed(1)}，当前 ${after.toFixed(1)}`;
      if (statChanges.length > 0) {
        message += ` | 属性变化: ${statChanges.join(", ")}`;
      }

      this.log(message, "c-common");
    },

    getBreakthroughRequirement(realmIdx) {
      const lv = realmIdx + 1;
      // 使用指数增长，让高境界突破需要更长时间
      // 公式：reqBase * lv^2.5，让后期增长更快
      return Math.floor(cfg.rules.breakthrough.reqBase * Math.pow(lv, 2.5));
    },

    checkBreakthrough() {
      const s = this.state;
      const req = this.getBreakthroughRequirement(s.realmIdx);
      if (s.cultivation < req || s.realmIdx >= cfg.realms.length - 1) return;

      const b = cfg.rules.breakthrough;
      const checkType = pickRandom(b.checkStats);
      const baseChance = b.baseChance - s.realmIdx * b.perRealmPenalty;
      const bonus = s.stats[checkType] * b.statBonusMul;
      const finalChance = baseChance + bonus;

      if (Math.random() * 100 < finalChance) {
        const gain = (s.realmIdx + 1) * b.successTizhiGainMul;
        s.realmIdx++;
        s.cultivation = 0;
        s.stats.tizhi += gain;
        s.stats.tianfu += b.successTianfuGain;
        this.log(
          `突破瓶颈！判定【${checkType === "wuxing" ? "悟性" : "气运"}】通过，晋升【${cfg.realms[s.realmIdx]}】！体质+${gain}。`,
          "c-legend"
        );
      } else {
        const loss = (s.realmIdx + 1) * b.failTizhiLossMul;
        s.cultivation *= b.failCultivationKeep;
        s.stats.tizhi -= loss;
        s.failCount++;
        this.log(
          `冲击【${cfg.realms[s.realmIdx + 1]}】失败！气血逆流，<span style="color:red">体质-${loss}</span>。`,
          "c-death"
        );

        if (s.stats.tizhi <= 0) {
          this.showSettlementDirectly(`冲击【${cfg.realms[s.realmIdx + 1]}】失败，气血攻心而亡。`);
        }
      }
    },

    // 判断事件类型：positive(正面), negative(负面), death(死亡), filler(填充)
    getEventType(event) {
      if (event.isDeath) return "death";
      if (event.isNegative) return "negative";
      if (!event.effects || event.effects.length === 0) return "filler";
      
      // 根据effects判断：增加属性为正面，减少属性为负面
      let hasPositive = false;
      let hasNegative = false;
      for (const effect of event.effects) {
        const add = effect.add || 0;
        if (add > 0) hasPositive = true;
        if (add < 0) hasNegative = true;
      }
      
      if (hasPositive && !hasNegative) return "positive";
      if (hasNegative && !hasPositive) return "negative";
      return "neutral";
    },

    // 计算负面/死亡事件的豁免阈值：气运 > (境界×2+3)×10 可豁免
    getQiyunExemptionThreshold(realmIdx) {
      return (realmIdx * 2 + 3) * 10;
    },

    triggerEvent() {
      const s = this.state;
      const context = {
        ...s,
        deathReason: s.deathReason,
        gender: s.gender,
        always: true
      };

      // 1-10岁严格只从童年事件中抽取
      const isChildhood = s.age >= 1 && s.age <= 10;
      let valid;
      if (isChildhood && cfg.childhoodEvents && cfg.childhoodEvents.length > 0) {
        valid = cfg.childhoodEvents.filter(e => matchCondition(context, e.trigger));
      } else {
        valid = cfg.events.filter(e => matchCondition(context, e.trigger));
      }
      // 排除冷却期内的非filler事件
      valid = valid.filter(e => !this.isEventOnCooldown(e.text));



      let hit = valid.find(e => e.text.includes(`${s.age}岁`));
      if (!hit) {
        const shuffled = [...valid].sort(() => Math.random() - 0.5);
        for (let i = 0; i < shuffled.length; i++) {
          const e = shuffled[i];
          if (e.chance) {
            const eventType = this.getEventType(e);
            let adjustedChance = e.chance;
            
            // 正面事件受气运加成：基础概率 + 气运×0.05%
            if (eventType === "positive") {
              const qiyunBonus = (s.stats.qiyun || 0) * 0.0005; // 0.05% = 0.0005
              adjustedChance = e.chance + qiyunBonus;
            }
            // 负面事件和死亡事件基础概率不变，但会单独进行豁免判定
            
            if (Math.random() < adjustedChance) {
              hit = e;
              break;
            }
          }
        }
      }

      if (!hit) {
        // 1-10岁使用童年专用filler，否则使用普通filler
        const isChildhood = s.age >= 1 && s.age <= 10;
        const fillerPool = (isChildhood && cfg.childhoodFillers && cfg.childhoodFillers.length > 0)
          ? cfg.childhoodFillers
          : cfg.fillers;
        let rawFiller = pickRandom(fillerPool);
        // 处理对象格式的性别特定filler
        let text;
        if (typeof rawFiller === 'object' && rawFiller !== null) {
          text = s.gender === 'female' ? rawFiller.female : rawFiller.male;
        } else {
          text = rawFiller;
        }
        // 性别适配：替换 filler 中的人名
        if (s.gender === "female" && text.includes("二丫")) {
          text = text.replace("二丫", "狗剩");
        }
        const realmIdx = s.realmIdx || 0;
        const baseValue = (cfg.rules.realmBaseCultivation && cfg.rules.realmBaseCultivation[realmIdx]) || 10;
        const tianfuMultiplier = (cfg.rules.cultivationFormula && cfg.rules.cultivationFormula.tianfuMultiplier) || 0.1;
        const tianfu = s.stats.tianfu || 0;
        const gain = baseValue * (1 + tianfu * tianfuMultiplier);
        hit = {
          text,
          color: "c-common",
          effects: [{ field: "cultivation", add: gain }],
          _isFiller: true
        };
      } else {
        // 非filler事件触发后进入10年冷却
        this.setEventCooldown(hit.text, 10);
      }

      if (hit.requiresQiyunCheck && s.stats.qiyun < hit.minQiyun) {
        this.log(`${s.age}岁：遇到机缘但气运不足，错失良机。`, "c-common");
        return;
      }

      // 判断事件类型并进行相应处理
      const eventType = this.getEventType(hit);
      
      // 负面事件和死亡事件需要进行气运豁免判定
      if (eventType === "negative" || eventType === "death") {
        const exemptionThreshold = this.getQiyunExemptionThreshold(s.realmIdx);
        if (s.stats.qiyun > exemptionThreshold) {
          // 气运豁免成功
          this.log(`${s.age}岁：遭遇${eventType === "death" ? "生死危机" : "劫难"}，但你的气运【${s.stats.qiyun}】超过了豁免阈值【${exemptionThreshold}】，化险为夷！`, "c-legend");
          return;
        }
      }

      if (hit.text.includes("南宫婉") || hit.text.includes("合欢宗")) {
        s.hasTriggeredRomance = true;
      }

      applyEffects(s, hit.effects);
      if (s.cultivation < 0) s.cultivation = 0;

      let txt = hit.text;
      if (!txt.includes("岁")) txt = `${s.age}岁：${txt}`;

      let colorClass = hit.color || this.getEventColor(hit.chance || 1);
      if (eventType === "death") colorClass = "c-death";
      this.log(txt, colorClass);

      if (eventType === "death") {
        this.handleDeathEvent(hit);
      }
    },

    handleDeathEvent(event) {
      const s = this.state;

      const qiyunCheckChance = Math.min((s.stats.qiyun || 0) * 0.5, 80);
      if (Math.random() * 100 < qiyunCheckChance) {
        this.log(`${s.age}岁：${event.text}，但你的气运让你化险为夷！`, "c-legend");
        return;
      }

      const damage = (s.realmIdx + 1) * 10;
      s.stats.tizhi -= damage;
      s.deathEventCount = (s.deathEventCount || 0) + 1;

      if (s.stats.tizhi <= 0) {
        this.die(`${event.text}（体质-${damage}）`);
      } else {
        this.log(`${event.text}（体质-<span style="color:red">${damage}</span>）`, "c-death");
        this.log("你顽强地活了下来！", "c-legend");
      }
    },

    getEventColor(prob) {
      if (prob < 0.01) return "c-legend";
      if (prob < 0.02) return "c-epic";
      if (prob < 0.05) return "c-rare";
      if (prob < 0.1) return "c-uncommon";
      return "c-common";
    },

    log(msg, cls) {
      const div = document.createElement("div");
      div.className = `log-entry ${cls || ""}`;
      div.innerHTML = msg;
      const area = document.getElementById("log-area");
      area.appendChild(div);
      area.scrollTop = area.scrollHeight;
    },

    updateGameUI() {
      const s = this.state;
      
      // 更新属性值，添加动画效果
      const updateStat = (id, value) => {
        const el = document.getElementById(id);
        const oldValue = parseInt(el.innerText);
        el.innerText = value;
        if (oldValue !== value) {
          el.style.transform = "scale(1.3)";
          el.style.transition = "transform 0.2s ease";
          setTimeout(() => {
            el.style.transform = "scale(1)";
          }, 200);
        }
      };
      
      updateStat("s-tianfu", s.stats.tianfu);
      updateStat("s-wuxing", s.stats.wuxing);
      updateStat("s-tizhi", s.stats.tizhi);
      updateStat("s-qiyun", s.stats.qiyun);
      
      document.getElementById("realm-name").innerText = cfg.realms[s.realmIdx];

      const req = this.getBreakthroughRequirement(s.realmIdx);
      const pct = Math.max(0, Math.min(100, (s.cultivation / req) * 100));
      document.getElementById("bar-fill").style.width = `${pct}%`;
    },

    resolveTitle(context) {
      const matchedTitles = cfg.titles.filter(t => matchCondition(context, t.condition));
      const unlockedTitles = new Set(this.data.titles);
      const unownedMatched = matchedTitles.filter(t => !unlockedTitles.has(t.name));

      if (unownedMatched.length > 0) {
        return unownedMatched[0];
      }
      if (matchedTitles.length > 0) return matchedTitles[0];
      return cfg.titles[cfg.titles.length - 1];
    },

    renderSettlement(myTitle, reason) {
      const tEl = document.getElementById("end-title");
      tEl.innerText = myTitle.name;
      tEl.style.color = myTitle.color;

      document.getElementById("end-title-desc").innerText = myTitle.desc;
      document.getElementById("end-age").innerText = this.state.age;
      document.getElementById("end-realm").innerText = cfg.realms[this.state.realmIdx];
      document.getElementById("end-gen").innerText = this.data.gen;
      document.getElementById("end-reason").innerText = `死因：${reason}`;
    },

    finalizeDeath(reason, options) {
      const finalReason = reason || "体质耗尽，魂飞魄散。";
      const opts = options || {};

      this.state.isDead = true;
      this.state.deathReason = finalReason;
      clearInterval(this.state.timer);

      document.getElementById("btn-settle").classList.remove("hidden");
      this.data.gen++;

      const context = {
        ...this.state,
        deathReason: finalReason,
        always: true
      };
      const myTitle = this.resolveTitle(context);

      if (!this.data.titles.includes(myTitle.name)) {
        this.data.titles.push(myTitle.name);
      }
      localStorage.setItem("xiuxian_save", JSON.stringify(this.data));
      this.state.lastTitle = myTitle.name;

      trackFunnelStep("death", 4, {
        age: this.state.age,
        realm: cfg.realms[this.state.realmIdx],
        title: myTitle.name
      });
      trackEvent("game_over", { reason: finalReason });

      this.renderSettlement(myTitle, finalReason);
      if (opts.showSettlement) {
        this.showSettlement();
      }
    },

    die(reason) {
      this.finalizeDeath(reason, { showSettlement: false });
    },

    // 递减所有事件的冷却时间
    decrementEventCooldowns() {
      const cd = this.state.eventCooldowns;
      for (const key in cd) {
        if (cd[key] > 0) {
          cd[key]--;
        }
        if (cd[key] <= 0) {
          delete cd[key];
        }
      }
    },

    // 设置事件冷却时间
    setEventCooldown(eventText, years) {
      this.state.eventCooldowns[eventText] = years;
    },

    // 检查事件是否在冷却中
    isEventOnCooldown(eventText) {
      return (this.state.eventCooldowns[eventText] || 0) > 0;
    },

    showSettlement() {
      document.getElementById("settlement-modal").style.display = "flex";
      trackFunnelStep("settlement_view", 5, {
        title: this.state.lastTitle || "unknown"
      });
    },

    showSettlementDirectly(reason) {
      this.finalizeDeath(reason || "体质耗尽，魂飞魄散。", { showSettlement: true });
    }
  };

  window.game = game;
  game.init();
})();
