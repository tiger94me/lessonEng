/* ================= 英语课文学习讲解 · 应用逻辑 ================= */
"use strict";

/* ---------- 小工具 ---------- */
function $(sel, root) { return (root || document).querySelector(sel); }
function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function sample(arr, n) { return shuffle(arr).slice(0, Math.max(0, n)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
/* 从池中取 n 个“键值互不相同”的元素（排除 exclude 文本），避免出现重复选项 */
function pickDistinct(pool, n, keyFn, exclude) {
  const used = {};
  (exclude || []).forEach(function (t) { used[normKey(t)] = 1; });
  const out = [];
  const arr = shuffle(pool);
  for (let i = 0; i < arr.length && out.length < n; i++) {
    const t = normKey(keyFn(arr[i]));
    if (used[t]) continue;
    used[t] = 1;
    out.push(arr[i]);
  }
  return out;
}
function pad2(n) { return (n < 10 ? "0" : "") + n; }
function todayISO(d) {
  const t = d || new Date();
  return t.getFullYear() + "-" + pad2(t.getMonth() + 1) + "-" + pad2(t.getDate());
}
function addDaysISO(iso, days) {
  const p = iso.split("-");
  const d = new Date(+p[0], +p[1] - 1, +p[2]);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}
function loadJSON(key, def) {
  try { const v = localStorage.getItem(key); return v == null ? def : JSON.parse(v); }
  catch (e) { return def; }
}
function saveJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
}
function hashId(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return "id" + (h >>> 0).toString(36);
}

/* ---------- 全局状态 ---------- */
const K_SETTINGS = "eclass.settings.v1";
const K_SRS = "eclass.srs.v1";
const K_WRONG = "eclass.wrong.v1";
const K_CUSTOM = "eclass.custom.v1";

const S = {
  tab: "lesson",
  rate: 0.92,
  autoSpeak: true,
  voiceMode: "auto",
  showZh: true,
  custom: null,     // 自定义课文模型
  customCache: null, // 切回内置时暂存的自定义课文
  quiz: null,       // 当前测验
  lastTab: "lesson"
};

/* ---------- 语音 TTS（三级兜底：浏览器语音 → 离线音频包 → 在线发音） ---------- */
let VOICES = [];
function initVoices() {
  if (typeof speechSynthesis === "undefined") return;
  VOICES = speechSynthesis.getVoices();
}
function hasBrowserEnVoice() {
  return VOICES.some(function (v) { return /^en[-_]?/i.test(v.lang); });
}
function pickVoice() {
  const en = VOICES.filter(function (v) { return /^en[-_]?/i.test(v.lang); });
  if (!en.length) return null;
  const prefer = [/google us english/i, /microsoft (aria|jenny|zira|emma)/i, /samantha|karen|moira/i, /en[-_]us/i];
  for (let i = 0; i < prefer.length; i++) {
    const hit = en.find(function (v) { return prefer[i].test(v.name); });
    if (hit) return hit;
  }
  return en[0];
}
function normKey(s) { return String(s).replace(/\s+/g, " ").trim(); }
function offlineManifest() {
  try { return (typeof window !== "undefined" && window.OFFLINE_AUDIO) || {}; }
  catch (e) { return {}; }
}
/* 课本真人音频清单（朗读覆盖合成音；例句文件内容含多句，只通过专门按钮播放） */
function textbookAudioManifest() {
  if (TTS._tb) return TTS._tb;
  const m = {};
  (typeof WORDS !== "undefined" ? WORDS : []).forEach(function (w) {
    if (w.audio && w.audio.word) m[normKey(w.en)] = w.audio.word;
  });
  TTS._tb = m;
  return m;
}

const TTS = {
  mode: "auto",            // auto | browser | offline | online
  browserBroken: false,
  probeDone: false,
  _audio: null,
  _watchdog: null,
  _seq: 0,
  _failToasted: false,
  init: function () {
    const self = this;
    if (typeof speechSynthesis === "undefined") { this.probeDone = true; return; }
    initVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = function () { initVoices(); self.probeDone = true; };
    }
    setTimeout(function () { self.probeDone = true; }, 2500);
  },
  chain: function () {
    if (this.mode === "browser") return ["browser"];
    if (this.mode === "offline") return ["offline", "online"];
    if (this.mode === "online") return ["online"];
    const c = [];
    if (!this.browserBroken && (hasBrowserEnVoice() || !this.probeDone)) c.push("browser");
    c.push("offline", "online");
    return c;
  },
  stop: function () {
    this._seq++;
    if (this._watchdog) { clearTimeout(this._watchdog); this._watchdog = null; }
    if (this._audio) { try { this._audio.pause(); } catch (e) {} this._audio = null; }
    if (typeof speechSynthesis !== "undefined") { try { speechSynthesis.cancel(); } catch (e) {} }
  },
  speak: function (text, opts) {
    text = String(text == null ? "" : text).trim();
    if (!text) return;
    this.stop();
    const seq = this._seq;
    this._try(text, opts || {}, this.chain(), 0, seq);
  },
  _try: function (text, opts, modes, i, seq) {
    if (seq !== this._seq) return;
    if (i >= modes.length) {
      if (!this._failToasted) {
        this._failToasted = true;
        toast("没有播放出声音：可在顶部选择其它“发音源”，或检查网络/音量");
        const self = this;
        setTimeout(function () { self._failToasted = false; }, 6000);
      }
      return;
    }
    const mode = modes[i];
    const self = this;
    const next = function (ok) {
      if (!ok && seq === self._seq) {
        if (mode === "browser") self.browserBroken = true;
        self._try(text, opts, modes, i + 1, seq);
      }
    };
    if (mode === "browser") this._speakBrowser(text, opts, seq, next);
    else if (mode === "offline") this._speakOffline(text, opts, seq, next);
    else this._speakOnline(text, opts, seq, next);
  },
  _splitChunks: function (text) {
    if (text.length <= 180) return [text];
    const parts = text.split(/(?<=[.!?])\s+/);
    const out = [];
    let cur = "";
    parts.forEach(function (p) {
      if ((cur + " " + p).trim().length <= 180) cur = (cur ? cur + " " : "") + p;
      else { if (cur) out.push(cur); cur = p; }
    });
    if (cur) out.push(cur);
    return out;
  },
  _speakBrowser: function (text, opts, seq, next) {
    if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") return next(false);
    const self = this;
    try {
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice();
      if (v) u.voice = v;
      u.lang = v ? v.lang : "en-US";
      u.rate = opts.rate || S.rate;
      u.pitch = 1;
      let started = false;
      u.onstart = function () { started = true; if (self._watchdog) { clearTimeout(self._watchdog); self._watchdog = null; } };
      u.onerror = function () { if (!started) next(false); };
      if (opts.onend) u.onend = opts.onend;
      speechSynthesis.speak(u);
      self._watchdog = setTimeout(function () { if (!started) next(false); }, 1800);
    } catch (e) { next(false); }
  },
  /* 贪心匹配：把文本按清单里的键逐段消费（支持多句拼接，如全文连读）；
     个别词未命中时跳过该词继续，未命中比例过高则放弃 */
  _greedyFiles: function (text, manifest) {
    const t = normKey(text);
    const keys = Object.keys(manifest);
    let pos = 0, guard = 0, gaps = 0, segs = 0;
    const files = [];
    while (pos < t.length) {
      while (pos < t.length && /\s/.test(t[pos])) pos++;
      if (pos >= t.length) break;
      let best = null;
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (k.length > 1 && t.startsWith(k, pos) && (!best || k.length > best.length)) best = k;
      }
      if (++guard > 600) return null;
      if (!best) {
        gaps++; segs++;
        const sp = t.indexOf(" ", pos);
        if (sp < 0) break;
        pos = sp + 1;
        continue;
      }
      segs++;
      files.push(manifest[best]);
      pos += best.length;
    }
    if (!files.length) return null;
    if (segs && gaps / segs > 0.25) return null;
    return files;
  },
  _exactChunkFiles: function (text, manifest) {
    const chunks = this._splitChunks(text).map(function (c) { return normKey(c); });
    const files = [];
    for (let i = 0; i < chunks.length; i++) {
      if (!manifest[chunks[i]]) return null;
      files.push(manifest[chunks[i]]);
    }
    return files;
  },
  _playFiles: function (files, opts, seq, next) {
    const self = this;
    let idx = 0;
    (function playNext() {
      if (seq !== self._seq) return;
      if (idx >= files.length) { if (opts.onend) opts.onend(); return; }
      let a;
      try { a = new Audio(files[idx++]); } catch (e) { return next(false); }
      a.playbackRate = Math.min(2, Math.max(0.5, opts.rate || S.rate));
      self._audio = a;
      a.onerror = function () { next(false); };
      a.onended = function () { if (seq === self._seq) { if (idx < files.length) playNext(); else if (opts.onend) opts.onend(); } };
      const pr = a.play();
      if (pr && pr.catch) pr.catch(function () { next(false); });
    })();
  },
  playFile: function (path, opts) {
    opts = opts || {};
    this.stop();
    const self = this;
    const seq = this._seq;
    let a;
    try { a = new Audio(path); } catch (e) { if (opts.fallback) opts.fallback(); return; }
    a.playbackRate = Math.min(2, Math.max(0.5, opts.rate || S.rate));
    this._audio = a;
    a.onerror = function () { if (opts.fallback) opts.fallback(); };
    const pr = a.play();
    if (pr && pr.catch) pr.catch(function () { if (seq === self._seq && opts.fallback) opts.fallback(); });
  },
  _speakOffline: function (text, opts, seq, next) {
    const manifest = Object.assign({}, offlineManifest(), textbookAudioManifest());
    const files = this._greedyFiles(text, manifest) || this._exactChunkFiles(text, manifest);
    if (!files) return next(false);
    this._playFiles(files, opts, seq, next);
  },
  _speakOnline: function (text, opts, seq, next) {
    const self = this;
    const chunks = this._splitChunks(text);
    let idx = 0;
    (function playNext() {
      if (seq !== self._seq) return;
      if (idx >= chunks.length) { if (opts.onend) opts.onend(); return; }
      const c = chunks[idx++];
      let a;
      try { a = new Audio("https://dict.youdao.com/dictvoice?audio=" + encodeURIComponent(c) + "&type=2"); }
      catch (e) { return next(false); }
      a.playbackRate = Math.min(2, Math.max(0.5, opts.rate || S.rate));
      self._audio = a;
      a.onerror = function () { next(false); };
      a.onended = function () { if (seq === self._seq) playNext(); };
      const pr = a.play();
      if (pr && pr.catch) pr.catch(function () { next(false); });
    })();
  }
};
function speak(text, opts) { TTS.speak(text, opts); }
function stopSpeak() { TTS.stop(); }

/* ---------- 生词本（间隔复习 +1/+3/+7/+16/+35） ---------- */
const SRS_INTERVALS = [1, 3, 7, 16, 35];
let SRS = null;
function initSRS() {
  SRS = loadJSON(K_SRS, null);
  if (!SRS || !SRS.items) {
    SRS = { seededAt: todayISO(), items: {} };
    SEED_SRS.forEach(function (s) {
      SRS.items[s.en] = { zh: s.zh, ex: s.ex, level: 0, due: addDaysISO("2026-10-22", 1), state: "待复习", src: "预录" };
    });
    saveSRS();
  }
}
function saveSRS() { saveJSON(K_SRS, SRS); }
function srsAdd(en, zh, ex, src) {
  if (!en) return false;
  if (SRS.items[en]) return false;
  SRS.items[en] = { zh: zh || "", ex: ex || "", level: 0, due: todayISO(), state: "待复习", src: src || "自录" };
  saveSRS();
  return true;
}
function srsRemove(en) { delete SRS.items[en]; saveSRS(); }
function srsReset(en) {
  const it = SRS.items[en]; if (!it) return;
  it.level = 0; it.due = todayISO(); it.state = "待复习"; saveSRS();
}
function srsUpdate(en, correct) {
  const it = SRS.items[en]; if (!it) return;
  if (correct) {
    it.level = Math.min((it.level || 0) + 1, 5);
    if (it.level >= 5) { it.state = "已掌握"; it.due = ""; }
    else { it.state = "复习中"; it.due = addDaysISO(todayISO(), SRS_INTERVALS[it.level]); }
  } else {
    it.level = Math.max(0, (it.level || 0) - 1);
    it.state = "待复习"; it.due = todayISO();
  }
  saveSRS();
}
function srsDueList() {
  const t = todayISO();
  return Object.keys(SRS.items).filter(function (k) {
    const it = SRS.items[k];
    return it.state !== "已掌握" && it.due && it.due <= t;
  });
}

/* ---------- 错题本 ---------- */
let WRONG = [];
function loadWrong() { WRONG = loadJSON(K_WRONG, []); }
function saveWrong() { saveJSON(K_WRONG, WRONG.slice(0, 120)); }
function addWrong(q, title) {
  if (WRONG.some(function (w) { return w.id === q.id; })) return;
  const copy = {};
  for (var k in q) copy[k] = q[k];
  copy.title = title || "";
  copy.time = todayISO();
  WRONG.push(copy);
  saveWrong();
}
function clearWrong() { WRONG = []; saveWrong(); }

/* ---------- 设置 ---------- */
function loadSettings() {
  const s = loadJSON(K_SETTINGS, {});
  if (s.rate) S.rate = s.rate;
  if (typeof s.autoSpeak === "boolean") S.autoSpeak = s.autoSpeak;
  if (s.voiceMode) { S.voiceMode = s.voiceMode; TTS.mode = s.voiceMode; }
}

/* ---------- 课文模型 ---------- */
function builtinModel() {
  const zhMap = {};
  UNIT_TEXT.forEach(function (sec) {
    sec.lines.forEach(function (l) { if (l.zh) zhMap[l.en] = l.zh; });
  });
  PATTERNS.forEach(function (p) {
    p.examples.forEach(function (e) { zhMap[e.en] = e.zh; });
  });
  const pool = LISTEN_SENTS.slice();
  PASSAGES.forEach(function (p) { pool.push.apply(pool, p.sents); });
  PATTERNS.forEach(function (p) {
    p.examples.forEach(function (e) { pool.push(e.en); });
  });
  return {
    kind: "builtin",
    id: "unit3",
    title: "外研社五上 · Unit 3 Happy together",
    words: WORDS,
    phrases: PHRASES,
    patterns: PATTERNS,
    grammarPoints: GRAMMAR_POINTS,
    grammarQs: GRAMMAR_QS,
    writeTasks: WRITE_TASKS,
    speakTask: SPEAK_TASK,
    storyEvents: STORY_EVENTS,
    storyTF: STORY_TF,
    listenSents: LISTEN_SENTS,
    reorderSents: pool.filter(function (s) {
      const wc = wordTokens(s).length;
      return wc >= 4 && wc <= 9;
    }),
    passages: PASSAGES,
    unitText: UNIT_TEXT,
    sentencePool: pool,
    zhMap: zhMap
  };
}
function currentModel() { return S.custom ? S.custom : builtinModel(); }

/* ================= 自定义课文解析 ================= */
const IRREG = {
  has: "have", was: "be", were: "be", ate: "eat", went: "go", came: "come", made: "make",
  gave: "give", felt: "feel", said: "say", told: "tell", got: "get", took: "take", saw: "see",
  ran: "run", sat: "sit", flew: "fly", sang: "sing", bought: "buy", taught: "teach",
  lost: "lose", left: "leave", kept: "keep", met: "meet", drank: "drink", drew: "draw",
  drove: "drive", rode: "ride", wore: "wear", won: "win", slept: "sleep", built: "build",
  thought: "think", knew: "know", found: "find", children: "child", people: "person",
  feet: "foot", teeth: "tooth", men: "man", women: "woman", better: "good", best: "good",
  worse: "bad", worst: "bad", mice: "mouse", knives: "knife", leaves: "leaf", writes: "write",
  does: "do", goes: "go", watches: "watch", finishes: "finish", carries: "carry", flies: "fly",
  studies: "study", tries: "try", cries: "cry", hobbies: "hobby", stories: "story",
  babies: "baby", cities: "city", families: "family", parties: "party", wishes: "wish",
  matches: "match", boxes: "box", classes: "class", dresses: "dress", heroes: "hero"
};

function wordTokens(s) { return (String(s).match(/[A-Za-z][A-Za-z'-]*/g) || []); }

function lemma(w) {
  const x = w.toLowerCase();
  if (DICT[x]) return x;
  if (IRREG[x] && DICT[IRREG[x]]) return IRREG[x];
  const tries = [];
  let m;
  m = x.match(/ies$/); if (m) tries.push(x.slice(0, -3) + "y");
  m = x.match(/ves$/); if (m) { tries.push(x.slice(0, -3) + "f"); tries.push(x.slice(0, -3) + "fe"); }
  m = x.match(/([sxz]|ch|sh)es$/); if (m) tries.push(x.slice(0, -2));
  if (/s$/.test(x) && !/ss$/.test(x)) tries.push(x.slice(0, -1));
  if (/ing$/.test(x)) {
    const st = x.slice(0, -3);
    tries.push(st, st + "e");
    if (/([b-df-hj-np-tv-z])\1$/.test(st)) tries.push(st.slice(0, -1));
  }
  if (/ed$/.test(x)) {
    const st = x.slice(0, -2);
    tries.push(st, st + "e", st + "d");
    if (/([b-df-hj-np-tv-z])\1$/.test(st)) tries.push(st.slice(0, -1));
  }
  if (/d$/.test(x) && !/ed$/.test(x)) tries.push(x.slice(0, -1));
  for (let i = 0; i < tries.length; i++) {
    if (tries[i] && DICT[tries[i]]) return tries[i];
  }
  return null;
}

function splitParagraphs(text) {
  const t = String(text).replace(/\r\n?/g, "\n").trim();
  if (!t) return [];
  if (/\n\s*\n/.test(t)) return t.split(/\n\s*\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
  return t.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
}
function cleanSentence(s) {
  return s.replace(/^\s*(\d+[.、)]|[a-zA-Z][.、)]|[-•*])\s*/, "").replace(/\s+/g, " ").trim();
}
function splitSentences(para) {
  const parts = para
    .replace(/([.!?。！？])(\s+|$)/g, "$1\u0001")
    .split("\u0001")
    .map(cleanSentence)
    .filter(function (s) { return s.length > 1; });
  return parts;
}
function parseText(text) {
  const paras = splitParagraphs(text);
  const sentences = [];
  paras.forEach(function (p) { splitSentences(p).forEach(function (s) { sentences.push(s); }); });
  return { paragraphs: paras, sentences: sentences };
}

function isContentPos(pos) { return /^(n|v|adj|adv)/.test(pos || ""); }
/* DICT 值格式："词性.中文"，如 "n.苹果"、"v./n.祝愿；希望" */
function dictPos(word) {
  const v = DICT[word];
  if (!v) return "";
  const m = v.match(/^([a-z]+(?:\.\/[a-z]+)*)\./);
  return m ? m[1] : "";
}
function dictZh(word) {
  const v = DICT[word];
  if (!v) return "";
  const m = v.match(/^([a-z]+(?:\.\/[a-z]+)*)\.(.+)$/);
  return m ? m[2] : v;
}

function buildCustom(rawText, title) {
  const parsed = parseText(rawText);
  const freq = {};
  const unknowns = {};
  parsed.sentences.forEach(function (s) {
    wordTokens(s).forEach(function (w) {
      if (w.length < 2) return;
      const low = w.toLowerCase();
      const base = lemma(w) || low;
      if (DICT[base]) { freq[base] = (freq[base] || 0) + 1; }
      else if (/^[a-z'-]{2,}$/.test(low)) { unknowns[low] = (unknowns[low] || 0) + 1; }
    });
  });
  const words = Object.keys(freq).sort(function (a, b) {
    return freq[b] - freq[a] || a.localeCompare(b);
  }).map(function (w) {
    return { en: w, pos: dictPos(w), zh: dictZh(w), core: false, fromDict: true };
  });
  const unkList = Object.keys(unknowns).sort(function (a, b) {
    return unknowns[b] - unknowns[a] || a.localeCompare(b);
  }).map(function (w) { return { en: w, count: unknowns[w] }; });

  /* 短语匹配 */
  const lowText = rawText.toLowerCase();
  const phrases = [];
  Object.keys(PHRASE_DICT).forEach(function (p) {
    const re = new RegExp("(^|[^a-z])" + p.replace(/ /g, "\\s+") + "([^a-z]|$)", "i");
    if (re.test(lowText)) phrases.push({ en: p, zh: PHRASE_DICT[p], ex: "", social: false });
  });
  phrases.forEach(function (ph) {
    for (let i = 0; i < parsed.sentences.length; i++) {
      if (parsed.sentences[i].toLowerCase().indexOf(ph.en) >= 0) { ph.ex = parsed.sentences[i]; break; }
    }
  });

  /* 句式识别 */
  const patterns = [];
  PATTERN_RULES.forEach(function (rule) {
    const sents = [];
    parsed.sentences.forEach(function (s) {
      if (sents.length < 5 && rule.re.test(s)) sents.push(s);
    });
    if (sents.length) patterns.push({ name: rule.name, zh: rule.note, note: "", examples: sents.map(function (s) { return { en: s, zh: "" }; }) });
  });

  const id = "custom-" + Date.now();
  const meanings = loadJSON(K_CUSTOM + ".meanings." + id, {});

  const model = {
    kind: "custom",
    id: id,
    title: title || "我的课文",
    rawText: rawText,
    paragraphs: parsed.paragraphs,
    sentences: parsed.sentences,
    words: words,
    unknowns: unkList,
    phrases: phrases,
    patterns: patterns,
    meanings: meanings,
    grammarQs: [],
    listenSents: parsed.sentences.filter(function (s) {
      const wc = wordTokens(s).length;
      return wc >= 4 && wc <= 16;
    }).slice(0, 24),
    reorderSents: parsed.sentences.filter(function (s) {
      const wc = wordTokens(s).length;
      return wc >= 4 && wc <= 9;
    }).slice(0, 30),
    passages: [],
    zhMap: {}
  };
  model.grammarQs = genGrammarCustom(model);
  model.passages = buildCustomPassages(model);
  return model;
}

function buildCustomPassages(model) {
  const out = [];
  for (let i = 0; i < model.paragraphs.length && out.length < 3; i++) {
    const sents = splitSentences(model.paragraphs[i]);
    if (sents.length >= 2 && sents.length <= 6) {
      const qs = [];
      const cand = sample(sents.filter(function (s) { return wordTokens(s).length >= 5; }), 2);
      cand.forEach(function (s) {
        const opts = [s];
        for (let k = 0; k < 8 && opts.length < 4; k++) {
          const mu = mutateSentence(s, model);
          if (mu && opts.indexOf(mu) < 0) opts.push(mu);
        }
        while (opts.length < 4) {
          const other = pick(model.sentences);
          if (other !== s && opts.indexOf(other) < 0) opts.push(other); else break;
        }
        if (opts.length >= 3) qs.push({ q: "短文中出现了哪一个句子？", opts: opts, a: 0, exp: "原文：" + s });
      });
      if (qs.length) out.push({ title: "短文 " + (out.length + 1), sents: sents, qs: qs });
    }
  }
  return out;
}

/* 自定义课文语法题生成（输出 {q, opts, a, exp}，与 GRAMMAR_QS 同构） */
function genGrammarCustom(model) {
  const out = [];
  const seen = {};
  function push(q) {
    if (!q || out.length >= 16) return;
    if (seen[q.q]) return;
    seen[q.q] = 1;
    out.push(q);
  }
  model.sentences.forEach(function (s) {
    if (out.length >= 16) return;
    /* a / an */
    let m = s.match(/\b(a|an)\s+([a-zA-Z]{3,})/);
    if (m) {
      const noun = m[2].toLowerCase();
      const base = lemma(noun) || noun;
      if (DICT[base]) {
        const blank = s.replace(/\b(a|an)(\s+)/i, "____$2");
        push({
          q: blank, sub: "选一选：a 还是 an？", kind: "grammar",
          opts: ["a", "an"], a: /^a$/i.test(m[1]) ? 0 : 1,
          exp: "以元音音素开头的单词前用 an，辅音音素开头用 a。" + base + "：" + dictZh(base)
        });
      }
    }
    /* is / are */
    m = s.match(/\b(is|are)\b/);
    if (m) {
      const blank = s.replace(/\b(is|are)\b/, "____");
      push({
        q: blank, sub: "选一选：be 动词", kind: "grammar",
        opts: ["am", "is", "are"], a: m[1] === "is" ? 1 : 2,
        exp: "原句用的是 " + m[1] + "。I 用 am，单数（he/she/it/一个人）用 is，you/复数用 are。"
      });
    }
    /* have / has */
    m = s.match(/\b(has|have)\b/);
    if (m) {
      const blank = s.replace(/\b(has|have)\b/, "____");
      push({
        q: blank, sub: "选一选：have 还是 has？", kind: "grammar",
        opts: ["have", "has"], a: m[1] === "has" ? 1 : 0,
        exp: "原句用的是 " + m[1] + "。第三人称单数用 has，其余用 have。"
      });
    }
    /* 第三人称单数动词（直接剥离 -s/-es/-ies 找动词原形） */
    const toks = wordTokens(s);
    for (let i = 0; i < toks.length; i++) {
      const low = toks[i].toLowerCase();
      if (low.length <= 3 || !/s$/.test(low) || /(is|has)$/.test(low)) continue;
      let base = null;
      if (/ies$/.test(low)) base = low.slice(0, -3) + "y";
      else if (/(ch|sh|ss|x|z|o)es$/.test(low)) base = low.slice(0, -2);
      else if (/[^s]s$/.test(low)) base = low.slice(0, -1);
      if (!base || !DICT[base] || !/^v\./.test(DICT[base])) continue;
      const blank = s.replace(new RegExp("\\b" + toks[i].replace(/[-']/g, "[-']") + "\\b"), "____");
      push({
        q: blank, sub: "动词的正确形式", kind: "grammar",
        opts: [low, base, base + "ing"], a: 0,
        exp: "主语是第三人称单数时，动词用三单形式 " + low + "（" + base + "：" + dictZh(base) + "）。"
      });
      break;
    }
  });
  return out;
}

/* 干扰句变异（听句选句） */
const PRON_SWAP = { he: "she", she: "he", his: "her", my: "your", your: "my", our: "your", we: "they", they: "we", "we're": "they're" };
function mutateSentence(sent, model) {
  const tokens = sent.split(" ");
  const idxContent = [];
  tokens.forEach(function (t, i) {
    const low = t.toLowerCase().replace(/[^a-z'-]/g, "");
    if (low.length >= 3 && /^[a-z]/.test(low) && t[0] !== t[0].toUpperCase()) {
      const base = lemma(low);
      if (base && DICT[base] && isContentPos(dictPos(base))) idxContent.push(i);
    }
  });
  const kindPool = [];
  if (idxContent.length) kindPool.push("word");
  if (tokens.some(function (t) { return PRON_SWAP[t.toLowerCase()]; })) kindPool.push("pron");
  if (tokens.some(function (t) { return /^(is|are)$/i.test(t); })) kindPool.push("be");
  if (!kindPool.length) return null;
  const kind = pick(kindPool);
  const out = tokens.slice();
  if (kind === "word") {
    const i = pick(idxContent);
    const low = out[i].toLowerCase().replace(/[^a-z'-]/g, "");
    const base = lemma(low);
    const pos = dictPos(base);
    const cands = Object.keys(DICT).filter(function (w) {
      return w !== base && w.length > 2 && dictPos(w) === pos && Math.abs(w.length - base.length) <= 4;
    });
    if (!cands.length) return null;
    out[i] = out[i].replace(new RegExp(low, "i"), pick(cands));
  } else if (kind === "pron") {
    const i = tokens.findIndex(function (t) { return PRON_SWAP[t.toLowerCase()]; });
    const low = out[i].toLowerCase();
    out[i] = out[i].replace(new RegExp(low, "i"), PRON_SWAP[low]);
  } else {
    const i = tokens.findIndex(function (t) { return /^(is|are)$/i.test(t); });
    out[i] = /^is$/i.test(out[i]) ? "are" : "is";
  }
  const res = out.join(" ").replace(/\s+/g, " ").trim();
  return res === sent ? null : res;
}

/* ================= 出题引擎 ================= */
function shuffleOptions(q) {
  if (q.kind === "reorder") { q.tokens = shuffle(q.tokens); return q; }
  const n = q.options.length;
  const idx = shuffle(q.options.map(function (_, i) { return i; }));
  q.options = idx.map(function (i) { return q.options[i]; });
  if (typeof q.answer === "number") q.answer = idx.indexOf(q.answer);
  return q;
}
function mkQ(obj) {
  const q = {
    id: hashId(obj.kind + "::" + obj.prompt + "::" + (obj.options || []).join("|")),
    kind: obj.kind, prompt: obj.prompt, sub: obj.sub || "", audio: obj.audio || obj.say || null,
    audioFile: obj.audioFile || null,
    options: obj.options, answer: obj.answer, explain: obj.explain || "",
    sentence: obj.sentence || null, tokens: obj.tokens || null, srsKey: obj.srsKey || null,
    srsZh: obj.srsZh || null
  };
  return shuffleOptions(q);
}
/* 题目发音：优先课本/真人音频文件，失败回退合成语音 */
function playQuestionAudio(q) {
  if (q.audioFile) {
    TTS.playFile(q.audioFile, { fallback: q.audio ? function () { speak(q.audio); } : null });
    return;
  }
  if (q.audio) speak(q.audio);
}

/* ---------- 大炮射击动画（选择题） ---------- */
function popSound() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    popSound.ctx = popSound.ctx || new AC();
    const ctx = popSound.ctx;
    if (ctx.state === "suspended") ctx.resume();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(300, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.18);
    g.gain.setValueAtTime(0.16, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.22);
  } catch (e) {}
}
function fireCannon(btn, onHit) {
  const card = $("#qcard");
  const barrel = card ? card.querySelector(".cannon-barrel") : null;
  const wheel = card ? card.querySelector(".cannon-wheel") : null;
  const layer = card ? card.querySelector(".cannon-layer") : null;
  if (!card || !barrel || !wheel || !layer || !btn) { if (onHit) onHit(); return; }
  const c = layer.getBoundingClientRect();
  const w = wheel.getBoundingClientRect();
  const t = btn.getBoundingClientRect();
  const px = w.left + w.width / 2 - c.left;
  const py = w.top + w.height / 2 - c.top;
  const ex = t.left + t.width / 2 - c.left;
  const ey = t.top + t.height / 2 - c.top;
  const ang = Math.atan2(ey - py, ex - px) * 180 / Math.PI;
  barrel.style.transform = "rotate(" + ang.toFixed(1) + "deg)";
  const rad = ang * Math.PI / 180;
  const sx = px + Math.cos(rad) * 22;
  const sy = py + Math.sin(rad) * 22;
  const dist = Math.sqrt((ex - sx) * (ex - sx) + (ey - sy) * (ey - sy));
  const dur = Math.max(160, Math.min(520, Math.round(dist * 1.6)));
  const ball = document.createElement("div");
  ball.className = "cannon-ball";
  ball.style.left = (sx - 7) + "px";
  ball.style.top = (sy - 7) + "px";
  ball.style.setProperty("--dx", (ex - sx) + "px");
  ball.style.setProperty("--dy", (ey - sy) + "px");
  ball.style.animationDuration = dur + "ms";
  layer.appendChild(ball);
  const smoke = document.createElement("div");
  smoke.className = "cannon-smoke";
  smoke.textContent = "💨";
  smoke.style.left = (sx + Math.cos(rad) * 10 - 10) + "px";
  smoke.style.top = (sy + Math.sin(rad) * 10 - 10) + "px";
  layer.appendChild(smoke);
  popSound();
  setTimeout(function () { smoke.remove(); }, 600);
  setTimeout(function () {
    ball.remove();
    const boom = document.createElement("div");
    boom.className = "cannon-boom";
    boom.textContent = "💥";
    boom.style.left = ex + "px";
    boom.style.top = ey + "px";
    layer.appendChild(boom);
    setTimeout(function () { boom.remove(); }, 500);
    btn.classList.add("opt-hit");
    setTimeout(function () { btn.classList.remove("opt-hit"); }, 500);
    if (onHit) onHit();
  }, dur);
}
/* 满分庆祝：全屏彩带礼花 */
function launchConfetti() {
  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  const colors = ["#f5222d", "#fa8c16", "#fadb14", "#52c41a", "#1890ff", "#722ed1", "#eb2f96"];
  const emojis = ["⭐", "🌟", "✨", "🎊", "🎉"];
  for (let i = 0; i < 46; i++) {
    const p = document.createElement("div");
    if (i % 6 === 0) { p.className = "confetti confetti-emoji"; p.textContent = emojis[(i / 6) % emojis.length]; }
    else { p.className = "confetti"; p.style.background = colors[i % colors.length]; }
    p.style.left = (Math.random() * 100) + "%";
    p.style.animationDelay = (Math.random() * 1.4).toFixed(2) + "s";
    p.style.animationDuration = (2.2 + Math.random() * 2).toFixed(2) + "s";
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(function () { layer.remove(); }, 6800);
}
/* 答错提示：给出所选错误选项的意思（英语选项查词典，汉语选项反向查词典） */
function zhToEn(zhText) {
  if (!zhText) return "";
  /* 先精确匹配释义（dictZh 带词性前缀，整体比对），再按「分号/逗号/空格切分后的义项」匹配 */
  const keys = Object.keys(DICT);
  for (let i = 0; i < keys.length; i++) { if (dictZh(keys[i]) === zhText) return keys[i]; }
  const aliases = [zhText].concat(zhText.split(/[；;，,、\s]+/)).filter(Boolean);
  for (let i = 0; i < keys.length; i++) {
    const zh = dictZh(keys[i]);
    for (let j = 0; j < aliases.length; j++) {
      const a = aliases[j].replace(/^[a-z]+\./, "");
      if (a.length >= 2 && (zh === a || zh.indexOf(a) >= 0 || a === zh.replace(/^[a-z]+\./, ""))) return keys[i];
    }
  }
  return "";
}
function meaningHint(q, wrongText) {
  if (!wrongText) return "";
  if (/^[a-zA-Z][a-zA-Z' -]*$/.test(wrongText)) {
    const zh = dictZh((lemma(wrongText) || wrongText).toLowerCase());
    if (zh) return wrongText + " 的意思是「" + zh + "」，不是它哦。";
    return "";
  }
  const en = zhToEn(wrongText);
  if (en) return "「" + wrongText + "」是 " + en + "，不是本题答案哦。";
  return "";
}

/* 词汇 */
function genWordE2C(model, n) {
  return sample(model.words, n).map(function (w) {
    const others = pickDistinct(model.words, 3, function (x) { return x.zh; }, [w.zh]);
    return mkQ({
      kind: "word-e2c", prompt: w.en, sub: w.pos ? w.pos + " 选出正确的汉语意思" : "选出正确的汉语意思",
      options: [w.zh].concat(others.map(function (o) { return o.zh; })),
      answer: 0, explain: w.en + " " + (w.pos || "") + " " + w.zh + (w.ex ? "\n例句：" + w.ex : ""),
      srsKey: w.en, srsZh: w.zh, say: w.en
    });
  });
}
function genWordC2E(model, n) {
  return sample(model.words, n).map(function (w) {
    const others = pickDistinct(model.words, 3, function (x) { return x.en; }, [w.en]);
    return mkQ({
      kind: "word-c2e", prompt: w.zh, sub: "选出正确的英语单词",
      options: [w.en].concat(others.map(function (o) { return o.en; })),
      answer: 0, explain: w.en + " " + (w.pos || "") + " " + w.zh + (w.ex ? "\n例句：" + w.ex : ""),
      srsKey: w.en, srsZh: w.zh
    });
  });
}
function genListenWord(model, n) {
  return sample(model.words, n).map(function (w) {
    const others = pickDistinct(model.words, 3, function (x) { return x.en; }, [w.en]);
    const af = w.audio ? (Math.random() < 0.5 ? w.audio.word : (w.audio.alt || w.audio.word)) : null;
    return mkQ({
      kind: "listen-word", prompt: "🔊 听发音，选出你听到的单词", audio: w.en, audioFile: af,
      options: [w.en].concat(others.map(function (o) { return o.en; })),
      answer: 0, explain: w.en + " " + (w.pos || "") + " " + w.zh, srsKey: w.en, srsZh: w.zh
    });
  });
}
function genListenWordZh(model, n) {
  return sample(model.words, n).map(function (w) {
    const others = pickDistinct(model.words, 3, function (x) { return x.zh; }, [w.zh]);
    const af = w.audio ? w.audio.word : null;
    return mkQ({
      kind: "listen-word-zh", prompt: "🔊 听发音，选出正确的汉语意思", audio: w.en, audioFile: af,
      options: [w.zh].concat(others.map(function (o) { return o.zh; })),
      answer: 0, explain: w.en + " " + (w.pos || "") + " " + w.zh, srsKey: w.en, srsZh: w.zh
    });
  });
}
/* 短语 */
function genPhraseE2C(model, n) {
  return sample(model.phrases, n).map(function (p) {
    const others = pickDistinct(model.phrases, 3, function (x) { return x.zh; }, [p.zh]);
    return mkQ({
      kind: "phrase-e2c", prompt: p.en, sub: "选出正确的汉语意思",
      options: [p.zh].concat(others.map(function (o) { return o.zh; })),
      answer: 0, explain: p.en + " " + p.zh + (p.ex ? "\n例句：" + p.ex : ""), srsKey: p.en, srsZh: p.zh, say: p.en
    });
  });
}
function genPhraseC2E(model, n) {
  return sample(model.phrases, n).map(function (p) {
    const others = pickDistinct(model.phrases, 3, function (x) { return x.en; }, [p.en]);
    return mkQ({
      kind: "phrase-c2e", prompt: p.zh, sub: "选出正确的英语短语",
      options: [p.en].concat(others.map(function (o) { return o.en; })),
      answer: 0, explain: p.en + " " + p.zh + (p.ex ? "\n例句：" + p.ex : ""), srsKey: p.en, srsZh: p.zh
    });
  });
}
function genListenPhrase(model, n) {
  return sample(model.phrases, n).map(function (p) {
    const others = pickDistinct(model.phrases, 3, function (x) { return x.en; }, [p.en]);
    return mkQ({
      kind: "listen-phrase", prompt: "🔊 听发音，选出你听到的短语", audio: p.en,
      options: [p.en].concat(others.map(function (o) { return o.en; })),
      answer: 0, explain: p.en + " " + p.zh, srsKey: p.en, srsZh: p.zh
    });
  });
}
/* 语法选择 */
function genGrammar(model, n) {
  return sample(model.grammarQs, n).map(function (g) {
    return mkQ({
      kind: "grammar", prompt: g.q, sub: "选择正确的选项填空",
      options: g.opts, answer: g.a, explain: g.exp
    });
  });
}
/* 选词填空（语境词汇） */
function genCloze(model, n) {
  const out = [];
  const sents = shuffle(model.sentencePool || model.sentences || []);
  for (let i = 0; i < sents.length && out.length < n; i++) {
    const s = sents[i];
    const toks = s.split(" ");
    const cands = [];
    toks.forEach(function (t, idx) {
      const low = t.toLowerCase().replace(/[^a-z'-]/g, "");
      if (low.length >= 3 && low.indexOf("'") < 0 && /^[a-z]/.test(low) && t[0] !== t[0].toUpperCase()) {
        const base = lemma(low);
        if (base && DICT[base] && isContentPos(dictPos(base))) cands.push({ idx: idx, low: low, base: base });
      }
    });
    if (!cands.length) continue;
    const c = pick(cands);
    const pos = dictPos(c.base);
    const others = Object.keys(DICT).filter(function (w) {
      return w !== c.base && w.length > 2 && dictPos(w) === pos;
    });
    if (others.length < 3) continue;
    const blanked = s.replace(new RegExp("\\b" + c.low.replace(/[-']/g, "[-']") + "\\b", "i"), "____");
    if (blanked === s) continue;
    out.push(mkQ({
      kind: "cloze", prompt: blanked, sub: "选词填空",
      options: [c.low].concat(sample(others, 3)),
      answer: 0,
      explain: "（" + DICT[c.base] + "）", reveal: "正确答案：" + c.low + "\n原句：" + s
    }));
  }
  return out;
}
/* 连词成句 */
function genReorder(model, n) {
  const pool = (model.reorderSents || model.sentences || []).filter(function (s) {
    const wc = wordTokens(s).length;
    return wc >= 4 && wc <= 9;
  });
  return sample(pool, n).map(function (s) {
    return mkQ({
      kind: "reorder", prompt: "点击单词，排成正确的句子",
      tokens: shuffle(wordTokens(s)),
      sentence: s, answer: -1, options: [],
      explain: "正确语序：" + s + (model.zhMap && model.zhMap[s] ? "\n" + model.zhMap[s] : "")
    });
  });
}
/* 听句选句 */
function genListenSent(model, n) {
  const pool = (model.listenSents && model.listenSents.length ? model.listenSents : model.sentences || [])
    .filter(function (s) { const wc = wordTokens(s).length; return wc >= 4 && wc <= 16; });
  const out = [];
  sample(pool, n).forEach(function (s) {
    const opts = [s];
    for (let k = 0; k < 12 && opts.length < 4; k++) {
      const mu = mutateSentence(s, model);
      if (mu && opts.indexOf(mu) < 0) opts.push(mu);
    }
    let j = 0;
    while (opts.length < 4 && j < pool.length) {
      const other = pool[j++];
      if (other !== s && opts.indexOf(other) < 0) opts.push(other);
    }
    if (opts.length >= 3) {
      out.push(mkQ({
        kind: "listen-sent", prompt: "🔊 听句子，选出你听到的句子", audio: s,
        options: opts, answer: 0,
        explain: "原句：" + s + (model.zhMap && model.zhMap[s] ? "\n" + model.zhMap[s] : "")
      }));
    }
  });
  return out;
}
/* 听短文答题 */
function genPassage(model, n) {
  const qs = [];
  (model.passages || []).forEach(function (p) {
    p.qs.forEach(function (item) {
      qs.push(mkQ({
        kind: "passage", prompt: item.q, sub: "🎧 短文：" + p.title + (p.audioFile ? "（课本原声）" : "（可反复听）"),
        audio: p.sents.join(" "), audioFile: p.audioFile || null,
        options: item.opts, answer: item.a, explain: item.exp
      }));
    });
    /* 文中句子题 */
    const sents = p.sents.filter(function (s) { const w = wordTokens(s).length; return w >= 5; });
    sample(sents, 1).forEach(function (s) {
      const opts = [s];
      for (let k = 0; k < 10 && opts.length < 4; k++) {
        const mu = mutateSentence(s, model);
        if (mu && opts.indexOf(mu) < 0) opts.push(mu);
      }
      if (opts.length >= 4) {
        qs.push(mkQ({
          kind: "passage", prompt: "短文中出现了哪一个句子？", sub: "🎧 短文：" + p.title,
          audio: p.sents.join(" "), options: opts, answer: 0, explain: "原文：" + s
        }));
      }
    });
  });
  return sample(qs, n);
}
/* 故事判断 */
function genStoryTF(model, n) {
  if (model.kind !== "builtin") return [];
  return sample(model.storyTF, n).map(function (t) {
    return mkQ({
      kind: "tf", prompt: t.s, sub: "根据课文判断对错",
      options: ["✓ 对", "✗ 错"], answer: t.ok ? 0 : 1, explain: t.exp
    });
  });
}
/* 生词本复习题 */
function genSrsReview(items, n) {
  const chosen = sample(items, n);
  const out = [];
  chosen.forEach(function (key, i) {
    const it = SRS.items[key];
    const pool = Object.keys(SRS.items).filter(function (k) { return k !== key; });
    const mode = i % 3;
    if (mode === 0) {
      const others = pickDistinct(pool, 3, function (k) { return SRS.items[k].zh; }, [it.zh]);
      out.push(mkQ({ kind: "srs-e2c", prompt: key, sub: "选出正确的汉语意思（生词本复习）",
        options: [it.zh].concat(others.map(function (k) { return SRS.items[k].zh; })), answer: 0, explain: key + " " + it.zh + (it.ex ? "\n语境：" + it.ex : ""), srsKey: key, srsZh: it.zh }));
    } else if (mode === 1) {
      const others = pickDistinct(pool, 3, function (k) { return k; }, [key]);
      out.push(mkQ({ kind: "srs-c2e", prompt: it.zh, sub: "选出正确的英语（生词本复习）",
        options: [key].concat(others), answer: 0, explain: key + " " + it.zh + (it.ex ? "\n语境：" + it.ex : ""), srsKey: key, srsZh: it.zh }));
    } else {
      const others = pickDistinct(pool, 3, function (k) { return k; }, [key]);
      out.push(mkQ({ kind: "srs-listen", prompt: "🔊 听发音，选出你听到的词", audio: key,
        options: [key].concat(others), answer: 0, explain: key + " " + it.zh + (it.ex ? "\n语境：" + it.ex : ""), srsKey: key, srsZh: it.zh }));
    }
  });
  return out;
}
/* 综合测验 */
function genMixed(model, n) {
  const gens = [
    function () { return genWordE2C(model, 1); },
    function () { return genWordC2E(model, 1); },
    function () { return genPhraseE2C(model, 1); },
    function () { return genPhraseC2E(model, 1); },
    function () { return genGrammar(model, 1); },
    function () { return genCloze(model, 1); },
    function () { return genReorder(model, 1); },
    function () { return genListenWord(model, 1); },
    function () { return genListenSent(model, 1); }
  ];
  if (model.kind === "builtin") {
    gens.push(function () { return genPassage(model, 1); });
    gens.push(function () { return genStoryTF(model, 1); });
    gens.push(function () { return genListenPhrase(model, 1); });
  } else {
    gens.push(function () { return genPassage(model, 1); });
  }
  const out = [];
  let guard = 0;
  const used = {};
  while (out.length < n && guard < n * 8) {
    const g = gens[guard % gens.length];
    guard++;
    const qs = g();
    if (qs && qs.length) {
      const q = qs[0];
      if (!used[q.id]) { used[q.id] = 1; out.push(q); }
    }
  }
  return out;
}

/* ================= 测验运行器 ================= */
function startQuiz(title, questions, opts) {
  opts = opts || {};
  if (!questions.length) { toast("题目不足，先去学习一下吧！"); return; }
  S.lastTab = S.tab;
  S.quiz = {
    title: title, qs: questions, i: 0, correct: 0, wrong: [],
    regen: opts.regen || null, requeue: opts.requeue || false
  };
  renderQuiz();
}
function quizOptionShuffled(q) { return q; }

function renderQuiz() {
  const z = S.quiz;
  const q = z.qs[z.i];
  const view = $("#view");
  if (!q) { return; }
  const total = z.qs.length;
  const pct = Math.round((z.i) / total * 100);
  let h = '<div class="quiz-head"><button class="btn btn-ghost btn-sm" id="quizExit">✕ 退出</button>';
  h += '<div class="quiz-title">' + esc(z.title) + '</div><div class="quiz-count">第 ' + (z.i + 1) + ' / ' + total + ' 题 · 答对 ' + z.correct + '</div></div>';
  h += '<div class="progress"><div class="bar" style="width:' + pct + '%"></div></div>';
  h += '<div class="card quiz-card" id="qcard">';
  h += '<div class="q-prompt">' + esc(q.prompt) + '</div>';
  if (q.sub) h += '<div class="q-sub">' + esc(q.sub) + '</div>';
  if (q.audio) h += '<div class="q-audio"><button class="btn btn-sound" id="qPlay">🔊 播放</button></div>';
  if (q.kind === "reorder") {
    h += '<div class="reorder-ans" id="roAns"></div>';
    h += '<div class="reorder-pool" id="roPool"></div>';
    h += '<div class="q-actions"><button class="btn btn-primary hidden" id="roCheck">检查</button><button class="btn btn-ghost hidden" id="roReset">↺ 重排</button></div>';
  } else {
    h += '<div class="cannon-layer" aria-hidden="true"></div>';
    h += '<div class="cannon-wrap" aria-hidden="true"><div class="cannon"><div class="cannon-barrel"></div><div class="cannon-wheel"></div></div></div>';
    h += '<div class="opts" id="opts">';
    q.options.forEach(function (op, i) {
      h += '<button class="opt" data-i="' + i + '"><span class="opt-key">' + "ABCD"[i] + '</span><span>' + esc(op) + '</span></button>';
    });
    h += '</div>';
  }
  h += '<div class="q-feedback hidden" id="qFb"></div>';
  h += '<div class="q-actions hidden" id="qNext"><button class="btn btn-primary" id="btnNext">下一题 →</button></div>';
  h += '</div>';
  view.innerHTML = h;

  $("#quizExit").onclick = function () { stopSpeak(); S.quiz = null; setTab(S.lastTab); };
  if (q.audio || q.audioFile) {
    $("#qPlay").onclick = function () { playQuestionAudio(q); };
    if (S.autoSpeak) setTimeout(function () { playQuestionAudio(q); }, 350);
  }
  if (q.kind === "reorder") renderReorder(q);
  else $all("#opts .opt").forEach(function (btn) {
    btn.onclick = function () { chooseOption(q, +btn.getAttribute("data-i")); };
  });
}
function renderReorder(q) {
  const pool = $("#roPool"), ans = $("#roAns");
  const picked = [];
  function paint() {
    ans.innerHTML = "";
    pool.innerHTML = "";
    q.tokens.forEach(function (t, i) {
      if (picked.indexOf(i) >= 0) return;
      const c = document.createElement("button");
      c.className = "chip"; c.textContent = t;
      c.onclick = function () { picked.push(i); paint(); };
      pool.appendChild(c);
    });
    picked.forEach(function (i, k) {
      const c = document.createElement("button");
      c.className = "chip chip-ans"; c.textContent = q.tokens[i];
      c.onclick = function () { picked.splice(k, 1); paint(); };
      ans.appendChild(c);
    });
    $("#roCheck").classList.toggle("hidden", picked.length !== q.tokens.length);
    $("#roReset").classList.toggle("hidden", !picked.length);
  }
  $("#roReset").onclick = function () { picked.length = 0; paint(); };
  $("#roCheck").onclick = function () {
    const built = picked.map(function (i) { return q.tokens[i]; }).join(" ");
    const ok = built === q.sentence;
    finishQuestion(q, ok, "你排的句子：" + built + "\n正确语序：" + q.sentence);
  };
  paint();
}
function chooseOption(q, i) {
  const card = $("#qcard");
  if (card.getAttribute("data-done") === "1" || card.getAttribute("data-busy") === "1") return;
  const ok = i === q.answer;
  if (q.kind === "reorder") { finishQuestion(q, ok, null, i); return; }
  const btn = $all("#opts .opt")[i];
  if (!btn) { finishQuestion(q, ok, null, i); return; }
  card.setAttribute("data-busy", "1");
  fireCannon(btn, function () {
    card.removeAttribute("data-busy");
    finishQuestion(q, ok, null, i);
  });
}
function finishQuestion(q, ok, customMsg, chosenIdx) {
  const card = $("#qcard");
  const z = S.quiz;
  /* 选择题答错不锁卡：显示所选选项的意思，鼓励重试直到答对 */
  const canRetry = !ok && q.kind !== "reorder" && !customMsg && chosenIdx != null;
  const alreadyWrong = card.getAttribute("data-wrong") === "1";
  if (ok) z.correct++;
  else if (!alreadyWrong) { z.wrong.push(q); addWrong(q, z.title); }
  if (!ok) card.setAttribute("data-wrong", "1");
  if (!ok) { card.classList.add("shake"); setTimeout(function () { card.classList.remove("shake"); }, 450); }
  if (!canRetry) card.setAttribute("data-done", "1");
  if (q.srsKey) {
    if (SRS.items[q.srsKey]) { if (ok || !alreadyWrong) srsUpdate(q.srsKey, ok); }
    else if (!ok && !alreadyWrong) srsAdd(q.srsKey, q.srsZh || "", "", "错题自动录入"); /* 错词自动入生词本 */
  }
  const fb = $("#qFb");
  fb.classList.remove("hidden", "fb-ok", "fb-bad", "fb-retry");
  let msg = "";
  if (q.kind === "reorder") {
    $all("#roPool .chip, #roAns .chip").forEach(function (b) { b.disabled = true; });
    $("#roCheck").classList.add("hidden");
    $("#roReset").classList.add("hidden");
    msg = ok ? "✅ 回答正确！\n" + (customMsg || "") : "❌ 再想想！" + (customMsg ? "\n" + customMsg : "");
  } else if (canRetry) {
    const chosenTxt = q.options[chosenIdx] != null ? q.options[chosenIdx] : "";
    $all("#opts .opt").forEach(function (btn, i) {
      if (i === chosenIdx) { btn.disabled = true; btn.classList.add("opt-tried"); }
    });
    msg = "💨 命中「" + chosenTxt + "」，可惜不是正确答案，调整角度再来一次！";
    const hint = meaningHint(q, chosenTxt);
    if (hint) msg += "\n💡 " + hint;
  } else {
    $all("#opts .opt").forEach(function (btn, i) {
      btn.disabled = true;
      if (i === q.answer) btn.classList.add("opt-right");
      else if (i === chosenIdx) btn.classList.add("opt-wrong");
    });
    if (ok) msg = alreadyWrong ? "✅ 答对啦！坚持就是胜利，你很棒！" : "✅ 回答正确！";
    else msg = "❌ " + (customMsg ? customMsg : "正确答案：" + q.options[q.answer]);
    if (ok && customMsg) msg += "\n" + customMsg;
  }
  if (q.explain) msg += "\n💡 " + q.explain;
  /* q.reveal 含正确答案/原句，只在不能重试（最终揭晓）时才展示，避免泄题 */
  if (!canRetry && q.reveal) msg += "\n💡 " + q.reveal;
  if (ok) fb.classList.add("fb-ok");
  else { fb.classList.add("fb-bad"); if (canRetry) fb.classList.add("fb-retry"); }
  fb.textContent = msg;
  if (!ok && (q.audio || q.audioFile)) { setTimeout(function () { playQuestionAudio(q); }, 500); }
  const nx = $("#qNext");
  if (canRetry) {
    nx.classList.add("hidden");
  } else {
    nx.classList.remove("hidden");
    $("#btnNext").textContent = z.i === z.qs.length - 1 ? "查看结果 🏁" : "下一题 →";
    $("#btnNext").onclick = nextQuestion;
  }
}
function nextQuestion() {
  const z = S.quiz;
  z.i++;
  if (z.i < z.qs.length) renderQuiz();
  else renderQuizEnd();
}
function renderQuizEnd() {
  const z = S.quiz;
  const total = z.qs.length;
  const pct = Math.round(z.correct / total * 100);
  const stars = pct >= 90 ? "★★★" : pct >= 70 ? "★★☆" : pct >= 50 ? "★☆☆" : "☆☆☆";
  let h = '<div class="card quiz-end">';
  h += '<div class="qe-stars">' + stars + '</div>';
  h += '<div class="qe-score">' + z.correct + ' / ' + total + '</div>';
  h += '<div class="qe-pct">正确率 ' + pct + '% · ' + esc(z.title) + '</div>';
  const perfect = z.correct >= total; /* 答错后订正做对也算满分（错题仍进订正回顾/错题本） */
  if (perfect) {
    h += '<div class="qe-score-big">100<span>分</span></div>';
    h += '<div class="qe-praise">🏆 你非常棒！全部答对啦！</div>';
  }
  if (z.wrong.length) {
    h += '<div class="qe-wrong"><div class="qe-wrong-title">📝 订正回顾（已自动存入错题本' + (z.requeue ? "，生词进度已回退" : "") + (perfect ? "，重练全对也算满分）" : "）") + '</div>';
    z.wrong.forEach(function (q) {
      h += '<div class="wrong-item"><div class="wi-q">' + esc(q.prompt) + '</div><div class="wi-a">正确答案：' + esc(q.kind === "reorder" ? q.sentence : q.options[q.answer]) + '</div>' + (q.explain ? '<div class="wi-e">' + esc(q.explain) + '</div>' : '') + '</div>';
    });
    h += '</div>';
    if (perfect) h += '<div class="qe-hint">全部订正做对也是 100 分！错题已存入错题本，多练几次就更牢固啦。</div>';
  }
  h += '<div class="q-actions center">';
  h += '<button class="btn btn-ghost" id="qeBack">← 返回</button>';
  if (z.wrong.length) h += '<button class="btn btn-ghost" id="qeWrong">只练错题 (' + z.wrong.length + ')</button>';
  if (z.regen) h += '<button class="btn btn-primary" id="qeAgain">再来一组</button>';
  h += '</div></div>';
  $("#view").innerHTML = h;
  $("#qeBack").onclick = function () { S.quiz = null; setTab(S.lastTab); };
  if ($("#qeAgain")) $("#qeAgain").onclick = function () { z.regen(); };
  if ($("#qeWrong")) $("#qeWrong").onclick = function () {
    const requeued = z.wrong.map(function (q) {
      const c = {}; for (var k in q) c[k] = q[k]; c.srsKey = null; return shuffleOptions(c);
    });
    startQuiz(z.title + " · 错词重现", requeued, { regen: null });
  };
  if (perfect) {
    launchConfetti();
    setTimeout(function () { speak("你非常棒，一百分！"); }, 500);
  }
  if (z.wrong.length && z.requeue) {
    /* 生词复习：错词当天已回退，无需额外处理 */
  }
  /* 表现优秀 → 追加一道脑筋急转弯（输入答案，答对有奖励） */
  const bonus = bonusEligible(z);
  if (bonus) renderRiddleBlock(bonus);
}

/* ---------- 脑筋急转弯加分题 ----------
   条件：一次做满 10 道题，且"一次就答对"≥9 道（首次正确率 ≥90%）。
   注意：因为答错可以重试直到做对，z.correct 最终必然等于总题数，
        所以必须按"首次答对数 = 总题数 - 首次答错数(z.wrong)"来判定。 */
const RIDDLE_PASS = 9, RIDDLE_MIN_Q = 10;
function bonusEligible(z) {
  if (!z || z.isRiddle) return null;
  if (z.qs.length < RIDDLE_MIN_Q) return null;
  const firstTry = z.qs.length - z.wrong.length;
  if (firstTry < RIDDLE_PASS) return null;
  if (typeof RIDDLES === "undefined" || !RIDDLES.length) return null;
  /* 已答过就沿用同一题，避免刷新后换题作弊 */
  if (!z.riddle) {
    z.riddle = RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
    z.riddleDone = false;
    z.riddleGot = false;
  }
  return z.riddle;
}
function normAnswer(s) {
  return String(s == null ? "" : s)
    .replace(/[\s\u3000]/g, "")
    .replace(/[，,。.、！!？?；;：:“”"'‘’（）()《》【】~～\-—_]/g, "")
    .toLowerCase();
}
function riddleCorrect(r, input) {
  const v = normAnswer(input);
  if (!v) return false;
  const pool = [r.a, r.anim].concat(r.aliases || []);
  for (let i = 0; i < pool.length; i++) {
    const p = normAnswer(pool[i]);
    if (!p) continue;
    if (v === p) return true;
    /* 模糊匹配只用于"多字答案"：孩子多写了"因为/是/啊"之类也能算对。
       单字答案（如"树""火""纸"）必须精确相等，否则"树懒""火鸡"这类
       干扰词会被误判为答对。 */
    if (p.length >= 2 && v.length >= 2 && (v.indexOf(p) >= 0 || p.indexOf(v) >= 0)) return true;
  }
  return false;
}
function renderRiddleBlock(r) {
  const box = $("#view .quiz-end");
  if (!box) return;
  const html =
    '<div class="riddle" id="riddleBox">' +
      '<div class="riddle-head">🧠 加分题 · 脑筋急转弯</div>' +
      '<div class="riddle-you">你太厉害了，送你一道脑筋急转弯！</div>' +
      '<div class="riddle-q">' + esc(r.q) + '</div>' +
      '<div class="riddle-opts">' +
        (r.options || []).map(function (o, i) {
          return '<button class="riddle-opt" data-ri="' + i + '">' + esc(o) + '</button>';
        }).join("") +
      '</div>' +
      '<div class="riddle-row">' +
        '<input id="riddleInput" class="riddle-input" type="text" autocomplete="off" ' +
          'autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="在这里输入你的答案">' +
        '<button class="btn btn-primary btn-sm" id="riddleGo">提交</button>' +
      '</div>' +
      '<div class="riddle-fb" id="riddleFb"></div>' +
    '</div>';
  box.insertAdjacentHTML("beforeend", html);

  const input = $("#riddleInput"), fb = $("#riddleFb"), go = $("#riddleGo");
  $all(".riddle-opt", $("#riddleBox")).forEach(function (b) {
    b.onclick = function () {
      input.value = r.options[parseInt(b.getAttribute("data-ri"), 10)];
      input.focus();
    };
  });
  function submit() {
    if (S.quiz && S.quiz.riddleDone) return;
    const ok = riddleCorrect(r, input.value);
    S.quiz.riddleDone = true;
    S.quiz.riddleGot = ok;
    $all(".riddle-opt", $("#riddleBox")).forEach(function (b) { b.disabled = true; });
    input.disabled = true; go.disabled = true;
    if (ok) {
      fb.className = "riddle-fb ok";
      fb.innerHTML = '<div class="riddle-ok">🎉 答对啦！你也是个小机灵鬼！</div>' +
        '<div class="riddle-tip">' + esc(r.tip || "") + '</div>' +
        '<div class="riddle-prize">🏅 奖励：解锁「机灵鬼」勋章（共 ' + riddleWins() + ' 枚）+ 全对星星一颗 ⭐</div>';
      launchConfetti();
      setTimeout(function () { speak("答对啦，你也是个小机灵鬼！"); }, 400);
      awardRiddle();
    } else {
      fb.className = "riddle-fb no";
      fb.innerHTML = '<div class="riddle-no">😄 差一点点～ 标准答案在这里：<b>' + esc(r.a) + '</b></div>' +
        '<div class="riddle-tip">' + esc(r.tip || "") + '</div>';
      setTimeout(function () { speak("答案是，" + r.a + "。" + (r.tip || "")); }, 300);
    }
  }
  go.onclick = submit;
  input.onkeydown = function (e) { if (e.key === "Enter" || e.keyCode === 13) { e.preventDefault(); submit(); } };
  /* 已答过（重进结算页）就直接展示结论 */
  if (S.quiz.riddleDone) {
    input.value = "";
    $all(".riddle-opt", $("#riddleBox")).forEach(function (b) { b.disabled = true; });
    input.disabled = true; go.disabled = true;
    if (S.quiz.riddleGot) {
      fb.className = "riddle-fb ok";
      fb.innerHTML = '<div class="riddle-ok">🎉 你已经答对过啦！</div><div class="riddle-tip">' + esc(r.tip || "") + '</div>';
    } else {
      fb.className = "riddle-fb no";
      fb.innerHTML = '<div class="riddle-no">标准答案：<b>' + esc(r.a) + '</b></div><div class="riddle-tip">' + esc(r.tip || "") + '</div>';
    }
  } else {
    try { input.focus({ preventScroll: true }); } catch (e) { try { input.focus(); } catch (e2) {} }
  }
}
/* 机灵鬼勋章：单独持久化，跨会话累计 */
const K_RIDDLE = "eclass.riddle.v1";
function riddleWins() {
  const d = loadJSON(K_RIDDLE, null);
  return (d && d.wins) || 0;
}
function awardRiddle() {
  const n = riddleWins() + 1;
  try { saveJSON(K_RIDDLE, { wins: n, last: todayISO() }); } catch (e) {}
}

/* ================= 页面渲染 ================= */
const TABS = [
  ["scene", "🎬 情景"], ["lesson", "📖 课文"], ["words", "🔤 词汇"], ["phrases", "🔗 短语"], ["patterns", "✨ 句式"],
  ["grammar", "📐 语法"], ["listen", "🎧 听力"], ["srs", "🗂 生词本"], ["test", "📝 综合测验"], ["wrong", "⭐ 错题本"]
];
function setTab(t) {
  stopSpeak();
  S.tab = t;
  $all(".tab").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-tab") === t); });
  const view = $("#view");
  view.innerHTML = '<div class="loading">加载中…</div>';
  try {
    if (t === "scene") renderSceneTab();
    else if (t === "lesson") renderLessonTab();
    else if (t === "words") renderWordsTab();
    else if (t === "phrases") renderPhrasesTab();
    else if (t === "patterns") renderPatternsTab();
    else if (t === "grammar") renderGrammarTab();
    else if (t === "listen") renderListenTab();
    else if (t === "srs") renderSrsTab();
    else if (t === "test") renderTestTab();
    else if (t === "wrong") renderWrongTab();
    if (typeof window !== "undefined") window.__appStarted = true;
  } catch (e) {
    view.innerHTML = '<div class="card">出错了：' + esc(e.message) + '</div>';
  }
  window.scrollTo(0, 0);
}

function speakBtn(text) {
  return '<button class="btn-sound" data-say="' + esc(text) + '">🔊</button>';
}
function playFileBtn(path, icon) {
  return '<button class="btn-sound" data-playfile="' + esc(path) + '">' + (icon || "📻") + '</button>';
}
function bindSpeakBtns(root) {
  $all("[data-say]", root).forEach(function (b) {
    b.onclick = function () { speak(b.getAttribute("data-say")); };
  });
  $all("[data-playfile]", root).forEach(function (b) {
    b.onclick = function () { TTS.playFile(b.getAttribute("data-playfile")); };
  });
}


/* ==================== 情景剧场：课文页面图 + 取景 + 对话 ==================== */
const K_SCENES = "eclass.scenes.v1";
const PAGE_W = 1100, PAGE_H = 1545;   // 页面图尺寸（决定取景框纵横比）

function sceneSavedMap() { return loadJSON(K_SCENES, {}); }
function sceneRegion(sc) {
  const saved = sceneSavedMap()[sc.id];
  return (Array.isArray(saved) && saved.length === 4) ? saved : sc.region;
}
function sceneCands(sc) {
  const cur = sceneRegion(sc).join(",");
  const all = [sceneRegion(sc)].concat(sc.cands || []);
  const out = [];
  const seen = {};
  all.forEach(function (r) {
    const k = r.join(",");
    if (seen[k]) return;
    seen[k] = 1;
    out.push(r);
  });
  return out;
}
function regionAspect(r) {
  const w = Math.max(0.5, r[2]), h = Math.max(0.5, r[3]);
  return (w / h) * (PAGE_W / PAGE_H);
}
/* 把取景框微调成指定宽高比：只多看到一点页面，绝不出现留白 */
function fitRegion(r, target) {
  const px = r[0] / 100 * PAGE_W, py = r[1] / 100 * PAGE_H;
  const pw = Math.max(1, r[2] / 100 * PAGE_W), ph = Math.max(1, r[3] / 100 * PAGE_H);
  let W = pw, H = pw / target;
  if (H < ph) { H = ph; W = ph * target; }
  if (W > PAGE_W) { W = PAGE_W; H = W / target; }
  if (H > PAGE_H) { H = PAGE_H; W = H * target; }
  let X = px - (W - pw) / 2, Y = py - (H - ph) / 2;
  X = Math.max(0, Math.min(PAGE_W - W, X));
  Y = Math.max(0, Math.min(PAGE_H - H, Y));
  return [Number((X / PAGE_W * 100).toFixed(2)), Number((Y / PAGE_H * 100).toFixed(2)),
          Number((W / PAGE_W * 100).toFixed(2)), Number((H / PAGE_H * 100).toFixed(2))];
}
/* 舞台用的最终取景：宽高比落在舒适区间，保证铺满不露白 */
function stageRegion(r) {
  const target = Math.min(2.05, Math.max(0.95, regionAspect(r)));
  return { region: fitRegion(r, target), aspect: target };
}
/* 用 CSS 背景裁出取景框内的画面 */
function cropBg(img, r) {
  const w = Math.max(0.5, r[2]), h = Math.max(0.5, r[3]);
  const size = (10000 / w).toFixed(2) + "% auto";
  const px = w >= 99.5 ? 0 : (r[0] / (100 - w)) * 100;
  const py = h >= 99.5 ? 0 : (r[1] / (100 - h)) * 100;
  return "background-image:url('" + img + "');background-size:" + size +
         ";background-position:" + px.toFixed(2) + "% " + py.toFixed(2) + "%;background-repeat:no-repeat;";
}
function scenePageUrl(sc) { return SCENE_PAGES[sc.page] || SCENE_PAGES.p01; }
/* 小图变体：t = 缩略图（导轨/气泡，约 33KB），h = 中图（舞台主图）；
   大页面图只在取景器/全页/大屏时才加载，避免 iPad 一次性解码十几张 1100×1545 图 */
function pageVariant(url, v) {
  if (!v) return url;
  return url.replace(/^(.*\/)unit3_(p\d+)\.jpg$/, "$1" + v + "/unit3_$2.jpg");
}
function sceneUrl(sc, v) { return pageVariant(scenePageUrl(sc), v); }
function bigScreen() {
  return typeof window !== "undefined" && window.innerWidth >= 900 &&
         !(window.matchMedia && window.matchMedia("(max-width: 720px)").matches);
}
/* 插图块的宽高比（用于占位，防止加载抖动） */
function shotAspect(shot) {
  const w = Math.max(0.4, shot[2]), h = Math.max(0.4, shot[3]);
  return Math.min(2.2, Math.max(0.75, (w / h) * (PAGE_W / PAGE_H)));
}
/* 按句配图：均衡分配该场景的插图块（正反序交替，避免连续重复） */
function sceneShotFor(sc, idx) {
  const blocks = (sc.shots && sc.shots.length) ? sc.shots
    : (sc.cands && sc.cands.length ? [sc.region] : [sc.region]);
  if (blocks.length === 1) return blocks[0];
  /* 纯循环交替：保证相邻两句配图一定不同 */
  return blocks[idx % blocks.length];
}

function speakerOf(sc, idx, en) {
  if (/^[a-c]\.\s/.test(en)) return "选项";
  if (sc.sec === 6 && idx >= 4) return "建议";
  const m = /^([A-Z][A-Za-z]*(?: & [A-Z][A-Za-z]*)?|Mum Bird|Dad Dog):\s*/.exec(en);
  if (m && SCENE_SPEAKERS[m[1]]) return m[1];
  return "旁白";
}
function splitSpeaker(sc, idx, en) {
  const sp = speakerOf(sc, idx, en);
  if (sp === "旁白" || sp === "选项" || sp === "建议") return { sp: sp, text: en };
  return { sp: sp, text: en.replace(/^[^:]{1,20}:\s*/, "") };
}
function sceneDialogue(sc) {
  const sec = UNIT_TEXT[sc.sec];
  return sc.lines.map(function (i) {
    const l = sec.lines[i] || { en: "", zh: "" };
    const parts = splitSpeaker(sc, i, l.en);
    return { i: i, sp: parts.sp, en: parts.text, full: l.en, zh: l.zh || "" };
  });
}
function sceneCurrent() {
  if (typeof SCENES === "undefined" || !SCENES.length) return null;
  let sc = SCENES.find(function (x) { return x.id === S.sceneId; });
  if (!sc) { sc = SCENES[0]; S.sceneId = sc.id; }
  return sc;
}
function sceneStopAuto() {
  S.playing = false;
  if (S._sceneTimer) { clearTimeout(S._sceneTimer); S._sceneTimer = null; }
}

function renderSceneTab() {
  const view = $("#view");
  if (typeof SCENES === "undefined" || !SCENES.length) {
    view.innerHTML = '<div class="card">当前课文没有情景数据（自定义课文暂不支持情景剧场）。</div>';
    return;
  }
  const sc = sceneCurrent();
  const dlg = sceneDialogue(sc);
  if (typeof S.sceneLine !== "number" || S.sceneLine >= dlg.length) S.sceneLine = 0;
  const cur = dlg[S.sceneLine] || dlg[0];
  const spk = SCENE_SPEAKERS[cur.sp] || SCENE_SPEAKERS["旁白"];
  const shot = sceneShotFor(sc, S.sceneLine);
  const asp = shotAspect(shot);

  let h = '';
  const mainV = bigScreen() ? "" : "h";
  h += '<div class="scene-rail" id="sceneRail">';
  SCENES.forEach(function (s) {
    const th = fitRegion(sceneShotFor(s, 0), 1.87);
    h += '<button class="scene-thumb' + (s.id === sc.id ? " active" : "") + '" data-scene="' + s.id + '">' +
         '<span class="st-img" data-page="' + esc(scenePageUrl(s)) + '" data-region="' + th.join(",") +
         '" style="background-color:#eef1f8"></span>' +
         '<span class="st-t">' + esc(s.title) + '</span></button>';
  });
  h += '</div>';

  h += '<div class="card scene-main">';
  h += '<div class="scene-main-head"><span class="scene-title">' + esc(sc.title) + '</span><span class="scene-sub">' + esc(sc.sub) + ' · ' + (S.sceneLine + 1) + '/' + dlg.length + '</span></div>';
  h += '<div class="scene-split" style="--ar:' + asp.toFixed(4) + '">';
  h += '<div class="scene-fig">';
  h += '<div class="scene-img" id="sceneImg" data-page="' + esc(scenePageUrl(sc)) + '" data-region="' + shot.join(",") +
       '" style="background-color:#e8ecf6"></div>';
  h += '<div class="scene-fig-bar"><button class="btn btn-ghost btn-xs" id="scFrame" title="选取画面">🔍 换画面</button>' +
       '<span class="scene-fig-note">课本 ' + sc.page.replace("p", "P") + '</span></div>';
  h += '</div>';
  h += '<div class="scene-say">';
  h += '<div class="scene-line" style="--sp:' + spk.color + ';--spbg:' + spk.bg + '">';
  h += '<div class="scene-line-top"><span class="scene-spk">' + spk.emoji + " " + esc(cur.sp) + '</span>' +
       '<button class="btn-sound mini" id="scReplay" title="重听本句">🔊</button></div>';
  h += '<div class="scene-en">' + esc(cur.en) + '</div>';
  if (S.showZh && cur.zh) h += '<div class="scene-zh">' + esc(cur.zh) + '</div>';
  h += '</div>';
  h += '<div class="scene-ctrl">';
  h += '<button class="btn btn-ghost btn-sm" id="scPrev" title="上一句">⏮</button>';
  h += '<button class="btn btn-primary btn-sm" id="scPlay">' + (S.playing ? "⏸ 暂停" : "▶ 连播") + '</button>';
  h += '<button class="btn btn-ghost btn-sm" id="scNext" title="下一句">⏭</button>';
  h += '<button class="btn btn-ghost btn-sm" id="scFull" title="全页">🗺 全页</button>';
  h += '</div></div></div>';

  h += '<div class="scene-dots">';
  dlg.forEach(function (d, k) {
    const sk = SCENE_SPEAKERS[d.sp] || SCENE_SPEAKERS["旁白"];
    h += '<button class="dot' + (k === S.sceneLine ? " on" : "") + '" data-line="' + k + '" style="--sp:' + sk.color + '">' + (k + 1) + '</button>';
  });
  h += '</div>';

  h += '<div class="card dialogue-card"><div class="sec-title">💬 全文对话（点句子即听）</div><div class="dialogue">';
  dlg.forEach(function (d, k) {
    const sk = SCENE_SPEAKERS[d.sp] || SCENE_SPEAKERS["旁白"];
    const side = (d.sp === "旁白") ? "narr" : (k % 2 ? "right" : "left");
    h += '<div class="bubble ' + side + (k === S.sceneLine ? " on" : "") + '" data-line="' + k + '">';
    h += '<div class="b-head"><span style="color:' + sk.color + '">' + sk.emoji + " " + esc(d.sp) + '</span>' +
         '<button class="btn-sound mini" data-play="' + k + '">🔊</button></div>';
    h += '<div class="b-body">';
    const bshot = sceneShotFor(sc, k);
    h += '<span class="b-thumb" data-page="' + esc(scenePageUrl(sc)) + '" data-region="' + bshot.join(",") + '"></span>';
    h += '<span class="b-txt"><span class="b-en" style="background:' + sk.bg + '">' + esc(d.en) + '</span>' +
         (S.showZh && d.zh ? '<span class="b-zh">' + esc(d.zh) + '</span>' : '') + '</span>';
    h += '</div></div>';
  });
  h += '</div></div>';

  view.innerHTML = h;
  bindSceneTab(sc, dlg);
  paintCrops(view, mainV);
}

/* 先把所有小图分批上色，再按需加载主舞台的中图/大图（首屏只画小图，iPad 不再卡死） */
function paintCrops(root, mainV) {
  const jobs = [];
  const main = root.querySelector("#sceneImg");
  $all(".st-img[data-page], .b-thumb[data-page]", root).forEach(function (el) {
    jobs.push({ el: el, v: "t", page: el.getAttribute("data-page"), region: regionOf(el) });
  });
  function regionOf(el) { return String(el.getAttribute("data-region")).split(",").map(Number); }
  function setBg(el, v) {
    el.style.cssText = cropBg(pageVariant(el.getAttribute("data-page"), v), regionOf(el));
    el.setAttribute("data-variant", v);
  }
  let i = 0;
  function step() {
    if (i < jobs.length) {
      const j = jobs[i++];
      setBg(j.el, "t");
      if (i % 5 === 0) setTimeout(step, 30); else setTimeout(step, 0);
      return;
    }
    if (main && main.isConnected) {
      setBg(main, mainV === undefined || mainV === null ? "h" : mainV);
      if (!bigScreen()) {
        /* 小屏先用中图立即显示，再在空闲时换成大图（仅供全屏/放大观看） */
        const up = function () {
          if (main.isConnected && !bigScreen()) return;
          if (main.isConnected) setBg(main, "");
        };
        if (window.requestIdleCallback) requestIdleCallback(up, { timeout: 2500 }); else setTimeout(up, 1200);
      }
    }
  }
  setTimeout(step, 0);
}
function bindSceneTab(sc, dlg) {
  const view = $("#view");
  $all("[data-scene]", view).forEach(function (b) {
    b.onclick = function () {
      sceneStopAuto(); stopSpeak();
      S.sceneId = b.getAttribute("data-scene");
      S.sceneLine = 0;
      renderSceneTab();
    };
  });
  function paint() {
    /* 局部更新：主图 + 对话行 + 高亮，避免整页重绘打断播放 */
    const d = dlg[S.sceneLine] || dlg[0];
    const sk = SCENE_SPEAKERS[d.sp] || SCENE_SPEAKERS["旁白"];
    const shot = sceneShotFor(sc, S.sceneLine);
    const img = $("#sceneImg");
    if (img) {
      const v = img.getAttribute("data-variant");
      img.style.cssText = cropBg(sceneUrl(sc, v === null ? "h" : v), shot);
      img.setAttribute("data-region", shot.join(","));
      const fig = $(".scene-fig");
      if (fig) fig.style.setProperty("--ar", shotAspect(shot).toFixed(4));
    }
    const line = $(".scene-line");
    if (line) {
      line.style.setProperty("--sp", sk.color);
      line.style.setProperty("--spbg", sk.bg);
      line.innerHTML = '<div class="scene-line-top"><span class="scene-spk">' + sk.emoji + " " + esc(d.sp) + '</span>' +
        '<button class="btn-sound mini" id="scReplay" title="重听本句">🔊</button></div>' +
        '<div class="scene-en">' + esc(d.en) + '</div>' +
        (S.showZh && d.zh ? '<div class="scene-zh">' + esc(d.zh) + '</div>' : "");
      const rp = $("#scReplay");
      if (rp) rp.onclick = function () { sceneStopAuto(); syncPlayBtn(); speakLine(null); };
    }
    const sub = $(".scene-sub");
    if (sub) sub.textContent = sc.sub + " · " + (S.sceneLine + 1) + "/" + dlg.length;
    $all(".dot", view).forEach(function (b) {
      b.classList.toggle("on", Number(b.getAttribute("data-line")) === S.sceneLine);
    });
    $all(".bubble", view).forEach(function (b) {
      b.classList.toggle("on", Number(b.getAttribute("data-line")) === S.sceneLine);
    });
  }
  function speakLine(cb) {
    const d = dlg[S.sceneLine];
    if (!d) return cb && cb();
    let done = false;
    const once = function () { if (done) return; done = true; if (cb) cb(); };
    speak(d.full, { onend: once });
    const words = d.full.split(/\s+/).length;
    S._sceneTimer = setTimeout(once, Math.max(2200, words * 430 / Math.max(0.5, S.rate)));
  }
  function goto(n, autoSpeak) {
    S.sceneLine = (n + dlg.length) % dlg.length;
    paint();
    if (autoSpeak) speakLine(S.playing ? function () { setTimeout(function () { if (S.playing) goto(S.sceneLine + 1, true); }, 260); } : null);
  }
  $("#scNext").onclick = function () { sceneStopAuto(); syncPlayBtn(); goto(S.sceneLine + 1, true); };
  $("#scPrev").onclick = function () { sceneStopAuto(); syncPlayBtn(); goto(S.sceneLine - 1, true); };
  $("#scReplay").onclick = function () { speakLine(null); };
  $("#scPlay").onclick = function () {
    if (S.playing) { sceneStopAuto(); stopSpeak(); syncPlayBtn(); return; }
    S.playing = true; syncPlayBtn();
    goto(S.sceneLine, true);
  };
  function syncPlayBtn() {
    const b = $("#scPlay");
    if (b) b.textContent = S.playing ? "⏸ 暂停" : "▶ 连播";
  }
  $("#scFrame").onclick = function () { sceneStopAuto(); stopSpeak(); openViewfinder(sc); };
  $("#scFull").onclick = function () {
    const map = sceneSavedMap();
    map[sc.id] = [0, 0, 100, 100];
    saveJSON(K_SCENES, map);
    renderSceneTab();
  };
  $all("[data-play]", view).forEach(function (b) {
    b.onclick = function (ev) {
      ev.stopPropagation();
      sceneStopAuto(); syncPlayBtn();
      goto(Number(b.getAttribute("data-play")), false);
      speakLine(null);
    };
  });
  $all(".bubble", view).forEach(function (b) {
    b.onclick = function () {
      sceneStopAuto(); syncPlayBtn();
      goto(Number(b.getAttribute("data-line")), false);
      speakLine(null);
    };
  });
  $all(".dot", view).forEach(function (b) {
    b.onclick = function () {
      sceneStopAuto(); syncPlayBtn();
      goto(Number(b.getAttribute("data-line")), true);
    };
  });
}

/* ---------- 取景器：拖动/缩放页面图，选出一块场景 ---------- */
function openViewfinder(sc) {
  sceneStopAuto(); stopSpeak();
  const view = $("#view");
  const img = scenePageUrl(sc);
  const AI = PAGE_W / PAGE_H;        // 图片宽/高
  const cur = sceneRegion(sc);
  let s = 100 / Math.max(1, cur[2]); // 缩放：取景框越窄，放的越大
  let Ws = 0, Hs = 0;

  let h = '<div class="vf-wrap">';
  h += '<div class="vf-tip">🖐 拖动图片选择画面 · 滑块缩放 · 满意后点【用这块画面】</div>';
  h += '<div class="vf-stage" id="vfStage"><img id="vfImg" src="' + esc(img) + '" alt="课本页面"></div>';
  h += '<div class="vf-bar"><span>缩放</span><input type="range" id="vfZoom" min="0" max="100" value="0"><span id="vfPct">100%</span></div>';
  h += '<div class="vf-grid" id="vfGrid"></div>';
  h += '<div class="vf-actions"><button class="btn btn-ghost btn-sm" id="vfReset">↺ 原始取景</button>' +
       '<button class="btn btn-ghost btn-sm" id="vfCand">🎲 换一个候选</button>' +
       '<button class="btn btn-ghost btn-sm" id="vfCancel">取消</button>' +
       '<button class="btn btn-primary" id="vfOk">✓ 用这块画面</button></div>';
  h += '<div class="vf-hint">提示：九宫格可用于快速定位；「换一个候选」在我预先挑好的几处画面之间轮换。</div>';
  h += '</div>';
  view.innerHTML = h;

  const stage = $("#vfStage"), im = $("#vfImg"), zoom = $("#vfZoom");
  let tx = 0, ty = 0, sMin = 1, dragging = false, lastX = 0, lastY = 0, moved = 0;

  function measure() {
    Ws = stage.clientWidth; Hs = stage.clientHeight;
    sMin = Math.max(1, (Hs * AI) / Ws);
    clamp();
    draw();
  }
  function dims() {
    const dw = Ws * s, dh = dw / AI;
    return { dw: dw, dh: dh };
  }
  function clamp() {
    const d = dims();
    tx = Math.min(0, Math.max(Ws - d.dw, tx));
    ty = Math.min(0, Math.max(Hs - d.dh, ty));
  }
  function draw() {
    im.style.width = (Ws * s) + "px";
    im.style.transform = "translate(" + tx + "px," + ty + "px)";
    const pct = Math.round((s / sMin) * 100);
    $("#vfPct").textContent = pct + "%";
    zoom.value = Math.min(100, Math.max(0, ((s - sMin) / (sMin * 3)) * 100));
  }
  function regionFromView() {
    const d = dims();
    const w = (Ws / d.dw) * 100, h = (Hs / d.dh) * 100;
    const x = (-tx / d.dw) * 100, y = (-ty / d.dh) * 100;
    const cl = function (v) { return Math.min(100, Math.max(0, Math.round(v * 10) / 10)); };
    return [cl(x), cl(y), Math.min(100, cl(w)), Math.min(100, cl(h))];
  }
  function setRegion(r) {
    s = 100 / Math.max(1, r[2]);
    if (s < sMin) s = sMin;
    const d = dims();
    tx = -(r[0] / 100) * d.dw;
    ty = -(r[1] / 100) * d.dh;
    clamp(); draw();
  }

  stage.addEventListener("pointerdown", function (e) {
    dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
    if (stage.setPointerCapture) { try { stage.setPointerCapture(e.pointerId); } catch (err) {} }
  });
  stage.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    lastX = e.clientX; lastY = e.clientY;
    tx += dx; ty += dy; clamp(); draw();
    e.preventDefault();
  });
  stage.addEventListener("pointerup", function () { dragging = false; });
  stage.addEventListener("pointercancel", function () { dragging = false; });
  stage.addEventListener("wheel", function (e) {
    e.preventDefault();
    s = Math.max(sMin, Math.min(sMin * 4, s * (e.deltaY > 0 ? 0.92 : 1.08)));
    clamp(); draw();
  }, { passive: false });
  zoom.oninput = function () {
    s = sMin + (sMin * 3) * (Number(zoom.value) / 100);
    clamp(); draw();
  };
  /* 双指缩放 */
  let pinch = null;
  stage.addEventListener("touchstart", function (e) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinch = { d: Math.hypot(dx, dy), s: s };
    }
  }, { passive: true });
  stage.addEventListener("touchmove", function (e) {
    if (e.touches.length === 2 && pinch) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.hypot(dx, dy);
      s = Math.max(sMin, Math.min(sMin * 4, pinch.s * (d / pinch.d)));
      clamp(); draw();
      e.preventDefault();
    }
  }, { passive: false });
  stage.addEventListener("touchend", function () { pinch = null; }, { passive: true });

  /* 九宫格 */
  const grid = $("#vfGrid");
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const b = document.createElement("button");
      b.className = "vf-cell";
      b.textContent = (row + 1) + "·" + (col + 1);
      b.onclick = function () {
        setRegion([col * 33.3, row * 33.3, 33.4, 33.4]);
      };
      grid.appendChild(b);
    }
  }
  $("#vfReset").onclick = function () { setRegion(sc.region); };
  let ci = 0;
  $("#vfCand").onclick = function () {
    const cs = sceneCands(sc);
    ci = (ci + 1) % cs.length;
    setRegion(cs[ci]);
  };
  $("#vfCancel").onclick = function () { renderSceneTab(); };
  $("#vfOk").onclick = function () {
    const map = sceneSavedMap();
    map[sc.id] = regionFromView();
    saveJSON(K_SCENES, map);
    renderSceneTab();
  };

  im.onload = function () { measure(); };
  im.onerror = function () { measure(); };
  setTimeout(measure, 30);
  setTimeout(function () { setRegion(cur); }, 60);
}

/* 惰性配图：只有快要进入视口时才上色，60 多个小图不再一次性合成 */
let _cropObserver = null;
function lazyCrops(root) {
  const els = $all(".line-thumb[data-page], .sec-hero[data-page]", root);
  if (!els.length) return;
  function draw(el) {
    if (el.getAttribute("data-drawn")) return;
    el.setAttribute("data-drawn", "1");
    const r = String(el.getAttribute("data-region")).split(",").map(Number);
    const v = el.classList.contains("sec-hero") ? "h" : "t";
    el.style.cssText = cropBg(pageVariant(el.getAttribute("data-page"), v), r);
  }
  if (typeof IntersectionObserver === "undefined") { els.forEach(draw); return; }
  els.forEach(function (el) {
    el._draw = draw;
    _cropObserver.observe(el);
  });
}
function initCropObserver() {
  if (typeof IntersectionObserver === "undefined") return;
  _cropObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      _cropObserver.unobserve(en.target);
      if (en.target._draw) en.target._draw(en.target);
    });
  }, { rootMargin: "300px 0px" });
}

/* ---- 课文 ---- */
function renderLessonTab() {
  const m = currentModel();
  const view = $("#view");
  let h = '<div class="lesson-head card">';
  h += '<div class="lesson-title">' + esc(m.title) + '</div>';
  h += '<div class="lesson-tools">';
  if (m.kind === "builtin") {
    h += '<label class="switch"><input type="checkbox" id="zhToggle" ' + (S.showZh ? "checked" : "") + '> 显示中文</label>';
    h += '<button class="btn btn-ghost btn-sm" id="readAll">🎧 全文连读</button>';
    h += '<button class="btn btn-ghost btn-sm" id="stopAll">⏹ 停止</button>';
    h += '<button class="btn btn-ghost btn-sm" id="tfQuiz">✓✗ 课文判断</button>';
  } else {
    h += '<button class="btn btn-ghost btn-sm" id="stopAll">⏹ 停止朗读</button>';
  }
  h += '</div></div>';

  if (m.kind === "builtin") {
    m.unitText.forEach(function (sec, si) {
      const tb = (typeof TEXTBOOK_TRACKS !== "undefined" ? TEXTBOOK_TRACKS : []).find(function (t) { return t.sec === si; });
      const scn = (typeof SCENES !== "undefined") ? SCENES.find(function (x) { return x.sec === si; }) : null;
      h += '<div class="card sec"><div class="sec-title">' + sec.icon + " " + esc(sec.title) + ' <button class="btn-sound" data-sec="' + si + '">🔊 连读</button>';
      if (scn) h += ' <button class="btn-sound tb-btn" data-goto="' + scn.id + '" title="在情景剧场中打开">🎬 情景</button>';
      if (tb) h += ' <button class="btn-sound tb-btn" data-playfile="' + esc(tb.file) + '" title="' + esc(tb.title + " · " + tb.dur) + '">📻 课本原声 ' + esc(tb.dur) + '</button>';
      h += '</div>';
      if (scn) {
        const hero = fitRegion(sceneRegion(scn), 4.6);
        h += '<div class="sec-hero" data-page="' + esc(scenePageUrl(scn)) + '" data-region="' + hero.join(",") + '"></div>';
      }
      sec.lines.forEach(function (l, li) {
        const cls = l.q ? "line q-line" : "line";
        const thumb = scn ? fitRegion(sceneShotFor(scn, li), 1.9) : null;
        h += '<div class="' + cls + '">';
        if (thumb) h += '<span class="line-thumb" data-page="' + esc(scenePageUrl(scn)) + '" data-region="' + thumb.join(",") + '"></span>';
        h += '<span class="line-body"><span class="line-en">' + speakBtn(l.en) + '<span>' + esc(l.en) + '</span></span>';
        if (S.showZh && l.zh) h += '<span class="line-zh">' + esc(l.zh) + '</span>';
        h += '</span></div>';
      });
      h += '</div>';
    });
    /* 故事排序 */
    h += '<div class="card sec"><div class="sec-title">🧩 故事排一排（复述故事第一步）</div><div class="hint">按发生顺序点击下面的句子。</div><div class="order-area" id="storyOrder"></div><div class="order-done" id="storyDone"></div><div class="q-actions"><button class="btn btn-ghost btn-sm" id="storyReset">↺ 重新开始</button></div></div>';
    /* 写一写 */
    h += '<div class="card sec"><div class="sec-title">✏️ 写一写：用 and / but / because 连句</div>';
    m.writeTasks.forEach(function (t, i) {
      h += '<div class="write-item"><div class="line-en"><span>' + esc(t.prompt) + '</span></div>';
      h += '<button class="btn btn-ghost btn-sm reveal-btn" data-reveal="wt' + i + '">👁 看参考</button>';
      h += '<div class="line-zh hidden" id="wt' + i + '">' + esc(t.ref) + '<br>' + speakBtn(t.ref) + ' ' + esc(t.exp) + '</div></div>';
    });
    h += '</div>';
    /* 口语任务 */
    h += '<div class="card sec"><div class="sec-title">🎤 口语挑战：' + esc(m.speakTask.title) + '</div>';
    h += '<div class="hint">' + esc(m.speakTask.tip) + '</div>';
    m.speakTask.frames.forEach(function (f) {
      h += '<div class="line-en">' + speakBtn(f) + '<span>' + esc(f) + '</span></div>';
    });
    h += '</div>';
  } else {
    m.paragraphs.forEach(function (p, pi) {
      const sents = splitSentences(p);
      h += '<div class="card sec"><div class="sec-title">📄 第 ' + (pi + 1) + ' 段 <button class="btn-sound" data-para="' + pi + '">🔊 连读</button></div>';
      sents.forEach(function (s) {
        h += '<div class="line"><div class="line-en">' + speakBtn(s) + '<span>' + esc(s) + '</span></div></div>';
      });
      h += '</div>';
    });
    if (m.unknowns.length) {
      h += '<div class="card sec"><div class="sec-title">🆕 未收录生词（' + m.unknowns.length + '）</div><div class="hint">填上中文意思后，这些词也会进入词汇练习；点击「保存含义」。</div>';
      m.unknowns.slice(0, 40).forEach(function (u) {
        const zh = m.meanings[u.en] || "";
        h += '<div class="unk-row"><span class="unk-en">' + esc(u.en) + '</span><span class="unk-count">×' + u.count + '</span>';
        h += '<input class="unk-input" data-unk="' + esc(u.en) + '" placeholder="中文意思（选填）" value="' + esc(zh) + '"></div>';
      });
      h += '<div class="q-actions"><button class="btn btn-primary btn-sm" id="saveMeanings">💾 保存含义</button></div></div>';
    }
  }
  view.innerHTML = h;
  bindSpeakBtns(view);
  lazyCrops(view);

  $all("[data-sec]").forEach(function (b) {
    b.onclick = function () {
      const sec = m.unitText[+b.getAttribute("data-sec")];
      speak(sec.lines.map(function (l) { return l.en; }).join(" "));
    };
  });
  $all("[data-para]").forEach(function (b) {
    b.onclick = function () { speak(m.paragraphs[+b.getAttribute("data-para")]); };
  });
  $all(".reveal-btn").forEach(function (b) {
    b.onclick = function () { $("#" + b.getAttribute("data-reveal")).classList.toggle("hidden"); };
  });
  const zt = $("#zhToggle");
  if (zt) zt.onchange = function () { S.showZh = zt.checked; renderLessonTab(); };
  $("#stopAll").onclick = stopSpeak;
  $all("[data-goto]", $("#view")).forEach(function (b) {
    b.onclick = function () {
      S.sceneId = b.getAttribute("data-goto");
      S.sceneLine = 0;
      setTab("scene");
    };
  });
  const ra = $("#readAll");
  if (ra) ra.onclick = function () {
    const all = [];
    m.unitText.forEach(function (sec) { sec.lines.forEach(function (l) { all.push(l.en); }); });
    speak(all.join(" "));
  };
  const tq = $("#tfQuiz");
  if (tq) tq.onclick = function () { startQuiz("课文判断 ✓✗", genStoryTF(m, 4), { regen: function () { startQuiz("课文判断 ✓✗", genStoryTF(m, 4), {}); } }); };

  if (m.kind === "builtin") initStoryOrder(m);
  const sm = $("#saveMeanings");
  if (sm) sm.onclick = function () {
    $all(".unk-input").forEach(function (inp) {
      const k = inp.getAttribute("data-unk");
      if (inp.value.trim()) m.meanings[k] = inp.value.trim();
    });
    saveJSON(K_CUSTOM + ".meanings." + m.id, m.meanings);
    S.custom = buildCustomFromModel(m);
    toast("已保存，生词含义已加入词汇练习 ✔");
    renderLessonTab();
  };
}
function buildCustomFromModel(m) {
  const model = buildCustom(m.rawText, m.title);
  model.id = m.id;
  model.meanings = m.meanings;
  model.words = model.words.concat(Object.keys(m.meanings).map(function (k) {
    return { en: k, pos: "", zh: m.meanings[k], core: false, fromDict: false };
  }));
  return model;
}
function initStoryOrder(m) {
  const area = $("#storyOrder");
  const doneBox = $("#storyDone");
  let order = [];
  const shuffled = shuffle(m.storyEvents.map(function (_, i) { return i; }));
  function paint() {
    area.innerHTML = "";
    shuffled.forEach(function (idx) {
      if (order.indexOf(idx) >= 0) return;
      const b = document.createElement("button");
      b.className = "chip"; b.textContent = m.storyEvents[idx].t;
      b.onclick = function () { order.push(idx); paint(); checkStory(); };
      area.appendChild(b);
    });
    doneBox.textContent = "";
  }
  function checkStory() {
    if (order.length !== m.storyEvents.length) return;
    const ok = order.every(function (v, i) { return v === i; });
    doneBox.textContent = ok ? "🎉 顺序正确！现在试着用自己的话复述一遍吧！" : "再想想哦：开头是图图在和别人玩……（点击“重新开始”再试）";
    doneBox.style.color = ok ? "#178a50" : "#c0483c";
    if (!ok) { order = []; setTimeout(paint, 1200); }
  }
  $("#storyReset").onclick = function () { order = []; paint(); };
  paint();
}

/* ---- 词汇 ---- */
function renderWordsTab() {
  const m = currentModel();
  const view = $("#view");
  const usable = m.words.filter(function (w) { return w.zh; });
  let h = '<div class="tab-head card"><div class="tab-title">🔤 词汇学习 <span class="badge">' + usable.length + ' 词</span></div>';
  h += '<div class="hint">点击 🔊 听发音。带 ★ 的是学习档案里的核心词。</div>';
  h += '<div class="btn-row">';
  h += '<button class="btn btn-primary" data-q="e2c">英 → 汉（10题）</button>';
  h += '<button class="btn btn-primary" data-q="c2e">汉 → 英（10题）</button>';
  h += '<button class="btn btn-primary" data-q="listen">听音选词（10题）</button>';
  h += '<button class="btn btn-primary" data-q="listenZh">听音选义（10题）</button>';
  h += '</div></div><div class="cards-grid">';
  usable.forEach(function (w, i) {
    const inSrs = !!SRS.items[w.en];
    h += '<div class="card word-card">';
    h += '<div class="w-top"><span class="w-en">' + (w.core ? '★ ' : '') + esc(w.en) + '</span>' + speakBtn(w.en) + '</div>';
    h += '<div class="w-pos">' + esc(w.pos || "") + (w.audio ? ' <span class="badge human">真人</span>' : '') + '</div>';
    h += '<div class="w-zh">' + esc(w.zh) + (w.audio && w.audio.zh ? ' ' + playFileBtn(w.audio.zh, "🔈") : '') + '</div>';
    if (w.ex) h += '<div class="w-ex">' + speakBtn(w.ex) + '<span>' + esc(w.ex) + (w.exZh ? '<br><i>' + esc(w.exZh) + '</i>' : '') + '</span></div>';
    if (w.audio && w.audio.ex) h += '<div class="w-tbaudio">' + playFileBtn(w.audio.ex, "📻") + '<span>词条原声（真人朗读+例句）</span></div>';
    h += '<div class="w-foot"><button class="btn btn-ghost btn-sm srs-add" data-srs="' + esc(w.en) + '" data-zh="' + esc(w.zh) + '">' + (inSrs ? "✓ 已在生词本" : "＋ 生词本") + '</button></div>';
    h += '</div>';
  });
  h += '</div>';
  view.innerHTML = h;
  bindSpeakBtns(view);
  $all(".srs-add").forEach(function (b) {
    b.onclick = function () {
      const en = b.getAttribute("data-srs");
      if (SRS.items[en]) { toast("已在生词本中"); return; }
      srsAdd(en, b.getAttribute("data-zh"), "", "词汇卡");
      toast("已加入生词本 ✔");
      renderWordsTab();
    };
  });
  $all("[data-q]").forEach(function (b) {
    b.onclick = function () {
      const t = b.getAttribute("data-q");
      const cfg = {
        e2c: ["词汇 · 英译汉", function () { return genWordE2C(m, 10); }],
        c2e: ["词汇 · 汉译英", function () { return genWordC2E(m, 10); }],
        listen: ["词汇 · 听音选词", function () { return genListenWord(m, 10); }],
        listenZh: ["词汇 · 听音选义", function () { return genListenWordZh(m, 10); }]
      }[t];
      const regen = function () { startQuiz(cfg[0], cfg[1](), { regen: regen }); };
      startQuiz(cfg[0], cfg[1](), { regen: regen });
    };
  });
}

/* ---- 短语 ---- */
function renderPhrasesTab() {
  const m = currentModel();
  const view = $("#view");
  let h = '<div class="tab-head card"><div class="tab-title">🔗 短语学习 <span class="badge">' + m.phrases.length + ' 条</span></div>';
  h += '<div class="hint">徽章 🤝 是本单元的“相处之道”短语。</div>';
  h += '<div class="btn-row">';
  h += '<button class="btn btn-primary" data-q="e2c">英 → 汉（8题）</button>';
  h += '<button class="btn btn-primary" data-q="c2e">汉 → 英（8题）</button>';
  h += '<button class="btn btn-primary" data-q="listen">听音选短语（8题）</button>';
  h += '</div></div><div class="cards-grid">';
  m.phrases.forEach(function (p) {
    const inSrs = !!SRS.items[p.en];
    h += '<div class="card word-card">';
    h += '<div class="w-top"><span class="w-en">' + (p.social ? '<span class="badge social">🤝 相处之道</span> ' : '') + esc(p.en) + '</span>' + speakBtn(p.en) + '</div>';
    h += '<div class="w-zh">' + esc(p.zh) + '</div>';
    if (p.ex) h += '<div class="w-ex">' + speakBtn(p.ex) + '<span>' + esc(p.ex) + (p.exZh ? '<br><i>' + esc(p.exZh) + '</i>' : '') + '</span></div>';
    h += '<div class="w-foot"><button class="btn btn-ghost btn-sm srs-add" data-srs="' + esc(p.en) + '" data-zh="' + esc(p.zh) + '">' + (inSrs ? "✓ 已在生词本" : "＋ 生词本") + '</button></div>';
    h += '</div>';
  });
  h += '</div>';
  view.innerHTML = h;
  bindSpeakBtns(view);
  $all(".srs-add").forEach(function (b) {
    b.onclick = function () {
      const en = b.getAttribute("data-srs");
      if (SRS.items[en]) { toast("已在生词本中"); return; }
      srsAdd(en, b.getAttribute("data-zh"), "", "短语卡");
      toast("已加入生词本 ✔");
      renderPhrasesTab();
    };
  });
  $all("[data-q]").forEach(function (b) {
    b.onclick = function () {
      const t = b.getAttribute("data-q");
      const cfg = {
        e2c: ["短语 · 英译汉", function () { return genPhraseE2C(m, 8); }],
        c2e: ["短语 · 汉译英", function () { return genPhraseC2E(m, 8); }],
        listen: ["短语 · 听音选短语", function () { return genListenPhrase(m, 8); }]
      }[t];
      const regen = function () { startQuiz(cfg[0], cfg[1](), { regen: regen }); };
      startQuiz(cfg[0], cfg[1](), { regen: regen });
    };
  });
}

/* ---- 句式 ---- */
function renderPatternsTab() {
  const m = currentModel();
  const view = $("#view");
  let h = '<div class="tab-head card"><div class="tab-title">✨ 重要句式</div><div class="hint">例句都可以点 🔊 跟读。</div></div>';
  m.patterns.forEach(function (p) {
    h += '<div class="card sec"><div class="sec-title">✨ ' + esc(p.name) + '</div>';
    h += '<div class="pattern-zh">' + esc(p.zh || "") + '</div>';
    if (p.note) h += '<div class="hint">' + esc(p.note) + '</div>';
    p.examples.forEach(function (e) {
      h += '<div class="line"><div class="line-en">' + speakBtn(e.en) + '<span>' + esc(e.en) + '</span></div>';
      if (e.zh) h += '<div class="line-zh">' + esc(e.zh) + '</div>';
      h += '</div>';
    });
    h += '</div>';
  });
  if (!m.patterns.length) h += '<div class="card">这篇课文中未自动识别到典型句式。</div>';
  view.innerHTML = h;
  bindSpeakBtns(view);
}

/* ---- 语法 ---- */
function renderGrammarTab() {
  const m = currentModel();
  const view = $("#view");
  let h = '<div class="tab-head card"><div class="tab-title">📐 语法讲解</div>';
  h += '<div class="btn-row">';
  h += '<button class="btn btn-primary" data-q="grammar">语法选择填空（10题）</button>';
  h += '<button class="btn btn-primary" data-q="cloze">选词填空（8题）</button>';
  h += '<button class="btn btn-primary" data-q="reorder">连词成句（8题）</button>';
  h += '</div></div>';
  (m.grammarPoints || []).forEach(function (g) {
    h += '<div class="card sec"><div class="sec-title">' + (g.core ? '<span class="badge core">核心</span> ' : '') + esc(g.title) + '</div>';
    h += '<div class="grammar-body">' + g.body + '</div><ul class="rules">';
    g.rules.forEach(function (r) { h += '<li>' + r + '</li>'; });
    h += '</ul><div class="tip">💡 ' + esc(g.tip) + '</div></div>';
  });
  if (!(m.grammarPoints || []).length) h += '<div class="card">自定义课文暂无固定语法讲解，可直接做“语法选择填空”（自动生成）。</div>';
  view.innerHTML = h;
  $all("[data-q]").forEach(function (b) {
    b.onclick = function () {
      const t = b.getAttribute("data-q");
      const cfg = {
        grammar: ["语法 · 选择填空", function () { return genGrammar(m, 10); }],
        cloze: ["语法 · 选词填空", function () { return genCloze(m, 8); }],
        reorder: ["语法 · 连词成句", function () { return genReorder(m, 8); }]
      }[t];
      const regen = function () { startQuiz(cfg[0], cfg[1](), { regen: regen }); };
      startQuiz(cfg[0], cfg[1](), { regen: regen });
    };
  });
}

/* ---- 听力 ---- */
function renderListenTab() {
  const m = currentModel();
  const view = $("#view");
  let h = '<div class="tab-head card"><div class="tab-title">🎧 听力训练</div>';
  h += '<div class="hint">电脑/手机会朗读英语。若没有声音，请检查系统音量，或换用 Chrome / Edge 浏览器。</div>';
  h += '<div class="btn-row">';
  h += '<button class="btn btn-primary" data-q="w">听单词 → 选词汇（10题）</button>';
  h += '<button class="btn btn-primary" data-q="wz">听单词 → 选汉语（10题）</button>';
  h += '<button class="btn btn-primary" data-q="s">听句子 → 选句子（8题）</button>';
  h += '<button class="btn btn-primary" data-q="p">听短文 → 选答案（6题）</button>';
  h += '</div></div>';
  if (m.kind === "builtin") {
    h += '<div class="card sec"><div class="sec-title">📻 课本原声（教材配套音频）</div>';
    h += '<div class="hint">和课本配套的真人录音，配合各板块使用效果更好。</div>';
    TEXTBOOK_TRACKS.forEach(function (t) {
      h += '<div class="tb-row">' + playFileBtn(t.file, "▶") + '<div><div class="tb-title">' + esc(t.title) + '</div><div class="tb-zh">' + esc(t.zh) + ' · ' + esc(t.dur) + '</div></div></div>';
    });
    h += '<div class="hint" style="margin-top:6px">💡 “听短文答题”里的 Duoduo 篇已直接使用课本原声；Sally &amp; Mia 场景题也可先听第 4 段再作答。</div>';
    h += '</div>';
    h += '<div class="card sec"><div class="sec-title">🎧 听力小剧场：Sally &amp; Mia</div>';
    h += '<div class="hint">课本听力场景（第 4 段原声）没有逐句原文，可先播放原声再做题。</div>';
    h += '<button class="btn btn-primary" id="playSally">📻 播放课本原声（第4段）</button>';
    h += '<div class="line" style="margin-top:8px"><div class="line-en">' + speakBtn(SALLY_TEXT) + '<span>Why are Sally and Mia angry with each other? … （合成语音版全文）</span></div></div>';
    h += '<div class="q-actions"><button class="btn btn-ghost" id="sallyQ">做一做场景选择题</button></div></div>';
  }
  view.innerHTML = h;
  bindSpeakBtns(view);
  $all("[data-q]").forEach(function (b) {
    b.onclick = function () {
      const t = b.getAttribute("data-q");
      const cfg = {
        w: ["听力 · 听音选词", function () { return genListenWord(m, 10); }],
        wz: ["听力 · 听音选义", function () { return genListenWordZh(m, 10); }],
        s: ["听力 · 听句选句", function () { return genListenSent(m, 8); }],
        p: ["听力 · 听短文答题", function () { return genPassage(m, 6); }]
      }[t];
      const regen = function () { startQuiz(cfg[0], cfg[1](), { regen: regen }); };
      startQuiz(cfg[0], cfg[1](), { regen: regen });
    };
  });
  const ps = $("#playSally");
  if (ps) ps.onclick = function () { TTS.playFile(TEXTBOOK_TRACKS[3].file, { fallback: function () { speak(SALLY_TEXT); } }); };
  const sq = $("#sallyQ");
  if (sq) sq.onclick = function () {
    const qs = [
      mkQ({ kind: "listen-sent", prompt: "Why are Sally and Mia angry with each other?", sub: "🎧 可先点上方“播放课本原声（第4段）”再作答", audio: "", audioFile: TEXTBOOK_TRACKS[3].file, options: ["Because they want to do different things on Saturday.", "Because they don't want to share things.", "Because they have different plans for their science homework."], answer: 2, explain: "她们的科学作业计划不同，所以生气了。（课本原声第4段）" }),
      mkQ({ kind: "grammar", prompt: "First, ___ sorry to Mia.", sub: "补全建议", options: ["say", "says", "saying"], answer: 0, explain: "祈使句用动词原形 say。" })
    ];
    startQuiz("听力小剧场 · Sally & Mia", qs, {});
  };
}

/* ---- 生词本 ---- */
function renderSrsTab() {
  const m = currentModel();
  const view = $("#view");
  const due = srsDueList();
  const items = Object.keys(SRS.items);
  const mastered = items.filter(function (k) { return SRS.items[k].state === "已掌握"; }).length;
  let h = '<div class="tab-head card"><div class="tab-title">🗂 生词本 · 间隔复习</div>';
  h += '<div class="hint">复习节奏：答对进下一档（+1 / +3 / +7 / +16 / +35 天），答错回退上一档并当天重现。复习时先考后揭。</div>';
  h += '<div class="srs-stats"><span class="stat">共 ' + items.length + ' 条</span><span class="stat hot">今日待复习 ' + due.length + ' 条</span><span class="stat ok">已掌握 ' + mastered + ' 条</span></div>';
  h += '<div class="btn-row">';
  h += '<button class="btn btn-primary" id="srsReview" ' + (due.length ? "" : "disabled") + '>▶ 开始今日复习（' + due.length + '）</button>';
  h += '<button class="btn btn-primary" id="srsDay1">⚡ Day 1 核心词自测（15题）</button>';
  h += '</div>';
  h += '<div class="srs-add-row"><input id="srsNewEn" placeholder="单词/短语（英文）"><input id="srsNewZh" placeholder="中文意思"><button class="btn btn-ghost btn-sm" id="srsAddBtn">＋ 添加</button></div>';
  h += '</div>';
  h += '<div class="card"><div class="table-wrap"><table class="srs-table"><thead><tr><th>单词 / 短语</th><th>释义</th><th>间隔档</th><th>下次复习</th><th>状态</th><th></th></tr></thead><tbody>';
  items.slice().sort(function (a, b) {
    const A = SRS.items[a], B = SRS.items[b];
    if ((A.due || "9999") !== (B.due || "9999")) return (A.due || "9999") < (B.due || "9999") ? -1 : 1;
    return a.localeCompare(b);
  }).forEach(function (k) {
    const it = SRS.items[k];
    const lv = it.state === "已掌握" ? "毕业 🎓" : "+" + SRS_INTERVALS[it.level] + "天";
    h += '<tr><td class="srs-en">' + speakBtn(k) + esc(k) + '</td><td>' + esc(it.zh) + '</td><td>' + lv + '</td><td>' + (it.due || "—") + '</td>';
    h += '<td><span class="' + (it.state === "已掌握" ? "ok" : "hot") + '">' + it.state + '</span></td>';
    h += '<td><button class="btn btn-ghost btn-sm srs-reset" data-k="' + esc(k) + '">↺</button> <button class="btn btn-ghost btn-sm srs-del" data-k="' + esc(k) + '">🗑</button></td></tr>';
  });
  h += '</tbody></table></div></div>';
  view.innerHTML = h;
  bindSpeakBtns(view);
  $("#srsReview").onclick = function () {
    if (!due.length) return;
    const qs = genSrsReview(due, Math.min(due.length, 12));
    startQuiz("生词本 · 今日复习", qs, { requeue: true });
  };
  $("#srsDay1").onclick = function () {
    const level0 = Object.keys(SRS.items).filter(function (k) { return SRS.items[k].level === 0; });
    const keys = sample(level0.length ? level0 : Object.keys(SRS.items), 15);
    startQuiz("Day 1 · 核心词自测（先考后揭）", genSrsReview(keys, keys.length), { requeue: true });
  };
  $("#srsAddBtn").onclick = function () {
    const en = $("#srsNewEn").value.trim();
    const zh = $("#srsNewZh").value.trim();
    if (!en) { toast("请输入英文"); return; }
    if (srsAdd(en, zh, "", "自录")) { toast("已添加 ✔"); renderSrsTab(); }
    else toast("这个词已在生词本里啦");
  };
  $all(".srs-del").forEach(function (b) {
    b.onclick = function () { srsRemove(b.getAttribute("data-k")); renderSrsTab(); };
  });
  $all(".srs-reset").forEach(function (b) {
    b.onclick = function () { srsReset(b.getAttribute("data-k")); renderSrsTab(); };
  });
}

/* ---- 综合测验 ---- */
function renderTestTab() {
  const m = currentModel();
  const view = $("#view");
  let h = '<div class="tab-head card"><div class="tab-title">📝 综合测验</div>';
  h += '<div class="hint">词汇 + 短语 + 语法 + 选词填空 + 连词成句 + 听力' + (m.kind === "builtin" ? " + 课文判断" : "") + '，检验本课所学。</div>';
  h += '<div class="btn-row">';
  h += '<button class="btn btn-primary" data-n="10">快测 10 题</button>';
  h += '<button class="btn btn-primary" data-n="15">标准 15 题</button>';
  h += '<button class="btn btn-primary" data-n="20">挑战 20 题</button>';
  h += '</div></div>';
  if (m.kind === "builtin") {
    h += '<div class="card sec"><div class="sec-title">🎯 本课 can-do 自查</div><ul class="rules">';
    h += '<li>□ 能说出 8 个“相处之道”短语（去短语页打卡）</li>';
    h += '<li>□ 能用 and / but / because 写 5 句以上连贯句子（去语法页“写一写”）</li>';
    h += '<li>□ 能 1 分钟口头介绍自己最好的朋友（去课文页“口语挑战”）</li>';
    h += '<li>□ 能复述 Duoduo\u2019s best friends 故事（去课文页“故事排一排”）</li>';
    h += '</ul></div>';
  }
  view.innerHTML = h;
  $all("[data-n]").forEach(function (b) {
    b.onclick = function () {
      const n = +b.getAttribute("data-n");
      const regen = function () { startQuiz("综合测验", genMixed(m, n), { regen: regen }); };
      startQuiz("综合测验", genMixed(m, n), { regen: regen });
    };
  });
}

/* ---- 错题本 ---- */
function renderWrongTab() {
  const view = $("#view");
  let h = '<div class="tab-head card"><div class="tab-title">⭐ 错题本 <span class="badge">' + WRONG.length + ' 题</span></div>';
  h += '<div class="hint">做错的题会自动收进来。词汇/短语答错时，对应生词也会自动进生词本并回退复习档。</div>';
  h += '<div class="btn-row">';
  h += '<button class="btn btn-primary" id="wrPractice" ' + (WRONG.length ? "" : "disabled") + '>▶ 练错题（' + WRONG.length + '）</button>';
  h += '<button class="btn btn-ghost" id="wrClear" ' + (WRONG.length ? "" : "disabled") + '>🗑 清空</button>';
  h += '</div></div>';
  if (WRONG.length) {
    h += '<div class="card">';
    WRONG.slice().reverse().forEach(function (q) {
      h += '<div class="wrong-item"><div class="wi-q">' + esc(q.prompt) + '</div><div class="wi-a">正确答案：' + esc(q.kind === "reorder" ? q.sentence : q.options[q.answer]) + '</div>';
      if (q.explain) h += '<div class="wi-e">' + esc(q.explain) + '</div>';
      h += '<div class="wi-t">' + esc(q.title || "") + (q.time ? " · " + esc(q.time) : "") + '</div></div>';
    });
    h += '</div>';
  }
  view.innerHTML = h;
  $("#wrPractice").onclick = function () {
    const qs = shuffle(WRONG).map(function (q) {
      const c = {}; for (var k in q) c[k] = q[k]; c.srsKey = null; return shuffleOptions(c);
    });
    startQuiz("错题本 · 重练", qs, {});
  };
  $("#wrClear").onclick = function () {
    if (confirm("确定清空错题本吗？")) { clearWrong(); renderWrongTab(); }
  };
}

/* ================= 上传课文 ================= */
function readFileAsText(file, cb) {
  const reader = new FileReader();
  reader.onload = function () {
    const buf = reader.result;
    let text = "";
    try { text = new TextDecoder("utf-8", { fatal: false }).decode(buf); } catch (e) { text = reader.result; }
    if (text.indexOf("\uFFFD") >= 0 && typeof TextDecoder !== "undefined") {
      try { text = new TextDecoder("gbk").decode(buf); } catch (e) {}
    }
    cb(text);
  };
  reader.readAsArrayBuffer(file);
}

/* PDF 课文：优先读取文字层；扫描版（无文字层）给出 OCR 转换指引 */
function handlePdfFile(file) {
  /* pdf.js 体积大且仅上传 PDF 时用到，改为按需加载，避免拖慢 iPad 首屏 */
  if (typeof pdfjsLib === "undefined") {
    toast("正在加载 PDF 解析组件…");
    const sc = document.createElement("script");
    sc.src = "pdfjs/pdf.min.js?v=20261024";
    sc.onload = function () { setTimeout(function () { handlePdfFile(file); }, 0); };
    sc.onerror = function () {
      showScanModal("未找到 PDF 解析组件（pdfjs/pdf.min.js），请确认应用文件夹完整，或用 OCR 工具转换后上传 txt。");
    };
    document.head.appendChild(sc);
    return;
  }
  toast("正在读取 PDF（" + file.name + "）…");
  const reader = new FileReader();
  reader.onload = function () {
    try { pdfjsLib.GlobalWorkerOptions.workerSrc = "pdfjs/pdf.worker.min.js"; } catch (e) {}
    pdfjsLib.getDocument({ data: reader.result }).promise.then(function (pdf) {
      const pages = [];
      let p = 1;
      function readPage() {
        if (p > pdf.numPages) { finish(); return; }
        pdf.getPage(p).then(function (page) { return page.getTextContent(); }).then(function (tc) {
          let line = "";
          const paras = [];
          (tc.items || []).forEach(function (it) {
            if (!it.str) return;
            line += it.str;
            if (it.hasEOL) { paras.push(line.trim()); line = ""; }
          });
          if (line.trim()) paras.push(line.trim());
          /* 合并被换行打断的段落/句子 */
          const merged = [];
          paras.forEach(function (ln) {
            if (!ln) return;
            const prev = merged[merged.length - 1];
            if (prev && !/[.!?:;"”)]$/.test(prev) && !/^[•·\-–—\d]/.test(ln) && prev.length >= 40 && prev.length < 400) {
              merged[merged.length - 1] = prev.replace(/-$/, "") + " " + ln;
            } else merged.push(ln);
          });
          pages.push(merged.join("\n"));
          p++;
          readPage();
        }).catch(function () { pages.push(""); p++; readPage(); });
      }
      function finish() {
        const text = pages.join("\n\n").replace(/[ \t]{2,}/g, " ").trim();
        const letters = (text.match(/[A-Za-z]/g) || []).length;
        if (letters < 30) {
          showScanModal("这份 PDF 没有文字层（扫描版/图片版），浏览器无法直接提取文本。");
          return;
        }
        handleUploadText(text, file.name.replace(/\.pdf$/i, ""));
      }
      readPage();
    }).catch(function (err) {
      showScanModal("PDF 读取失败：" + ((err && err.message) || "未知错误"));
    });
  };
  reader.readAsArrayBuffer(file);
}
function showScanModal(msg) {
  $("#scanMsg").textContent = msg || "";
  $("#scanCmd").textContent = 'python3 tools/pdf2txt.py "你的课文.pdf"';
  $("#scanModal").classList.remove("hidden");
}
function closeScanModal() { $("#scanModal").classList.add("hidden"); }
function handleUploadText(text, name) {
  if (!text || !text.trim()) { toast("文件是空的哦"); return; }
  if (text.length > 200000) text = text.slice(0, 200000);
  const model = buildCustom(text, name || "我的课文");
  saveJSON(K_CUSTOM, { title: model.title, rawText: text, meanings: {}, createdAt: model.id });
  S.custom = model;
  refreshLessonSel();
  toast("解析完成：词汇 " + model.words.length + " · 生词 " + model.unknowns.length + " · 短语 " + model.phrases.length + " · 句式 " + model.patterns.length + " · 句子 " + model.sentences.length);
  setTab("lesson");
}
function refreshLessonSel() {
  const sel = $("#lessonSel");
  sel.innerHTML = '<option value="builtin">内置：外研社五上 Unit 3 Happy together</option>';
  const custom = S.custom || S.customCache;
  if (custom) {
    const o = document.createElement("option");
    o.value = "custom";
    o.textContent = "自定义：" + custom.title;
    sel.appendChild(o);
  }
  sel.value = S.custom ? "custom" : "builtin";
}
function switchLesson(which) {
  if (which === "builtin") {
    if (S.custom) S.customCache = S.custom; /* 暂存，便于再切换 */
    S.custom = null;
    refreshLessonSel();
    setTab("lesson");
  } else if (which === "custom") {
    if (S.customCache && !S.custom) { S.custom = S.customCache; refreshLessonSel(); setTab("lesson"); }
  }
}

/* ================= 初始化 ================= */
function toast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(function () { t.classList.remove("show"); }, 2600);
}

function initApp() {
  initCropObserver();
  loadSettings();
  loadWrong();
  initSRS();
  TTS.init();
  /* 恢复上次自定义课文 */
  const saved = loadJSON(K_CUSTOM, null);
  if (saved && saved.rawText) {
    try { S.custom = buildCustom(saved.rawText, saved.title); S.custom.meanings = saved.meanings || {}; } catch (e) { S.custom = null; }
  }
  /* 顶栏 */
  const tabs = $("#tabs");
  TABS.forEach(function (t) {
    const sp = t[1].indexOf(" ");
    const ico = t[1].slice(0, sp), label = t[1].slice(sp + 1);
    const b = document.createElement("button");
    b.className = "tab"; b.setAttribute("data-tab", t[0]);
    b.innerHTML = '<span class="t-ico">' + ico + '</span><span class="t-label">' + label + '</span>';
    b.onclick = function () { setTab(t[0]); };
    tabs.appendChild(b);
  });
  refreshLessonSel();
  $("#lessonSel").onchange = function (e) {
    switchLesson(e.target.value);
  };
  $("#fileInput").onchange = function (e) {
    const f = e.target.files[0];
    if (!f) return;
    if (/\.pdf$/i.test(f.name) || f.type === "application/pdf") handlePdfFile(f);
    else readFileAsText(f, function (text) { handleUploadText(text, f.name.replace(/\.[^.]+$/, "")); });
    e.target.value = "";
  };
  $("#btnUpload").onclick = function () { $("#fileInput").click(); };
  $("#btnPaste").onclick = function () { openPasteModal(); };
  $("#btnHome").onclick = function () { setTab("lesson"); };
  $("#rateRange").value = S.rate;
  $("#rateVal").textContent = S.rate.toFixed(2) + "x";
  $("#rateRange").oninput = function (e) {
    S.rate = +e.target.value;
    $("#rateVal").textContent = S.rate.toFixed(2) + "x";
    saveJSON(K_SETTINGS, { rate: S.rate, autoSpeak: S.autoSpeak, voiceMode: S.voiceMode });
  };
  $("#autoSpeak").checked = S.autoSpeak;
  $("#autoSpeak").onchange = function (e) {
    S.autoSpeak = e.target.checked;
    saveJSON(K_SETTINGS, { rate: S.rate, autoSpeak: S.autoSpeak, voiceMode: S.voiceMode });
  };
  /* 发音源选择 */
  const vsel = $("#voiceSel");
  vsel.value = S.voiceMode;
  vsel.onchange = function (e) {
    S.voiceMode = e.target.value;
    TTS.mode = e.target.value;
    TTS.browserBroken = false;
    saveJSON(K_SETTINGS, { rate: S.rate, autoSpeak: S.autoSpeak, voiceMode: S.voiceMode });
    TTS.speak("Hello! Let's learn English together.");
  };
  /* 手机端：设置折叠开关 */
  $("#btnSettings").onclick = function () {
    $("#settingsRow").classList.toggle("show");
  };
  /* 粘贴弹窗 */
  $("#pasteCancel").onclick = closePasteModal;
  $("#pasteOk").onclick = function () {
    const t = $("#pasteArea").value;
    if (!t.trim()) { toast("请先粘贴课文文本"); return; }
    closePasteModal();
    handleUploadText(t, "粘贴的课文");
  };
  /* 扫描版 PDF 提示弹窗 */
  $("#scanClose").onclick = closeScanModal;
  $("#scanPaste").onclick = function () { closeScanModal(); openPasteModal(); };
  /* 支持 #词汇 等 hash 直达板块 */
  const h = (typeof location !== "undefined" ? location.hash || "" : "").replace("#", "");
  if (TABS.some(function (t) { return t[0] === h; })) {
    setTimeout(function () { setTab(h); }, 0);
  } else {
    setTab(typeof SCENES !== "undefined" ? "scene" : "lesson");
  }
}
function openPasteModal() {
  $("#pasteModal").classList.remove("hidden");
  $("#pasteArea").focus();
}
function closePasteModal() { $("#pasteModal").classList.add("hidden"); }

if (typeof document !== "undefined" && typeof window !== "undefined") {
  window.APP = {
    buildCustom: buildCustom, parseText: parseText, lemma: lemma, genMixed: genMixed,
    genWordE2C: genWordE2C, genWordC2E: genWordC2E, genListenWord: genListenWord,
    genGrammar: genGrammar, genCloze: genCloze, genReorder: genReorder,
    genListenSent: genListenSent, genPassage: genPassage, genSrsReview: genSrsReview,
    mutateSentence: mutateSentence, builtinModel: builtinModel, genGrammarCustom: genGrammarCustom,
    buildCustomPassages: buildCustomPassages, startQuiz: startQuiz,
    state: S, srsAdd: srsAdd, srsUpdate: srsUpdate, srsItems: function () { return SRS.items; },
    currentModel: currentModel, switchLesson: switchLesson, handleUploadText: handleUploadText,
    scenes: (typeof SCENES !== "undefined" ? SCENES : []),
    sceneDialogue: sceneDialogue, cropBg: cropBg, regionAspect: regionAspect
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initApp);
  else initApp();
}
