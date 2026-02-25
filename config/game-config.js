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

  // 出生性别描述
  birthDesc: {
    male: ["家族寄予厚望，为你取名添福。", "哭声洪亮，接生婆说此子日后必成大器。"],
    female: ["眉清目秀，母亲见了甚是欢喜。", "稳婆一看面相，便知日后修仙界又要多一段孽缘。"]
  },
  rules: {
    startPoints: 20,
    tickMs: 400,
    oldAgeStart: 100,
    oldAgeStep: 10,
    oldAgeTizhiLoss: 1,
    baseStats: { tianfu: 0, wuxing: 0, tizhi: 0, qiyun: 0 },
    breakthrough: {
      reqBase: 150,
      baseChance: 70,
      perRealmPenalty: 2,
      statBonusMul: 4,
      successTizhiGainMul: 4,
      successTianfuGain: 2,
      failTizhiLossMul: 2,
      failCultivationKeep: 0.8,
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
      4: 80,   // 元婴（原60，提升33%）
      5: 120,  // 化神（原85，提升41%）
      6: 170,  // 炼虚（原115，提升48%）
      7: 230,  // 合体（原150，提升53%）
      8: 300,  // 大乘（原190，提升58%）
      9: 380,  // 渡劫（原235，提升62%）
      10: 500  // 真仙（原300，提升67%）
    },
    // 修为公式：基础值 * (1 + 天赋 * tianfuMultiplier)
    cultivationFormula: {
      tianfuMultiplier: 0.08  // 每点天赋增加8%修为获取（原5%）
    },
    debug: {
      logCultivationDeltaPerTick: false,
      enableTalentTest: false  // 天赋测试模式开关，true=可无限重抽天赋，正式版改为 false
    },
    statLabels: {
      tianfu: "天赋",
      wuxing: "悟性",
      tizhi: "体质",
      qiyun: "气运"
    },
    // 属性说明（鼠标悬停显示）
    statDescriptions: {
      tianfu: "影响修为获取速度，每点天赋增加8%修为",
      wuxing: "影响突破成功率，突破时与气运共同判定",
      tizhi: "决定寿命上限，体质归零时死亡；突破成功可回复",
      qiyun: "影响奇遇概率与突破判定，高气运可豁免死亡事件"
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
    { name: "荒古圣体", type: "positive", desc: "体质+4，同阶无敌", effects: [{ field: "stats.tizhi", add: 4 }] },
    { name: "天胡开局", type: "positive", desc: "气运+4", effects: [{ field: "stats.qiyun", add: 4 }] },
    { name: "掌天瓶", type: "positive", desc: "悟性+4，催熟灵药", effects: [{ field: "stats.wuxing", add: 4 }] },
    { name: "大聪明", type: "positive", desc: "天赋+4", effects: [{ field: "stats.tianfu", add: 4 }] },

    { name: "废灵根", type: "negative", desc: "天赋-3，体质-2", effects: [{ field: "stats.tianfu", add: -3 }, { field: "stats.tizhi", add: -2 }] },
    { name: "天崩开局", type: "negative", desc: "气运-4", effects: [{ field: "stats.qiyun", add: -4 }] },
    { name: "经脉郁结", type: "negative", desc: "体质-2，修炼极慢", effects: [{ field: "stats.tizhi", add: -2 }] },
    { name: "招黑体质", type: "negative", desc: "气运-3，容易被追杀", effects: [{ field: "stats.qiyun", add: -3 }] },

    { name: "地主家的傻儿子", type: "neutral", desc: "体质+4，悟性-3", effects: [{ field: "stats.tizhi", add: 4 }, { field: "stats.wuxing", add: -3 }] },
    { name: "邪修", type: "neutral", desc: "天赋+4，体质-2", effects: [{ field: "stats.tianfu", add: 4 }, { field: "stats.tizhi", add: -2 }] },
    { name: "赌狗", type: "neutral", desc: "气运+4，悟性-4", effects: [{ field: "stats.qiyun", add: 4 }, { field: "stats.wuxing", add: -4 }] },
    { name: "聪明绝顶", type: "neutral", desc: "悟性+4，体质-2(秃了)", effects: [{ field: "stats.wuxing", add: 4 }, { field: "stats.tizhi", add: -2 }] },

    { name: "氪金大佬", type: "positive", desc: "气运+5，我也想低调，但实力不允许", effects: [{ field: "stats.qiyun", add: 5 }] },
    { name: "非酋", type: "negative", desc: "气运-5，喝凉水都塞牙，走路必踩坑", effects: [{ field: "stats.qiyun", add: -5 }] },
    { name: "熬夜冠军", type: "neutral", desc: "悟性+3，体质-3，修仙（物理）", effects: [{ field: "stats.wuxing", add: 3 }, { field: "stats.tizhi", add: -3 }] },
    { name: "键盘侠", type: "negative", desc: "悟性-3，体质-2，键道大成，只会嘴炮", effects: [{ field: "stats.wuxing", add: -3 }, { field: "stats.tizhi", add: -2 }] },
    { name: "老六", type: "positive", desc: "气运+3，悟性+1，从不刚正面，专敲闷棍", effects: [{ field: "stats.qiyun", add: 3 }, { field: "stats.wuxing", add: 1 }] },
    { name: "二哈血统", type: "neutral", desc: "体质+5，悟性-4，拆家能力一流", effects: [{ field: "stats.tizhi", add: 5 }, { field: "stats.wuxing", add: -4 }] },
    { name: "恋爱脑", type: "negative", desc: "悟性-5，心中无大道，只有那个TA", effects: [{ field: "stats.wuxing", add: -5 }] },
    { name: "干饭人", type: "neutral", desc: "体质+3，天赋-1，灵石都被拿去买吃的了", effects: [{ field: "stats.tizhi", add: 3 }, { field: "stats.tianfu", add: -1 }] },
    { name: "普信", type: "negative", desc: "气运-2，天赋-2，明明那么普通，却那么自信", effects: [{ field: "stats.qiyun", add: -2 }, { field: "stats.tianfu", add: -2 }] },
    { name: "无效努力", type: "negative", desc: "体质-2，天赋-2，每天假装修炼感动自己", effects: [{ field: "stats.tizhi", add: -2 }, { field: "stats.tianfu", add: -2 }] },
    { name: "平衡之道", type: "neutral", desc: "天赋+3，气运-2，中庸之道，不偏不倚", effects: [{ field: "stats.tianfu", add: 3 }, { field: "stats.qiyun", add: -2 }] },
    { name: "佛系青年", type: "neutral", desc: "气运+3，天赋-2，一切随缘，该来的总会来", effects: [{ field: "stats.qiyun", add: 3 }, { field: "stats.tianfu", add: -2 }] },
    { name: "平平无奇", type: "neutral", desc: "平凡也是一种特质", effects: [] }

  ],

  // 童年事件（1-10岁专属，数值增减较少）
  childhoodEvents: [
    { text: "学会走路，摇摇晃晃地扑向母亲。", chance: 0.05, color: "c-common", trigger: { all: [{ field: "age", op: ">=", value: 1 }, { field: "age", op: "<=", value: 3 }] }, effects: [{ field: "stats.tizhi", add: 1 }] },
    { text: "第一次开口说话，口齿不清地喊着'修仙'。", chance: 0.05, color: "c-common", trigger: { all: [{ field: "age", op: ">=", value: 1 }, { field: "age", op: "<=", value: 3 }] }, effects: [{ field: "stats.tianfu", add: 1 }] },
    { text: "在院子里追逐蝴蝶，摔了一跤但笑得很开心。", chance: 0.05, color: "c-common", trigger: { all: [{ field: "age", op: ">=", value: 2 }, { field: "age", op: "<=", value: 5 }] }, effects: [{ field: "stats.tizhi", add: 1 }, { field: "stats.qiyun", add: 1 }] },
    { text: "偷吃家里的灵果，肚子胀了一整天。", chance: 0.05, color: "c-funny", trigger: { all: [{ field: "age", op: ">=", value: 3 }, { field: "age", op: "<=", value: 6 }] }, effects: [{ field: "stats.tizhi", add: 1 }, { field: "stats.wuxing", add: -1 }] },
    { text: "听爷爷讲修仙故事，眼睛里闪烁着光芒。", chance: 0.05, color: "c-common", trigger: { all: [{ field: "age", op: ">=", value: 3 }, { field: "age", op: "<=", value: 7 }] }, effects: [{ field: "stats.wuxing", add: 1 }] },
    { text: "和邻居小孩打架，打赢了但也挂彩了。", chance: 0.05, color: "c-common", trigger: { all: [{ field: "age", op: ">=", value: 4 }, { field: "age", op: "<=", value: 8 }] }, effects: [{ field: "stats.tizhi", add: 1 }, { field: "stats.qiyun", add: -1 }] },
    { text: "在溪边捡到一颗漂亮的石头，当作宝贝收藏。", chance: 0.04, color: "c-uncommon", trigger: { all: [{ field: "age", op: ">=", value: 4 }, { field: "age", op: "<=", value: 8 }] }, effects: [{ field: "stats.qiyun", add: 2 }] },
    { text: "被父亲逼着背诵《三字经》，背得磕磕巴巴。", chance: 0.05, color: "c-common", trigger: { all: [{ field: "age", op: ">=", value: 5 }, { field: "age", op: "<=", value: 8 }] }, effects: [{ field: "stats.wuxing", add: 1 }] },
    { text: "帮家里喂鸡，被大公鸡追着跑了半个村子。", chance: 0.05, color: "c-funny", trigger: { all: [{ field: "age", op: ">=", value: 5 }, { field: "age", op: "<=", value: 9 }] }, effects: [{ field: "stats.tizhi", add: 1 }] },
    { text: "第一次尝试打坐，结果坐着睡着了。", chance: 0.05, color: "c-funny", trigger: { all: [{ field: "age", op: ">=", value: 6 }, { field: "age", op: "<=", value: 10 }] }, effects: [{ field: "cultivation", add: 10 }, { field: "stats.wuxing", add: 1 }] },
    { text: "在山脚下发现一株野生草药，卖了个好价钱。", chance: 0.04, color: "c-uncommon", trigger: { all: [{ field: "age", op: ">=", value: 6 }, { field: "age", op: "<=", value: 10 }] }, effects: [{ field: "stats.qiyun", add: 1 }, { field: "cultivation", add: 15 }] },
    { text: "跟村里的武师学了一套拳法，练得有模有样。", chance: 0.04, color: "c-uncommon", trigger: { all: [{ field: "age", op: ">=", value: 7 }, { field: "age", op: "<=", value: 10 }] }, effects: [{ field: "stats.tizhi", add: 2 }] },
    { text: "发了一场高烧，梦里似乎看到了仙人。", chance: 0.03, color: "c-rare", trigger: { all: [{ field: "age", op: ">=", value: 2 }, { field: "age", op: "<=", value: 6 }] }, effects: [{ field: "stats.tianfu", add: 2 }, { field: "stats.tizhi", add: -1 }] },
    { text: "偷偷下河游泳，差点被水冲走。", chance: 0.04, color: "c-funny", trigger: { all: [{ field: "age", op: ">=", value: 5 }, { field: "age", op: "<=", value: 9 }] }, effects: [{ field: "stats.tizhi", add: 1 }, { field: "stats.qiyun", add: -1 }] },
    { text: "过生日时长辈送了一块平安符。", chance: 0.04, color: "c-uncommon", trigger: { all: [{ field: "age", op: ">=", value: 3 }, { field: "age", op: "<=", value: 8 }] }, effects: [{ field: "stats.qiyun", add: 2 }] },
    { text: "躺在草地上数星星，不知不觉睡着了。", chance: 0.05, color: "c-common", trigger: { all: [{ field: "age", op: ">=", value: 4 }, { field: "age", op: "<=", value: 9 }] }, effects: [{ field: "stats.wuxing", add: 1 }] },
    { text: "被村里的恶犬追赶，爬上了树才脱险。", chance: 0.04, color: "c-funny", trigger: { all: [{ field: "age", op: ">=", value: 5 }, { field: "age", op: "<=", value: 9 }] }, effects: [{ field: "stats.tizhi", add: 1 }, { field: "stats.qiyun", add: -1 }] },
    { text: "第一次学写字，毛笔字歪歪扭扭像蚯蚓。", chance: 0.05, color: "c-common", trigger: { all: [{ field: "age", op: ">=", value: 5 }, { field: "age", op: "<=", value: 8 }] }, effects: [{ field: "stats.wuxing", add: 1 }] },
    { text: "帮母亲捶背，被夸奖是个懂事的孩子。", chance: 0.05, color: "c-common", trigger: { all: [{ field: "age", op: ">=", value: 6 }, { field: "age", op: "<=", value: 10 }] }, effects: [{ field: "stats.tizhi", add: 1 }, { field: "stats.qiyun", add: 1 }] },
    { text: "雨后捉到一只大蚯蚓，吓得甩到了妹妹脸上。", chance: 0.04, color: "c-funny", trigger: { all: [{ field: "age", op: ">=", value: 4 }, { field: "age", op: "<=", value: 8 }] }, effects: [{ field: "stats.tizhi", add: 1 }, { field: "stats.wuxing", add: -1 }] }
  ],

  // 童年专用填充文本（1-10岁未触发事件时使用）
  childhoodFillers: [
    "在院子里追着蜻蜓跑了一整天。",
    "和小伙伴玩捉迷藏，躲在草垛里睡着了。",
    "趴在父亲膝头听他讲村里的趣事。",
    "用树枝在地上画着想象中的飞剑。",
    "抱着母亲的腿撒娇，讨要糖葫芦。"
  ],

  fillers: [
    "打坐修炼，感觉今天灵气有点稀薄。",
    "盯着洞府顶部的蜘蛛网发呆，若有所悟。",
    "试图用眼神杀死一只蚊子，失败了。",
    "整理储物袋，发现里面只有几块下品灵石。",
    { male: "回忆起村口的二丫，叹了口气，继续修炼。", female: "想起当年相亲的村头的二狗子，吓出一身冷汗，赶紧多运转了一个大周天压压惊。" },
    "练习御剑术，不小心削掉了自己的一缕头发。",
    "研读《修仙基础理论》，看睡着了。",
    "感觉心魔在蠢蠢欲动，赶紧喝了口凉水压惊。",
    { male: "对着镜子感叹自己仙风道骨，帅气逼人。", female: "对着镜子苦恼自己长得太红颜祸水，怕是出门又要引发宗门大战。" },
    "闭关中，勿扰。"
  ],

  titles: [
    { name: "仙帝", color: "#ffd700", desc: "达成条件：修炼至真仙境界", condition: { all: [{ field: "realmIdx", op: ">=", value: 10 }] } },
    { name: "半步真仙", color: "#ffaa00", desc: "达成条件：修炼至渡劫境界", condition: { all: [{ field: "realmIdx", op: "==", value: 9 }] } },
    { name: "十里坡剑神", color: "#ffd700", desc: "达成条件：炼气期活过100岁", condition: { all: [{ field: "realmIdx", op: "==", value: 1 }, { field: "age", op: ">", value: 100 }] } },
    { name: "龙套之王", color: "#fff", desc: "达成条件：元婴以下，活过150岁", condition: { all: [{ field: "realmIdx", op: "<", value: 4 }, { field: "age", op: ">", value: 150 }] } },

    { name: "绝世欧皇", color: "#ffd700", desc: "达成条件：气运>150，天命之子", condition: { all: [{ field: "stats.qiyun", op: ">", value: 150 }] } },
    { name: "非酋", color: "#333", desc: "达成条件：气运<-5，脸黑如炭", condition: { all: [{ field: "stats.qiyun", op: "<", value: -5 }] } },
    { name: "万年王八", color: "#4eff4e", desc: "达成条件：死亡时>300岁，太能苟了", condition: { all: [{ field: "age", op: ">", value: 300 }] } },
    { name: "智商欠费", color: "#888", desc: "达成条件：死亡时悟性<10", condition: { all: [{ field: "stats.wuxing", op: "<", value: 10 }] } },

    { name: "键盘侠", color: "#ff77ff", desc: "达成条件：死于天降键盘", condition: { all: [{ field: "deathReason", op: "includes", value: "键盘" }] } },
    { name: "代码修仙", color: "#00ccff", desc: "达成条件：触发程序员事件", condition: { all: [{ field: "deathReason", op: "includesAny", value: ["程序", "Bug", "代码"] }] } },
    { name: "绿化带之主", color: "#4eff4e", desc: "达成条件：气运<0 但活过30岁", condition: { all: [{ field: "stats.qiyun", op: "<", value: 0 }, { field: "age", op: ">", value: 30 }] } },
    { name: "铁头娃", color: "#b088ff", desc: "达成条件：突破失败超过3次", condition: { all: [{ field: "failCount", op: ">", value: 3 }] } },
    { name: "就这？", color: "#888", desc: "达成条件：10岁前夭折", condition: { all: [{ field: "age", op: "<", value: 10 }] } },
    { name: "耐杀王", color: "#ff4444", desc: "达成条件：经历2次死亡事件未死", condition: { all: [{ field: "deathEventCount", op: ">=", value: 2 }] } },
    { name: "大魔法师", color: "#b088ff", desc: "达成条件：死时还是童子身(气运>15、年龄>30且未触发南宫婉或合欢宗事件)", condition: { all: [{ field: "stats.qiyun", op: ">", value: 15 }, { field: "age", op: ">", value: 30 }, { field: "hasTriggeredRomance", op: "==", value: false }] } },

    { name: "金刚芭比", color: "#ff69b4", desc: "达成条件：游戏过程中体质曾经超过100且性别为女", condition: { all: [{ field: "maxTizhi", op: ">", value: 100 }, { field: "gender", op: "==", value: "female" }] } },
    { name: "软饭硬吃", color: "#ff77ff", desc: "达成条件：触发'不可描述的事'且'合欢宗'事件>5次", condition: { all: [{ field: "hasTriggeredIndescribable", op: "==", value: true }, { field: "hehuanzongCount", op: ">", value: 5 }] } },
    { name: "凡人修仙", color: "#4eff4e", desc: "达成条件：体质<5 且活过50岁", condition: { all: [{ field: "stats.tizhi", op: "<", value: 5 }, { field: "age", op: ">", value: 50 }] } },
    { name: "摸鱼大师", color: "#87CEEB", desc: "达成条件：年龄超过100岁但还在金丹以下摸鱼", condition: { all: [{ field: "age", op: ">", value: 100 }, { field: "realmIdx", op: "<=", value: 3 }] } },
    { name: "天选打工人", color: "#aaa", desc: "达成条件：死于工地或猝死", condition: { all: [{ field: "deathReason", op: "includesAny", value: ["老板", "猝死"] }] } },
    { name: "吃货", color: "#ffaa00", desc: "达成条件：死于喝奶茶或电饭煲", condition: { all: [{ field: "deathReason", op: "includesAny", value: ["奶茶", "电饭煲"] }] } },

    { name: "无名小卒", color: "#fff", desc: "达成条件：平平淡淡过一生", condition: { all: [{ field: "always", op: "==", value: true }] } },
    { name: "逆天改命", color: "#ff4444", desc: "达成条件：开局3个天赋均为负面天赋，却活过了筑基期", condition: { all: [{ field: "startTalentTypes", op: "every", value: "negative" }, { field: "realmIdx", op: ">=", value: 2 }] } },
    { name: "平平无奇", color: "#aaa", desc: "达成条件：开局3个天赋均为中性天赋，却活过了筑基期", condition: { all: [{ field: "startTalentTypes", op: "every", value: "neutral" }, { field: "realmIdx", op: ">=", value: 2 }] } },
    { name: "天妒英才", color: "#8b0000", desc: "达成条件：起手3个正面天赋，却没有活过筑基期", condition: { all: [{ field: "startTalentTypes", op: "every", value: "positive" }, { field: "realmIdx", op: "<", value: 2 }] } },
    { name: "出道即巅峰", color: "#ffd700", desc: "达成条件：死时除体质外任意一属性小于初始值", condition: { all: [{ field: "declinedStats", op: ">", value: 0 }] } }
  ],

  events: [
    { text: "0岁：你出生了。", trigger: { all: [{ field: "age", op: "==", value: 0 }] } },
    { text: "3岁：在村口玩泥巴。", trigger: { all: [{ field: "age", op: "==", value: 3 }] } },

    { text: "捡到一个绿色小瓶，滴出的液体能催熟灵药！", chance: 0.005, color: "c-green", effects: [{ field: "stats.wuxing", add: 10 }, { field: "stats.qiyun", add: 10 }] },
    { text: "遇到一位名为‘厉飞雨’的友人，从此种下了心魔", chance: 0.02, color: "c-green", trigger: { all: [{ field: "realmIdx", op: "<", value: 2 }] }, effects: [{ field: "stats.tizhi", add: 2 }] },
    { text: "遭遇强敌，你眉头一皱，退至众人身后……", chance: 0.02, color: "c-green", trigger: { all: [{ field: "realmIdx", op: ">", value: 1 }] }, effects: [{ field: "stats.qiyun", add: 2 }] },
    { text: "参加血色试炼，利用隐匿符苟到了最后，采摘了千年灵药。", chance: 0.01, color: "c-green", trigger: { all: [{ field: "realmIdx", op: "==", value: 1 }] }, effects: [{ field: "cultivation", add: 500 }, { field: "stats.wuxing", add: 2 }] },
    { text: "偶遇‘南宫婉’，发生了一些不可描述的事...", chance: 0.005, color: "c-legend", trigger: { all: [{ field: "realmIdx", op: ">=", value: 2 }, { field: "gender", op: "==", value: "male" }] }, effects: [{ field: "stats.tizhi", add: -5 }, { field: "stats.qiyun", add: 5 }, { field: "cultivation", add: 1000 }] },
    { text: "偶遇'韩立'，发生了一些不可描述的事...", chance: 0.005, color: "c-legend", trigger: { all: [{ field: "realmIdx", op: ">=", value: 2 }, { field: "gender", op: "==", value: "female" }] }, effects: [{ field: "stats.tizhi", add: -5 }, { field: "stats.qiyun", add: 5 }, { field: "cultivation", add: 1000 }] },
    { text: "炼制筑基丹，炸炉了三十次终于成功。", chance: 0.03, color: "c-green", trigger: { all: [{ field: "realmIdx", op: "==", value: 1 }] }, effects: [{ field: "cultivation", add: 200 }] },
    { text: "获得一本秘籍，第一页写着“欲练此功……”", chance: 0.01, color: "c-green", trigger: { all: [{ field: "realmIdx", op: ">=", value: 3 }, { field: "gender", op: "==", value: "male" }] }, effects: [{ field: "stats.tianfu", add: 5 }] },
    { text: "借高利贷炒“飞剑股”失败，被钱庄打手堵在洞府门口活活打死。", chance: 0.02, color: "c-green", trigger: { all: [{ field: "realmIdx", op: "==", value: 0 }] }, effects: [{ field: "stats.wuxing", add: 3 }, { field: "stats.qiyun", add: 2 }] },
    { text: "在乱星海猎杀妖兽，获得了一枚六级妖丹。", chance: 0.02, color: "c-green", trigger: { all: [{ field: "realmIdx", op: ">=", value: 3 }] }, effects: [{ field: "cultivation", add: 600 }] },
    { text: "大喊一声‘道友请留步’，对方吓得落荒而逃。", chance: 0.02, color: "c-green" },

    { text: "捡到一张显卡【9090】，试图将其炼化为本命法宝，悟性+1。", chance: 0.01, color: "c-funny", effects: [{ field: "stats.wuxing", add: 1 }] },
    { text: "路边的狗看了你一眼，你觉得它在鄙视你的修为。", chance: 0.02, color: "c-funny", effects: [{ field: "stats.wuxing", add: 1 }] },
    { text: "顿悟了！原来修仙就是修个寂寞。", chance: 0.01, color: "c-funny", trigger: { all: [{ field: "stats.wuxing", op: ">", value: 10 }] }, effects: [{ field: "cultivation", add: 300 }] },
    { text: "下山历练，在路边摊买到了假冒伪劣的‘九转还魂丹’，气运-2。", chance: 0.02, color: "c-funny", effects: [{ field: "stats.qiyun", add: -2 }] },
    { text: "遭遇雷劫，你拿出一根避雷针，天道表示无语。", chance: 0.01, color: "c-funny", trigger: { all: [{ field: "realmIdx", op: ">=", value: 2 }] }, effects: [{ field: "stats.tizhi", add: 2 }] },
    { text: "发现一本《三年修仙五年元婴》，研读后修为大增。", chance: 0.02, color: "c-funny", effects: [{ field: "stats.wuxing", add: 2 }] },
    { text: "一位道友问你是否听说过'安利'，你差点被拉入传销宗门。", chance: 0.02, color: "c-funny" },
    { text: "你发现掌门的WIFI密码是'12345678'，成功蹭网修炼。", chance: 0.01, color: "c-funny", trigger: { all: [{ field: "realmIdx", op: ">=", value: 1 }] }, effects: [{ field: "cultivation", add: 50 }] },
    { text: "有人送你一把'98K'，你发现这玩意儿比飞剑好用。", chance: 0.01, color: "c-funny" },
    { text: "你试图跟妖兽讲道理，妖兽表示它只听得懂英语。", chance: 0.01, color: "c-funny" },

    { text: "喝奶茶呛到了气管，不仅没升仙，反而升天了。", chance: 0.001, isDeath: true },
    { text: "修炼时程序报错：Segmentation Fault，你的灵魂崩溃了。", chance: 0.001, isDeath: true },
    { text: "被天降键盘砸中头部，当场暴毙。", chance: 0.001, isDeath: true },
    { text: "因为太帅，被疯狂的女修们围堵踩踏致死。", chance: 0.002, trigger: { all: [{ field: "stats.tianfu", op: ">", value: 15 }] }, isDeath: true },
    { text: "忘记了呼吸，窒息而亡（这也行？）。", chance: 0.001, isDeath: true },
    { text: "渡劫关键时刻，天道服务器连接超时，卡在半空被雷劈焦。", chance: 0.001, isDeath: true },
    { text: "试图用电饭煲炼丹，发生高压爆炸。", chance: 0.002, isDeath: true },
    { text: "御剑飞行超速，与前面的仙鹤发生惨烈追尾。", chance: 0.001, isDeath: true },
    { text: "熬夜完成炼丹KPI，猝死。", chance: 0.002, isDeath: true },
    { text: "卡BUG刷灵石被天道（老板）发现，直接被抹除数据。", chance: 0.001, trigger: { all: [{ field: "stats.wuxing", op: ">", value: 10 }] }, isDeath: true },
    { text: "被合欢宗妖女抓走，身体被掏空...", chance: 0.003, color: "c-death", trigger: { all: [{ field: "realmIdx", op: ">=", value: 2 }, { field: "gender", op: "==", value: "male" }] }, effects: [{ field: "stats.tizhi", add: -10 }, { field: "cultivation", add: -100 }] },
    { text: "被合欢宗男修抓走，身体被掏空...", chance: 0.003, color: "c-death", trigger: { all: [{ field: "realmIdx", op: ">=", value: 2 }, { field: "gender", op: "==", value: "female" }] }, effects: [{ field: "stats.tizhi", add: -10 }, { field: "cultivation", add: -100 }] },

    // 减修为搞笑事件 - 负面事件，需要气运判定豁免
    // 豁免条件：气运 > (realmIdx*2+3)*10
    { text: "修炼时走火入魔，修为倒退十年！", chance: 0.015, isNegative: true, color: "c-funny", effects: [{ field: "cultivation", percent: true }] },
    { text: "被心魔诱惑，沉迷网络游戏，荒废了修炼。", chance: 0.02, isNegative: true, color: "c-funny", effects: [{ field: "cultivation", percent: true }] },
    { text: "误食了有毒的灵果，拉肚子拉了一整天，修为尽失。", chance: 0.015, isNegative: true, color: "c-funny", effects: [{ field: "cultivation", percent: true }] },
    { text: "被一只会说话的鹦鹉骗了，把修为传给了它。", chance: 0.01, isNegative: true, color: "c-funny", effects: [{ field: "cultivation", percent: true }] },
    { text: "试图用科学方法修仙，结果走火入魔，修为大跌。", chance: 0.015, isNegative: true, color: "c-funny", effects: [{ field: "cultivation", percent: true }] },
    { text: "被一只会卖萌的妖兽骗了，把修为都用来买它的零食。", chance: 0.02, isNegative: true, color: "c-funny", effects: [{ field: "cultivation", percent: true }] },
    { text: "修炼时睡着了，醒来发现修为被老鼠偷走了。", chance: 0.02, isNegative: true, color: "c-funny", effects: [{ field: "cultivation", percent: true }] },
    { text: "试图用意念控制飞剑，结果飞剑失控，修为受损。", chance: 0.015, isNegative: true, color: "c-funny", effects: [{ field: "cultivation", percent: true }] },
    { text: "被一只会唱歌的青蛙迷惑，修为都被它吸走了。", chance: 0.01, isNegative: true, color: "c-funny", effects: [{ field: "cultivation", percent: true }] },
    { text: "试图用炼丹炉煮火锅，结果炸炉，修为倒退。", chance: 0.02, isNegative: true, color: "c-funny", effects: [{ field: "cultivation", percent: true }] },

    // 高天赋专属事件 - 需要天赋达到一定值才能触发
    { text: "天生异象，紫气东来三万里！你顿悟了无上大道。", chance: 0.01, color: "c-legend", trigger: { all: [{ field: "stats.tianfu", op: ">=", value: 10 }] }, effects: [{ field: "cultivation", add: 2000 }, { field: "stats.wuxing", add: 5 }] },
    { text: "梦中得仙人指点，领悟了一门失传的上古神通。", chance: 0.015, color: "c-epic", trigger: { all: [{ field: "stats.tianfu", op: ">=", value: 8 }] }, effects: [{ field: "cultivation", add: 800 }, { field: "stats.qiyun", add: 3 }] },
    { text: "你的修炼速度远超常人，宗门长老惊叹你为千年难遇的奇才。", chance: 0.02, color: "c-rare", trigger: { all: [{ field: "stats.tianfu", op: ">=", value: 6 }] }, effects: [{ field: "cultivation", add: 400 }, { field: "stats.tianfu", add: 1 }] },
    { text: "参悟天地法则时，你隐约触摸到了了一丝大道真意。", chance: 0.025, color: "c-uncommon", trigger: { all: [{ field: "stats.tianfu", op: ">=", value: 4 }] }, effects: [{ field: "cultivation", add: 200 }, { field: "stats.wuxing", add: 1 }] },

    // 女修专属事件 - 仅限女性角色触发
    { text: "捡到【比基尼款九天玄女甲】，穿上后因皮肤直接接触天地灵气，修炼效率翻倍。", chance: 0.01, color: "c-purple", trigger: { all: [{ field: "gender", op: "==", value: "female" }] }, effects: [{ field: "stats.tianfu", add: 3 }] },
    { text: "被魔教少主壁咚霸道示爱，你反手一个大嘴巴子将其抽飞，顿悟了'心中无男人，拔刀自然神'的真谛。", chance: 0.01, color: "c-purple", trigger: { all: [{ field: "gender", op: "==", value: "female" }] }, effects: [{ field: "stats.wuxing", add: 5 }] },
    { text: "闭关减肥饿昏了头，把师父养的'招财灵蟾'生吞了，虽然拉了三天肚子，但肉身强度暴涨。", chance: 0.01, color: "c-funny", trigger: { all: [{ field: "gender", op: "==", value: "female" }] }, effects: [{ field: "stats.tizhi", add: 10 }] },
    { text: "沉迷修仙界'盲盒'抽奖，散尽家财只抽到一堆'谢谢惠顾'的空丹瓶。", chance: 0.015, color: "c-red", trigger: { all: [{ field: "gender", op: "==", value: "female" }] }, effects: [{ field: "stats.qiyun", add: -5 }] },
    { text: "识破了绿茶师妹的'哥哥我不是故意的'装柔弱把戏，当众将其踹下擂台，念头通达，灵力暴涨。", chance: 0.012, color: "c-green", trigger: { all: [{ field: "gender", op: "==", value: "female" }] }, effects: [{ field: "cultivation", add: 50 }] },

    // 元婴期专属事件 - 达到元婴之后才可触发
    { text: "神识外放八百里，本想搜寻天材地宝，结果听了一整晚隔壁合欢宗长老的情感纠葛，道心微乱但很刺激。", chance: 0.015, color: "c-purple", trigger: { all: [{ field: "realmIdx", op: ">=", value: 4 }] }, effects: [{ field: "stats.wuxing", add: -4 }, { field: "stats.qiyun", add: 6 }] },
    { text: "偶遇绝色仙子想结善缘，神识一扫，发现对方神魂竟是个抠脚三万年的糟老头子", chance: 0.012, color: "c-funny", trigger: { all: [{ field: "realmIdx", op: ">=", value: 4 }, { field: "gender", op: "==", value: "male" }] }, effects: [{ field: "stats.wuxing", add: -2 }, { field: "stats.qiyun", add: 4 }] },
    { text: "闭关打了个盹，醒来发现自家宗门已经换了三茬掌门，现在的掌门还得管你的徒孙叫师祖，辈分乱成一锅粥。", chance: 0.01, color: "c-funny", trigger: { all: [{ field: "realmIdx", op: ">=", value: 4 }] }, effects: [{ field: "stats.wuxing", add: 6 }, { field: "stats.qiyun", add: -2 }] },
    { text: "终于明白了'道生一，一生二'原来就是二进制，你对大道的理解达到了全新的维度。", chance: 0.01, color: "c-legend", trigger: { all: [{ field: "realmIdx", op: ">=", value: 4 }] }, effects: [{ field: "stats.wuxing", add: 10 }] },
    { text: "你的本命法宝产生了器灵，但这器灵是个话痨，每天在你识海里喋喋不休。", chance: 0.012, color: "c-funny", trigger: { all: [{ field: "realmIdx", op: ">=", value: 4 }] }, effects: [{ field: "stats.tianfu", add: 4 }, { field: "stats.wuxing", add: -2 }] },
    { text: "看到一株长得像韭菜的千年灵草，随手拔了拿回去炒了鸡蛋，味道有点苦。", chance: 0.015, color: "c-funny", trigger: { all: [{ field: "realmIdx", op: ">=", value: 4 }] }, effects: [{ field: "stats.tizhi", add: 4 }, { field: "stats.qiyun", add: -2 }] },
    { text: "将自己的供奉画像过度美化，导致宗门小辈认不出祖师奶", chance: 0.012, color: "c-funny", trigger: { all: [{ field: "realmIdx", op: ">=", value: 4 }, { field: "gender", op: "==", value: "female" }] }, effects: [{ field: "stats.wuxing", add: 4 }, { field: "stats.qiyun", add: -2 }] },

    // 元婴期强力事件 - 新增
    { text: "元婴大成，可分魂夺舍！你顿悟了分身之术，修炼速度倍增。", chance: 0.008, color: "c-legend", trigger: { all: [{ field: "realmIdx", op: ">=", value: 4 }] }, effects: [{ field: "cultivation", add: 2500 }, { field: "stats.tianfu", add: 5 }] },
    { text: "进入上古修士遗留的小世界，搜刮了三千年积累的资源。", chance: 0.01, color: "c-epic", trigger: { all: [{ field: "realmIdx", op: ">=", value: 4 }] }, effects: [{ field: "cultivation", add: 1800 }, { field: "stats.qiyun", add: 5 }] },
    { text: "闭关冲击化神瓶颈，虽然没成功，但修为精进不少。", chance: 0.02, color: "c-rare", trigger: { all: [{ field: "realmIdx", op: ">=", value: 4 }] }, effects: [{ field: "cultivation", add: 1200 }, { field: "stats.wuxing", add: 3 }] }
  ]
};
