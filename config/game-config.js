// Operations editing guide:
// 1) Only edit this file, do not modify game-engine.js.
// 2) Adjust values: change numbers under rules.
// 3) Add events: copy any event entry, change text/chance/trigger/effects.
// 4) Add titles: copy any title entry, change name/desc/condition.
//
// condition/trigger rule format:
// { all: [ { field: "stats.qiyun", op: ">", value: 10 } ] }
//
// Common fields:
// age, realmIdx, failCount, deathReason
// stats.tianfu, stats.wuxing, stats.tizhi, stats.qiyun
//
// Common ops:
// ==, !=, >, >=, <, <=, includes, includesAny
//
// effects format:
// [ { field: "stats.qiyun", add: 5 }, { field: "cultivation", add: 100 } ]

window.GAME_CONFIG = {
  version: "1.0.0",

  // Birth gender descriptions
  birthDesc: {
    male: ["The family has high hopes — they name you after a great ancestor.", "A hearty cry fills the hall. The midwife declares this boy will do great things."],
    female: ["Bright-eyed and fair, your mother is overjoyed.", "The midwife takes one look and says the kingdom shall hear of this one someday."]
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
    // Realm base renown — base renown gain per tick, scales with rank
    realmBaseCultivation: {
      0: 10,   // Peasant
      1: 15,   // Page
      2: 25,   // Squire
      3: 40,   // Knight
      4: 80,   // Captain
      5: 120,  // Baron
      6: 170,  // Viscount
      7: 230,  // Earl
      8: 300,  // Duke
      9: 380,  // Prince
      10: 500  // King
    },
    // Renown formula: base * (1 + Valor * valorMultiplier)
    cultivationFormula: {
      tianfuMultiplier: 0.08  // Each point of Valor adds 8% renown gain
    },
    debug: {
      logCultivationDeltaPerTick: false,
      enableTalentTest: false  // Talent test mode toggle, true = unlimited redraws
    },
    statLabels: {
      tianfu: "Valor",
      wuxing: "Wisdom",
      tizhi: "Vitality",
      qiyun: "Fortune"
    },
    // Stat descriptions (shown on hover)
    statDescriptions: {
      tianfu: "Affects renown gain speed. Each point adds 8% renown.",
      wuxing: "Affects promotion success rate. Checked with Fortune during promotion.",
      tizhi: "Determines lifespan. Death occurs when Vitality reaches zero. Restored on promotion.",
      qiyun: "Affects adventure chance and promotion checks. High Fortune can avert fatal events."
    }
  },
  // Analytics (disabled by default, fill in GA4 Measurement ID to enable)
  analytics: {
    enabled: false,
    gaMeasurementId: "",
    funnelName: "knight-core"
  },

  realms: ["Peasant", "Page", "Squire", "Knight", "Captain", "Baron", "Viscount", "Earl", "Duke", "Prince", "King"],

  talents: [
    { name: "Noble Blood", type: "positive", desc: "Vitality+4, born of ancient lineage", effects: [{ field: "stats.tizhi", add: 4 }] },
    { name: "Born Lucky", type: "positive", desc: "Fortune+4", effects: [{ field: "stats.qiyun", add: 4 }] },
    { name: "Scholar's Mind", type: "positive", desc: "Wisdom+4, sharp as a quill", effects: [{ field: "stats.wuxing", add: 4 }] },
    { name: "Prodigy", type: "positive", desc: "Valor+4", effects: [{ field: "stats.tianfu", add: 4 }] },

    { name: "Sickly Child", type: "negative", desc: "Valor-3, Vitality-2", effects: [{ field: "stats.tianfu", add: -3 }, { field: "stats.tizhi", add: -2 }] },
    { name: "Cursed Birth", type: "negative", desc: "Fortune-4", effects: [{ field: "stats.qiyun", add: -4 }] },
    { name: "Frail Body", type: "negative", desc: "Vitality-2, tires easily", effects: [{ field: "stats.tizhi", add: -2 }] },
    { name: "Jinx", type: "negative", desc: "Fortune-3, trouble follows you", effects: [{ field: "stats.qiyun", add: -3 }] },

    { name: "Lord's Fool", type: "neutral", desc: "Vitality+4, Wisdom-3", effects: [{ field: "stats.tizhi", add: 4 }, { field: "stats.wuxing", add: -3 }] },
    { name: "Dark Knight", type: "neutral", desc: "Valor+4, Vitality-2", effects: [{ field: "stats.tianfu", add: 4 }, { field: "stats.tizhi", add: -2 }] },
    { name: "Gambler", type: "neutral", desc: "Fortune+4, Wisdom-4", effects: [{ field: "stats.qiyun", add: 4 }, { field: "stats.wuxing", add: -4 }] },
    { name: "Bald Genius", type: "neutral", desc: "Wisdom+4, Vitality-2 (hair fell out)", effects: [{ field: "stats.wuxing", add: 4 }, { field: "stats.tizhi", add: -2 }] },

    { name: "Silver Spoon", type: "positive", desc: "Fortune+5, money solves everything", effects: [{ field: "stats.qiyun", add: 5 }] },
    { name: "Jinxed", type: "negative", desc: "Fortune-5, cursed since birth", effects: [{ field: "stats.qiyun", add: -5 }] },
    { name: "Night Owl", type: "neutral", desc: "Wisdom+3, Vitality-3, trains till dawn", effects: [{ field: "stats.wuxing", add: 3 }, { field: "stats.tizhi", add: -3 }] },
    { name: "Keyboard Knight", type: "negative", desc: "Wisdom-3, Vitality-2, all talk no sword", effects: [{ field: "stats.wuxing", add: -3 }, { field: "stats.tizhi", add: -2 }] },
    { name: "Cunning Fox", type: "positive", desc: "Fortune+3, Wisdom+1, never fights fair", effects: [{ field: "stats.qiyun", add: 3 }, { field: "stats.wuxing", add: 1 }] },
    { name: "Wild Blood", type: "neutral", desc: "Vitality+5, Wisdom-4, breaks everything", effects: [{ field: "stats.tizhi", add: 5 }, { field: "stats.wuxing", add: -4 }] },
    { name: "Lovesick", type: "negative", desc: "Wisdom-5, only thinks of THAT person", effects: [{ field: "stats.wuxing", add: -5 }] },
    { name: "Glutton", type: "neutral", desc: "Vitality+3, Valor-1, spends all coin on food", effects: [{ field: "stats.tizhi", add: 3 }, { field: "stats.tianfu", add: -1 }] },
    { name: "Overconfident", type: "negative", desc: "Fortune-2, Valor-2, so ordinary yet so sure", effects: [{ field: "stats.qiyun", add: -2 }, { field: "stats.tianfu", add: -2 }] },
    { name: "Wasted Effort", type: "negative", desc: "Vitality-2, Valor-2, trains wrong every day", effects: [{ field: "stats.tizhi", add: -2 }, { field: "stats.tianfu", add: -2 }] },
    { name: "Balanced Path", type: "neutral", desc: "Valor+3, Fortune-2, steady and true", effects: [{ field: "stats.tianfu", add: 3 }, { field: "stats.qiyun", add: -2 }] },
    { name: "Fatalist", type: "neutral", desc: "Fortune+3, Valor-2, whatever will be, will be", effects: [{ field: "stats.qiyun", add: 3 }, { field: "stats.tianfu", add: -2 }] },
    { name: "Unremarkable", type: "neutral", desc: "Being ordinary is a talent in itself", effects: [] }

  ],

  // Childhood events (ages 1-10 only, small stat changes)
  childhoodEvents: [
    { text: "Took your first steps, wobbling toward your mother.", chance: 0.05, color: "c-common", trigger: { all: [{ field: "age", op: ">=", value: 1 }, { field: "age", op: "<=", value: 3 }] }, effects: [{ field: "stats.tizhi", add: 1 }] },
    { text: "Spoke your first word — 'sword!'", chance: 0.05, color: "c-common", trigger: { all: [{ field: "age", op: ">=", value: 1 }, { field: "age", op: "<=", value: 3 }] }, effects: [{ field: "stats.tianfu", add: 1 }] },
    { text: "Chased butterflies in the courtyard, tripped and fell but laughed it off.", chance: 0.05, color: "c-common", trigger: { all: [{ field: "age", op: ">=", value: 2 }, { field: "age", op: "<=", value: 5 }] }, effects: [{ field: "stats.tizhi", add: 1 }, { field: "stats.qiyun", add: 1 }] },
    { text: "Snuck into the kitchen and ate an entire pie. Stomachache all day.", chance: 0.05, color: "c-funny", trigger: { all: [{ field: "age", op: ">=", value: 3 }, { field: "age", op: "<=", value: 6 }] }, effects: [{ field: "stats.tizhi", add: 1 }, { field: "stats.wuxing", add: -1 }] },
    { text: "Listened to grandfather's tales of great battles, eyes sparkling.", chance: 0.05, color: "c-common", trigger: { all: [{ field: "age", op: ">=", value: 3 }, { field: "age", op: "<=", value: 7 }] }, effects: [{ field: "stats.wuxing", add: 1 }] },
    { text: "Got into a scuffle with the neighbor's kid. Won, but got a black eye.", chance: 0.05, color: "c-common", trigger: { all: [{ field: "age", op: ">=", value: 4 }, { field: "age", op: "<=", value: 8 }] }, effects: [{ field: "stats.tizhi", add: 1 }, { field: "stats.qiyun", add: -1 }] },
    { text: "Found a shiny stone by the stream and kept it as a treasure.", chance: 0.04, color: "c-uncommon", trigger: { all: [{ field: "age", op: ">=", value: 4 }, { field: "age", op: "<=", value: 8 }] }, effects: [{ field: "stats.qiyun", add: 2 }] },
    { text: "Father made you memorize the Knight's Code. You stumbled through it.", chance: 0.05, color: "c-common", trigger: { all: [{ field: "age", op: ">=", value: 5 }, { field: "age", op: "<=", value: 8 }] }, effects: [{ field: "stats.wuxing", add: 1 }] },
    { text: "Helped feed the chickens. The rooster chased you across the whole village.", chance: 0.05, color: "c-funny", trigger: { all: [{ field: "age", op: ">=", value: 5 }, { field: "age", op: "<=", value: 9 }] }, effects: [{ field: "stats.tizhi", add: 1 }] },
    { text: "Tried to meditate like a monk. Fell asleep sitting up.", chance: 0.05, color: "c-funny", trigger: { all: [{ field: "age", op: ">=", value: 6 }, { field: "age", op: "<=", value: 10 }] }, effects: [{ field: "cultivation", add: 10 }, { field: "stats.wuxing", add: 1 }] },
    { text: "Found a wild herb by the hillside and sold it for a good price.", chance: 0.04, color: "c-uncommon", trigger: { all: [{ field: "age", op: ">=", value: 6 }, { field: "age", op: "<=", value: 10 }] }, effects: [{ field: "stats.qiyun", add: 1 }, { field: "cultivation", add: 15 }] },
    { text: "Learned a set of basic sword forms from the village guard.", chance: 0.04, color: "c-uncommon", trigger: { all: [{ field: "age", op: ">=", value: 7 }, { field: "age", op: "<=", value: 10 }] }, effects: [{ field: "stats.tizhi", add: 2 }] },
    { text: "Caught a high fever. In your delirium, you dreamt of a great knight.", chance: 0.03, color: "c-rare", trigger: { all: [{ field: "age", op: ">=", value: 2 }, { field: "age", op: "<=", value: 6 }] }, effects: [{ field: "stats.tianfu", add: 2 }, { field: "stats.tizhi", add: -1 }] },
    { text: "Sneaked off to swim in the river. Nearly got swept away.", chance: 0.04, color: "c-funny", trigger: { all: [{ field: "age", op: ">=", value: 5 }, { field: "age", op: "<=", value: 9 }] }, effects: [{ field: "stats.tizhi", add: 1 }, { field: "stats.qiyun", add: -1 }] },
    { text: "An elder gave you a lucky charm for your birthday.", chance: 0.04, color: "c-uncommon", trigger: { all: [{ field: "age", op: ">=", value: 3 }, { field: "age", op: "<=", value: 8 }] }, effects: [{ field: "stats.qiyun", add: 2 }] },
    { text: "Lay in the fields counting stars and drifted off to sleep.", chance: 0.05, color: "c-common", trigger: { all: [{ field: "age", op: ">=", value: 4 }, { field: "age", op: "<=", value: 9 }] }, effects: [{ field: "stats.wuxing", add: 1 }] },
    { text: "Got chased by the blacksmith's dog. Climbed a tree to escape.", chance: 0.04, color: "c-funny", trigger: { all: [{ field: "age", op: ">=", value: 5 }, { field: "age", op: "<=", value: 9 }] }, effects: [{ field: "stats.tizhi", add: 1 }, { field: "stats.qiyun", add: -1 }] },
    { text: "Tried writing your first letters. They looked like worms on paper.", chance: 0.05, color: "c-common", trigger: { all: [{ field: "age", op: ">=", value: 5 }, { field: "age", op: "<=", value: 8 }] }, effects: [{ field: "stats.wuxing", add: 1 }] },
    { text: "Helped your mother with the washing. She called you a good child.", chance: 0.05, color: "c-common", trigger: { all: [{ field: "age", op: ">=", value: 6 }, { field: "age", op: "<=", value: 10 }] }, effects: [{ field: "stats.tizhi", add: 1 }, { field: "stats.qiyun", add: 1 }] },
    { text: "Caught a frog after the rain and threw it at your sister's face.", chance: 0.04, color: "c-funny", trigger: { all: [{ field: "age", op: ">=", value: 4 }, { field: "age", op: "<=", value: 8 }] }, effects: [{ field: "stats.tizhi", add: 1 }, { field: "stats.wuxing", add: -1 }] }
  ],

  // Childhood filler text (used when no childhood event triggers, ages 1-10)
  childhoodFillers: [
    "Chased dragonflies around the yard all day.",
    "Played hide-and-seek with friends and fell asleep in a haystack.",
    "Sat on father's knee listening to tales of brave knights.",
    "Drew imaginary swords in the dirt with a stick.",
    "Begged mother for a honey cake."
  ],

  fillers: [
    "Practiced sword drills. The training dummy didn't put up much of a fight.",
    "Stared at the cobwebs in the barracks ceiling, lost in thought.",
    "Tried to kill a fly with your stare alone. Failed.",
    "Sorted through your coin pouch. Found nothing but copper.",
    { male: "Thought of Rosie from the village. Sighed, and went back to training.", female: "Remembered that lad Tom from the village market. Shuddered, and ran an extra lap around the castle walls." },
    "Practiced archery. Accidentally shot your own hat off.",
    "Read 'The Basics of Chivalry.' Fell asleep on page two.",
    "Felt your inner demons stirring. Drank some cold water to calm down.",
    { male: "Looked in the mirror and admired your rugged, knightly appearance.", female: "Looked in the mirror, worried your beauty would start another war between houses." },
    "In seclusion. Do not disturb."
  ],

  titles: [
    // Legendary titles — gold glow
    { name: "High King", color: "#ffd700", rarity: "legendary", desc: "Achieved: Reached the rank of King", condition: { all: [{ field: "realmIdx", op: ">=", value: 10 }] } },
    { name: "Crown Prince", color: "#ffd700", rarity: "legendary", desc: "Achieved: Reached the rank of Prince", condition: { all: [{ field: "realmIdx", op: "==", value: 9 }] } },
    { name: "Iron Maiden", color: "#ffd700", rarity: "legendary", desc: "Achieved: Female with Vitality over 100", condition: { all: [{ field: "maxTizhi", op: ">", value: 100 }, { field: "gender", op: "==", value: "female" }] } },
    { name: "Fortune's Darling", color: "#ffd700", rarity: "legendary", desc: "Achieved: Fortune exceeds 150", condition: { all: [{ field: "stats.qiyun", op: ">", value: 150 }] } },
    { name: "The Chosen One", color: "#ffd700", rarity: "legendary", desc: "Achieved: All four stats above 50", condition: { all: [{ field: "stats.tianfu", op: ">", value: 50 }, { field: "stats.wuxing", op: ">", value: 50 }, { field: "stats.tizhi", op: ">", value: 50 }, { field: "stats.qiyun", op: ">", value: 50 }] }, hidden: true },
    { name: "Fallen Prince", color: "#ffd700", rarity: "legendary", desc: "Achieved: Died at the rank of Prince", condition: { all: [{ field: "realmIdx", op: "==", value: 9 }] }, hidden: true },
    { name: "Unearned Glory", color: "#ffd700", rarity: "legendary", desc: "Achieved: Reached Captain with max renown under 500", condition: { all: [{ field: "realmIdx", op: ">=", value: 4 }, { field: "maxCultivation", op: "<", value: 500 }] }, hidden: true },
    { name: "Eternal Failure", color: "#ffd700", rarity: "legendary", desc: "Achieved: Failed promotion 10+ times", condition: { all: [{ field: "failCount", op: ">=", value: 10 }] }, hidden: true },

    // Epic titles — purple
    { name: "Wasted Potential", color: "#b088ff", rarity: "epic", desc: "Achieved: 3 positive talents but died before Squire", condition: { all: [{ field: "startTalentTypes", op: "every", value: "positive" }, { field: "realmIdx", op: "<", value: 2 }] } },
    { name: "Against All Odds", color: "#b088ff", rarity: "epic", desc: "Achieved: 3 negative talents but survived past Squire", condition: { all: [{ field: "startTalentTypes", op: "every", value: "negative" }, { field: "realmIdx", op: ">=", value: 2 }] } },
    { name: "Back from the Brink", color: "#b088ff", rarity: "epic", desc: "Achieved: Vitality dropped below 5 then recovered to 50+", condition: { all: [{ field: "minTizhi", op: "<", value: 5 }, { field: "stats.tizhi", op: ">=", value: 50 }] }, hidden: true },
    { name: "Unkillable", color: "#b088ff", rarity: "epic", desc: "Achieved: Survived 2+ death events", condition: { all: [{ field: "deathEventCount", op: ">=", value: 2 }] } },
    { name: "The Wizard", color: "#b088ff", rarity: "epic", desc: "Achieved: Died a virgin (Fortune>15, age>30, no romance)", condition: { all: [{ field: "stats.qiyun", op: ">", value: 15 }, { field: "age", op: ">", value: 30 }, { field: "hasTriggeredRomance", op: "==", value: false }] } },
    { name: "Century Celibate", color: "#b088ff", rarity: "epic", desc: "Achieved: 100+ years old with no romance", condition: { all: [{ field: "age", op: ">=", value: 100 }, { field: "hasTriggeredRomance", op: "==", value: false }] }, hidden: true },

    // Rare titles — green
    { name: "King of Extras", color: "#50c878", rarity: "rare", desc: "Achieved: Below Captain rank but lived 150+ years", condition: { all: [{ field: "realmIdx", op: "<", value: 4 }, { field: "age", op: ">", value: 150 }] } },
    { name: "Old Tortoise", color: "#50c878", rarity: "rare", desc: "Achieved: Died at age 300+", condition: { all: [{ field: "age", op: ">", value: 300 }] } },
    { name: "Hardheaded", color: "#50c878", rarity: "rare", desc: "Achieved: Failed promotion 3+ times", condition: { all: [{ field: "failCount", op: ">", value: 3 }] } },
    { name: "Gold Digger", color: "#50c878", rarity: "rare", desc: "Achieved: Triggered unspeakable events and Siren's Court 5+ times", condition: { all: [{ field: "hasTriggeredIndescribable", op: "==", value: true }, { field: "hehuanzongCount", op: ">", value: 5 }] } },
    { name: "Peasant Hero", color: "#50c878", rarity: "rare", desc: "Achieved: Vitality<5 and lived past 50", condition: { all: [{ field: "stats.tizhi", op: "<", value: 5 }, { field: "age", op: ">", value: 50 }] } },
    { name: "Master Slacker", color: "#50c878", rarity: "rare", desc: "Achieved: Age 100+ but still at Knight rank or below", condition: { all: [{ field: "age", op: ">", value: 100 }, { field: "realmIdx", op: "<=", value: 3 }] } },
    { name: "Forever a Page", color: "#50c878", rarity: "rare", desc: "Achieved: Page rank for 100+ years", condition: { all: [{ field: "realmIdx", op: "==", value: 1 }, { field: "age", op: ">", value: 100 }] } },
    { name: "Peaked Early", color: "#50c878", rarity: "rare", desc: "Achieved: Any non-Vitality stat declined from starting value", condition: { all: [{ field: "declinedStats", op: ">", value: 0 }] } },
    { name: "Keyboard Warrior", color: "#50c878", rarity: "rare", desc: "Achieved: Died from a falling keyboard", condition: { all: [{ field: "deathReason", op: "includes", value: "keyboard" }] } },
    { name: "Code Knight", color: "#50c878", rarity: "rare", desc: "Achieved: Died from a programming error", condition: { all: [{ field: "deathReason", op: "includesAny", value: ["program", "Bug", "code"] }] } },
    { name: "Glutton's End", color: "#50c878", rarity: "rare", desc: "Achieved: Died from ale or cauldron", condition: { all: [{ field: "deathReason", op: "includesAny", value: ["ale", "cauldron"] }] } },

    // Common titles — no special effects
    { name: "Cursed Soul", color: "#dccbb5", rarity: "common", desc: "Achieved: Fortune below -5", condition: { all: [{ field: "stats.qiyun", op: "<", value: -5 }] } },
    { name: "Dim-Witted", color: "#dccbb5", rarity: "common", desc: "Achieved: Wisdom below 10 at death", condition: { all: [{ field: "stats.wuxing", op: "<", value: 10 }] } },
    { name: "Hapless Survivor", color: "#dccbb5", rarity: "common", desc: "Achieved: Fortune<0 but lived past 30", condition: { all: [{ field: "stats.qiyun", op: "<", value: 0 }, { field: "age", op: ">", value: 30 }] } },
    { name: "That's It?", color: "#dccbb5", rarity: "common", desc: "Achieved: Died before age 10", condition: { all: [{ field: "age", op: "<", value: 10 }] } },
    { name: "Born to Serve", color: "#dccbb5", rarity: "common", desc: "Achieved: Died of overwork or by the lord's hand", condition: { all: [{ field: "deathReason", op: "includesAny", value: ["lord", "overwork"] }] } },
    { name: "Nobody", color: "#dccbb5", rarity: "common", desc: "Achieved: An unremarkable life", condition: { all: [{ field: "always", op: "==", value: true }] } },
    { name: "Perfectly Average", color: "#dccbb5", rarity: "common", desc: "Achieved: 3 neutral talents and reached Squire+", condition: { all: [{ field: "startTalentTypes", op: "every", value: "neutral" }, { field: "realmIdx", op: ">=", value: 2 }] } }
  ],

  events: [
    { text: "Age 0: You were born.", trigger: { all: [{ field: "age", op: "==", value: 0 }] } },
    { text: "Age 3: Playing in the mud outside the village.", trigger: { all: [{ field: "age", op: "==", value: 3 }] } },

    // Positive / story events
    { text: "Found a green vial in the woods. The liquid inside can polish any blade to perfection!", chance: 0.005, color: "c-green", effects: [{ field: "stats.wuxing", add: 10 }, { field: "stats.qiyun", add: 10 }] },
    { text: "Met a wandering knight named 'Sir Storm.' He taught you a few tricks.", chance: 0.02, color: "c-green", trigger: { all: [{ field: "realmIdx", op: "<", value: 2 }] }, effects: [{ field: "stats.tizhi", add: 2 }] },
    { text: "Faced a fearsome enemy. You narrowed your eyes and retreated behind your allies...", chance: 0.02, color: "c-green", trigger: { all: [{ field: "realmIdx", op: ">", value: 1 }] }, effects: [{ field: "stats.qiyun", add: 2 }] },
    { text: "Entered a bloody tournament. Hid behind a pillar until the end and claimed the prize.", chance: 0.01, color: "c-green", trigger: { all: [{ field: "realmIdx", op: "==", value: 1 }] }, effects: [{ field: "cultivation", add: 500 }, { field: "stats.wuxing", add: 2 }] },
    { text: "Encountered Lady Guinevere. Something unspeakable happened...", chance: 0.005, color: "c-legend", trigger: { all: [{ field: "realmIdx", op: ">=", value: 2 }, { field: "gender", op: "==", value: "male" }] }, effects: [{ field: "stats.tizhi", add: -5 }, { field: "stats.qiyun", add: 5 }, { field: "cultivation", add: 1000 }] },
    { text: "Encountered Sir Lancelot. Something unspeakable happened...", chance: 0.005, color: "c-legend", trigger: { all: [{ field: "realmIdx", op: ">=", value: 2 }, { field: "gender", op: "==", value: "female" }] }, effects: [{ field: "stats.tizhi", add: -5 }, { field: "stats.qiyun", add: 5 }, { field: "cultivation", add: 1000 }] },
    { text: "Tried to forge a sword. Broke thirty blades before finally succeeding.", chance: 0.03, color: "c-green", trigger: { all: [{ field: "realmIdx", op: "==", value: 1 }] }, effects: [{ field: "cultivation", add: 200 }] },
    { text: "Found an ancient scroll. The first line read: 'To master this art...'", chance: 0.01, color: "c-green", trigger: { all: [{ field: "realmIdx", op: ">=", value: 3 }, { field: "gender", op: "==", value: "male" }] }, effects: [{ field: "stats.tianfu", add: 5 }] },
    { text: "Took a loan to invest in 'Flying Horse Stock.' Got beaten by the moneylender's thugs.", chance: 0.02, color: "c-green", trigger: { all: [{ field: "realmIdx", op: "==", value: 0 }] }, effects: [{ field: "stats.wuxing", add: 3 }, { field: "stats.qiyun", add: 2 }] },
    { text: "Slew a fearsome beast in the Darkwood. Found a Grade-6 monster core.", chance: 0.02, color: "c-green", trigger: { all: [{ field: "realmIdx", op: ">=", value: 3 }] }, effects: [{ field: "cultivation", add: 600 }] },
    { text: "Shouted 'Stand and deliver!' The enemy panicked and fled.", chance: 0.02, color: "c-green" },

    // Funny events
    { text: "Found a strange contraption labeled 'GPU 9090.' Tried to use it as a shield. Wisdom+1.", chance: 0.01, color: "c-funny", effects: [{ field: "stats.wuxing", add: 1 }] },
    { text: "A stray dog by the road gave you a look of pure disdain.", chance: 0.02, color: "c-funny", effects: [{ field: "stats.wuxing", add: 1 }] },
    { text: "Had an epiphany! Turns out being a knight is just being lonely with a sword.", chance: 0.01, color: "c-funny", trigger: { all: [{ field: "stats.wuxing", op: ">", value: 10 }] }, effects: [{ field: "cultivation", add: 300 }] },
    { text: "Bought a 'Miracle Healing Potion' from a roadside stall. It was just colored water. Fortune-2.", chance: 0.02, color: "c-funny", effects: [{ field: "stats.qiyun", add: -2 }] },
    { text: "Lightning struck during a storm. You pulled out an umbrella. The gods were not amused.", chance: 0.01, color: "c-funny", trigger: { all: [{ field: "realmIdx", op: ">=", value: 2 }] }, effects: [{ field: "stats.tizhi", add: 2 }] },
    { text: "Found a book: 'Three Years a Page, Five Years a Knight.' Your training improved.", chance: 0.02, color: "c-funny", effects: [{ field: "stats.wuxing", add: 2 }] },
    { text: "A strange fellow asked if you'd heard of 'Amway.' You nearly joined his cult.", chance: 0.02, color: "c-funny" },
    { text: "Discovered the castle master's WiFi password is '12345678.' Free training resources!", chance: 0.01, color: "c-funny", trigger: { all: [{ field: "realmIdx", op: ">=", value: 1 }] }, effects: [{ field: "cultivation", add: 50 }] },
    { text: "Someone gave you a crossbow called the '98K.' Turns out it's better than a sword.", chance: 0.01, color: "c-funny" },
    { text: "You tried reasoning with a dragon. It said it only speaks French.", chance: 0.01, color: "c-funny" },

    // Death events
    { text: "Choked on ale and ascended — not to knighthood, but to heaven.", chance: 0.001, isDeath: true },
    { text: "Training program error: Segmentation Fault. Your soul crashed.", chance: 0.001, isDeath: true },
    { text: "A keyboard fell from the sky and struck you dead.", chance: 0.001, isDeath: true },
    { text: "Too handsome. Trampled to death by a mob of admirers.", chance: 0.002, trigger: { all: [{ field: "stats.tianfu", op: ">", value: 15 }] }, isDeath: true },
    { text: "Forgot to breathe. Suffocated. (How is that even possible?)", chance: 0.001, isDeath: true },
    { text: "During the final trial, the server timed out. Struck by lightning while frozen mid-air.", chance: 0.001, isDeath: true },
    { text: "Tried to brew potions in a cauldron. It exploded.", chance: 0.002, isDeath: true },
    { text: "Rode your horse too fast. Rear-ended a hay cart. Fatal collision.", chance: 0.001, isDeath: true },
    { text: "Stayed up all night to meet the alchemy KPI. Died of overwork.", chance: 0.002, isDeath: true },
    { text: "Caught exploiting a code bug by the lord (your boss). Existence deleted.", chance: 0.001, trigger: { all: [{ field: "stats.wuxing", op: ">", value: 10 }] }, isDeath: true },
    { text: "Captured by a Siren's Court enchantress. Drained of all energy...", chance: 0.003, color: "c-death", trigger: { all: [{ field: "realmIdx", op: ">=", value: 2 }, { field: "gender", op: "==", value: "male" }] }, effects: [{ field: "stats.tizhi", add: -10 }, { field: "cultivation", add: -100 }] },
    { text: "Captured by a Siren's Court warlock. Drained of all energy...", chance: 0.003, color: "c-death", trigger: { all: [{ field: "realmIdx", op: ">=", value: 2 }, { field: "gender", op: "==", value: "female" }] }, effects: [{ field: "stats.tizhi", add: -10 }, { field: "cultivation", add: -100 }] },

    // Negative funny events — renown loss with Fortune exemption
    { text: "Lost control during training. Set back ten years!", chance: 0.015, isNegative: true, color: "c-funny", effects: [{ field: "cultivation", percent: true }] },
    { text: "Inner demons got the best of you. Spent weeks playing tavern games instead of training.", chance: 0.02, isNegative: true, color: "c-funny", effects: [{ field: "cultivation", percent: true }] },
    { text: "Ate a poisonous mushroom. Spent all day in the outhouse. Lost all progress.", chance: 0.015, isNegative: true, color: "c-funny", effects: [{ field: "cultivation", percent: true }] },
    { text: "Got tricked by a talking parrot. Somehow transferred all your renown to it.", chance: 0.01, isNegative: true, color: "c-funny", effects: [{ field: "cultivation", percent: true }] },
    { text: "Tried applying science to swordsmanship. Had a breakdown. Renown plummeted.", chance: 0.015, isNegative: true, color: "c-funny", effects: [{ field: "cultivation", percent: true }] },
    { text: "A cute baby dragon bamboozled you into spending all your renown on its snacks.", chance: 0.02, isNegative: true, color: "c-funny", effects: [{ field: "cultivation", percent: true }] },
    { text: "Fell asleep during training. Woke up to find a mouse had stolen your progress notes.", chance: 0.02, isNegative: true, color: "c-funny", effects: [{ field: "cultivation", percent: true }] },
    { text: "Tried to control your sword with your mind. The sword went rogue. You got hurt.", chance: 0.015, isNegative: true, color: "c-funny", effects: [{ field: "cultivation", percent: true }] },
    { text: "A singing frog mesmerized you. It absorbed all your renown.", chance: 0.01, isNegative: true, color: "c-funny", effects: [{ field: "cultivation", percent: true }] },
    { text: "Used the alchemy furnace to cook stew. It exploded. Renown gone.", chance: 0.02, isNegative: true, color: "c-funny", effects: [{ field: "cultivation", percent: true }] },

    // High-Valor events — require high Valor to trigger
    { text: "A great omen! Purple clouds stretched across the sky. You grasped the way of the blade.", chance: 0.01, color: "c-legend", trigger: { all: [{ field: "stats.tianfu", op: ">=", value: 10 }] }, effects: [{ field: "cultivation", add: 2000 }, { field: "stats.wuxing", add: 5 }] },
    { text: "A spirit visited you in a dream, teaching you a lost ancient technique.", chance: 0.015, color: "c-epic", trigger: { all: [{ field: "stats.tianfu", op: ">=", value: 8 }] }, effects: [{ field: "cultivation", add: 800 }, { field: "stats.qiyun", add: 3 }] },
    { text: "Your training speed astounds the elders. They call you a once-in-a-century prodigy.", chance: 0.02, color: "c-rare", trigger: { all: [{ field: "stats.tianfu", op: ">=", value: 6 }] }, effects: [{ field: "cultivation", add: 400 }, { field: "stats.tianfu", add: 1 }] },
    { text: "While studying the laws of combat, you glimpsed a faint trace of the ultimate truth.", chance: 0.025, color: "c-uncommon", trigger: { all: [{ field: "stats.tianfu", op: ">=", value: 4 }] }, effects: [{ field: "cultivation", add: 200 }, { field: "stats.wuxing", add: 1 }] },

    // Female-only events
    { text: "Found the Chainmail Bikini of the War Goddess. The skin-to-air contact doubled your training efficiency.", chance: 0.01, color: "c-purple", trigger: { all: [{ field: "gender", op: "==", value: "female" }] }, effects: [{ field: "stats.tianfu", add: 3 }] },
    { text: "A dark lord cornered you for a dramatic confession. You slapped him into next week. Enlightenment: 'No men, no problems.'", chance: 0.01, color: "c-purple", trigger: { all: [{ field: "gender", op: "==", value: "female" }] }, effects: [{ field: "stats.wuxing", add: 5 }] },
    { text: "Fasted to lose weight. Got so hungry you swallowed the castle's pet frog whole. Vitality surged.", chance: 0.01, color: "c-funny", trigger: { all: [{ field: "gender", op: "==", value: "female" }] }, effects: [{ field: "stats.tizhi", add: 10 }] },
    { text: "Spent all your gold on mystery loot boxes. Got nothing but empty vials labeled 'Thanks for playing.'", chance: 0.015, color: "c-red", trigger: { all: [{ field: "gender", op: "==", value: "female" }] }, effects: [{ field: "stats.qiyun", add: -5 }] },
    { text: "Exposed a scheming rival's 'Oh I'm so helpless' act and kicked her off the sparring ring. Clarity achieved.", chance: 0.012, color: "c-green", trigger: { all: [{ field: "gender", op: "==", value: "female" }] }, effects: [{ field: "cultivation", add: 50 }] },

    // Captain+ rank events (realmIdx >= 4)
    { text: "Extended your scouts 800 miles. Instead of treasure, you overheard the Siren's Court elder's love drama. Disturbing but thrilling.", chance: 0.015, color: "c-purple", trigger: { all: [{ field: "realmIdx", op: ">=", value: 4 }] }, effects: [{ field: "stats.wuxing", add: -4 }, { field: "stats.qiyun", add: 6 }] },
    { text: "Met a beautiful maiden. Your scouts revealed she's actually a 30,000-year-old geezer in disguise.", chance: 0.012, color: "c-funny", trigger: { all: [{ field: "realmIdx", op: ">=", value: 4 }, { field: "gender", op: "==", value: "male" }] }, effects: [{ field: "stats.wuxing", add: -2 }, { field: "stats.qiyun", add: 4 }] },
    { text: "Took a nap during a siege. Woke up to find three new castle masters had come and gone.", chance: 0.01, color: "c-funny", trigger: { all: [{ field: "realmIdx", op: ">=", value: 4 }] }, effects: [{ field: "stats.wuxing", add: 6 }, { field: "stats.qiyun", add: -2 }] },
    { text: "Finally understood that 'divide and conquer' is just binary search. Your grasp of strategy reached a new dimension.", chance: 0.01, color: "c-legend", trigger: { all: [{ field: "realmIdx", op: ">=", value: 4 }] }, effects: [{ field: "stats.wuxing", add: 10 }] },
    { text: "Your legendary weapon developed a spirit. Unfortunately, it's a chatterbox that never shuts up.", chance: 0.012, color: "c-funny", trigger: { all: [{ field: "realmIdx", op: ">=", value: 4 }] }, effects: [{ field: "stats.tianfu", add: 4 }, { field: "stats.wuxing", add: -2 }] },
    { text: "Found a plant that looked like leeks. Picked it and made an omelette. Tasted bitter.", chance: 0.015, color: "c-funny", trigger: { all: [{ field: "realmIdx", op: ">=", value: 4 }] }, effects: [{ field: "stats.tizhi", add: 4 }, { field: "stats.qiyun", add: -2 }] },
    { text: "Over-beautified your official portrait. New recruits can't recognize the Grand Dame.", chance: 0.012, color: "c-funny", trigger: { all: [{ field: "realmIdx", op: ">=", value: 4 }, { field: "gender", op: "==", value: "female" }] }, effects: [{ field: "stats.wuxing", add: 4 }, { field: "stats.qiyun", add: -2 }] },

    // Captain+ powerful events
    { text: "Mastered the art of the doppelganger! Your training speed doubled.", chance: 0.008, color: "c-legend", trigger: { all: [{ field: "realmIdx", op: ">=", value: 4 }] }, effects: [{ field: "cultivation", add: 2500 }, { field: "stats.tianfu", add: 5 }] },
    { text: "Discovered an ancient knight's hidden treasury. Looted three centuries' worth of resources.", chance: 0.01, color: "c-epic", trigger: { all: [{ field: "realmIdx", op: ">=", value: 4 }] }, effects: [{ field: "cultivation", add: 1800 }, { field: "stats.qiyun", add: 5 }] },
    { text: "Attempted to break through the Baron bottleneck. Failed, but gained valuable experience.", chance: 0.02, color: "c-rare", trigger: { all: [{ field: "realmIdx", op: ">=", value: 4 }] }, effects: [{ field: "cultivation", add: 1200 }, { field: "stats.wuxing", add: 3 }] }
  ]
};
