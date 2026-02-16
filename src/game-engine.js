/* global setTimeout, qrcode, html2canvas, navigator, fetch, File, alert */
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
      case "every":
        return Array.isArray(left) && left.every(item => item === right);
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

  function applyEffects(state, effects, eventChance) {
    if (!Array.isArray(effects)) return;
    effects.forEach(effect => {
      const oldValue = getByPath(state, effect.field);
      if (typeof oldValue !== "number") return;

      // 百分比损失：用于减修为事件，几率越大损失百分比越小（10%-30%）
      if (effect.percent) {
        // chance 缺失/非法时按中位数 0.015 处理，防止 NaN 污染状态。
        const chanceValue = Number(eventChance);
        const chance = Number.isFinite(chanceValue) ? chanceValue : 0.015;
        // chance 范围 0.01-0.02 映射到 30%-10%，越大概率越小
        const lossPercent = Math.max(0.10, Math.min(0.30, 0.30 - (chance - 0.01) / 0.01 * 0.20));
        const loss = Math.floor(oldValue * lossPercent);
        setByPath(state, effect.field, oldValue - loss);
        return;
      }

      const delta = Number(effect.add || 0);
      const newValue = oldValue + delta;
      setByPath(state, effect.field, newValue);

      // 追踪体质最大值
      if (effect.field === "stats.tizhi" && state.maxTizhi !== undefined) {
        state.maxTizhi = Math.max(state.maxTizhi, newValue);
      }
    });
  }

  function createDefaultData() {
    return {
      gen: 1,
      titles: [],
      highestStatFromLastLife: null
    };
  }

  function isValidSavedData(data) {
    if (!data || typeof data !== "object") return false;
    if (!Number.isInteger(data.gen) || data.gen < 1) return false;
    if (!Array.isArray(data.titles) || !data.titles.every(title => typeof title === "string")) return false;
    if (data.highestStatFromLastLife !== null && typeof data.highestStatFromLastLife !== "string") return false;
    return true;
  }

  const game = {
    data: createDefaultData(),

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
      hasTriggeredIndescribable: false,  // 是否触发过"不可描述的事"
      hehuanzongCount: 0,  // 合欢宗事件触发次数
      gender: null,  // 'male' 或 'female'
      eventCooldowns: {},  // 事件冷却：{ eventText: 剩余冷却年数 }
      maxTizhi: 0  // 游戏过程中体质达到的最大值
    },

    init() {
      const saved = localStorage.getItem("xiuxian_save");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (isValidSavedData(parsed)) {
            this.data = {
              gen: parsed.gen,
              titles: [...parsed.titles],
              highestStatFromLastLife: parsed.highestStatFromLastLife
            };
          } else {
            this.data = createDefaultData();
            localStorage.removeItem("xiuxian_save");
          }
        } catch {
          this.data = createDefaultData();
          localStorage.removeItem("xiuxian_save");
        }
      } else {
        this.data = createDefaultData();
      }
      this.updateStartScreen();
      trackFunnelStep("start_view", 0);
    },

    updateStartScreen() {
      document.getElementById("gen-count").innerText = this.data.gen;
      const rate = Math.floor((this.data.titles.length / cfg.titles.length) * 100);
      document.getElementById("title-rate").innerText = `${rate}%`;
      
      // 显示转世继承属性加成
      this.renderReincarnationBonus();
    },

    renderReincarnationBonus() {
      let bonusEl = document.getElementById("reincarnation-bonus");
      if (this.data.highestStatFromLastLife && this.data.gen > 1) {
        const statName = cfg.rules.statLabels[this.data.highestStatFromLastLife] || this.data.highestStatFromLastLife;
        if (!bonusEl) {
          bonusEl = document.createElement("div");
          bonusEl.id = "reincarnation-bonus";
          bonusEl.style.cssText = "margin-top:15px; padding:10px; background:rgba(80,200,120,0.15); border:1px solid var(--evt-pos); color:var(--evt-pos); font-size:14px; cursor:help;";
          bonusEl.title = "上一世结算时最高的属性，可在下一世起始时获得+1加成";
          document.getElementById("start-stats").appendChild(bonusEl);
        }
        bonusEl.innerText = `转世福泽：下一世${statName}+1`;
        bonusEl.style.display = "block";
      } else if (bonusEl) {
        bonusEl.style.display = "none";
      }
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
      // 保存初始状态（无任何天赋时的状态），应用转世继承加成
      const baseStats = { ...cfg.rules.baseStats };
      if (this.data.highestStatFromLastLife) {
        const statKey = this.data.highestStatFromLastLife;
        if (baseStats[statKey] !== undefined) {
          baseStats[statKey]++;
        }
      }
      this.state.initialStats = baseStats;
      this.state.stats = { ...baseStats };
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

    // 获取天赋影响的所有属性及其增减方向
    getTalentAffectedStats(talent) {
      const stats = new Map(); // field -> set of signs ('+' or '-')
      if (!talent.effects) return stats;
      
      talent.effects.forEach(effect => {
        if (effect.field && effect.field.startsWith('stats.')) {
          const statName = effect.field.replace('stats.', '');
          const sign = effect.add >= 0 ? '+' : '-';
          if (!stats.has(statName)) {
            stats.set(statName, new Set());
          }
          stats.get(statName).add(sign);
        }
      });
      return stats;
    },

    // 检查一组天赋是否有属性冲突
    // 冲突规则：
    // 1. 同一属性既有增加又有减少
    // 2. 同一属性被减少多次
    hasStatConflict(talents) {
      const globalStats = new Map(); // field -> { addCount, subCount }

      for (const talent of talents) {
        const talentStats = this.getTalentAffectedStats(talent);
        for (const [statName, signs] of talentStats) {
          if (!globalStats.has(statName)) {
            globalStats.set(statName, { addCount: 0, subCount: 0 });
          }
          const stat = globalStats.get(statName);
          for (const sign of signs) {
            if (sign === '+') stat.addCount++;
            if (sign === '-') stat.subCount++;
          }
          // 规则1：同一属性既有 '+' 又有 '-'，说明有冲突
          if (stat.addCount > 0 && stat.subCount > 0) {
            return true;
          }
          // 规则2：同一属性被减少多次，说明有冲突
          if (stat.subCount > 1) {
            return true;
          }
        }
      }
      return false;
    },

    sampleTalents(count) {
      const pool = [...cfg.talents];
      let attempts = 0;
      const maxAttempts = 100; // 防止无限循环

      do {
        // 打乱数组（Fisher-Yates 洗牌算法）
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        
        const selected = pool.slice(0, count);
        
        // 检查是否有属性冲突，没有冲突则返回
        if (!this.hasStatConflict(selected)) {
          return selected;
        }
        
        attempts++;
      } while (attempts < maxAttempts);

      // 如果多次尝试后仍有冲突，直接返回（避免无限循环）
      return pool.slice(0, count);
    },

    renderTalentCards(pool) {
      const list = document.getElementById("talent-list");
      list.innerHTML = "";

      // 记录开局天赋类型用于称号判定
      this.state.startTalentTypes = pool.map(t => t.type);

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
        const desc = cfg.rules.statDescriptions?.[key] || "";
        con.innerHTML += `
          <div class="stat-row" title="${desc}">
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

      // 初始化体质最大值
      this.state.maxTizhi = this.state.stats.tizhi;
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
      if (this.state.isDead) return;

      this.triggerEvent();
      if (this.state.isDead) return;

      if (this.state.stats.tizhi <= 0 && !this.state.isDead) {
        this.die("寿元耗尽，坐化于洞府。");
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

      const b = cfg.rules.breakthrough || {};
      const baseChanceRaw = Number(b.baseChance);
      const perRealmPenaltyRaw = Number(b.perRealmPenalty);
      const failCultivationKeep = Number(b.failCultivationKeep);
      const successTizhiGainMul = Number(b.successTizhiGainMul);
      const successTianfuGain = Number(b.successTianfuGain);
      const failTizhiLossMul = Number(b.failTizhiLossMul);

      const baseChanceValue = Number.isFinite(baseChanceRaw) ? baseChanceRaw : 60;
      const perRealmPenaltyValue = Number.isFinite(perRealmPenaltyRaw) ? perRealmPenaltyRaw : 5;
      const failCultivationKeepValue = Number.isFinite(failCultivationKeep) ? failCultivationKeep : 0.7;
      const successTizhiGainMulValue = Number.isFinite(successTizhiGainMul) ? successTizhiGainMul : 4;
      const successTianfuGainValue = Number.isFinite(successTianfuGain) ? successTianfuGain : 2;
      const failTizhiLossMulValue = Number.isFinite(failTizhiLossMul) ? failTizhiLossMul : 3;
      const failPercentText = Math.max(0, Math.round((1 - failCultivationKeepValue) * 100));

      // 第一阶段：基础成功率判定
      const baseChance = baseChanceValue - s.realmIdx * perRealmPenaltyValue;
      const finalBaseChance = Math.max(0, Math.min(100, baseChance));

      if (Math.random() * 100 < finalBaseChance) {
        // 第二阶段：按配置的属性列表判定
        const checkStats = Array.isArray(b.checkStats) && b.checkStats.length > 0
          ? b.checkStats
          : ["wuxing", "qiyun"];
        const statBonusMulRaw = Number(b.statBonusMul);
        const statBonusMul = Number.isFinite(statBonusMulRaw) ? statBonusMulRaw : 1;
        const statSum = checkStats.reduce((sum, statKey) => sum + Number(s.stats[statKey] || 0), 0);
        const statScore = statSum * statBonusMul;
        const threshold = (s.realmIdx * 2 + 1) * 10;
        const statText = checkStats
          .map(statKey => `${cfg.rules.statLabels?.[statKey] || statKey}=${Number(s.stats[statKey] || 0)}`)
          .join("，");

        if (statScore > threshold) {
          // 突破成功
          const gain = (s.realmIdx + 1) * successTizhiGainMulValue;
          s.realmIdx++;
          s.cultivation = 0;
          s.stats.tizhi += gain;
          s.stats.tianfu += successTianfuGainValue;
          this.log(
            `突破瓶颈！判定【${statText}，倍率x${statBonusMul}=${statScore}】超过阈值【${threshold}】，晋升【${cfg.realms[s.realmIdx]}】！体质+${gain}。`,
            "c-legend"
          );
        } else {
          // 第二阶段判定失败，计入失败但不扣体质（只扣修为）
          s.cultivation *= failCultivationKeepValue;
          s.failCount++;
          this.log(
            `冲击【${cfg.realms[s.realmIdx + 1]}】失败！判定【${statText}，倍率x${statBonusMul}=${statScore}】未超过阈值【${threshold}】，修为损失${failPercentText}%。`,
            "c-death"
          );
        }
      } else {
        // 第一阶段判定失败
        const loss = (s.realmIdx + 1) * failTizhiLossMulValue;
        s.cultivation *= failCultivationKeepValue;
        s.stats.tizhi -= loss;
        s.failCount++;
        this.log(
          `冲击【${cfg.realms[s.realmIdx + 1]}】失败！气血逆流，<span style="color:red">体质-${loss}</span>。`,
          "c-death"
        );

        if (s.stats.tizhi <= 0) {
          this.die(`冲击【${cfg.realms[s.realmIdx + 1]}】失败，气血攻心而亡。`);
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
            
            // 正面事件受气运加成：基础概率 + 气运×0.05%，最高加成50%
            if (eventType === "positive") {
              const qiyunBonus = Math.min((s.stats.qiyun || 0) * 0.0005, 0.5); // 0.05% = 0.0005，最高50%
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

      // 负面事件豁免判定：气运超过阈值时直接化险为夷
      if (eventType === "negative") {
        const threshold = this.getQiyunExemptionThreshold(s.realmIdx);
        if ((s.stats.qiyun || 0) > threshold) {
          this.log(`${s.age}岁：${hit.text}，但你的气运让你化险为夷！`, "c-legend");
          return;
        }
      }

      if (hit.text.includes("南宫婉") || hit.text.includes("合欢宗")) {
        s.hasTriggeredRomance = true;
      }
      // 追踪"不可描述的事"事件（南宫婉/韩立）
      if (hit.text.includes("不可描述的事")) {
        s.hasTriggeredIndescribable = true;
      }
      // 追踪合欢宗事件次数
      if (hit.text.includes("被合欢宗")) {
        s.hehuanzongCount = (s.hehuanzongCount || 0) + 1;
      }

      applyEffects(s, hit.effects, hit.chance);
      if (s.cultivation < 0) s.cultivation = 0;

      let txt = hit.text;
      if (!txt.includes("岁")) txt = `${s.age}岁：${txt}`;

      let colorClass = hit.color || this.getEventColor(hit.chance || 1, eventType);
      if (eventType === "death") colorClass = "c-death";
      this.log(txt, colorClass);

      if (eventType === "death") {
        this.handleDeathEvent(hit);
      }
    },

    handleDeathEvent(event) {
      const s = this.state;

      // 死亡事件豁免：气运超过阈值时直接化险为夷
      const threshold = this.getQiyunExemptionThreshold(s.realmIdx);
      if ((s.stats.qiyun || 0) > threshold) {
        this.log(`${s.age}岁：${event.text}，但你的气运让你化险为夷！`, "c-legend");
        return;
      }

      // 体质扣除：取基础数值和体质80%中较大的那个
      const baseDamage = (s.realmIdx + 1) * 10;
      const tizhiPercentDamage = Math.floor(s.stats.tizhi * 0.8);
      const damage = Math.max(baseDamage, tizhiPercentDamage);
      s.stats.tizhi -= damage;
      s.deathEventCount = (s.deathEventCount || 0) + 1;

      if (s.stats.tizhi <= 0) {
        this.die(`${event.text}（体质-${damage}）`);
      } else {
        this.log(`${event.text}（体质-<span style="color:red">${damage}</span>）`, "c-death");
        this.log("你顽强地活了下来！", "c-legend");
      }
    },

    getEventColor(prob, eventType) {
      // 正面事件按概率分级：金 > 紫 > 粉 > 绿
      if (eventType === "positive") {
        if (prob < 0.005) return "c-gold";      // 最稀有：金色
        if (prob < 0.01) return "c-purple";     // 次之：紫色
        if (prob < 0.02) return "c-pink";       // 再次：粉色
        return "c-green";                        // 最普通：绿色
      }
      // 其他事件使用通用颜色分级
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

      // 优先判定：如果真仙境界，优先给予"仙帝"称号
      const xianDi = matchedTitles.find(t => t.name === "仙帝");
      if (xianDi) {
        // 如果仙帝未解锁，优先解锁；如果已解锁，优先展示
        return xianDi;
      }

      if (unownedMatched.length > 0) {
        return unownedMatched[0];
      }
      if (matchedTitles.length > 0) return matchedTitles[0];
      return cfg.titles[cfg.titles.length - 1];
    },

    renderSettlement(myTitle, reason, isNewTitle) {
      const tEl = document.getElementById("end-title");
      // 如果是新称号，添加"新！"标签
      if (isNewTitle) {
        tEl.innerHTML = `${myTitle.name}<span class="new-title-badge">新！</span>`;
      } else {
        tEl.innerText = myTitle.name;
      }
      tEl.style.color = myTitle.color;

      document.getElementById("end-title-desc").innerText = myTitle.desc;
      document.getElementById("end-age").innerText = this.state.age;
      document.getElementById("end-realm").innerText = cfg.realms[this.state.realmIdx];
      document.getElementById("end-gen").innerText = this.data.gen;
      document.getElementById("end-reason").innerText = `死因：${reason}`;
      
      // 显示转世福泽
      const bonusEl = document.getElementById("end-reincarnation-bonus");
      if (bonusEl && this.data.highestStatFromLastLife) {
        const statName = cfg.rules.statLabels[this.data.highestStatFromLastLife] || this.data.highestStatFromLastLife;
        bonusEl.innerText = `转世福泽：下一世${statName}+1`;
        bonusEl.style.display = "block";
      }
    },

    finalizeDeath(reason, options) {
      const finalReason = reason || "体质耗尽，魂飞魄散。";
      const opts = options || {};

      this.state.isDead = true;
      this.state.deathReason = finalReason;
      clearInterval(this.state.timer);

      document.getElementById("btn-settle").classList.remove("hidden");
      this.data.gen++;

      // 计算是否有属性（除体质外）低于初始值，用于"出道即巅峰"称号
      const s = this.state;
      const declinedStats = (
        (s.stats.tianfu < s.baseStats.tianfu ? 1 : 0) +
        (s.stats.wuxing < s.baseStats.wuxing ? 1 : 0) +
        (s.stats.qiyun < s.baseStats.qiyun ? 1 : 0)
      );

      // 记录本世最高属性，用于下一世继承
      const finalStats = s.stats;
      let maxStatValue = -Infinity;
      let maxStatName = null;
      for (const [key, value] of Object.entries(finalStats)) {
        if (value > maxStatValue) {
          maxStatValue = value;
          maxStatName = key;
        }
      }
      this.data.highestStatFromLastLife = maxStatName;

      const context = {
        ...this.state,
        deathReason: finalReason,
        declinedStats,
        always: true
      };
      const myTitle = this.resolveTitle(context);

      const isNewTitle = !this.data.titles.includes(myTitle.name);
      if (isNewTitle) {
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

      this.renderSettlement(myTitle, finalReason, isNewTitle);
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

    // 生成二维码并返回 canvas 元素
    createQRCodeCanvas() {
      if (typeof qrcode === "undefined") return null;

      // 生成二维码
      const url = "https://jiajinyu.github.io/xiuxian-simulator/app/index.html";
      const qr = qrcode(0, "M");
      qr.addData(url);
      qr.make();

      // 创建 canvas
      const size = 80;
      const cellSize = size / qr.getModuleCount();
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");

      // 绘制深木色背景（与游戏背景协调）
      ctx.fillStyle = "#2b1d14";
      ctx.fillRect(0, 0, size, size);

      // 绘制二维码模块（羊皮纸色，与游戏文字协调）
      ctx.fillStyle = "#dccbb5";
      for (let row = 0; row < qr.getModuleCount(); row++) {
        for (let col = 0; col < qr.getModuleCount(); col++) {
          if (qr.isDark(row, col)) {
            ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
          }
        }
      }

      return canvas;
    },

    // 创建分享区域元素
    createShareFooter() {
      const footer = document.createElement("div");
      footer.className = "share-footer";
      footer.id = "share-footer-temp";

      const gameName = document.createElement("div");
      gameName.className = "game-name";
      gameName.innerText = "修仙模拟器";

      const qrContainer = document.createElement("div");
      qrContainer.className = "qr-container";

      const qrCanvas = this.createQRCodeCanvas();
      if (qrCanvas) {
        qrContainer.appendChild(qrCanvas);
      }

      footer.appendChild(gameName);
      footer.appendChild(qrContainer);

      return footer;
    },

    showSettlement() {
      document.getElementById("settlement-modal").style.display = "flex";
      trackFunnelStep("settlement_view", 5, {
        title: this.state.lastTitle || "unknown"
      });
    },

    async shareSettlement() {
      const content = document.getElementById("settlement-content");
      if (!content) return;

      // 动态添加分享区域
      const shareFooter = this.createShareFooter();
      content.appendChild(shareFooter);

      try {
        // 使用 html2canvas 截图
        const canvas = await html2canvas(content, {
          backgroundColor: "#2b1d14",
          scale: 2,
          useCORS: true,
          allowTaint: true
        });

        // 转换为图片数据
        const imageData = canvas.toDataURL("image/png");

        // 尝试使用 Web Share API (移动端)
        if (navigator.share && navigator.canShare) {
          try {
            const response = await fetch(imageData);
            const blob = await response.blob();
            const file = new File([blob], "修仙结算.png", { type: "image/png" });

            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                title: "修仙模拟器 - 生平结算",
                text: `我在修仙模拟器中获得了【${this.state.lastTitle || "无名小卒"}】的称号！`,
                files: [file]
              });
              return;
            }
          } catch {
            // 分享失败，回退到下载
          }
        }

        // 回退：下载图片
        const link = document.createElement("a");
        link.download = `修仙结算_${this.state.age}岁_${this.state.lastTitle || "无名小卒"}.png`;
        link.href = imageData;
        link.click();
      } catch {
        alert("截图失败，请重试");
      } finally {
        // 无论成功失败，都移除分享区域
        const tempFooter = document.getElementById("share-footer-temp");
        if (tempFooter) {
          tempFooter.remove();
        }
      }
    },

    showSettlementDirectly(reason) {
      this.finalizeDeath(reason || "体质耗尽，魂飞魄散。", { showSettlement: true });
    }
  };

  window.game = game;
  game.init();
})();
