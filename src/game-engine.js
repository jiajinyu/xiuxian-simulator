/* global setTimeout */
(function () {
  const cfg = window.GAME_CONFIG;
  if (!cfg) {
    throw new Error("GAME_CONFIG 未加载");
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
      deathReason: ""
    },

    init() {
      const saved = localStorage.getItem("xiuxian_save");
      if (saved) {
        this.data = JSON.parse(saved);
      }
      this.updateStartScreen();
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
    },

    toGallery() {
      document.getElementById("panel-start").classList.add("hidden");
      document.getElementById("panel-gallery").classList.remove("hidden");

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
      document.getElementById("gallery-ring").style.strokeDashoffset = offset;
      document.getElementById("gallery-progress").innerText = `${unlockedCount}/${total}`;
    },

    backToStart() {
      document.getElementById("panel-gallery").classList.add("hidden");
      document.getElementById("panel-start").classList.remove("hidden");
    },

    drawTalents() {
      const list = document.getElementById("talent-list");
      list.innerHTML = "";

      const pool = [...cfg.talents].sort(() => 0.5 - Math.random()).slice(0, 3);
      pool.forEach(t => {
        applyEffects(this.state, t.effects);

        const div = document.createElement("div");
        div.className = `talent-card ${t.type}`;
        div.innerHTML = `<span class="t-name">${t.name}</span><span class="t-desc">${t.desc}</span>`;
        list.appendChild(div);
      });

      this.state.baseStats = { ...this.state.stats };
      document.getElementById("btn-draw").classList.add("hidden");
      document.getElementById("btn-confirm-talent").classList.remove("hidden");
    },

    toSetup() {
      document.getElementById("panel-talent").classList.add("hidden");
      document.getElementById("panel-setup").classList.remove("hidden");
      this.renderStats();
      this.updatePoints();
    },

    renderStats() {
      const con = document.getElementById("stat-rows");
      con.innerHTML = "";
      const icons = {
        tianfu: "🎯",
        wuxing: "💡",
        tizhi: "💪",
        qiyun: "🍀"
      };
      Object.keys(cfg.rules.statLabels).forEach(key => {
        con.innerHTML += `
          <div class="stat-row">
            <div class="stat-row-info">
              <div class="stat-icon">${icons[key]}</div>
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
      }
      this.updatePoints();
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
      
      // 添加数值变化动画
      pointsEl.style.transform = "scale(1.2)";
      pointsEl.style.transition = "transform 0.2s ease";
      setTimeout(() => {
        pointsEl.style.transform = "scale(1)";
      }, 200);
      
      Object.keys(cfg.rules.statLabels).forEach(key => {
        document.getElementById(`val-${key}`).innerText = this.state.stats[key];
      });
      document.getElementById("btn-start").disabled = this.state.points !== 0;
    },

    startGame() {
      if (this.state.stats.tizhi <= 0) this.state.stats.tizhi = 1;
      document.getElementById("panel-setup").classList.add("hidden");
      document.getElementById("panel-game").classList.remove("hidden");

      this.log("轮回转世，再踏仙途。", "c-legend");
      this.state.timer = setInterval(() => this.tick(), cfg.rules.tickMs);
    },

    togglePause() {
      this.state.paused = !this.state.paused;
      document.getElementById("btn-pause").innerText = this.state.paused ? "继续" : "暂停";
    },

    tick() {
      if (this.state.isDead || this.state.paused) return;
      const cultivationBeforeTick = this.state.cultivation;

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
      this.logCultivationDelta(cultivationBeforeTick, this.state.cultivation);
      this.updateGameUI();
    },

    logCultivationDelta(before, after) {
      if (!cfg.rules.debug || !cfg.rules.debug.logCultivationDeltaPerTick) return;
      const delta = after - before;
      const sign = delta >= 0 ? "+" : "";
      this.log(
        `<span class="log-age">${this.state.age}岁</span>【调试】本回合修为 ${sign}${delta.toFixed(1)}，当前 ${after.toFixed(1)}`,
        "c-common"
      );
    },

    getBreakthroughRequirement(realmIdx) {
      const lv = realmIdx + 1;
      return lv * cfg.rules.breakthrough.reqBase * lv;
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
          if (e.chance && Math.random() < e.chance) {
            hit = e;
            break;
          }
        }
      }

      if (!hit) {
        const text = pickRandom(cfg.fillers);
        // 新修为公式：基础值 * (1 + 天赋 * 10%)
        const realmIdx = s.realmIdx || 0;
        const baseValue = (cfg.rules.realmBaseCultivation && cfg.rules.realmBaseCultivation[realmIdx]) || 10;
        const tianfuMultiplier = (cfg.rules.cultivationFormula && cfg.rules.cultivationFormula.tianfuMultiplier) || 0.1;
        const tianfu = s.stats.tianfu || 0;
        const gain = baseValue * (1 + tianfu * tianfuMultiplier);
        hit = {
          text,
          color: "c-common",
          effects: [{ field: "cultivation", add: gain }]
        };
      }

      applyEffects(s, hit.effects);
      if (s.cultivation < 0) s.cultivation = 0;

      let txt = hit.text;
      if (!txt.includes("岁")) txt = `${s.age}岁：${txt}`;

      let colorClass = hit.color || this.getEventColor(hit.chance || 1);
      if (hit.isDeath) colorClass = "c-death";
      this.log(txt, colorClass);

      if (hit.isDeath) {
        this.die(hit.text);
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

      let myTitle = cfg.titles.find(t => matchCondition(context, t.condition));
      if (!myTitle) myTitle = cfg.titles[cfg.titles.length - 1];

      if (!this.data.titles.includes(myTitle.name)) {
        this.data.titles.push(myTitle.name);
      }

      localStorage.setItem("xiuxian_save", JSON.stringify(this.data));

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
    }
  };

  window.game = game;
  game.init();
})();
