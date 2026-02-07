// 运营模板（复制本文件内容覆盖 game-config.js 即可生效）
// 注意：
// 1) 保留英文符号，不要写中文引号。
// 2) 每一行后面的逗号要保持正确。
// 3) 修改后刷新页面验证。

window.GAME_CONFIG = {
  version: "ops-template-v1",

  // 全局数值（先改这里）
  rules: {
    startPoints: 20,
    tickMs: 300,
    oldAgeStart: 100,
    oldAgeStep: 10,
    oldAgeTizhiLoss: 1,
    baseStats: { tianfu: 0, wuxing: 0, tizhi: 0, qiyun: 0 },
    breakthrough: {
      reqBase: 150,
      baseChance: 80,
      perRealmPenalty: 8,
      statBonusMul: 2,
      successTizhiGainMul: 4,
      successTianfuGain: 2,
      failTizhiLossMul: 3,
      failCultivationKeep: 0.7,
      checkStats: ["wuxing", "qiyun"]
    },
    filler: {
      cultivationFromTianfuMul: 3,
      minCultivationGain: 1
    },
    debug: {
      logCultivationDeltaPerTick: false
    },
    statLabels: {
      tianfu: "天赋",
      wuxing: "悟性",
      tizhi: "体质",
      qiyun: "气运"
    }
  },

  // 境界名称（按顺序）
  realms: ["凡人", "炼气", "筑基", "金丹", "元婴", "化神", "炼虚", "合体", "大乘", "渡劫", "真仙"],

  // 天赋库
  talents: [
    { name: "模板-正向", type: "positive", desc: "天赋+2，气运+1", effects: [{ field: "stats.tianfu", add: 2 }, { field: "stats.qiyun", add: 1 }] },
    { name: "模板-负向", type: "negative", desc: "体质-2", effects: [{ field: "stats.tizhi", add: -2 }] },
    { name: "模板-中性", type: "neutral", desc: "悟性+2，体质-1", effects: [{ field: "stats.wuxing", add: 2 }, { field: "stats.tizhi", add: -1 }] }
  ],

  // 未触发事件时的保底文案
  fillers: [
    "你在洞府内打坐修炼，灵气缓慢流转。",
    "你整理储物袋，默默盘算下一次历练。",
    "你观摩古籍残卷，若有所悟。"
  ],

  // 称号（按顺序检查，第一个命中即生效；最后一条建议保底）
  titles: [
    {
      name: "天命之子",
      color: "#ffd700",
      desc: "达成条件：气运>25",
      condition: { all: [{ field: "stats.qiyun", op: ">", value: 25 }] }
    },
    {
      name: "短命鬼",
      color: "#888",
      desc: "达成条件：10岁前夭折",
      condition: { all: [{ field: "age", op: "<", value: 10 }] }
    },
    {
      name: "键盘侠",
      color: "#ff77ff",
      desc: "达成条件：死因包含“键盘”",
      condition: { all: [{ field: "deathReason", op: "includes", value: "键盘" }] }
    },
    {
      name: "无名小卒",
      color: "#fff",
      desc: "达成条件：平平淡淡过一生",
      condition: { all: [{ field: "always", op: "==", value: true }] }
    }
  ],

  // 事件库
  events: [
    // 固定年龄事件（每次必触发）
    { text: "0岁：你出生了。", trigger: { all: [{ field: "age", op: "==", value: 0 }] } },

    // 随机事件（chance 越大越容易触发）
    {
      text: "你在山中采药，收获颇丰。",
      chance: 0.02,
      color: "c-green",
      effects: [{ field: "cultivation", add: 120 }]
    },
    {
      text: "你与妖兽交战受伤，体质-2。",
      chance: 0.015,
      color: "c-death",
      effects: [{ field: "stats.tizhi", add: -2 }]
    },

    // 条件事件（满足条件才参与抽取）
    {
      text: "你顿悟剑道，悟性+2。",
      chance: 0.01,
      trigger: { all: [{ field: "realmIdx", op: ">=", value: 2 }] },
      effects: [{ field: "stats.wuxing", add: 2 }]
    },

    // 死亡事件
    {
      text: "你走火入魔，经脉尽断，当场身亡。",
      chance: 0.001,
      isDeath: true
    }
  ]
};
