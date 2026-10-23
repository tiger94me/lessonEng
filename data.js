/* ================= 外研社五年级上册 Unit 3 · Happy together 课堂数据 ================= */
"use strict";

/* ---------- 词汇（core=true 表示学习档案生词本预录的核心词） ---------- */
const WORDS = [
  { en: "friendship", pos: "n.", zh: "友谊；友情", ex: "Keep your friendship strong.", exZh: "让你们的友谊保持牢固。", core: true, audio: { word: "textbook_audio/words/friendship_朗读.mp3", alt: "textbook_audio/words/friendship_发音a.mp3", ex: "textbook_audio/words/friendship_例句.mp3", zh: "textbook_audio/words/friendship_释义.mp3" } },
  { en: "best friend", pos: "n.", zh: "最好的朋友", ex: "Tutu is his best friend.", exZh: "图图是他最好的朋友。", core: true },
  { en: "unhappy", pos: "adj.", zh: "不开心的；难过的", ex: "This makes Duoduo unhappy.", exZh: "这让多多很不开心。", core: true, audio: { word: "textbook_audio/words/unhappy_朗读.mp3", alt: "textbook_audio/words/unhappy_发音a.mp3", ex: "textbook_audio/words/unhappy_例句.mp3", zh: "textbook_audio/words/unhappy_释义.mp3" } },
  { en: "miss", pos: "v.", zh: "想念", ex: "He misses Tutu.", exZh: "他想念图图。", core: true },
  { en: "join", pos: "v.", zh: "加入；参加", ex: "Join us!", exZh: "加入我们吧！", core: true },
  { en: "sad", pos: "adj.", zh: "悲伤的", ex: "Duoduo feels sad.", exZh: "多多感到难过。", core: true },
  { en: "feel", pos: "v.", zh: "感觉；觉得", ex: "After a week, Duoduo feels sad.", exZh: "一周后，多多感到难过。", core: true },
  { en: "because", pos: "conj.", zh: "因为", ex: "I'm unhappy because I'm not your friend now.", exZh: "我不开心，因为我现在不是你的朋友了。", core: true },
  { en: "laugh", pos: "v.", zh: "笑；大笑", ex: "Momo often makes me laugh.", exZh: "毛毛常常逗我笑。", core: true },
  { en: "funny", pos: "adj.", zh: "滑稽的；爱逗人笑的", ex: "He is funny.", exZh: "他很滑稽。", core: true, audio: { word: "textbook_audio/words/funny_朗读.mp3", alt: "textbook_audio/words/funny_发音a.mp3", ex: "textbook_audio/words/funny_例句.mp3", zh: "textbook_audio/words/funny_释义.mp3" } },
  { en: "musical", pos: "adj.", zh: "有音乐天赋的；爱好音乐的", ex: "He is very musical.", exZh: "他很有音乐天赋。", core: true, audio: { word: "textbook_audio/words/musical_朗读.mp3", alt: "textbook_audio/words/musical_发音a.mp3", ex: "textbook_audio/words/musical_例句.mp3" } },
  { en: "cool", pos: "adj.", zh: "酷的；棒的", ex: "He's very cool.", exZh: "他很酷。", core: true },
  { en: "different", pos: "adj.", zh: "不同的", ex: "You're so different.", exZh: "你们太不一样了。", core: true },
  { en: "same", pos: "adj.", zh: "相同的", ex: "We live in the same street.", exZh: "我们住在同一条街上。", core: true },
  { en: "hobby", pos: "n.", zh: "爱好（复数 hobbies）", ex: "We have different hobbies.", exZh: "我们有不同的爱好。", core: true },
  { en: "share", pos: "v.", zh: "分享", ex: "Friends share with each other.", exZh: "朋友彼此分享。", core: true },
  { en: "worried", pos: "adj.", zh: "担心的；发愁的", ex: "Why are you looking worried?", exZh: "你为什么看起来愁眉苦脸的？", core: true },
  { en: "key", pos: "n.", zh: "关键", ex: "That's the key.", exZh: "这就是关键。", core: true, audio: { word: "textbook_audio/words/key_朗读.mp3", alt: "textbook_audio/words/key_发音a.mp3", ex: "textbook_audio/words/key_例句.mp3", zh: "textbook_audio/words/key_释义.mp3" } },
  { en: "problem", pos: "n.", zh: "问题；难题", ex: "We've got a problem today.", exZh: "我们今天遇到了一个难题。", core: true },
  { en: "openly", pos: "adv.", zh: "坦诚地；公开地", ex: "We talk openly with each other.", exZh: "我们彼此坦诚交流。", core: true, audio: { word: "textbook_audio/words/openly_朗读.mp3", alt: "textbook_audio/words/openly_发音a.mp3", ex: "textbook_audio/words/openly_例句.mp3" } },
  { en: "angry", pos: "adj.", zh: "生气的", ex: "Why are Sally and Mia angry with each other?", exZh: "萨莉和米娅为什么互相生气？", core: true },
  { en: "plan", pos: "n.", zh: "计划", ex: "They have different plans.", exZh: "他们有不同的计划。", core: true, audio: { word: "textbook_audio/words/plan_朗读.mp3", alt: "textbook_audio/words/plan_发音a.mp3", ex: "textbook_audio/words/plan_例句.mp3", zh: "textbook_audio/words/plan_释义.mp3" } },
  { en: "science", pos: "n.", zh: "科学", ex: "their science homework", exZh: "他们的科学作业", core: false },
  { en: "homework", pos: "n.", zh: "作业；家庭作业", ex: "science homework", exZh: "科学作业", core: false },
  { en: "sorry", pos: "adj.", zh: "抱歉的；对不起的", ex: "First, say sorry to Mia.", exZh: "首先，向米娅道歉。", core: false },
  { en: "kind", pos: "adj.", zh: "友善的；和蔼的", ex: "Friends should be kind to each other.", exZh: "朋友之间应该友善相待。", core: true },
  { en: "chat", pos: "n.", zh: "闲谈；聊天", ex: "Then have a chat with Mia.", exZh: "然后和米娅聊一聊。", core: false },
  { en: "seed", pos: "n.", zh: "种子", ex: "I eat seeds.", exZh: "我吃种子。", core: false },
  { en: "meat", pos: "n.", zh: "肉", ex: "You eat meat.", exZh: "你吃肉。", core: false },
  { en: "similar", pos: "adj.", zh: "相似的", ex: "How are you and your friend similar?", exZh: "你和你的朋友有哪些相似之处？", core: true, audio: { word: "textbook_audio/words/similar_朗读.mp3", alt: "textbook_audio/words/similar_发音a.mp3", ex: "textbook_audio/words/similar_例句.mp3" } },
  { en: "similarity", pos: "n.", zh: "相似之处", ex: "Tell one similarity.", exZh: "说出一个相似之处。", core: true },
  { en: "difference", pos: "n.", zh: "不同之处", ex: "Tell one difference.", exZh: "说出一个不同之处。", core: true, audio: { word: "textbook_audio/words/difference_朗读.mp3", alt: "textbook_audio/words/difference_发音a.mp3", ex: "textbook_audio/words/difference_例句.mp3", zh: "textbook_audio/words/difference_释义.mp3" } },
  { en: "rule", pos: "n.", zh: "规则", ex: "the rules of your friendship", exZh: "你们友谊的规则", core: false },
  { en: "important", pos: "adj.", zh: "重要的", ex: "It's important to have friends.", exZh: "有朋友很重要。", core: true },
  { en: "celebrate", pos: "v.", zh: "庆祝", ex: "People celebrate the day.", exZh: "人们庆祝这一天。", core: true },
  { en: "gift", pos: "n.", zh: "礼物", ex: "They give each other gifts.", exZh: "他们互赠礼物。", core: true },
  { en: "card", pos: "n.", zh: "卡片；贺卡", ex: "gifts, cards and best wishes", exZh: "礼物、贺卡和最美好的祝愿", core: false },
  { en: "wish", pos: "n.", zh: "祝愿（复数 wishes）", ex: "best wishes", exZh: "最美好的祝愿", core: true },
  { en: "culture", pos: "n.", zh: "文化", ex: "friendship between cultures", exZh: "文化之间的友谊", core: false },
  { en: "international", pos: "adj.", zh: "国际的", ex: "the International Day of Friendship", exZh: "国际友谊日", core: false },
  { en: "between", pos: "prep.", zh: "在……之间", ex: "friendship between people", exZh: "人与人之间的友谊", core: false },
  { en: "phew", pos: "int.", zh: "唷！呼！（松了一口气）", ex: "Make us friends again, phew!", exZh: "让我们重新成为朋友，呼！", core: false },
  { en: "few", pos: "adj.", zh: "很少的", ex: "A few nice words make us friends again.", exZh: "几句好话就让我们重新成为朋友。", core: false }
,
{ en: "both", pos: "adj.", zh: "两个都", ex: "Old friends and new friends are both very nice.", exZh: "老朋友和新朋友都很好。", core: true, audio: { word: "textbook_audio/words/both_朗读.mp3", alt: "textbook_audio/words/both_发音a.mp3", ex: "textbook_audio/words/both_例句.mp3", zh: "textbook_audio/words/both_释义.mp3" } },
{ en: "er", pos: "int.", zh: "哦；嗯；呃（语气词）", ex: "Er, what do we share?", exZh: "呃，我们能分享什么呢？", core: false, audio: { word: "textbook_audio/words/er_朗读.mp3", alt: "textbook_audio/words/er_发音a.mp3", ex: "textbook_audio/words/er_例句.mp3", zh: "textbook_audio/words/er_释义.mp3" } },
{ en: "find", pos: "v.", zh: "找到；发现", ex: "Find photos or draw pictures.", exZh: "找照片或者画图片。", core: false, audio: { word: "textbook_audio/words/find_朗读.mp3", alt: "textbook_audio/words/find_发音a.mp3", ex: "textbook_audio/words/find_例句.mp3", zh: "textbook_audio/words/find_释义.mp3" } },
{ en: "parent", pos: "n.", zh: "父亲；母亲；家长（复数 parents）", ex: "Let's show this to our parents.", exZh: "让我们把这个证明给爸爸妈妈看。", core: false, audio: { word: "textbook_audio/words/parent_朗读.mp3", alt: "textbook_audio/words/parent_发音a.mp3", ex: "textbook_audio/words/parent_例句.mp3", zh: "textbook_audio/words/parent_释义.mp3" } },
{ en: "rabbit", pos: "n.", zh: "兔；兔子", ex: "The rabbit tells them the key.", exZh: "兔子告诉了他们关键所在。", core: false, audio: { word: "textbook_audio/words/rabbit_朗读.mp3", alt: "textbook_audio/words/rabbit_发音a.mp3", ex: "textbook_audio/words/rabbit_例句.mp3", zh: "textbook_audio/words/rabbit_释义.mp3" } },
{ en: "should", pos: "v.", zh: "应该，应当", ex: "Friends should be kind to each other.", exZh: "朋友之间应该友善相待。", core: true, audio: { word: "textbook_audio/words/should_朗读.mp3", alt: "textbook_audio/words/should_发音a.mp3", ex: "textbook_audio/words/should_例句.mp3", zh: "textbook_audio/words/should_释义.mp3" } },
{ en: "tip", pos: "n.", zh: "窍门；忠告；建议", ex: "Here are my tips.", exZh: "这是我的小建议。", core: false, audio: { word: "textbook_audio/words/tip_朗读.mp3", alt: "textbook_audio/words/tip_发音a.mp3", ex: "textbook_audio/words/tip_例句.mp3" } }
];

/* ---------- 短语（social=true 表示“相处之道”短语） ---------- */
const PHRASES = [
  { en: "each other", zh: "互相；彼此", ex: "We help each other.", exZh: "我们互相帮助。", social: true },
  { en: "help each other", zh: "互相帮助", ex: "We help each other.", exZh: "我们互相帮助。", social: true },
  { en: "take care of each other", zh: "互相照顾", ex: "Friends take care of each other.", exZh: "朋友互相照顾。", social: true },
  { en: "listen to each other", zh: "互相倾听", ex: "Listen to each other.", exZh: "互相倾听。", social: true },
  { en: "share things", zh: "分享东西", ex: "We share things.", exZh: "我们分享东西。", social: true },
  { en: "do happy things together", zh: "一起做开心的事", ex: "We do happy things together.", exZh: "我们一起做开心的事。", social: true },
  { en: "be happy for each other", zh: "为彼此高兴", ex: "Be happy for each other.", exZh: "为彼此高兴。", social: true },
  { en: "talk openly with each other", zh: "坦诚交谈", ex: "We talk openly with each other.", exZh: "我们彼此坦诚交流。", social: true },
  { en: "walk away", zh: "走开", ex: "Duoduo just walks away.", exZh: "多多径直走开了。", social: false },
  { en: "sit down", zh: "坐下", ex: "Tutu sits down next to him.", exZh: "图图在他旁边坐下。", social: false },
  { en: "next to", zh: "在……旁边", ex: "Tutu sits down next to him.", exZh: "图图在他旁边坐下。", social: false },
  { en: "make friends", zh: "交朋友", ex: "Duoduo makes friends with the other two boys.", exZh: "多多和另外两个男孩交上了朋友。", social: true },
  { en: "make friends again", zh: "重归于好", ex: "A few nice words make us friends again.", exZh: "几句好话让我们重归于好。", social: true },
  { en: "have fun", zh: "玩得开心", ex: "We always have fun.", exZh: "我们总是玩得很开心。", social: false },
  { en: "make me laugh", zh: "逗我笑", ex: "Momo often makes me laugh.", exZh: "毛毛常常逗我笑。", social: false },
  { en: "sing together", zh: "一起唱歌", ex: "We often sing together.", exZh: "我们经常一起唱歌。", social: false },
  { en: "say sorry to", zh: "向……道歉", ex: "Say sorry to Mia.", exZh: "向米娅道歉。", social: true },
  { en: "have a chat with", zh: "和……聊一聊", ex: "Have a chat with Mia.", exZh: "和米娅聊一聊。", social: false },
  { en: "ask for help", zh: "求助", ex: "Sometimes I ask my parents for help.", exZh: "有时我请父母帮忙。", social: true },
  { en: "eat out", zh: "出去吃饭；下馆子", ex: "Friends eat out or have a meal at home.", exZh: "朋友们下馆子或在家吃饭。", social: false },
  { en: "give each other gifts", zh: "互赠礼物", ex: "They give each other gifts.", exZh: "他们互赠礼物。", social: false },
  { en: "get along with", zh: "与……和睦相处", ex: "Get along with our friends.", exZh: "与朋友们和睦相处。", social: true },
  { en: "be different from", zh: "与……不同", ex: "My best friend is different from me.", exZh: "我最好的朋友和我不同。", social: true },
  { en: "stay at home", zh: "待在家里", ex: "You want to stay at home and play.", exZh: "你想待在家里玩。", social: false },
  { en: "go out", zh: "外出；出门", ex: "I want to go out.", exZh: "我想出去。", social: false },
  { en: "try something new", zh: "尝试新事物", ex: "I want to go out and try something new.", exZh: "我想出去尝试点新东西。", social: false },
  { en: "get in the way", zh: "碍事；挡道", ex: "It's getting in the way.", exZh: "这事正碍着呢。", social: false },
  { en: "around the world", zh: "全世界", ex: "People around the world celebrate the day.", exZh: "全世界的人们都庆祝这一天。", social: false },
  { en: "every year", zh: "每年", ex: "Every year, 30 July is the International Day of Friendship.", exZh: "每年的7月30日是国际友谊日。", social: false },
  { en: "have a happy time", zh: "过得快乐", ex: "Friends have a happy time together.", exZh: "朋友们一起度过快乐时光。", social: false },
  { en: "keep friendship strong", zh: "让友谊保持牢固", ex: "What can you do to keep your friendship strong?", exZh: "你能做些什么让友谊保持牢固？", social: true },
  { en: "a few", zh: "一些；几个", ex: "A few nice words make us friends again.", exZh: "几句好话让我们重归于好。", social: false }
];

/* ---------- 重要句式 ---------- */
const PATTERNS = [
  { name: "ask sb to do sth", zh: "请／叫某人做某事", note: "ask 后面用“某人 + to + 动词原形”。",
    examples: [
      { en: "Tutu asks Duoduo to join them.", zh: "图图叫多多加入他们。" },
      { en: "Mum asks me to say sorry.", zh: "妈妈让我去道歉。" } ] },
  { name: "make sb/sth + 形容词", zh: "使……变得……", note: "make 后接“某人 + 形容词”，表示“让某人处于某种状态”。",
    examples: [
      { en: "This makes Duoduo unhappy.", zh: "这让多多很不开心。" },
      { en: "The story makes me sad.", zh: "这个故事让我难过。" } ] },
  { name: "make sb do sth", zh: "让某人做某事", note: "make 后接“某人 + 动词原形”（不加 to）。",
    examples: [
      { en: "Momo often makes me laugh.", zh: "毛毛常常逗我笑。" } ] },
  { name: "because 从句", zh: "因为……", note: "because 用来回答“为什么”，说明原因。★ 本单元核心语法",
    examples: [
      { en: "I'm unhappy because I'm not your friend now.", zh: "我不开心，因为我现在不是你的朋友了。" },
      { en: "We are friends because we are happy together.", zh: "我们是朋友，因为我们在一起很快乐。" } ] },
  { name: "but 表转折", zh: "但是……", note: "but 连接两个意思相反或转折的部分。★ 本单元核心语法",
    examples: [
      { en: "Tutu asks Duoduo to join them but Duoduo just walks away.", zh: "图图叫多多加入他们，但多多径直走开了。" },
      { en: "We want to be friends but we can't.", zh: "我们想做朋友，可是不行。" } ] },
  { name: "and 表并列", zh: "……和……；并且", note: "and 连接两个并列的词或句子。★ 本单元核心语法",
    examples: [
      { en: "We play games together and we always have fun.", zh: "我们一起做游戏，总是玩得很开心。" },
      { en: "Old friends and new friends are both very nice.", zh: "老朋友和新朋友都很好。" } ] },
  { name: "want to do sth", zh: "想要做某事", note: "want 后接 to + 动词原形。",
    examples: [
      { en: "He wants to play with Tutu.", zh: "他想和图图一起玩。" },
      { en: "We want to be friends.", zh: "我们想做朋友。" } ] },
  { name: "be friends with sb", zh: "和某人是朋友", note: "can't be friends with… 表示“不能和……做朋友”。",
    examples: [
      { en: "You can't be friends with Dog because you're so different.", zh: "你不能和狗做朋友，因为你们太不一样了。" } ] },
  { name: "Let's + 动词原形", zh: "让我们……吧", note: "Let's = Let us，表示建议，后面用动词原形。",
    examples: [
      { en: "Let's show them we aren't different.", zh: "让我们证明给他们看：我们并非不同。" },
      { en: "Let's talk to each other.", zh: "让我们彼此聊聊吧。" } ] },
  { name: "It's important to do sth", zh: "做某事很重要", note: "It 是形式主语，真正的主语是 to do…。",
    examples: [
      { en: "It's important to have friends.", zh: "有朋友很重要。" } ] },
  { name: "miss sb", zh: "想念某人", note: "主语是第三人称单数时用 misses（miss 以 s 结尾，加 -es）。",
    examples: [
      { en: "After a week, Duoduo feels sad and he misses Tutu.", zh: "一周后，多多感到难过，他想念图图。" } ] },
  { name: "both 的用法", zh: "（两者）都", note: "both 放在 be 动词后、实义动词前，指“两者都”。",
    examples: [
      { en: "Old friends and new friends are both very nice.", zh: "老朋友和新朋友都很好。" } ] }
];

/* ---------- 语法点（core=true 为本单元核心） ---------- */
const GRAMMAR_POINTS = [
  { core: true, title: "连词 and / but / because（本单元核心）",
    body: "<b>and</b> 表并列或顺承（“和、并且”）；<b>but</b> 表转折（“但是”）；<b>because</b> 表原因（“因为”）。",
    rules: [
      "并列、顺承 → and：We play games together <b>and</b> we always have fun.",
      "转折 → but：Tutu asks Duoduo to join them <b>but</b> Duoduo just walks away.",
      "原因 → because：I'm unhappy <b>because</b> I'm not your friend now."
    ],
    tip: "口诀：并列 and，转折 but，问为什么用 because。" },
  { core: true, title: "一般现在时 · 第三人称单数",
    body: "主语是第三人称单数（he / she / it / 单个人名）时，动词要加 -s 或 -es；主语是 I / you / we / they 或复数时用动词原形。",
    rules: [
      "Tutu ask<b>s</b> Duoduo to join them.（Tutu = he）",
      "Duoduo feel<b>s</b> sad. / He miss<b>es</b> Tutu.（miss 以 s 结尾加 -es）",
      "Bird eat<b>s</b> seeds. / Tutu sit<b>s</b> down. / Dad Dog say<b>s</b>…",
      "We share things. / They give each other gifts.（复数用原形）"
    ],
    tip: "see / hear 等动词三单直接加 -s；以 s, x, ch, sh, o 结尾的加 -es。" },
  { core: false, title: "人称代词与物主代词",
    body: "主格作主语，宾格作宾语，形容词性物主代词后面要跟名词。",
    rules: [
      "I–me–my；he–him–his；she–her–her；we–us–our；you–you–your；they–them–their",
      "Tutu asks Duoduo to join <b>them</b>.（they 的宾格）",
      "<b>His</b> best friend is Tutu.（his + 名词）"
    ],
    tip: "动词或介词后面的人要用宾格：join us / miss him / talk to her。" },
  { core: false, title: "祈使句与 Let's 句型",
    body: "祈使句以动词原形开头，表示请求或建议；Let's = Let us，后接动词原形。",
    rules: [
      "<b>Join</b> us! / <b>Say</b> sorry to Mia.",
      "<b>Let's</b> show them we aren't different.",
      "<b>Let's</b> stop and think together."
    ],
    tip: "否定祈使句：Don't walk away." },
  { core: false, title: "情态动词 can / can't",
    body: "can 表示“能、可以”，can't = cannot 表示“不能”，后面都接动词原形。",
    rules: [
      "You can't <b>be</b> friends with Dog.",
      "Then we can <b>be</b> friends — the best friends!"
    ],
    tip: "can 没有人称和数的变化。" },
  { core: false, title: "频率副词 always / often / sometimes",
    body: "频率副词放在实义动词之前、be 动词之后。",
    rules: [
      "We <b>often</b> read books, watch films and play games together.",
      "We <b>always</b> have fun.",
      "<b>Sometimes</b> I ask my parents for help."
    ],
    tip: "always > often > sometimes > never（频率从高到低）。" }
];

/* ---------- 语法选择题（含 In focus 三道连词题） ---------- */
const GRAMMAR_QS = [
  { q: "Tutu ___ Duoduo to join them.", opts: ["asks", "ask", "asking"], a: 0, exp: "主语 Tutu 是第三人称单数，动词加 -s：asks。" },
  { q: "After a week, Duoduo ___ sad.", opts: ["feels", "feel", "feeling"], a: 0, exp: "主语 Duoduo（he）是三单，动词加 -s：feels。" },
  { q: "I'm unhappy ___ I'm not your friend now.", opts: ["because", "and", "but"], a: 0, exp: "后面说明“不开心”的原因，用 because。" },
  { q: "We play games together ___ we always have fun.", opts: ["and", "but", "because"], a: 0, exp: "两个句子意思顺承、并列，用 and。" },
  { q: "Xiaojun and I have different hobbies ___ we enjoy talking to each other.", opts: ["but", "and", "so"], a: 0, exp: "爱好不同与聊得开心之间是转折，用 but。" },
  { q: "Momo often makes me laugh ___ he is funny.", opts: ["because", "but", "or"], a: 0, exp: "“他滑稽”是“逗我笑”的原因，用 because。" },
  { q: "He is very musical ___ we often sing together.", opts: ["and", "but", "because"], a: 0, exp: "前后意思并列顺承，用 and。" },
  { q: "Tutu asks Duoduo to join them ___ Duoduo just walks away.", opts: ["but", "and", "because"], a: 0, exp: "被邀请与走开之间是转折，用 but。" },
  { q: "Old friends and new friends are ___ very nice.", opts: ["both", "all", "too"], a: 0, exp: "两类朋友（两者）都很好，用 both。" },
  { q: "___ show them we aren't different.", opts: ["Let's", "Lets", "Let us to"], a: 0, exp: "Let's = Let us，后接动词原形。" },
  { q: "You can't ___ friends with Dog.", opts: ["be", "is", "are"], a: 0, exp: "can't 后接动词原形 be。" },
  { q: "He wants ___ play with Tutu.", opts: ["to", "for", "with"], a: 0, exp: "want to do sth 想要做某事。" },
  { q: "This ___ Duoduo unhappy.", opts: ["makes", "make", "making"], a: 0, exp: "This（it）是三单，用 makes；make sb + 形容词。" },
  { q: "I am small and you ___ big.", opts: ["are", "is", "am"], a: 0, exp: "主语 you 用 are。" },
  { q: "I eat seeds and you ___ meat.", opts: ["eat", "eats", "eating"], a: 0, exp: "主语 you 用动词原形 eat。" },
  { q: "Momo and I often ___ together.", opts: ["sing", "sings", "singing"], a: 0, exp: "主语 Momo and I 是复数，用动词原形 sing。" },
  { q: "Why are you looking ___?", opts: ["worried", "worry", "worries"], a: 0, exp: "look + 形容词，表示“看起来……”。" },
  { q: "We talk ___ with each other.", opts: ["openly", "open", "opening"], a: 0, exp: "修饰动词 talk 用副词 openly。" },
  { q: "Friends share ___ each other.", opts: ["with", "to", "for"], a: 0, exp: "share with each other 固定搭配：彼此分享。" },
  { q: "First, ___ sorry to Mia.", opts: ["say", "says", "saying"], a: 0, exp: "祈使句以动词原形开头。" },
  { q: "Friends should be ___ to each other.", opts: ["kind", "kindly", "kinds"], a: 0, exp: "be 动词后接形容词 kind。" },
  { q: "Every year, people around the world ___ the day.", opts: ["celebrate", "celebrates", "celebrating"], a: 0, exp: "people 是复数，用动词原形 celebrate。" },
  { q: "He ___ his best friend very much.", opts: ["misses", "miss", "missing"], a: 0, exp: "he 是三单；miss 以 s 结尾加 -es：misses。" },
  { q: "Let's stop and ___ together.", opts: ["think", "thinks", "thinking"], a: 0, exp: "Let's 后接动词原形 think。" },
  { q: "We are friends ___ we are happy together.", opts: ["because", "but", "or"], a: 0, exp: "“在一起很快乐”是“我们是朋友”的原因，用 because。" },
  { q: "It's important ___ have friends.", opts: ["to", "for", "of"], a: 0, exp: "It's important to do sth 做某事很重要。" },
  { q: "A few nice words make ___ friends again.", opts: ["us", "we", "our"], a: 0, exp: "动词 make 后用宾格 us。" },
  { q: "Duoduo wants ___ to join them.", opts: ["them", "they", "their"], a: 0, exp: "动词后面的人称代词用宾格 them。" }
];

/* ---------- 写一写（and / but / because 连句练习，参考答案可揭晓） ---------- */
const WRITE_TASKS = [
  { prompt: "用 and 连接两句：We play games together. / We always have fun.",
    ref: "We play games together and we always have fun.", exp: "意思顺承，用 and 并列。" },
  { prompt: "用 but 连接两句：Tutu asks Duoduo to join them. / Duoduo just walks away.",
    ref: "Tutu asks Duoduo to join them but Duoduo just walks away.", exp: "意思转折，用 but。" },
  { prompt: "用 because 连接两句：I'm unhappy. / I'm not your friend now.",
    ref: "I'm unhappy because I'm not your friend now.", exp: "后面是原因，用 because。" },
  { prompt: "补全：Momo often makes me laugh ___（他很有趣）.",
    ref: "Momo often makes me laugh because he is funny.", exp: "原因用 because 引出。" },
  { prompt: "自由写：用 because 写一句你和好朋友是朋友的原因。",
    ref: "We are friends because we are happy together.", exp: "参考句，答案不唯一。" }
];

/* ---------- 口语任务 ---------- */
const SPEAK_TASK = {
  title: "1 分钟介绍你最好的朋友",
  frames: [
    "My best friend is ___.",
    "We often ___ and ___ together.",
    "We help each other. We share things.",
    "My friend is different from me, but ___.",
    "We are friends because ___.",
    "We're happy together!"
  ],
  tip: "先照着句框说，再脱稿说一遍；说的时候别忘了三单动词加 -s 哦！"
};

/* ---------- 故事排序（复述故事 support） ---------- */
const STORY_EVENTS = [
  { t: "Tutu is playing with two other boys.", zh: "图图在和另外两个男孩一起玩。" },
  { t: "Duoduo just walks away.", zh: "多多径直走开了。" },
  { t: "After a week, Duoduo feels sad and he misses Tutu.", zh: "一周后，多多很难过，他想念图图。" },
  { t: "Tutu sits down next to Duoduo and says hello.", zh: "图图坐到多多旁边向他问好。" },
  { t: "Tutu says old friends and new friends are both very nice.", zh: "图图说老朋友和新朋友都很好。" },
  { t: "Now Duoduo has three best friends!", zh: "现在多多有了三个最好的朋友！" }
];

/* ---------- 教材配套原声（淘知学堂《小学教材全解》） ---------- */
const TEXTBOOK_TRACKS = [
  { file: "textbook_audio/01_Start_up_1_Read_and_answer.mp3", title: "Start up · 1 Read and answer", zh: "课文朗读：Duoduo's best friends", sec: 2, dur: "1:49" },
  { file: "textbook_audio/02_Speed_up_1_Read_and_answer.mp3", title: "Speed up · 1 Read and answer", zh: "故事朗读：Can the bird and the dog be friends?", sec: 4, dur: "1:27" },
  { file: "textbook_audio/03_Fuel_up_1_Listen_and_chant.mp3", title: "Fuel up · 1 Listen and chant", zh: "课本韵律诗：We're friends again!", sec: 5, dur: "2:05" },
  { file: "textbook_audio/04_Fuel_up_3_Listen_and_choose.mp3", title: "Fuel up · 3 Listen and choose", zh: "课本听力：Sally & Mia", sec: 6, dur: "1:17" }
];

/* ---------- Sally & Mia 听力场景文本 ---------- */
const SALLY_TEXT = "Why are Sally and Mia angry with each other? They have different plans for their science homework. Sally, do these. Then you and Mia can be happy friends again. First, say sorry to Mia because friends should be kind to each other. Then have a chat with Mia. Friends should listen to each other. Try to find the best plan for the homework.";

/* ---------- 听力句子（听句选句） ---------- */
const LISTEN_SENTS = [
  "Tutu asks Duoduo to join them but Duoduo just walks away.",
  "After a week, Duoduo feels sad and he misses Tutu.",
  "I'm unhappy because I'm not your friend now.",
  "Old friends and new friends are both very nice.",
  "Now Duoduo has three best friends!",
  "You can't be friends with Dog because you're so different.",
  "Let's show them we aren't different.",
  "I am small and you are big.",
  "I eat seeds and you eat meat.",
  "We want to be friends but we can't.",
  "Friends play together and friends share with each other.",
  "We've got a problem today.",
  "Let's stop and think together.",
  "A few nice words make us friends again.",
  "We often read books, watch films and play games together.",
  "We help each other. We share things.",
  "Every year, 30 July is the International Day of Friendship.",
  "Friends eat out or have a meal at home.",
  "They give each other gifts, cards and best wishes."
];

/* ---------- 听力短文（听短文答题） ---------- */
const PASSAGES = [
  { title: "Duoduo's best friends（节选）", audioFile: "textbook_audio/01_Start_up_1_Read_and_answer.mp3",
    sents: [
      "For Duoduo, Tutu is his best and only friend.",
      "He wants to play with Tutu, but Tutu is playing with two other boys.",
      "This makes Duoduo unhappy.",
      "After a week, Duoduo feels sad and he misses Tutu.",
      "Just then, Tutu sits down next to him.",
      "Now Duoduo has three best friends!"
    ],
    qs: [
      { q: "How many best friends does Duoduo have now?", opts: ["Three.", "One.", "Two.", "Four."], a: 0, exp: "短文最后一句：Now Duoduo has three best friends!" },
      { q: "Why is Duoduo unhappy at first?", opts: ["Because Tutu is playing with two other boys.", "Because he has no homework.", "Because it is raining.", "Because he is ill."], a: 0, exp: "Tutu 在和别人玩，多多觉得不开心。" },
      { q: "What does Duoduo do after a week?", opts: ["He feels sad and misses Tutu.", "He finds a new friend.", "He moves to a new school.", "He plays with Tutu every day."], a: 0, exp: "After a week, Duoduo feels sad and he misses Tutu." }
    ] },
  { title: "The International Day of Friendship（国际友谊日）",
    sents: [
      "Every year, 30 July is the United Nations International Day of Friendship.",
      "People around the world celebrate the day.",
      "It is about friendship between people, countries and cultures.",
      "On this day, friends have a happy time together.",
      "Friends eat out or have a meal at home.",
      "They give each other gifts, cards and best wishes."
    ],
    qs: [
      { q: "When is the International Day of Friendship?", opts: ["On 30 July.", "On 30 June.", "On 13 July.", "On 3 October."], a: 0, exp: "短文第一句：30 July。" },
      { q: "What is the day about?", opts: ["Friendship between people, countries and cultures.", "Food from different countries.", "Animals around the world.", "A big football game."], a: 0, exp: "It is about friendship between people, countries and cultures." },
      { q: "How do people celebrate the day?", opts: ["They eat out and give each other gifts, cards and best wishes.", "They stay at home and sleep all day.", "They go to school as usual.", "They watch TV alone."], a: 0, exp: "Friends eat out or have a meal at home. They give each other gifts, cards and best wishes." }
    ] }
];

/* ---------- 故事判断题（Read again and write ✓ or ✗） ---------- */
const STORY_TF = [
  { s: "Tutu asks Duoduo to play together and Duoduo joins them.", ok: false, exp: "多多没有加入，他径直走开了。" },
  { s: "Duoduo misses Tutu and he thinks Tutu may not miss him.", ok: true, exp: "多多想念图图，并觉得图图可能不会想念他。" },
  { s: "Tutu has new friends and he is not Duoduo's friend now.", ok: false, exp: "图图说“you're still my friend”，他们仍是朋友。" },
  { s: "Duoduo makes friends with the other two boys.", ok: true, exp: "结尾多多有了三个最好的朋友。" }
];

/* ---------- 课文（学习卡内容：en / zh 逐行对照） ---------- */
const UNIT_TEXT = [
  { icon: "🎯", title: "Unit goals 单元目标", lines: [
    { en: "In this unit, we will learn to...", zh: "在本单元，我们将学会……" },
    { en: "use words and expressions about friendship;", zh: "使用关于友谊的词汇和表达；" },
    { en: "talk about best friends;", zh: "谈论最好的朋友；" },
    { en: "get along with our friends.", zh: "与朋友们和睦相处。" },
    { en: "How can you be a good friend?", zh: "怎样才能成为一个好朋友？" } ] },
  { icon: "🔥", title: "Get ready 热身：相处之道", lines: [
    { en: "help each other", zh: "互相帮助" },
    { en: "take care of each other", zh: "互相照顾" },
    { en: "listen to each other", zh: "互相倾听" },
    { en: "share things", zh: "分享东西" },
    { en: "do happy things together", zh: "一起做开心的事" },
    { en: "be happy for each other", zh: "为彼此高兴" },
    { en: "— This is nice!  — Yes, it is.", zh: "——这真不错！——是啊。" } ] },
  { icon: "📖", title: "Read and answer 课文：Duoduo's best friends", lines: [
    { en: "How many best friends does Duoduo have now?", zh: "多多现在有几个最好的朋友？", q: true },
    { en: "For Duoduo, Tutu is his best and only friend.", zh: "对多多来说，图图是他最好也是唯一的朋友。" },
    { en: "He wants to play with Tutu, but Tutu is playing with two other boys.", zh: "他想和图图一起玩，可图图正在和另外两个男孩玩。" },
    { en: "This makes Duoduo unhappy.", zh: "这让多多很不开心。" },
    { en: "Tutu asks Duoduo to join them but Duoduo just walks away.", zh: "图图叫多多加入他们，但多多径直走开了。" },
    { en: "After a week, Duoduo feels sad and he misses Tutu.", zh: "一周后，多多感到难过，他想念图图。" },
    { en: "\u201cBut Tutu may not miss me because he has new friends,\u201d Duoduo thinks.", zh: "多多心想：\u201c可图图可能不会想我，因为他有新朋友了。\u201d" },
    { en: "Just then, Tutu sits down next to him. \u201cHi Duoduo. How are you?\u201d Tutu asks.", zh: "就在这时，图图在他旁边坐下。\u201c嗨，多多。你好吗？\u201d图图问。" },
    { en: "\u201cI'm unhappy because I'm not your friend now,\u201d answers Duoduo.", zh: "\u201c我不开心，因为我现在不是你的朋友了。\u201d多多回答。" },
    { en: "\u201cWhy do you say that?\u201d says Tutu. \u201cYes, I have new friends, but you're still my friend.", zh: "\u201c你为什么这么说？\u201d图图说，\u201c没错，我有新朋友了，但你仍然是我的朋友。" },
    { en: "Old friends and new friends are both very nice. Join us and they can be your friends, too.\u201d", zh: "老朋友和新朋友都很好。加入我们吧，他们也能成为你的朋友。\u201d" },
    { en: "Now Duoduo has three best friends!", zh: "现在多多有了三个最好的朋友！" } ] },
  { icon: "🔎", title: "In focus 句式聚焦", lines: [
    { en: "Tutu asks Duoduo to join them but Duoduo just walks away.", zh: "（but 转折）图图叫多多加入他们，但多多径直走开了。" },
    { en: "After a week, Duoduo feels sad and he misses Tutu.", zh: "（and 并列 / 三单）一周后，多多感到难过，他想念图图。" },
    { en: "I'm unhappy because I'm not your friend now.", zh: "（because 原因）我不开心，因为我现在不是你的朋友了。" } ] },
  { icon: "🐾", title: "Story time 故事：Can the bird and the dog be friends?", lines: [
    { en: "Can the bird and the dog be friends?", zh: "小鸟和小狗能成为朋友吗？", q: true },
    { en: "Mum Bird: You can't be friends with Dog because you're so different.", zh: "鸟妈妈：你不能和狗做朋友，因为你们太不一样了。" },
    { en: "Dad Dog: You can't be friends with Bird because you're so different.", zh: "狗爸爸：你不能和鸟做朋友，因为你们太不一样了。" },
    { en: "Bird: Let's show them we aren't different. Then we can be friends.", zh: "小鸟：让我们证明给他们看，我们并非不同。那样我们就能做朋友了。" },
    { en: "Dog: Good idea!", zh: "小狗：好主意！" },
    { en: "Bird: I am small and you are big. I eat seeds and you eat meat. I fly and you run. Er, what do we share?", zh: "小鸟：我小，你大。我吃种子，你吃肉。我会飞，你会跑。呃，我们能分享什么呢？" },
    { en: "Rabbit: Hey, why are you looking worried?", zh: "兔子：嘿，你们为什么看起来愁眉苦脸的？" },
    { en: "Dog: We want to be friends but we can't. We are so different.", zh: "小狗：我们想做朋友，可是不行。我们太不一样了。" },
    { en: "Rabbit: But we are friends because we are happy together.", zh: "兔子：可我们是朋友，因为我们在一起很快乐。" },
    { en: "Rabbit: Friends play together and friends share with each other. That's the key.", zh: "兔子：朋友一起玩耍，朋友彼此分享。这就是关键。" },
    { en: "Bird & Dog: Let's show this to our parents. Then we can be friends — the best friends!", zh: "小鸟和小狗：让我们把这个证明给爸爸妈妈看。那样我们就能做朋友了——最好的朋友！" } ] },
  { icon: "🎵", title: "Listen and chant 韵律诗：We're friends again!", lines: [
    { en: "We're friends again!", zh: "我们又是朋友啦！" },
    { en: "We've got a problem today.", zh: "我们今天遇到了一个难题。" },
    { en: "And it's getting in the way.", zh: "这事正碍着呢。" },
    { en: "You want to stay at home and play.", zh: "你想待在家里玩。" },
    { en: "I want to go out and try something new.", zh: "我想出去尝试点新东西。" },
    { en: "Let's stop and think together.", zh: "让我们停下来一起想想。" },
    { en: "Let's talk to each other.", zh: "让我们彼此谈一谈。" },
    { en: "We can find a game for me and you.", zh: "我们能找到一个你我都喜欢的游戏。" },
    { en: "A few nice words make us friends again, phew!", zh: "几句好话让我们重归于好，呼！" },
    { en: "Read the chant and write: Which words have the same sound \"ew\"? new, few, phew", zh: "读一读，写一写：哪些词含相同的发音 /juː/？→ new, few, phew", q: true } ] },
  { icon: "👂", title: "Listen Sally & Mia（听力场景）", lines: [
    { en: "Why are Sally and Mia angry with each other?", zh: "萨莉和米娅为什么互相生气？", q: true },
    { en: "a. Because they want to do different things on Saturday.", zh: "a. 因为她们周六想做不同的事情。" },
    { en: "b. Because they don't want to share things.", zh: "b. 因为她们不想分享东西。" },
    { en: "c. Because they have different plans for their science homework.", zh: "c. 因为她们的科学作业有不同的计划。（参考答案 c）", q: true },
    { en: "Sally, do these. Then you and Mia can be happy friends again.", zh: "萨莉，照着做。这样你和米娅就能重新成为快乐的朋友。" },
    { en: "First, say sorry to Mia because friends should be kind to each other.", zh: "首先，向米娅道歉，因为朋友之间应该友善相待。" },
    { en: "Then have a chat with Mia. Friends should listen to each other.", zh: "然后和米娅聊一聊。朋友应该互相倾听。" },
    { en: "Try to find the best plan for the homework.", zh: "努力为作业找到最好的计划。" },
    { en: "Sometimes my friends and I have problems, but we often talk openly.", zh: "有时我和朋友们会有矛盾，但我们常常坦诚交流。" },
    { en: "Sometimes I ask my parents for help.", zh: "有时我会请父母帮忙。" } ] },
  { icon: "🎨", title: "Hit it big 海报范例", lines: [
    { en: "Feifei, Taotao, Wenwen and Lili are my best friends.", zh: "菲菲、涛涛、文文和丽丽是我最好的朋友。" },
    { en: "We often read books, watch films and play games together.", zh: "我们经常一起看书、看电影和做游戏。" },
    { en: "We help each other. We share things.", zh: "我们互相帮助。我们分享东西。" },
    { en: "We talk openly with each other.", zh: "我们彼此坦诚交流。" },
    { en: "We're happy together.", zh: "我们在一起很快乐。" } ] },
  { icon: "🌍", title: "Let's explore 国际友谊日", lines: [
    { en: "Every year, 30 July is the United Nations International Day of Friendship.", zh: "每年的7月30日是联合国国际友谊日。" },
    { en: "People around the world celebrate the day.", zh: "全世界的人们都会庆祝这一天。" },
    { en: "It is about friendship between people, countries and cultures.", zh: "它关乎人与人、国与国、不同文化之间的友谊。" },
    { en: "On this day, friends have a happy time together.", zh: "在这一天，朋友们一起度过快乐时光。" },
    { en: "There are many ways to celebrate the day.", zh: "庆祝这一天的方式有很多。" },
    { en: "Friends eat out or have a meal at home.", zh: "朋友们可以下馆子，或者在家吃一顿饭。" },
    { en: "They give each other gifts, cards and best wishes.", zh: "他们互赠礼物、贺卡和最美好的祝愿。" } ] }
];

/* ---------- 生词本预录数据（来自学习档案，29 条） ---------- */
const SEED_SRS = [
  { en: "friendship", zh: "友谊", ex: "Keep your friendship strong." },
  { en: "best friend", zh: "最好的朋友", ex: "Tutu is his best friend." },
  { en: "hobby (hobbies)", zh: "爱好", ex: "We have different hobbies." },
  { en: "problem", zh: "问题；难题", ex: "We've got a problem today." },
  { en: "difference", zh: "不同之处", ex: "One difference between you and your friends." },
  { en: "similarity", zh: "相似之处", ex: "Tell one similarity." },
  { en: "wish (wishes)", zh: "祝愿", ex: "Gifts, cards and best wishes." },
  { en: "happy / unhappy", zh: "开心的 / 不开心的", ex: "We're happy together." },
  { en: "different", zh: "不同的", ex: "You're so different." },
  { en: "similar", zh: "相似的", ex: "Be similar to." },
  { en: "musical", zh: "有音乐天赋的", ex: "He is very musical." },
  { en: "funny", zh: "滑稽的，爱逗人笑的", ex: "He is funny." },
  { en: "cool", zh: "酷的；棒的", ex: "He's very cool." },
  { en: "worried", zh: "担心的，发愁的", ex: "Looking worried." },
  { en: "openly", zh: "坦诚地", ex: "Talk openly with each other." },
  { en: "share", zh: "分享", ex: "Friends share with each other." },
  { en: "miss", zh: "想念", ex: "He misses Tutu." },
  { en: "join", zh: "加入", ex: "Join us!" },
  { en: "walk away", zh: "走开", ex: "Duoduo just walks away." },
  { en: "make friends", zh: "交朋友", ex: "Make friends with..." },
  { en: "get along with", zh: "与……相处", ex: "Get along with our friends." },
  { en: "celebrate", zh: "庆祝", ex: "Celebrate the day." },
  { en: "help each other", zh: "互相帮助", ex: "We help each other." },
  { en: "take care of each other", zh: "互相照顾", ex: "Take care of each other." },
  { en: "listen to each other", zh: "互相倾听", ex: "Listen to each other." },
  { en: "talk openly", zh: "坦诚交谈", ex: "We talk openly with each other." },
  { en: "be different from", zh: "与……不同", ex: "My friend is different from me." },
  { en: "make friends again", zh: "重归于好", ex: "Make us friends again." },
  { en: "International Day of Friendship", zh: "国际友谊日", ex: "The United Nations International Day of Friendship." }
];

/* ================= 自定义课文解析词典 ================= */

/* 常用词词典：word -> "词性|中文" */
const DICT = {
  "a":"art.一(个)","an":"art.一(个)","the":"art.这个；那个","and":"conj.和；并且","but":"conj.但是","or":"conj.或者","because":"conj.因为","so":"conj.所以","if":"conj.如果","when":"conj.当……时","then":"adv.然后；那时","too":"adv.也","also":"adv.也","very":"adv.非常","not":"adv.不","no":"adv.不；不是","yes":"adv.是；对","both":"adj.两个都","all":"adj.全部的","some":"adj.一些","any":"adj.任何的","many":"adj.许多","much":"adj.许多","few":"adj.很少的","little":"adj.小的；少的","this":"pron.这；这个","that":"pron.那；那个","these":"pron.这些","those":"pron.那些","i":"pron.我","you":"pron.你；你们","he":"pron.他","she":"pron.她","it":"pron.它","we":"pron.我们","they":"pron.他(她/它)们","me":"pron.我(宾格)","him":"pron.他(宾格)","her":"pron.她(宾格)","us":"pron.我们(宾格)","them":"pron.他(她/它)们(宾格)","my":"det.我的","your":"det.你的；你们的","his":"det.他的","its":"det.它的","our":"det.我们的","their":"det.他(她/它)们的","here":"adv.这里","there":"adv.那里","what":"pron.什么","who":"pron.谁","why":"adv.为什么","how":"adv.怎样","where":"adv.在哪里","which":"pron.哪一个","again":"adv.再；又","always":"adv.总是","often":"adv.经常","sometimes":"adv.有时","never":"adv.从不","usually":"adv.通常","now":"adv.现在","today":"adv.今天","tomorrow":"n.明天","yesterday":"n.昨天","every":"det.每一","each":"det.每个","other":"adj.其他的","together":"adv.一起","with":"prep.和……一起","without":"prep.没有","for":"prep.为了","to":"prep.到；向","of":"prep.……的","in":"prep.在……里","on":"prep.在……上","at":"prep.在","by":"prep.通过；乘","from":"prep.从","up":"adv.向上","down":"adv.向下","out":"adv.出去","off":"adv.离开","over":"prep.在……上方","under":"prep.在……下面","next":"adj.下一个","near":"prep.在……附近","between":"prep.在……之间","around":"prep.围绕；到处","about":"prep.关于","after":"prep.在……之后","before":"prep.在……之前","behind":"prep.在……后面","into":"prep.进入",
  "be":"v.是","am":"v.是","is":"v.是","are":"v.是","was":"v.是(be过去式)","were":"v.是(be过去式)",
  "can":"v.能；可以","can't":"v.不能","could":"v.能(can过去式)","will":"v.将要；会","won't":"v.将不会",
  "would":"v.将会；想(委婉)","should":"v.应该","shall":"v.将要","may":"v.可以；可能","might":"v.可能",
  "must":"v.必须","don't":"v.不(=do not)","doesn't":"v.不(三单)","didn't":"v.不(过去式)",
  "isn't":"v.不是","aren't":"v.不是(复数)","i'm":"pron.我是","it's":"pron.它是","that's":"pron.那是",
  "let's":"v.让我们","we're":"pron.我们是","they're":"pron.他们(她/它)们是","he's":"pron.他是","she's":"pron.她是","do":"v.做；助动词","does":"v.做(do三单)","did":"v.做(do过去式)","have":"v.有","has":"v.有(三单)","had":"v.有(have过去式)","go":"v.去","goes":"v.去(三单)","went":"v.去(go过去式)","come":"v.来","comes":"v.来(三单)","came":"v.来(come过去式)","run":"v.跑","runs":"v.跑(三单)","walk":"v.走路","walks":"v.走路(三单)","sit":"v.坐","sits":"v.坐(三单)","stand":"v.站","jump":"v.跳","fly":"v.飞；放(风筝)","flies":"v.飞(三单)","swim":"v.游泳","sing":"v.唱歌","sings":"v.唱歌(三单)","dance":"v.跳舞","draw":"v.画画","read":"v.读","reads":"v.读(三单)","write":"v.写","writes":"v.写(三单)","say":"v.说","says":"v.说(三单)","said":"v.说(say过去式)","speak":"v.说话","talk":"v.谈话","talks":"v.谈话(三单)","tell":"v.告诉","tells":"v.告诉(三单)","ask":"v.问；请求","asks":"v.问；请求(三单)","answer":"v.回答","listen":"v.听","hear":"v.听见","look":"v.看；看起来","looks":"v.看(三单)","see":"v.看见","sees":"v.看见(三单)","watch":"v.观看","watches":"v.观看(三单)","play":"v.玩；踢(球)","plays":"v.玩(三单)","like":"v.喜欢","likes":"v.喜欢(三单)","love":"v.爱","loves":"v.爱(三单)","want":"v.想要","wants":"v.想要(三单)","need":"v.需要","help":"v.帮助","helps":"v.帮助(三单)","give":"v.给","gives":"v.给(三单)","gave":"v.给(give过去式)","get":"v.得到","gets":"v.得到(三单)","take":"v.拿；带走","takes":"v.拿(三单)","bring":"v.带来","make":"v.制作；使","makes":"v.制作；使(三单)","made":"v.制作(make过去式)","let":"v.让","puts":"v.放(三单)","open":"v.打开；adj.开着的","close":"v.关闭","eat":"v.吃","eats":"v.吃(三单)","ate":"v.吃(eat过去式)","drink":"v.喝","sleep":"v.睡觉","wash":"v.洗","clean":"v.打扫；adj.干净的","cook":"v.做饭；厨师","buy":"v.买","buys":"v.买(三单)","find":"v.找到","finds":"v.找到(三单)","lose":"v.丢失","meet":"v.遇见","meets":"v.遇见(三单)","miss":"v.想念；错过","misses":"v.想念(三单)","missed":"v.想念(miss过去式)","join":"v.加入","joins":"v.加入(三单)","joined":"v.加入(join过去式)","share":"v.分享","shares":"v.分享(三单)","shared":"v.分享(share过去式)","feel":"v.感觉","feels":"v.感觉(三单)","felt":"v.感觉(feel过去式)","laugh":"v.笑","laughs":"v.笑(三单)","cry":"v.哭","smile":"v.微笑","think":"v.想；认为","thinks":"v.想(三单)","know":"v.知道","knows":"v.知道(三单)","learn":"v.学习；学会","learns":"v.学习(三单)","study":"v.学习；书房","studies":"v.学习(三单)","teach":"v.教","teaches":"v.教(三单)","try":"v.尝试；努力","tries":"v.尝试(三单)","use":"v.使用","work":"v.工作；起作用","works":"v.工作(三单)","wait":"v.等待","waits":"v.等待(三单)","visit":"v.参观；拜访","travel":"v.旅行","ride":"v.骑","drive":"v.驾驶","stop":"v.停止","stops":"v.停止(三单)","start":"v.开始","starts":"v.开始(三单)","begin":"v.开始","finish":"v.完成","finishes":"v.完成(三单)","keep":"v.保持","keeps":"v.保持(三单)","show":"v.给……看；展示","shows":"v.展示(三单)","wish":"v./n.祝愿；希望","wishes":"n.祝愿(复数)","celebrate":"v.庆祝","celebrates":"v.庆祝(三单)","celebrated":"v.庆祝(celebrate过去式)","invite":"v.邀请","move":"v.移动；搬家","turn":"v.转动；变成","wear":"v.穿","carry":"v.携带","push":"v.推","pull":"v.拉","throw":"v.扔","catch":"v.接住；抓","kick":"v.踢","climb":"v.爬","fall":"v.落下","grow":"v.生长","live":"v.居住；生活","lives":"v.居住(三单)","stay":"v.停留；待","stays":"v.待(三单)","leave":"v.离开","leaves":"v.离开(三单)","arrive":"v.到达","return":"v.返回","call":"v.称呼；打电话","phone":"v./n.打电话；电话","send":"v.发送","sends":"v.发送(三单)","look after":"v.照顾",
  "friend":"n.朋友","friends":"n.朋友(复数)","friendship":"n.友谊","family":"n.家庭","father":"n.父亲","mother":"n.母亲","dad":"n.爸爸","mum":"n.妈妈","mom":"n.妈妈","brother":"n.兄弟","sister":"n.姐妹","grandpa":"n.爷爷；外公","grandma":"n.奶奶；外婆","uncle":"n.叔叔；舅舅","aunt":"n.姑姑；阿姨","cousin":"n.堂(表)兄弟姐妹","baby":"n.婴儿","boy":"n.男孩","boys":"n.男孩(复数)","girl":"n.女孩","girls":"n.女孩(复数)","man":"n.男人","woman":"n.女人","people":"n.人们","person":"n.人","child":"n.孩子","children":"n.孩子们","name":"n.名字","home":"n.家","house":"n.房子","room":"n.房间","school":"n.学校","class":"n.班级；课","classroom":"n.教室","teacher":"n.老师","student":"n.学生","pupil":"n.小学生","desk":"n.书桌","chair":"n.椅子","book":"n.书","books":"n.书(复数)","pen":"n.钢笔","pencil":"n.铅笔","ruler":"n.尺子","eraser":"n.橡皮","bag":"n.包","schoolbag":"n.书包","ball":"n.球","game":"n.游戏；比赛","games":"n.游戏(复数)","toy":"n.玩具","kite":"n.风筝","bike":"n.自行车","car":"n.汽车","bus":"n.公共汽车","train":"n.火车","plane":"n.飞机","ship":"n.轮船","boat":"n.小船","street":"n.街道","road":"n.马路","park":"n.公园","zoo":"n.动物园","shop":"n.商店","farm":"n.农场","city":"n.城市","country":"n.国家；乡村","countries":"n.国家(复数)","world":"n.世界","day":"n.天；日","days":"n.天(复数)","week":"n.周；星期","weeks":"n.周(复数)","month":"n.月份","year":"n.年","years":"n.年(复数)","morning":"n.早晨","afternoon":"n.下午","evening":"n.晚上","night":"n.夜晚","time":"n.时间；次","hour":"n.小时","birthday":"n.生日","party":"n.聚会","film":"n.电影","films":"n.电影(复数)","movie":"n.电影","song":"n.歌曲","music":"n.音乐","photo":"n.照片","photos":"n.照片(复数)","picture":"n.图片","story":"n.故事","stories":"n.故事(复数)","word":"n.单词","words":"n.单词(复数)","sentence":"n.句子","question":"n.问题","homework":"n.作业","lesson":"n.课；教训","english":"n.英语","chinese":"n.语文；中文","maths":"n.数学","math":"n.数学","science":"n.科学","art":"n.美术","food":"n.食物","rice":"n.米饭","bread":"n.面包","milk":"n.牛奶","egg":"n.鸡蛋","meat":"n.肉","chicken":"n.鸡肉；小鸡","fruit":"n.水果","apple":"n.苹果","apples":"n.苹果(复数)","banana":"n.香蕉","orange":"n.橘子；橙色","grape":"n.葡萄","pear":"n.梨","water":"n.水","juice":"n.果汁","cake":"n.蛋糕","sweets":"n.糖果(复数)","vegetable":"n.蔬菜","potato":"n.土豆","tomato":"n.西红柿","carrot":"n.胡萝卜","seed":"n.种子","seeds":"n.种子(复数)","tree":"n.树","flower":"n.花","flowers":"n.花(复数)","grass":"n.草","dog":"n.狗","dogs":"n.狗(复数)","cat":"n.猫","bird":"n.鸟","birds":"n.鸟(复数)","rabbit":"n.兔子","duck":"n.鸭子","pig":"n.猪","cow":"n.奶牛","sheep":"n.绵羊","horse":"n.马","monkey":"n.猴子","panda":"n.熊猫","tiger":"n.老虎","lion":"n.狮子","elephant":"n.大象","bear":"n.熊","wolf":"n.狼","fox":"n.狐狸","mouse":"n.老鼠","head":"n.头","face":"n.脸","eye":"n.眼睛","ear":"n.耳朵","nose":"n.鼻子","mouth":"n.嘴巴","hand":"n.手","arm":"n.手臂","leg":"n.腿","foot":"n.脚","hair":"n.头发","body":"n.身体","red":"adj.红色的","yellow":"adj.黄色的","blue":"adj.蓝色的","green":"adj.绿色的","black":"adj.黑色的","white":"adj.白色的","brown":"adj.棕色的","pink":"adj.粉色的","purple":"adj.紫色的","number":"n.数字","one":"num.一","two":"num.二","three":"num.三","four":"num.四","five":"num.五","six":"num.六","seven":"num.七","eight":"num.八","nine":"num.九","ten":"num.十","gift":"n.礼物","gifts":"n.礼物(复数)","present":"n.礼物","card":"n.卡片","cards":"n.卡片(复数)","key":"n.钥匙；关键","problem":"n.问题；难题","problems":"n.问题(复数)","plan":"n./v.计划","plans":"n.计划(复数)","idea":"n.主意","ideas":"n.主意(复数)","rule":"n.规则","rules":"n.规则(复数)","secret":"n.秘密","letter":"n.信","dream":"n.梦想","hobby":"n.爱好","hobbies":"n.爱好(复数)","sport":"n.运动","sports":"n.运动(复数)","football":"n.足球","basketball":"n.篮球","swimming":"n.游泳","running":"n.跑步","weather":"n.天气","rain":"n./v.雨；下雨","snow":"n./v.雪；下雪","wind":"n.风","sun":"n.太阳","moon":"n.月亮","star":"n.星星","breakfast":"n.早餐","lunch":"n.午餐","dinner":"n.晚餐","meal":"n.一餐","holidays":"n.假期(复数)","holiday":"n.假期","weekend":"n.周末","way":"n.路；方法","ways":"n.方法(复数)","thing":"n.事情；东西","things":"n.东西(复数)","something":"pron.某事；某物","anything":"pron.任何事物","nothing":"pron.没有什么","saturday":"n.星期六","sunday":"n.星期日","monday":"n.星期一","friday":"n.星期五","july":"n.七月","united":"adj.联合的","nations":"n.国家(复数)","international":"adj.国际的","culture":"n.文化","cultures":"n.文化(复数)","sound":"n.声音；v.听起来","sounds":"v.听起来(三单)","voice":"n.嗓音","pair":"n.一对；一双","group":"n.小组","life":"n.生活","love":"n.爱","fun":"n.乐趣","care":"n./v.关心；照顾","doctor":"n.医生","nurse":"n.护士","everywhere":"adv.到处","teacher":"n.老师","poster":"n.海报","exercise":"n.练习；锻炼","example":"n.例子",
  "good":"adj.好的","nice":"adj.好的；友好的","fine":"adj.好的；晴朗的","great":"adj.极好的","happy":"adj.开心的","sad":"adj.悲伤的","unhappy":"adj.不开心的","angry":"adj.生气的","glad":"adj.高兴的","kind":"adj.友善的","kindly":"adv.友善地","friendly":"adj.友好的","cool":"adj.酷的","funny":"adj.滑稽的","cute":"adj.可爱的","lovely":"adj.可爱的","beautiful":"adj.美丽的","pretty":"adj.漂亮的","big":"adj.大的","small":"adj.小的","long":"adj.长的","short":"adj.短的；矮的","tall":"adj.高的","high":"adj.高的","fat":"adj.胖的","thin":"adj.瘦的","new":"adj.新的","old":"adj.老的；旧的","young":"adj.年轻的","hot":"adj.热的","cold":"adj.冷的","warm":"adj.温暖的","dry":"adj.干的","wet":"adj.湿的","fast":"adj.快的","slow":"adj.慢的","quick":"adj.快的","early":"adj.早的","late":"adj.迟的","easy":"adj.容易的","hard":"adj.困难的；努力地","heavy":"adj.重的","light":"adj.轻的；灯","full":"adj.满的","empty":"adj.空的","right":"adj.正确的","wrong":"adj.错误的","same":"adj.相同的","different":"adj.不同的","important":"adj.重要的","interesting":"adj.有趣的","boring":"adj.无聊的","best":"adj.最好的","better":"adj.更好的","worse":"adj.更差的","more":"adj.更多的","most":"adj.最多的","ready":"adj.准备好的","sorry":"adj.抱歉的","worried":"adj.担心的","afraid":"adj.害怕的","sure":"adv.当然；确信的","hungry":"adj.饥饿的","thirsty":"adj.口渴的","tired":"adj.累的","strong":"adj.强壮的","weak":"adj.虚弱的","healthy":"adj.健康的","rich":"adj.富有的","famous":"adj.有名的","musical":"adj.有音乐天赋的","similar":"adj.相似的","openly":"adv.坦诚地","bad":"adj.坏的","only":"adv.只；仅仅","just":"adv.刚刚；只是","still":"adv.仍然","maybe":"adv.也许","really":"adv.真正地","well":"adv.好；令人满意地","away":"adv.离开","again":"adv.再；又","first":"adv.首先","last":"adj.最后的","soon":"adv.很快","later":"adv.后来","together":"adv.一起","aloud":"adv.大声地","both":"adj.两个都","either":"det.任一的","best":"adj.最好的"
};

/* 多词短语词典（用于自定义课文匹配） */
const PHRASE_DICT = {
  "each other": "互相；彼此", "play with": "和……一起玩", "talk to": "和……交谈", "talk with": "和……交谈",
  "talk about": "谈论", "listen to": "倾听", "look at": "看", "look for": "寻找", "wait for": "等待",
  "think about": "思考；考虑", "ask for": "请求得到", "say sorry": "道歉", "say hello": "问好",
  "have fun": "玩得开心", "make friends": "交朋友", "get along": "相处融洽", "take care of": "照顾",
  "sit down": "坐下", "stand up": "起立", "walk away": "走开", "run away": "跑开", "come back": "回来",
  "come on": "加油；来吧", "go out": "外出", "go home": "回家", "go to school": "去上学", "go to bed": "上床睡觉",
  "get up": "起床", "at home": "在家", "at school": "在学校", "at night": "在夜里", "in the morning": "在早上",
  "after school": "放学后", "next to": "在……旁边", "in front of": "在……前面", "a lot": "很多",
  "lots of": "许多", "a few": "一些", "a little": "一点儿", "of course": "当然", "excuse me": "打扰一下",
  "for example": "例如", "every day": "每天", "every year": "每年", "on time": "准时", "by bus": "乘公共汽车",
  "on foot": "步行", "eat out": "出去吃饭", "best friend": "最好的朋友", "best wishes": "最美好的祝愿",
  "play games": "做游戏", "watch films": "看电影", "read books": "看书", "have a chat": "聊一聊",
  "have a meal": "吃一顿饭", "happy time": "快乐时光", "give gifts": "送礼物", "sing together": "一起唱歌",
  "ask for help": "求助", "be happy for": "为……高兴", "help each other": "互相帮助",
  "take care of each other": "互相照顾", "listen to each other": "互相倾听", "talk openly": "坦诚交谈",
  "stay at home": "待在家里", "try something new": "尝试新事物", "get in the way": "碍事",
  "around the world": "全世界", "have a good time": "过得愉快", "have a happy time": "度过快乐时光"
};

/* 自定义课文句式识别规则 */
const PATTERN_RULES = [
  { re: /because/i, name: "because 从句（原因）", note: "because 引导原因：……因为……" },
  { re: /\bbut\b/i, name: "but 转折句", note: "but 表示转折：……但是……" },
  { re: /\b(let's|let us)\b/i, name: "Let's 建议句型", note: "Let's + 动词原形：让我们……" },
  { re: /\b(ask|asks|asked|want|wants|wanted|tell|tells|told)\s+(me|you|him|her|us|them|\w+)\s+to\s+\w+/i, name: "ask/want sb to do sth", note: "请/想要某人做某事：动词后接 某人 + to do。" },
  { re: /\bmake(s| made)?\s+(me|you|him|her|us|them|\w+)\s+(happy|sad|unhappy|angry|proud|nice)/i, name: "make sb + 形容词", note: "make + 某人 + 形容词：使某人……" },
  { re: /\bthere\s+(is|are|was|were)\b/i, name: "there be 句型", note: "There is/are…：有……（is 配单数，are 配复数）。" },
  { re: /\bcan('t|not)?\b/i, name: "can / can't 情态动词", note: "can/can't + 动词原形：能/不能……" },
  { re: /\b(is|are|am)\s+\w+ing\b/i, name: "现在进行时", note: "be + 动词ing：正在做……" },
  { re: /\blike(s|d)?\s+(to\s+)?\w+ing\b/i, name: "like doing", note: "like + doing/to do：喜欢做……" },
  { re: /\bboth\b/i, name: "both 的用法", note: "both 表示“（两者）都”，放在 be 动词后。" },
  { re: /\b(always|often|sometimes|usually|never)\b/i, name: "频率副词", note: "频率副词放在实义动词前、be 动词后。" },
  { re: /\b(is|am|are)\s+(very\s+)?(happy|sad|nice|good|kind|funny|cool|friendly|different|same|worried|angry)\b/i, name: "be + 形容词", note: "be 动词后接形容词作表语。" }
];
