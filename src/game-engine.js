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

  function matchRule(context, rule) {
    const left = getByPath(context, rule.field);
    const right = rule.value;

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
      hasTriggeredRomance: false
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

      // 更新环形进度条（可选元素）
      const total = cfg.titles.length;
      const progress = unlockedCount / total;
      const galleryRing = document.getElementById("gallery-ring");
      if (galleryRing) {
        const circumference = 2 * Math.PI * 36; // r=36
        const offset = circumference - (progress * circumference);
        galleryRing.style.strokeDashoffset = offset;
      }
      const progressEl = document.getElementById("gallery-progress");
      if (progressEl) {
        progressEl.innerText = `${unlockedCount}/${total}`;
      }
    },

    backToStart() {
      document.getElementById("panel-gallery").classList.add("hidden");
      document.getElementById("panel-start").classList.remove("hidden");
    },

    // ========== 事件分类与气运系统 ==========

    getEventType(event) {
      if (event.isDeath) return 'death';
      if (event.isNegative) return 'negative';
      if (!event.effects || event.effects.length === 0) return 'filler';
      
      const hasPositive = event.effects.some(e => (e.add || 0) > 0);
      const hasNegative = event.effects.some(e => (e.add || 0) < 0);
      
      if (hasPositive && hasNegative) return 'neutral';
      if (hasNegative) return 'negative';
      return 'positive';
    },

    getQiyunExemptionThreshold(realmIdx) {
      // 公式：(境界 * 2 + 3) * 10
      return (realmIdx * 2 + 3) * 10;
    },

    // ========== 事件冷却系统 ==========

    isEventOnCooldown(eventText) {
      if (!this.state.eventCooldowns) return false;
      const cooldown = this.state.eventCooldowns[eventText];
      return !!(cooldown && cooldown > 0);
    },

    setEventCooldown(eventText, years) {
      if (!this.state.eventCooldowns) this.state.eventCooldowns = {};
      this.state.eventCooldowns[eventText] = years;
    },

    decrementEventCooldowns() {
      if (!this.state.eventCooldowns) return;
      for (const key in this.state.eventCooldowns) {
        this.state.eventCooldowns[key]--;
        if (this.state.eventCooldowns[key] <= 0) {
          delete this.state.eventCooldowns[key];
        }
      }
    },

    // ========== 天赋系统 ==========

    getTalentAffectedStats(talent) {
      const result = new Map();
      if (!talent.effects) return result;
      
      talent.effects.forEach(effect => {
        // 从 field 中提取属性名，如 "stats.tizhi" -> "tizhi"
        const fieldName = effect.field;
        if (fieldName.startsWith('stats.')) {
          const statName = fieldName.substring(6);
          if (!result.has(statName)) {
            result.set(statName, new Set());
          }
          if ((effect.add || 0) > 0) {
            result.get(statName).add('+');
          } else if ((effect.add || 0) < 0) {
            result.get(statName).add('-');
          }
        }
      });
      
      return result;
    },

    hasStatConflict(talents) {
      const allAffectedStats = new Map();
      
      for (const talent of talents) {
        const stats = this.getTalentAffectedStats(talent);
        stats.forEach((modifiers, statName) => {
          if (!allAffectedStats.has(statName)) {
            allAffectedStats.set(statName, new Set());
          }
          modifiers.forEach(mod => allAffectedStats.get(statName).add(mod));
        });
      }
      
      // 检查是否有属性同时有 + 和 -（冲突）
      // 或者同一属性被减少多次（通过检测多个天赋都有 '-'）
      for (const [statName, modifiers] of allAffectedStats) {
        if (modifiers.has('+') && modifiers.has('-')) {
          return true;
        }
      }
      
      // 检查是否有同一属性被多个天赋减少
      let negativeCount = 0;
      for (const talent of talents) {
        const stats = this.getTalentAffectedStats(talent);
        if (stats.has('tizhi') && stats.get('tizhi').has('-')) negativeCount++;
        if (stats.has('qiyun') && stats.get('qiyun').has('-')) negativeCount++;
        if (stats.has('tianfu') && stats.get('tianfu').has('-')) negativeCount++;
        if (stats.has('wuxing') && stats.get('wuxing').has('-')) negativeCount++;
      }
      
      // 检查单个属性被减少多次
      for (const statName of ['tizhi', 'qiyun', 'tianfu', 'wuxing']) {
        let count = 0;
        for (const talent of talents) {
          const stats = this.getTalentAffectedStats(talent);
          if (stats.has(statName) && stats.get(statName).has('-')) {
            count++;
          }
        }
        if (count > 1) return true;
      }
      
      return false;
    },

    sampleTalents(count) {
      const pool = [...cfg.talents];
      const selected = [];
      const maxAttempts = pool.length * 3;
      let attempts = 0;
      
      while (selected.length < count && pool.length > 0 && attempts < maxAttempts) {
        attempts++;
        const idx = Math.floor(Math.random() * pool.length);
        const candidate = pool[idx];
        
        // 检查是否与已选天赋冲突
        const testSelection = [...selected, candidate];
        if (!this.hasStatConflict(testSelection)) {
          selected.push(candidate);
          pool.splice(idx, 1);
        }
      }
      
      // 如果无法避免冲突，随机选择
      while (selected.length < count && pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        selected.push(pool[idx]);
        pool.splice(idx, 1);
      }
      
      return selected;
    },

    // ========== 死亡结算 ==========

    finalizeDeath(reason, options) {
      const opts = options || {};
      this.state.isDead = true;
      this.state.deathReason = reason;
      clearInterval(this.state.timer);

      const btnSettle = document.getElementById("btn-settle");
      btnSettle.classList.remove("hidden");
      
      if (opts.showSettlement !== false) {
        btnSettle.style.position = 'absolute';
        btnSettle.style.bottom = '10px';
        btnSettle.style.left = '10px';
        btnSettle.style.right = '10px';
        btnSettle.style.zIndex = '100';
      }

      this.data.gen++;

      const context = {
        ...this.state,
        deathReason: reason,
        always: true
      };

      const matchedTitles = cfg.titles.filter(t => matchCondition(context, t.condition));
      let myTitle = null;

      const unlockedTitles = new Set(this.data.titles);
      const unownedMatched = matchedTitles.filter(t => !unlockedTitles.has(t.name));

      if (unownedMatched.length > 0) {
        myTitle = unownedMatched[0];
      } else if (matchedTitles.length > 0) {
        myTitle = matchedTitles[0];
      } else {
        myTitle = cfg.titles[cfg.titles.length - 1];
      }

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
      trackEvent("game_over", { reason });

      const tEl = document.getElementById("end-title");
      tEl.innerText = myTitle.name;
      tEl.style.color = myTitle.color;

      document.getElementById("end-title-desc").innerText = myTitle.desc;
      document.getElementById("end-age").innerText = this.state.age;
      document.getElementById("end-realm").innerText = cfg.realms[this.state.realmIdx];
      document.getElementById("end-gen").innerText = this.data.gen;
      document.getElementById("end-reason").innerText = `死因：${reason}`;
    },

    drawTalents() {
      const list = document.getElementById("talent-list");
      list.innerHTML = "";

      const pool = this.sampleTalents(3);
      pool.forEach(t => {
        applyEffects(this.state, t.effects);

        const div = document.createElement("div");
        div.className = `talent-card ${t.type}`;
        div.innerHTML = `<span class="t-name">${t.name}</span><span class="t-desc">${t.desc}</span>`;
        list.appendChild(div);
      });

      this.state.baseStats = { ...this.state.stats };
      document.getElementById("btn-draw").classList.add("hidden");
      document.getElementById("btn-redraw")?.classList.remove("hidden");
      document.getElementById("btn-confirm-talent").classList.remove("hidden");
    },

    redrawTalents() {
      // 重置状态
      this.state.stats = { ...cfg.rules.baseStats };
      this.state.points = cfg.rules.startPoints;
      
      // 重新抽取天赋
      this.drawTalents();
      
      // 隐藏重抽按钮
      document.getElementById("btn-redraw").classList.add("hidden");
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
      } else if (delta < 0 && this.state.stats[key] > this.state.baseStats[key]) {
        this.state.stats[key]--;
        this.state.points++;
      } else if (delta < 0 && this.state.stats[key] <= this.state.baseStats[key]) {
        const statName = cfg.rules.statLabels[key];
        const baseValue = this.state.baseStats[key];
        this.showStatWarning(`${statName}受天赋影响，最低为${baseValue}点`);
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

      this.log("轮回转世，再踏仙途。", "c-legend");
      this.state.timer = setInterval(() => this.tick(), cfg.rules.tickMs);
      trackFunnelStep("game_start", 3);
    },

    togglePause() {
      this.state.paused = !this.state.paused;
      document.getElementById("btn-pause").innerText = this.state.paused ? "继续" : "暂停";
    },

    tick() {
      if (this.state.isDead || this.state.paused) return;
      const cultivationBeforeTick = this.state.cultivation;
      const statsBeforeTick = { ...this.state.stats };

      this.state.age++;
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

    triggerEvent() {
      const s = this.state;
      const context = {
        ...s,
        deathReason: s.deathReason,
        always: true
      };

      const valid = cfg.events.filter(e => matchCondition(context, e.trigger));

      let hit = valid.find(e => e.text.includes(`${s.age}岁`));
      if (!hit) {
        const shuffled = [...valid].sort(() => Math.random() - 0.5);
        for (let i = 0; i < shuffled.length; i++) {
          const e = shuffled[i];
          if (e.chance) {
            let adjustedChance = e.chance;
            if (!e.isDeath) {
              const qiyunBonus = (s.stats.qiyun || 0) * 0.001;
              adjustedChance = e.chance + qiyunBonus;
            }
            if (Math.random() < adjustedChance) {
              hit = e;
              break;
            }
          }
        }
      }

      if (!hit) {
        const filler = pickRandom(cfg.fillers);
        const realmIdx = s.realmIdx || 0;
        const baseValue = (cfg.rules.realmBaseCultivation && cfg.rules.realmBaseCultivation[realmIdx]) || 10;
        const tianfuMultiplier = (cfg.rules.cultivationFormula && cfg.rules.cultivationFormula.tianfuMultiplier) || 0.1;
        const tianfu = s.stats.tianfu || 0;
        const gain = baseValue * (1 + tianfu * tianfuMultiplier);
        
        // 处理性别特定的 filler 文本
        let text;
        if (typeof filler === 'object' && filler !== null) {
          text = (s.gender === 'female' && filler.female) ? filler.female : filler.male || filler.female || '修炼中...';
        } else {
          text = filler;
        }
        
        hit = {
          text,
          color: "c-common",
          effects: [{ field: "cultivation", add: gain }],
          _isFiller: true
        };
      }

      if (hit.requiresQiyunCheck && s.stats.qiyun < hit.minQiyun) {
        this.log(`${s.age}岁：遇到机缘但气运不足，错失良机。`, "c-common");
        return;
      }

      if (hit.text.includes("南宫婉") || hit.text.includes("合欢宗")) {
        s.hasTriggeredRomance = true;
      }

      applyEffects(s, hit.effects);
      if (s.cultivation < 0) s.cultivation = 0;

      let txt = hit.text;
      if (!txt.includes("岁")) txt = `${s.age}岁：${txt}`;

      let colorClass = hit.color || this.getEventColor(hit.chance || 1);
      if (hit.isDeath) colorClass = "c-death";
      this.log(txt, colorClass);

      if (hit.isDeath) {
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

    die(reason) {
      this.state.isDead = true;
      this.state.deathReason = reason;
      clearInterval(this.state.timer);

      document.getElementById("btn-settle").classList.remove("hidden");
      this.data.gen++;

      const context = {
        ...this.state,
        deathReason: reason,
        always: true
      };

      const matchedTitles = cfg.titles.filter(t => matchCondition(context, t.condition));
      let myTitle = null;

      const unlockedTitles = new Set(this.data.titles);
      const unownedMatched = matchedTitles.filter(t => !unlockedTitles.has(t.name));

      if (unownedMatched.length > 0) {
        myTitle = unownedMatched[0];
      } else if (matchedTitles.length > 0) {
        myTitle = matchedTitles[0];
      } else {
        myTitle = cfg.titles[cfg.titles.length - 1];
      }

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
      trackEvent("game_over", { reason });

      const tEl = document.getElementById("end-title");
      tEl.innerText = myTitle.name;
      tEl.style.color = myTitle.color;

      document.getElementById("end-title-desc").innerText = myTitle.desc;
      document.getElementById("end-age").innerText = this.state.age;
      document.getElementById("end-realm").innerText = cfg.realms[this.state.realmIdx];
      document.getElementById("end-gen").innerText = this.data.gen;
      document.getElementById("end-reason").innerText = `死因：${reason}`;
    },

    showSettlement() {
      document.getElementById("settlement-modal").style.display = "flex";
      trackFunnelStep("settlement_view", 5, {
        title: this.state.lastTitle || "unknown"
      });
    },

    showSettlementDirectly(reason) {
      this.state.isDead = true;
      this.state.deathReason = reason || "体质耗尽，魂飞魄散。";
      clearInterval(this.state.timer);
      document.getElementById("btn-settle").classList.remove("hidden");

      this.data.gen++;

      const context = {
        ...this.state,
        deathReason: this.state.deathReason,
        always: true
      };

      const matchedTitles = cfg.titles.filter(t => matchCondition(context, t.condition));
      let myTitle = null;

      const unlockedTitles = new Set(this.data.titles);
      const unownedMatched = matchedTitles.filter(t => !unlockedTitles.has(t.name));

      if (unownedMatched.length > 0) {
        myTitle = unownedMatched[0];
      } else if (matchedTitles.length > 0) {
        myTitle = matchedTitles[0];
      } else {
        myTitle = cfg.titles[cfg.titles.length - 1];
      }

      if (!this.data.titles.includes(myTitle.name)) {
        this.data.titles.push(myTitle.name);
      }

      localStorage.setItem("xiuxian_save", JSON.stringify(this.data));
      this.state.lastTitle = myTitle.name;

      const tEl = document.getElementById("end-title");
      tEl.innerText = myTitle.name;
      tEl.style.color = myTitle.color;

      document.getElementById("end-title-desc").innerText = myTitle.desc;
      document.getElementById("end-age").innerText = this.state.age;
      document.getElementById("end-realm").innerText = cfg.realms[this.state.realmIdx];
      document.getElementById("end-gen").innerText = this.data.gen;
      document.getElementById("end-reason").innerText = `死因：${this.state.deathReason}`;

      this.showSettlement();
    }
  };

  window.game = game;
  game.init();
})();
