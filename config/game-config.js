// 运营编辑说明：
// 1) 只改这个文件，不要改 game-engine.js。
// 2) 数值调整：改 rules 下面的数字。
// 3) 新增事件：复制 events 里任意一条，改 text/chance/trigger/effects。
// 4) 新增称号：复制 titles 里任意一条，改 name/desc/condition。
//
// condition/trigger 规则格式：
// { all: [ { field: "stats.qiyun", op: ">", value: 10 } ] }
//
// 常见 field:
// age, realmIdx, failCount, deathReason
// stats.tianfu, stats.wuxing, stats.tizhi, stats.qiyun
//
// 常见 op:
// ==, !=, >, >=, <, <=, includes, includesAny
//
// effects 格式：
// [ { field: "stats.qiyun", add: 5 }, { field: "cultivation", add: 100 } ]

window.GAME_CONFIG = {
  version: "1.0.0",
  rules: {
    startPoints: 20,
    tickMs: 300,
    oldAgeStart: 100,
    oldAgeStep: 10,
    oldAgeTizhiLoss: 1,
    baseStats: { tianfu: 0, wuxing: 0, tizhi: 0, qiyun: 0 },
    breakthrough: {
      reqBase: 150,
      baseChance: 60,
      perRealmPenalty: 5,
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
    // 境界基础修为值 - 每次tick获取修为的基础值，与境界相关
    realmBaseCultivation: {
      0: 10,   // 凡人
      1: 15,   // 炼气
      2: 25,   // 筑基
      3: 40,   // 金丹
      4: 60,   // 元婴
      5: 85,   // 化神
      6: 115,  // 炼虚
      7: 150,  // 合体
      8: 190,  // 大乘
      9: 235,  // 渡劫
      10: 300  // 真仙
    },
    // 修为公式：基础值 * (1 + 天赋 * tianfuMultiplier)
    cultivationFormula: {
      tianfuMultiplier: 0.1  // 每点天赋增加10%修为获取
    },
    debug: {
      logCultivationDeltaPerTick: true
    },
    statLabels: {
      tianfu: "天赋",
      wuxing: "悟性",
      tizhi: "体质",
      qiyun: "气运"
    }
  },
  // 行为统计（默认关闭，填写 GA4 Measurement ID 后开启）
  analytics: {
    enabled: false,
    gaMeasurementId: "",
    funnelName: "xiuxian-core"
  },

  realms: ["凡人", "炼气", "筑基", "金丹", "元婴", "化神", "炼虚", "合体", "大乘", "渡劫", "真仙"],

  talents: [
    { name: "荒古圣体", type: "positive", desc: "体质+5，同阶无敌", effects: [{ field: "stats.tizhi", add: 5 }] },
    { name: "韩跑跑", type: "positive", desc: "气运+5，逃跑速度一流", effects: [{ field: "stats.qiyun", add: 5 }] },
    { name: "掌天瓶", type: "positive", desc: "悟性+5，催熟灵药", effects: [{ field: "stats.wuxing", add: 5 }] },
    { name: "天灵根", type: "positive", desc: "天赋+5", effects: [{ field: "stats.tianfu", add: 5 }] },

    { name: "废灵根", type: "negative", desc: "天赋-3，体质-2", effects: [{ field: "stats.tianfu", add: -3 }, { field: "stats.tizhi", add: -2 }] },
    { name: "天煞孤星", type: "negative", desc: "气运-5，克死亲友", effects: [{ field: "stats.qiyun", add: -5 }] },
    { name: "经脉郁结", type: "negative", desc: "体质-2，修炼极慢", effects: [{ field: "stats.tizhi", add: -2 }] },
    { name: "招黑体质", type: "negative", desc: "气运-3，容易被追杀", effects: [{ field: "stats.qiyun", add: -3 }] },

    { name: "莽夫", type: "neutral", desc: "体质+4，悟性-3", effects: [{ field: "stats.tizhi", add: 4 }, { field: "stats.wuxing", add: -3 }] },
    { name: "玻璃大炮", type: "neutral", desc: "天赋+4，体质-2", effects: [{ field: "stats.tianfu", add: 4 }, { field: "stats.tizhi", add: -2 }] },
    { name: "赌狗", type: "neutral", desc: "气运+5，悟性-4", effects: [{ field: "stats.qiyun", add: 5 }, { field: "stats.wuxing", add: -4 }] },
    { name: "聪明绝顶", type: "neutral", desc: "悟性+4，体质-2(秃了)", effects: [{ field: "stats.wuxing", add: 4 }, { field: "stats.tizhi", add: -2 }] }
  ],

  fillers: [
    "打坐修炼，感觉今天灵气有点稀薄。",
    "盯着洞府顶部的蜘蛛网发呆，若有所悟。",
    "试图用眼神杀死一只蚊子，失败了。",
    "整理储物袋，发现里面只有几块下品灵石。",
    "回忆起村口的二丫，叹了口气，继续修炼。",
    "练习御剑术，不小心削掉了自己的一缕头发。",
    "研读《修仙基础理论》，看睡着了。",
    "感觉心魔在蠢蠢欲动，赶紧喝了口凉水压惊。",
    "对着镜子感叹自己仙风道骨，帅气逼人。",
    "闭关中，勿扰。"
  ],

  titles: [
    { name: "仙帝", color: "#ffd700", desc: "达成条件：修炼至真仙境界", condition: { all: [{ field: "realmIdx", op: ">=", value: 10 }] } },
    { name: "半步真仙", color: "#ffaa00", desc: "达成条件：修炼至渡劫境界", condition: { all: [{ field: "realmIdx", op: "==", value: 9 }] } },
    { name: "十里坡剑神", color: "#ffd700", desc: "达成条件：炼气期活过100岁", condition: { all: [{ field: "realmIdx", op: "==", value: 1 }, { field: "age", op: ">", value: 100 }] } },
    { name: "龙套之王", color: "#fff", desc: "达成条件：化神以下，活过150岁", condition: { all: [{ field: "realmIdx", op: "<", value: 5 }, { field: "age", op: ">", value: 150 }] } },

    { name: "绝世欧皇", color: "#ffd700", desc: "达成条件：气运>30，天命之子", condition: { all: [{ field: "stats.qiyun", op: ">", value: 30 }] } },
    { name: "非酋", color: "#333", desc: "达成条件：气运<-5，脸黑如炭", condition: { all: [{ field: "stats.qiyun", op: "<", value: -5 }] } },
    { name: "万年王八", color: "#4eff4e", desc: "达成条件：体质>100，太能苟了", condition: { all: [{ field: "stats.tizhi", op: ">", value: 100 }] } },
    { name: "智商欠费", color: "#888", desc: "达成条件：悟性<0，这也想修仙？", condition: { all: [{ field: "stats.wuxing", op: "<", value: 0 }] } },

    { name: "键盘侠", color: "#ff77ff", desc: "达成条件：死于天降键盘", condition: { all: [{ field: "deathReason", op: "includes", value: "键盘" }] } },
    { name: "代码修仙", color: "#00ccff", desc: "达成条件：触发程序员事件", condition: { all: [{ field: "deathReason", op: "includesAny", value: ["程序", "Bug", "代码"] }] } },
    { name: "绿化带之主", color: "#4eff4e", desc: "达成条件：气运<0 但活过30岁", condition: { all: [{ field: "stats.qiyun", op: "<", value: 0 }, { field: "age", op: ">", value: 30 }] } },
    { name: "铁头娃", color: "#b088ff", desc: "达成条件：突破失败超过3次", condition: { all: [{ field: "failCount", op: ">", value: 3 }] } },
    { name: "短命鬼", color: "#888", desc: "达成条件：10岁前夭折", condition: { all: [{ field: "age", op: "<", value: 10 }] } },
    { name: "耐杀王", color: "#ff4444", desc: "达成条件：经历2次死亡事件未死", condition: { all: [{ field: "deathEventCount", op: ">=", value: 2 }] } },
    { name: "大魔法师", color: "#b088ff", desc: "达成条件：死时还是童子身(气运>15且无道侣)", condition: { all: [{ field: "stats.qiyun", op: ">", value: 15 }, { field: "age", op: ">", value: 30 }] } },

    { name: "韩跑跑", color: "#4d94ff", desc: "达成条件：气运>20，逃跑大师", condition: { all: [{ field: "stats.qiyun", op: ">", value: 20 }] } },
    { name: "软饭硬吃", color: "#ff77ff", desc: "达成条件：触发南宫婉或合欢宗事件", condition: { all: [{ field: "deathReason", op: "includesAny", value: ["南宫", "合欢"] }] } },
    { name: "药罐子", color: "#4eff4e", desc: "达成条件：体质<5 且活过50岁", condition: { all: [{ field: "stats.tizhi", op: "<", value: 5 }, { field: "age", op: ">", value: 50 }] } },
    { name: "版本之子", color: "#ffd700", desc: "达成条件：全属性>15", condition: { all: [{ field: "stats.tianfu", op: ">", value: 15 }, { field: "stats.wuxing", op: ">", value: 15 }, { field: "stats.tizhi", op: ">", value: 15 }, { field: "stats.qiyun", op: ">", value: 15 }] } },
    { name: "天选打工人", color: "#aaa", desc: "达成条件：死于工地或猝死", condition: { all: [{ field: "deathReason", op: "includesAny", value: ["工地", "猝死"] }] } },
    { name: "吃货", color: "#ffaa00", desc: "达成条件：死于喝奶茶或电饭煲", condition: { all: [{ field: "deathReason", op: "includesAny", value: ["奶茶", "电饭煲"] }] } },

    { name: "无名小卒", color: "#fff", desc: "达成条件：平平淡淡过一生", condition: { all: [{ field: "always", op: "==", value: true }] } }
  ],

  events: [
    { text: "0岁：你出生了。", trigger: { all: [{ field: "age", op: "==", value: 0 }] } },
    { text: "3岁：在村口玩泥巴。", trigger: { all: [{ field: "age", op: "==", value: 3 }] } },

    { text: "捡到一个绿色小瓶（掌天瓶），滴出的液体能催熟灵药！", chance: 0.005, color: "c-green", effects: [{ field: "stats.wuxing", add: 10 }, { field: "stats.qiyun", add: 10 }] },
    { text: "遇到一位名为‘厉飞雨’的友人，他虽然没有灵根，但武功盖世。", chance: 0.02, color: "c-green", trigger: { all: [{ field: "realmIdx", op: "<", value: 2 }] }, effects: [{ field: "stats.tizhi", add: 2 }] },
    { text: "遭遇强敌，你眉头一皱，退至众人身后……", chance: 0.02, color: "c-green", trigger: { all: [{ field: "realmIdx", op: ">", value: 1 }] }, effects: [{ field: "stats.qiyun", add: 2 }] },
    { text: "参加血色试炼，利用隐匿符苟到了最后，采摘了千年灵药。", chance: 0.01, color: "c-green", trigger: { all: [{ field: "realmIdx", op: "==", value: 1 }] }, effects: [{ field: "cultivation", add: 500 }, { field: "stats.wuxing", add: 2 }] },
    { text: "偶遇‘南宫婉’，发生了一些不可描述的意外...", chance: 0.005, color: "c-legend", trigger: { all: [{ field: "realmIdx", op: ">=", value: 2 }] }, effects: [{ field: "stats.tizhi", add: -5 }, { field: "stats.qiyun", add: 5 }, { field: "cultivation", add: 1000 }] },
    { text: "炼制筑基丹，炸炉了三十次终于成功。", chance: 0.03, color: "c-green", trigger: { all: [{ field: "realmIdx", op: "==", value: 1 }] }, effects: [{ field: "cultivation", add: 200 }] },
    { text: "获得【青竹蜂云剑】残片，开始修炼剑阵。", chance: 0.01, color: "c-green", trigger: { all: [{ field: "realmIdx", op: ">=", value: 3 }] }, effects: [{ field: "stats.tianfu", add: 5 }] },
    { text: "路遇墨大夫，他想夺舍你，反被你反杀。", chance: 0.02, color: "c-green", trigger: { all: [{ field: "realmIdx", op: "==", value: 0 }] }, effects: [{ field: "stats.wuxing", add: 3 }, { field: "stats.qiyun", add: 2 }] },
    { text: "在乱星海猎杀妖兽，获得了一枚六级妖丹。", chance: 0.02, color: "c-green", trigger: { all: [{ field: "realmIdx", op: ">=", value: 3 }] }, effects: [{ field: "cultivation", add: 600 }] },
    { text: "大喊一声‘道友请留步’，对方吓得落荒而逃。", chance: 0.02, color: "c-green" },

    { text: "捡到一张显卡，试图将其炼化为本命法宝，悟性+1。", chance: 0.01, color: "c-funny", effects: [{ field: "stats.wuxing", add: 1 }] },
    { text: "路边的狗看了你一眼，你觉得它在鄙视你的修为。", chance: 0.02, color: "c-funny", effects: [{ field: "stats.wuxing", add: 1 }] },
    { text: "顿悟了！原来修仙就是修个寂寞。", chance: 0.01, color: "c-funny", trigger: { all: [{ field: "stats.wuxing", op: ">", value: 10 }] }, effects: [{ field: "cultivation", add: 300 }] },
    { text: "下山历练，在路边摊买到了假冒伪劣的‘九转还魂丹’，气运-2。", chance: 0.02, color: "c-funny", effects: [{ field: "stats.qiyun", add: -2 }] },
    { text: "遭遇雷劫，你拿出一根避雷针，天道表示无语。", chance: 0.01, color: "c-funny", trigger: { all: [{ field: "realmIdx", op: ">=", value: 2 }] }, effects: [{ field: "stats.tizhi", add: 2 }] },
    { text: "发现一本《三年模拟五年修仙》，研读后修为大增。", chance: 0.02, color: "c-funny", effects: [{ field: "stats.wuxing", add: 2 }] },
    { text: "一位道友问你是否听说过'安利'，你差点被拉入传销宗门。", chance: 0.02, color: "c-funny" },
    { text: "你发现掌门的WIFI密码是'12345678'，成功蹭网修炼。", chance: 0.01, color: "c-funny", trigger: { all: [{ field: "realmIdx", op: ">=", value: 1 }] }, effects: [{ field: "cultivation", add: 50 }] },
    { text: "有人送你一把'98K'，你发现这玩意儿比飞剑好用。", chance: 0.01, color: "c-funny" },
    { text: "你试图跟妖兽讲道理，妖兽表示它只听得懂英语。", chance: 0.01, color: "c-funny" },

    { text: "喝奶茶呛到了气管，不仅没升仙，反而升天了。", chance: 0.001, isDeath: true },
    { text: "修炼时程序报错：Segmentation Fault，你的灵魂崩溃了。", chance: 0.001, isDeath: true },
    { text: "被天降键盘砸中头部，当场暴毙。", chance: 0.001, isDeath: true },
    { text: "因为太帅，被疯狂的女修们围堵踩踏致死。", chance: 0.002, trigger: { all: [{ field: "stats.tianfu", op: ">", value: 15 }] }, isDeath: true },
    { text: "忘记了呼吸，窒息而亡（这也行？）。", chance: 0.001, isDeath: true },
    { text: "被管理员封号，原因：开挂修仙。", chance: 0.001, isDeath: true },
    { text: "试图用电饭煲炼丹，发生高压爆炸。", chance: 0.002, isDeath: true },
    { text: "路过工地，被御剑飞行的‘泥头车’创死。", chance: 0.001, isDeath: true },
    { text: "熬夜修仙（真的熬夜），猝死。", chance: 0.002, isDeath: true },
    { text: "看到不可名状的代码（屎山），San值归零而亡。", chance: 0.001, trigger: { all: [{ field: "stats.wuxing", op: ">", value: 10 }] }, isDeath: true },
    { text: "被合欢宗妖女抓走，身体被掏空...", chance: 0.003, color: "c-death", trigger: { all: [{ field: "realmIdx", op: ">=", value: 2 }] }, effects: [{ field: "stats.tizhi", add: -3 }, { field: "cultivation", add: -100 }] },

    // 高天赋专属事件 - 需要天赋达到一定值才能触发
    { text: "天生异象，紫气东来三万里！你顿悟了无上大道。", chance: 0.01, color: "c-legend", trigger: { all: [{ field: "stats.tianfu", op: ">=", value: 10 }] }, effects: [{ field: "cultivation", add: 2000 }, { field: "stats.wuxing", add: 5 }] },
    { text: "梦中得仙人指点，领悟了一门失传的上古神通。", chance: 0.015, color: "c-epic", trigger: { all: [{ field: "stats.tianfu", op: ">=", value: 8 }] }, effects: [{ field: "cultivation", add: 800 }, { field: "stats.qiyun", add: 3 }] },
    { text: "你的修炼速度远超常人，宗门长老惊叹你为千年难遇的奇才。", chance: 0.02, color: "c-rare", trigger: { all: [{ field: "stats.tianfu", op: ">=", value: 6 }] }, effects: [{ field: "cultivation", add: 400 }, { field: "stats.tianfu", add: 1 }] },
    { text: "参悟天地法则时，你隐约触摸到了一丝大道真意。", chance: 0.025, color: "c-uncommon", trigger: { all: [{ field: "stats.tianfu", op: ">=", value: 4 }] }, effects: [{ field: "cultivation", add: 200 }, { field: "stats.wuxing", add: 1 }] }
  ]
};
