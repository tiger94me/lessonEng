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
    /* 老版 iPad Safari 不支持后行断言 (?<=...)，会抛 SyntaxError 让整个脚本加载失败。
       改成手工切分：只在「句末标点 + 空白」处断开，效果相同。 */
    const parts = [];
    let cur = "";
    const chars = String(text);
    for (let i = 0; i < chars.length; i++) {
      cur += chars[i];
      const isEnd = chars[i] === "." || chars[i] === "!" || chars[i] === "?";
      const nextIsSpace = i + 1 < chars.length && /\s/.test(chars[i + 1]);
      if (isEnd && nextIsSpace) {
        /* 把紧跟的空白也吃掉，避免下一段开头带空格 */
        while (i + 1 < chars.length && /\s/.test(chars[i + 1])) i++;
        parts.push(cur);
        cur = "";
      }
    }
    if (cur) parts.push(cur);
    if (!parts.length) parts.push(text);
    const out = [];
    let buf = "";
    parts.forEach(function (p) {
      if ((buf + " " + p).trim().length <= 180) buf = (buf ? buf + " " : "") + p;
      else { if (buf) out.push(buf); buf = p; }
    });
    if (buf) out.push(buf);
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

/* ---- 粘连词修复：PDF/OCR 抽出的文字常常丢掉词间空格 ----
   如 "aboutbestfriends" / "listentoeachother"。用词典做最长匹配切分，
   只在"整串不是词典词、但能完整切成多个词典词"时才改写，避免误伤正常单词。 */
const GLUE_EXTRA = {
  tutu: 1, duoduo: 1, sally: 1, mia: 1, momo: 1, wenwen: 1, xiaojun: 1, amy: 1, sam: 1,
  lingling: 1, daming: 1, fangfang: 1, tom: 1, jack: 1
};
function glueSplit(w) {
  const low = w.toLowerCase();
  if (low.length < 6) return null;
  if (DICT[low] || GLUE_EXTRA[low]) return null;
  if (low.indexOf("'") >= 0 || low.indexOf("-") >= 0) return null;
  const memo = {};
  const maxLen = 13;
  function walk(i) {
    if (i === low.length) return [];
    if (memo[i] !== undefined) return memo[i];
    let best = null;
    for (let len = Math.min(maxLen, low.length - i); len >= 1; len--) {
      const piece = low.substr(i, len);
      const okWord = (DICT[piece] && piece.length >= 2) || GLUE_EXTRA[piece] ||
                     (piece.length === 1 && (piece === "a" || piece === "i"));
      if (!okWord) continue;
      const rest = walk(i + len);
      if (rest) { best = [piece].concat(rest); break; }
    }
    memo[i] = best;
    return best;
  }
  let parts = walk(0);
  if (!parts) {
    /* 兜底：允许其中一段是"词典里没有的生词"（如 friendships），
       只要至少两段能在词典里查到，就认为这串是粘连词 */
    const memo2 = {};
    function walk2(i, unknownUsed) {
      if (i === low.length) return [];
      const key = i + ":" + (unknownUsed ? 1 : 0);
      if (memo2[key] !== undefined) return memo2[key];
      let best = null;
      for (let len = Math.min(maxLen, low.length - i); len >= 2; len--) {
        const piece = low.substr(i, len);
        const known = !!DICT[piece] || !!GLUE_EXTRA[piece];
        if (!known && unknownUsed) continue;
        if (!known && len < 4) continue;
        const rest = walk2(i + len, unknownUsed || !known);
        if (rest) { best = [piece].concat(rest); break; }
      }
      memo2[key] = best;
      return best;
    }
    const loose = walk2(0, false);
    if (loose && loose.length >= 2) {
      /* 至少要有一段是真实单词，且生词段不超过半数 */
      const knownN = loose.filter(function (x) { return DICT[x] || GLUE_EXTRA[x]; }).length;
      if (knownN >= 2 && knownN >= loose.length - 1) parts = loose;
    }
  }
  if (!parts || parts.length < 2) return null;
  return parts;
}
/* 只判断能否被完整切成多个词典词（不做兜底），用于过滤粘连残渣 */
function glueParts(w) {
  const low = String(w).toLowerCase();
  if (low.length < 4) return null;
  const memo = {};
  function walk(i) {
    if (i === low.length) return [];
    if (memo[i] !== undefined) return memo[i];
    let best = null;
    for (let len = Math.min(13, low.length - i); len >= 1; len--) {
      const p = low.substr(i, len);
      if (!((DICT[p] && p.length >= 2) || GLUE_EXTRA[p] || (p.length === 1 && (p === "a" || p === "i")))) continue;
      const rest = walk(i + len);
      if (rest) { best = [p].concat(rest); break; }
    }
    memo[i] = best;
    return best;
  }
  const parts = walk(0);
  return (parts && parts.length >= 2) ? parts : null;
}
/* 把一段已断句的文本里的粘连词拆开（保留原有大小写风格按小写输出） */
function unglueText(s) {
  if (!s) return s;
  return String(s).replace(/[A-Za-z]{6,}/g, function (w) {
    const parts = glueSplit(w);
    return parts ? parts.join(" ") : w;
  });
}

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
  /* 只有单换行时，行尾多半是硬折行（PDF/抄写常见）：
     把不以句末标点结尾的行与下一行接起来，避免行尾单词被粘成一个假词 */
  const lines = t.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
  const paras = [];
  let buf = "";
  lines.forEach(function (ln) {
    buf = buf ? (buf + " " + ln) : ln;
    /* 以句末标点收尾（且引号已闭合）才认为一段结束 */
    if (/[.!?。！？]["'”’)\]]?$/.test(buf)) { paras.push(buf); buf = ""; }
  });
  if (buf) paras.push(buf);
  return paras;
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
  const paras = splitParagraphs(text).map(unglueText);
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
  /* 生词本只收"真正要背的英文词"：
     - 出现 2 次以上，或本身长得像正常英文词；
     - 排除人名/招牌词（tutu、duoduo…）、没有元音的词、超长粘连残渣；
     - 排除粘连串（含连续 3 个以上辅音且不是常见词尾的怪词）。 */
  const unkList = Object.keys(unknowns)
    .filter(function (w) {
      if (GLUE_EXTRA[w]) return false;
      if (!/[aeiouy]/.test(w)) return false;
      if (w.length > 11) return false;
      if (w.length < 3) return false;
      if (/^(.)\1+$/.test(w)) return false;
      /* 能被完整拆成多个词典词的，一定是粘连残渣 */
      if (glueParts(w)) return false;
      const n = unknowns[w];
      if (n < 2 && w.length > 9) return false;
      return true;
    })
    .sort(function (a, b) {
      return unknowns[b] - unknowns[a] || a.localeCompare(b);
    })
    .slice(0, 40)
    .map(function (w) { return { en: w, count: unknowns[w] }; });

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

  /* 上传课程与内置课程使用同一套字段，才能被各板块完整渲染 */
  const unitText = buildCustomUnitText(parsed, title);
  const zhMap = {};
  unitText.forEach(function (sec) {
    sec.lines.forEach(function (l) { if (l.zh) zhMap[l.en] = l.zh; });
  });

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
    grammarPoints: [],
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
    /* 以下字段让自定义课程也能渲染情景 / 课文分板块 / 听力 / 判断 / 写作 / 口语 */
    unitText: unitText,
    storyEvents: [],
    storyTF: [],
    writeTasks: [],
    speakTask: { title: "说一说这一课", tip: "先跟着读，再试着自己说一遍。", frames: [] },
    tracks: [],
    scenes: [],
    scenePages: {},
    sectionImages: {},
    speakers: {},
    zhMap: zhMap
  };
  model.grammarQs = genGrammarCustom(model);
  model.passages = buildCustomPassages(model);
  model.storyEvents = buildCustomStoryEvents(parsed);
  model.storyTF = buildCustomStoryTF(parsed);
  model.writeTasks = buildCustomWriteTasks(parsed);
  model.speakTask = buildCustomSpeakTask(parsed, words);
  model.scenes = buildCustomScenes(parsed, unitText);
  model.speakers = detectSpeakers(parsed, unkList.reduce(function (a, u) { a[u.en] = u.count; return a; }, {})) || {};
  return model;
}

/* ---- 把课文切成学习板块（与内置 UNIT_TEXT 同构） ---- */
function buildCustomUnitText(parsed, title) {
  const secs = [];
  /* 主体：按句子数把段落合并成合理数量的板块（避免逐行切分出上百个小板块） */
  const seen = {};
  const groups = [];
  let buf = [], bufN = 0;
  parsed.paragraphs.forEach(function (p) {
    const sents = splitSentences(p);
    if (!sents.length) return;
    buf = buf.concat(sents); bufN += sents.length;
    /* 满 4 句或段落实在很长时收口 */
    if (bufN >= 4 || sents.length >= 4) { groups.push(buf); buf = []; bufN = 0; }
  });
  if (buf.length) groups.push(buf);
  /* 板块超过 12 块时，按句子总数重新均分成 12 块（避免出现 30 句一块的超长板块） */
  const MAX_SECS = 12;
  if (groups.length > MAX_SECS) {
    const all = [];
    groups.forEach(function (g) { g.forEach(function (x) { all.push(x); }); });
    const per = Math.ceil(all.length / MAX_SECS);
    groups.length = 0;
    for (let i = 0; i < all.length; i += per) groups.push(all.slice(i, i + per));
  }
  groups.forEach(function (sents, gi) {
    sents.forEach(function (s) { seen[s] = 1; });
    secs.push({
      icon: ["📖", "📗", "📘", "📙"][gi % 4],
      title: (groups.length === 1 ? "课文" : "第 " + (gi + 1) + " 部分"),
      lines: sents.map(function (s) { return { en: s, zh: "" }; })
    });
  });
  return secs;
}

/* ---- 由课文句子生成情景剧场（每句一个取景，使用上传的页面图） ---- */
/* 从课文里认出"谁在说话"：形如 "Tutu: ..." / "Mum:" 的对话行，
   以及反复出现的人名（首字母大写、不是句首也不是常见词）。 */
function detectSpeakers(parsed, unknownNames) {
  const names = {};
  parsed.sentences.forEach(function (s) {
    const m = /^([A-Z][A-Za-z]{1,12}(?:\s*(?:&|and)\s*[A-Z][A-Za-z]{1,12})?)\s*:/.exec(s);
    if (m) {
      m[1].split(/\s*(?:&|and)\s*/).forEach(function (n) { if (n) names[n] = (names[n] || 0) + 1; });
    }
  });
  /* 没有冒号台词时，退而用"反复出现的人名" */
  if (!Object.keys(names).length && unknownNames) {
    Object.keys(unknownNames).forEach(function (w) { names[w] = unknownNames[w]; });
  }
  /* 只留像人名的：首字母大写、全小写后不是词典词、不是粘连残渣、不含撇号 */
  /* 整篇没有一句台词（"人名:" 形式）时，不去猜名字——猜错的配色比统一旁白更糟 */
  if (!Object.keys(names).length) return null;
  const list = Object.keys(names).filter(function (n) {
    if (n.length < 2 || n.length > 12) return false;
    if (!/^[A-Z][a-z]+$/.test(n)) return false;
    const low = n.toLowerCase();
    /* GLUE_EXTRA 就是"人名白名单"，对话里出现应当认出来 */
    if (GLUE_EXTRA[low]) return true;
    if (DICT[low]) return false;
    if (glueParts(low)) return false;
    return true;
  }).sort(function (a, b) { return names[b] - names[a] || a.localeCompare(b); }).slice(0, 8);
  if (!list.length) return null;
  const out = {};
  list.forEach(function (n, i) {
    const cap = n.charAt(0).toUpperCase() + n.slice(1);
    out[cap] = SPK_PALETTE[i % SPK_PALETTE.length];
  });
  return out;
}

function buildCustomScenes(parsed, unitText) {
  const out = [];
  /* 情景板块跟随 unitText 的分块结构，便于与课文板块一一对应 */
  unitText.forEach(function (sec, si) {
    const lines = sec.lines.map(function (l) { return l.en; });
    if (!lines.length) return;
    out.push({
      id: "csec" + si,
      sec: si,
      /* 没有上传图片时用 p01 占位，避免指向不存在的页 */
      page: "p" + pad2(si + 1),
      title: sec.title,
      sub: "Scene " + (si + 1),
      region: [4, 8, 92, 84],
      cands: [[4, 8, 92, 84], [0, 3, 100, 97]],
      lines: lines.map(function (_, li) { return li; }),
      shots: lines.map(function (_, li) {
        const n = lines.length;
        const hh = Math.max(10, Math.floor(90 / n));
        return [6, Math.min(6 + li * hh, 88), 88, Math.min(hh - 2, 30)];
      }),
      customLines: lines
    });
  });
  return out;
}

function pad2(n) { return (n < 10 ? "0" : "") + n; }

/* ---- 课文判断素材 ---- */
function buildCustomStoryEvents(parsed) {
  const cand = parsed.sentences.filter(function (s) {
    const wc = wordTokens(s).length;
    return wc >= 5 && wc <= 20;
  }).slice(0, 6);
  return cand.map(function (s) { return { t: s, zh: "" }; });
}

function buildCustomStoryTF(parsed) {
  const cand = parsed.sentences.filter(function (s) { return wordTokens(s).length >= 5; }).slice(0, 10);
  const out = [];
  cand.forEach(function (s, i) {
    const isTrue = i % 2 === 0;
    if (isTrue) out.push({ t: s, ok: true, exp: "原文就是这样写的。" });
    else {
      const mu = mutateSentence(s, { sentences: parsed.sentences, words: [], kind: "custom" });
      if (mu && mu !== s) out.push({ t: mu, ok: false, exp: "原文是：" + s });
    }
  });
  return out.slice(0, 6);
}

/* ---- 写一写（用连接词造句） ---- */
function buildCustomWriteTasks(parsed) {
  const out = [];
  const joins = [
    { w: "and", zh: "和；并且" },
    { w: "but", zh: "但是" },
    { w: "because", zh: "因为" }
  ];
  joins.forEach(function (j) {
    const hit = parsed.sentences.filter(function (s) {
      return new RegExp("\\b" + j.w + "\\b", "i").test(s);
    })[0];
    if (hit) {
      out.push({
        prompt: "用 " + j.w + "（" + j.zh + "）说一句关于这一课的话。",
        ref: hit,
        exp: "参考句来自课文，注意 " + j.w + " 前后连接的内容。"
      });
    }
  });
  if (!out.length && parsed.sentences.length) {
    out.push({ prompt: "用一句话说说这一课讲的是什么。", ref: parsed.sentences[0], exp: "可以参考课文第一句。" });
  }
  return out;
}

/* ---- 口语挑战 ---- */
function buildCustomSpeakTask(parsed, words) {
  const frames = parsed.sentences.filter(function (s) {
    const wc = wordTokens(s).length;
    return wc >= 4 && wc <= 12;
  }).slice(0, 5);
  const key = words.slice(0, 3).map(function (w) { return w.en; });
  return {
    title: "说一说这一课",
    tip: key.length ? "先读熟这几个词：" + key.join(" / ") + "，再把下面的句子读出来。" : "把下面的句子读出来，注意语音语调。",
    frames: frames.length ? frames : parsed.sentences.slice(0, 3)
  };
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
/* 炮台转向 + 炮弹飞行的公共实现。
   layer = 动画层（position:absolute 覆盖舞台）；barrel/wheel = 炮管与炮轮；
   btn = 目标元素；delay = 转向后延迟多久开炮（让孩子看清瞄准）。 */
function fireCannonCore(layer, barrel, wheel, btn, onHit, delay) {
  if (!layer || !barrel || !wheel || !btn) { if (onHit) onHit(); return; }
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
  const dur = Math.max(150, Math.min(380, Math.round(dist * 1.4)));
  setTimeout(function () {
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
  }, delay || 0);
}
function fireCannon(btn, onHit) {
  const card = $("#qcard");
  const layer = card ? card.querySelector(".cannon-layer") : null;
  const barrel = card ? card.querySelector(".cannon-barrel") : null;
  const wheel = card ? card.querySelector(".cannon-wheel") : null;
  fireCannonCore(layer, barrel, wheel, btn, onHit, 0);
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
  if (!model.storyTF || !model.storyTF.length) return [];
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
/* ---------- 答对后 5 秒自动进入下一题 ---------- */
function quizClearTimer() {
  const z = S.quiz;
  if (z && z.timer) { clearTimeout(z.timer); z.timer = null; }
  const cd = $("#qCountdown");
  if (cd) cd.classList.add("hidden");
}
function quizStartAutoNext() {
  const z = S.quiz;
  if (!z) return;
  quizClearTimer();
  if (!z.autoNext || z.paused) return;
  if (z.i >= z.qs.length - 1) return; /* 最后一题不自动跳，留给"查看结果" */
  let left = 3;
  const cd = $("#qCountdown");
  const num = $("#qCountNum");
  const show = function () {
    if (cd) { cd.classList.remove("hidden"); }
    if (num) num.textContent = left;
  };
  show();
  const tick = function () {
    const zz = S.quiz;
    if (!zz || zz.paused || !zz.autoNext) { quizClearTimer(); return; }
    left--;
    if (left <= 0) {
      quizClearTimer();
      if (S.quiz === zz && zz.i === z.i) nextQuestion();
      return;
    }
    if (num) num.textContent = left;
    z.timer = setTimeout(tick, 1000);
  };
  z.timer = setTimeout(tick, 1000);
}

function startQuiz(title, questions, opts) {
  opts = opts || {};
  if (!questions.length) { toast("题目不足，先去学习一下吧！"); return; }
  S.lastTab = S.tab;
  S.quiz = {
    title: title, qs: questions, i: 0, correct: 0, wrong: [],
    regen: opts.regen || null, requeue: opts.requeue || false,
    /* 答对后自动进入下一题；paused 时暂停；answered 记录每题选了什么，供"上一题"回看 */
    autoNext: true, paused: false, timer: null, answered: {}
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
  h += '<div class="q-countdown hidden" id="qCountdown">⏱ <b id="qCountNum">3</b> 秒后自动进入下一题 · 点「暂停」可以停下来看</div>';
  h += '<div class="q-actions hidden" id="qNext">' +
       '<button class="btn btn-ghost" id="btnPrev">← 上一题</button>' +
       '<button class="btn btn-primary" id="btnNext">下一题 →</button>' +
       '<button class="btn btn-ghost" id="btnPause">⏸ 暂停</button>' +
       '</div>';
  h += '</div>';
  view.innerHTML = h;

  $("#quizExit").onclick = function () { quizClearTimer(); stopSpeak(); S.quiz = null; setTab(S.lastTab); };
  const bp = $("#btnPrev");
  if (bp) {
    bp.disabled = z.i <= 0;
    bp.onclick = prevQuestion;
  }
  const bs = $("#btnPause");
  if (bs) {
    bs.onclick = function () {
      z.paused = !z.paused;
      bs.textContent = z.paused ? "▶ 继续" : "⏸ 暂停";
      bs.classList.toggle("btn-primary", z.paused);
      bs.classList.toggle("btn-ghost", !z.paused);
      if (z.paused) {
        quizClearTimer();
        toast("已暂停自动跳题");
      } else if (z.answered[z.i] && z.answered[z.i].ok && !z.answered[z.i].retry) {
        quizStartAutoNext();
        toast("继续自动跳题");
      }
    };
  }
  if (q.audio || q.audioFile) {
    $("#qPlay").onclick = function () { playQuestionAudio(q); };
    if (S.autoSpeak) setTimeout(function () { playQuestionAudio(q); }, 350);
  }
  if (q.kind === "reorder") renderReorder(q);
  else $all("#opts .opt").forEach(function (btn) {
    btn.onclick = function () { chooseOption(q, +btn.getAttribute("data-i")); };
  });

  /* 从"上一题"回来：如果这题已经答完，恢复当时的对错显示 */
  const rec = z.answered[z.i];
  if (rec && rec.done) {
    if (bp) bp.disabled = z.i <= 0;
    restoreAnswered(q, rec);
    const bsx = $("#btnPause");
    if (bsx) bsx.classList.remove("hidden");
  }
}

/* 回看已作答的题目：把结果原样显示，不允许再改 */
function restoreAnswered(q, rec) {
  const z = S.quiz, card = $("#qcard"), fb = $("#qFb");
  if (!card || !fb) return;
  card.setAttribute("data-done", "1");
  if (!rec.ok) card.setAttribute("data-wrong", "1");
  if (q.kind === "reorder") {
    $all("#roPool .chip, #roAns .chip").forEach(function (b) { b.disabled = true; });
    const ck = $("#roCheck"), rs = $("#roReset");
    if (ck) ck.classList.add("hidden");
    if (rs) rs.classList.add("hidden");
  } else {
    $all("#opts .opt").forEach(function (btn, i) {
      btn.disabled = true;
      if (i === q.answer) btn.classList.add("opt-right");
      else if (i === rec.chosen) btn.classList.add("opt-wrong");
    });
  }
  fb.classList.remove("hidden", "fb-retry");
  fb.classList.add(rec.ok ? "fb-ok" : "fb-bad");
  let msg = rec.ok ? "✅ 已答对" : "❌ 已作答";
  if (q.kind !== "reorder" && q.options && q.options[q.answer] != null) msg += " · 正确答案：" + q.options[q.answer];
  if (q.explain) msg += "\n💡 " + q.explain;
  fb.textContent = msg;
  const nx = $("#qNext");
  if (nx) {
    nx.classList.remove("hidden");
    $("#btnNext").textContent = z.i === z.qs.length - 1 ? "查看结果 🏁" : "下一题 →";
    $("#btnNext").onclick = nextQuestion;
  }
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
  /* 答对时立刻亮倒计时条：大炮动画要 300ms，先给玩家反馈 */
  const z0 = S.quiz;
  if (ok && z0 && z0.autoNext && !z0.paused && z0.i < z0.qs.length - 1) {
    const cd0 = $("#qCountdown");
    if (cd0) { cd0.classList.remove("hidden"); const n0 = $("#qCountNum"); if (n0) n0.textContent = "3"; }
  }
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
  /* 记录本题作答结果，"上一题"回来时能原样恢复 */
  z.answered[z.i] = { ok: ok, chosen: chosenIdx, done: !canRetry };
  /* 答对就立刻亮出倒计时条，不等大炮动画，避免玩家以为没反应 */
  if (ok && !canRetry && z.i < z.qs.length - 1 && z.autoNext && !z.paused) {
    const cdNow = $("#qCountdown");
    if (cdNow) cdNow.classList.remove("hidden");
  }
  const nx = $("#qNext");
  if (canRetry) {
    nx.classList.add("hidden");
    quizClearTimer();
  } else {
    nx.classList.remove("hidden");
    $("#btnNext").textContent = z.i === z.qs.length - 1 ? "查看结果 🏁" : "下一题 →";
    $("#btnNext").onclick = nextQuestion;
    /* 答对（且不是最后一题）→ 3 秒后自动进入下一题 */
    if (ok) quizStartAutoNext();
    else quizClearTimer();
  }
}
function nextQuestion() {
  const z = S.quiz;
  quizClearTimer();
  z.i++;
  if (z.i < z.qs.length) renderQuiz();
  else renderQuizEnd();
}
/* 回到上一题：允许回看，已作答的题目保持结果、不能再改 */
function prevQuestion() {
  const z = S.quiz;
  if (!z || z.i <= 0) { toast("已经是第一题了"); return; }
  quizClearTimer();
  z.i--;
  renderQuiz();
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
  ["grammar", "📐 语法"], ["listen", "🎧 听力"], ["srs", "🗂 生词本"], ["test", "📝 综合测验"],
  ["game", "🎮 游戏"], ["wrong", "⭐ 错题本"]
];
/* 管理页不在标签栏：家长入口 = 连点页脚 5 次，或地址栏加 ?admin=1 */
const ADMIN_TAB = ["admin", "⚙️ 管理"];
function setTab(t) {
  stopSpeak();
  const wasAdmin = (S.tab === "admin");
  if (S.tab === "game" && t !== "game") { GAME.running = false; GAME.phReady = false; gameStopTimer(); }
  S.tab = t;
  /* 进出管理页时导航栏要重建：管理标签只在管理页里出现 */
  if (wasAdmin !== (t === "admin")) { renderTabs(); syncAdminChrome(); }
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
    else if (t === "game") renderGameTab();
    else if (t === "wrong") renderWrongTab();
    else if (t === "admin") renderAdminTab();
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
  /* 没有上传图片时画一个柔和的占位色，避免空白或 404 */
  if (!img) return "background:linear-gradient(135deg,#eef4ff,#e6f0ff 45%,#f4f8ff);";
  const w = Math.max(0.5, r[2]), h = Math.max(0.5, r[3]);
  const size = (10000 / w).toFixed(2) + "% auto";
  const px = w >= 99.5 ? 0 : (r[0] / (100 - w)) * 100;
  const py = h >= 99.5 ? 0 : (r[1] / (100 - h)) * 100;
  return "background-image:url('" + img + "');background-size:" + size +
         ";background-position:" + px.toFixed(2) + "% " + py.toFixed(2) + "%;background-repeat:no-repeat;";
}
function scenePageUrl(sc) {
  const m = currentModel();
  /* 上传的课程可能给每个情景单独绑图（sc.pageImg）；其次是按页号的映射 */
  const pages = (m && m.scenePages && Object.keys(m.scenePages).length) ? m.scenePages : SCENE_PAGES;
  const own = sc && (sc.pageImg || pages[sc.page]);
  if (own) return own;
  /* 上传课程但没传图：返回空串，渲染层会画占位框而不是 404 图 */
  if (m && m.kind !== "builtin") return "";
  return pages.p01 || SCENE_PAGES.p01;
}
/* 小图变体：t = 缩略图（导轨/气泡，约 33KB），h = 中图（舞台主图）；
   大页面图只在取景器/全页/大屏时才加载，避免 iPad 一次性解码十几张 1100×1545 图 */
function pageVariant(url, v) {
  if (!v) return url;
  /* 只有内置的 unit3_*.jpg 才有 h/ t/ 小图；上传的图片原样返回 */
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

/* 说话人外观：内置课用 SCENE_SPEAKERS；上传课的人名不在表里，就按名字生成稳定的配色 */
const SPK_PALETTE = [
  { emoji: "🙂", color: "#1d4ed8", bg: "#e8f0ff" },
  { emoji: "😊", color: "#0f766e", bg: "#e6fbf6" },
  { emoji: "😃", color: "#b45309", bg: "#fff4e5" },
  { emoji: "🙋", color: "#7c3aed", bg: "#f3ecff" },
  { emoji: "😉", color: "#be123c", bg: "#ffe9ef" },
  { emoji: "🧒", color: "#0369a1", bg: "#e5f6ff" }
];
function speakerStyle(name) {
  const nm = String(name || "");
  if (typeof SCENE_SPEAKERS !== "undefined" && SCENE_SPEAKERS[nm]) return SCENE_SPEAKERS[nm];
  let h = 0;
  for (let i = 0; i < nm.length; i++) h = (h * 31 + nm.charCodeAt(i)) % 9973;
  return SPK_PALETTE[h % SPK_PALETTE.length];
}
function speakersOf(sc) {
  const m = currentModel();
  return (m && m.speakers && Object.keys(m.speakers).length) ? m.speakers : SCENE_SPEAKERS;
}
function speakerOf(sc, idx, en) {
  if (/^[a-c]\.\s/.test(en)) return "选项";
  if (sc.sec === 6 && idx >= 4) return "建议";
  const m = /^([A-Z][A-Za-z]*(?: & [A-Z][A-Za-z]*)?|Mum Bird|Dad Dog):\s*/.exec(en);
  if (m && speakersOf(sc)[m[1]]) return m[1];
  return "旁白";
}
function splitSpeaker(sc, idx, en) {
  const sp = speakerOf(sc, idx, en);
  if (sp === "旁白" || sp === "选项" || sp === "建议") return { sp: sp, text: en };
  return { sp: sp, text: en.replace(/^[^:]{1,20}:\s*/, "") };
}
function sceneDialogue(sc) {
  const m = currentModel();
  const units = (m && m.unitText && m.unitText.length) ? m.unitText : UNIT_TEXT;
  const sec = units[sc.sec] || { lines: [] };
  const src = sc.customLines || (sec.lines || []);
  return sc.lines.map(function (i) {
    const l = (sc.customLines ? { en: src[i] || "", zh: "" } : (sec.lines[i] || { en: "", zh: "" }));
    const parts = splitSpeaker(sc, i, l.en);
    return { i: i, sp: parts.sp, en: parts.text, full: l.en, zh: l.zh || "" };
  });
}
function sceneList() {
  const m = currentModel();
  if (m && m.scenes && m.scenes.length) return m.scenes;
  return (typeof SCENES !== "undefined") ? SCENES : [];
}
function sceneCurrent() {
  const list = sceneList();
  if (!list.length) return null;
  let sc = list.find(function (x) { return x.id === S.sceneId; });
  if (!sc) { sc = list[0]; S.sceneId = sc.id; }
  return sc;
}
function sceneStopAuto() {
  S.playing = false;
  if (S._sceneTimer) { clearTimeout(S._sceneTimer); S._sceneTimer = null; }
}

function renderSceneTab() {
  const view = $("#view");
  if (!sceneList().length) {
    view.innerHTML = '<div class="card">当前课文没有情景数据。请到管理页上传课文内容。</div>';
    return;
  }
  const sc = sceneCurrent();
  const dlg = sceneDialogue(sc);
  if (typeof S.sceneLine !== "number" || S.sceneLine >= dlg.length) S.sceneLine = 0;
  const cur = dlg[S.sceneLine] || dlg[0];
  const spk = speakerStyle(cur.sp);
  const shot = sceneShotFor(sc, S.sceneLine);
  const asp = shotAspect(shot);

  let h = '';
  const mainV = bigScreen() ? "" : "h";
  h += '<div class="scene-rail" id="sceneRail">';
  sceneList().forEach(function (s) {
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
    const sk = speakerStyle(d.sp);
    h += '<button class="dot' + (k === S.sceneLine ? " on" : "") + '" data-line="' + k + '" style="--sp:' + sk.color + '">' + (k + 1) + '</button>';
  });
  h += '</div>';

  h += '<div class="card dialogue-card"><div class="sec-title">💬 全文对话（点句子即听）</div><div class="dialogue">';
  dlg.forEach(function (d, k) {
    const sk = speakerStyle(d.sp);
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
    const sk = speakerStyle(d.sp);
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
  const hasSecs = !!(m.unitText && m.unitText.length);
  if (hasSecs) {
    h += '<label class="switch"><input type="checkbox" id="zhToggle" ' + (S.showZh ? "checked" : "") + '> 显示中文</label>';
    h += '<button class="btn btn-ghost btn-sm" id="readAll">🎧 全文连读</button>';
    h += '<button class="btn btn-ghost btn-sm" id="stopAll">⏹ 停止</button>';
    if (m.storyTF && m.storyTF.length) h += '<button class="btn btn-ghost btn-sm" id="tfQuiz">✓✗ 课文判断</button>';
  } else {
    h += '<button class="btn btn-ghost btn-sm" id="stopAll">⏹ 停止朗读</button>';
  }
  h += '</div></div>';

  if (hasSecs) {
    const trackList = (m.tracks && m.tracks.length) ? m.tracks : (typeof TEXTBOOK_TRACKS !== "undefined" ? TEXTBOOK_TRACKS : []);
    const sceneSrc = (m.scenes && m.scenes.length) ? m.scenes : (typeof SCENES !== "undefined" ? SCENES : []);
    m.unitText.forEach(function (sec, si) {
      const tb = trackList.find(function (t) { return t.sec === si; });
      const scn = sceneSrc.find(function (x) { return x.sec === si; });
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
    if (m.storyEvents && m.storyEvents.length) {
    h += '<div class="card sec"><div class="sec-title">🧩 故事排一排（复述故事第一步）</div><div class="hint">按发生顺序点击下面的句子。</div><div class="order-area" id="storyOrder"></div><div class="order-done" id="storyDone"></div><div class="q-actions"><button class="btn btn-ghost btn-sm" id="storyReset">↺ 重新开始</button></div></div>';
    }
    /* 写一写 */
    if (m.writeTasks && m.writeTasks.length) {
    h += '<div class="card sec"><div class="sec-title">✏️ 写一写：用 and / but / because 连句</div>';
    m.writeTasks.forEach(function (t, i) {
      h += '<div class="write-item"><div class="line-en"><span>' + esc(t.prompt) + '</span></div>';
      h += '<button class="btn btn-ghost btn-sm reveal-btn" data-reveal="wt' + i + '">👁 看参考</button>';
      h += '<div class="line-zh hidden" id="wt' + i + '">' + esc(t.ref) + '<br>' + speakBtn(t.ref) + ' ' + esc(t.exp) + '</div></div>';
    });
    h += '</div>';
    }
    /* 口语任务 */
    if (m.speakTask && m.speakTask.frames && m.speakTask.frames.length) {
    h += '<div class="card sec"><div class="sec-title">🎤 口语挑战：' + esc(m.speakTask.title) + '</div>';
    h += '<div class="hint">' + esc(m.speakTask.tip) + '</div>';
    m.speakTask.frames.forEach(function (f) {
      h += '<div class="line-en">' + speakBtn(f) + '<span>' + esc(f) + '</span></div>';
    });
    h += '</div>';
    }
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

  if (m.storyEvents && m.storyEvents.length && $("#storyOrder")) initStoryOrder(m);
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
  const tracks = (m.tracks && m.tracks.length) ? m.tracks : (m.kind === "builtin" ? TEXTBOOK_TRACKS : []);
  if (tracks.length) {
    h += '<div class="card sec"><div class="sec-title">📻 课本原声（教材配套音频）</div>';
    h += '<div class="hint">和课本配套的真人录音，配合各板块使用效果更好。</div>';
    tracks.forEach(function (t) {
      h += '<div class="tb-row">' + playFileBtn(t.file, "▶") + '<div><div class="tb-title">' + esc(t.title) + '</div><div class="tb-zh">' + esc(t.zh) + ' · ' + esc(t.dur) + '</div></div></div>';
    });
    h += '<div class="hint" style="margin-top:6px">💡 “听短文答题”里的 Duoduo 篇已直接使用课本原声。</div>';
    h += '</div>';
  }
  if (m.kind === "builtin") {
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
/* 地址栏 ?admin=1 表示"这次直接进管理页" */
function wantsAdmin() {
  try { return /[?&]admin=1\b/.test(location.search || ""); } catch (e) { return false; }
}

/* 顶栏的"上传课文 / 粘贴文本"只在管理页出现，孩子平时看不到 */
function syncAdminChrome() {
  const on = (S.tab === "admin");
  ["#btnUpload", "#btnPaste"].forEach(function (sel) {
    const b = $(sel);
    if (b) b.classList.toggle("hidden", !on);
  });
}

/* 导航栏：管理页只有"当前正停在管理页"时才出现自己的标签，孩子平时看不到 */
function renderTabs() {
  const tabs = $("#tabs");
  if (!tabs) return;
  tabs.innerHTML = "";
  const list = (S.tab === "admin") ? TABS.concat([ADMIN_TAB]) : TABS;
  list.forEach(function (t) {
    const sp = t[1].indexOf(" ");
    const ico = t[1].slice(0, sp), label = t[1].slice(sp + 1);
    const b = document.createElement("button");
    b.className = "tab"; b.setAttribute("data-tab", t[0]);
    b.innerHTML = '<span class="t-ico">' + ico + '</span><span class="t-label">' + label + '</span>';
    b.onclick = function () { setTab(t[0]); };
    tabs.appendChild(b);
  });
  const cur = $('.tab[data-tab="' + S.tab + '"]');
  $all(".tab").forEach(function (x) { x.classList.remove("active"); });
  if (cur) cur.classList.add("active");
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

/* ================= 管理后台：装载课文 / 图片 / 音频 ================= */
/* 设计：静态网站没有服务器，但"后台"体现在两件事上——
   1) 管理页里一次性上传课文、图片、音频，自动分解成 10 个学习板块；
   2) 点"装载到学习页"后，内容写入本机存储，关掉网页再打开还在，可反复复习。
   上传的图片/音频保存在浏览器 IndexedDB（不限大小的空间），localStorage 只存文字。 */

const DB_NAME = "eclass.media.v1";
const DB_STORE = "blobs";
let _dbPromise = null;

function openMediaDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise(function (resolve) {
    if (typeof indexedDB === "undefined") { resolve(null); return; }
    let req;
    try { req = indexedDB.open(DB_NAME, 1); } catch (e) { resolve(null); return; }
    req.onupgradeneeded = function () {
      try { req.result.createObjectStore(DB_STORE); } catch (e) { }
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { resolve(null); };
  });
  return _dbPromise;
}
function dbPut(key, blob) {
  return openMediaDB().then(function (db) {
    if (!db) return false;
    return new Promise(function (resolve) {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(blob, key);
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function () { resolve(false); };
      tx.onabort = function () { resolve(false); };
    });
  });
}
function dbGet(key) {
  return openMediaDB().then(function (db) {
    if (!db) return null;
    return new Promise(function (resolve) {
      const tx = db.transaction(DB_STORE, "readonly");
      const rq = tx.objectStore(DB_STORE).get(key);
      rq.onsuccess = function () { resolve(rq.result || null); };
      rq.onerror = function () { resolve(null); };
    });
  });
}
function dbDel(key) {
  return openMediaDB().then(function (db) {
    if (!db) return false;
    return new Promise(function (resolve) {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).delete(key);
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function () { resolve(false); };
    });
  });
}
function dbKeys() {
  return openMediaDB().then(function (db) {
    if (!db) return [];
    return new Promise(function (resolve) {
      const tx = db.transaction(DB_STORE, "readonly");
      const rq = tx.objectStore(DB_STORE).getAllKeys();
      rq.onsuccess = function () { resolve(rq.result || []); };
      rq.onerror = function () { resolve([]); };
    });
  });
}
function dbClear() {
  return openMediaDB().then(function (db) {
    if (!db) return false;
    return new Promise(function (resolve) {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).clear();
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function () { resolve(false); };
    });
  });
}

/* ---- 待装载的草稿（管理页里编辑的内容） ---- */
const K_DRAFT = "eclass.draft.v1";
const ADMIN = { text: "", title: "", imgs: [], auds: [], parsing: false, lostImgs: 0, lostAuds: 0 };

function adminMeta(list) {
  return (list || []).map(function (x) { return { name: x.name, size: x.size }; });
}
function adminDraftLoad() {
  const d = loadJSON(K_DRAFT, null);
  if (!d) return;
  ADMIN.text = d.text || "";
  ADMIN.title = d.title || "";
  /* 刷新后原来的文件对象已经失效，只恢复名字用于提示；需要重新选择文件 */
  ADMIN.imgs = [];
  ADMIN.auds = [];
  ADMIN.lostImgs = (d.imgs || []).length;
  ADMIN.lostAuds = (d.auds || []).length;
}

function adminLog(msg, cls) {
  const box = $("#adminLog");
  if (!box) return;
  const line = document.createElement("div");
  line.className = "al-line " + (cls || "");
  line.innerHTML = msg;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

/* ---- 解析预览：把课文"分解"成板块，先给用户看 ---- */
function adminParse() {
  const ta = $("#adminText");
  const titleIn = $("#adminTitle");
  const text = (ta ? ta.value : "").trim();
  if (!text) { adminLog("⚠️ 请先粘贴或上传课文内容。", "warn"); toast("还没有课文内容"); return null; }
  const title = (titleIn && titleIn.value.trim()) || "我的课文";
  ADMIN.text = text.slice(0, 200000);
  ADMIN.title = title;
  let model;
  try {
    model = buildCustom(ADMIN.text, title);
  } catch (e) {
    adminLog("❌ 解析失败：" + esc(String(e && e.message || e)), "bad");
    return null;
  }
  ADMIN.model = model;
  saveJSON(K_DRAFT, { text: ADMIN.text, title: title, imgs: adminMeta(ADMIN.imgs), auds: adminMeta(ADMIN.auds) });
  renderAdminPreview(model);
  return model;
}

function renderAdminPreview(m) {
  const box = $("#adminPreview");
  if (!box) return;
  const secs = m.unitText || [];
  let h = '';
  h += '<div class="ap-grid">';
  const cards = [
    ["📚 学习板块", secs.length + " 块", "共 " + secs.reduce(function (a, s) { return a + s.lines.length; }, 0) + " 句"],
    ["🔤 词汇", m.words.length + " 个", "自动识别核心单词"],
    ["🧩 生词", m.unknowns.length + " 个", "需要你补中文意思"],
    ["💬 短语", m.phrases.length + " 条", "课文里出现的常用搭配"],
    ["📐 句式", m.patterns.length + " 类", "可用来练语法与替换"],
    ["❓ 练习题", (m.grammarQs.length + m.passages.length) + " 道", "语法 " + m.grammarQs.length + " · 阅读 " + m.passages.length]
  ];
  cards.forEach(function (c) {
    h += '<div class="ap-card"><div class="ap-k">' + c[0] + '</div><div class="ap-v">' + esc(c[1]) + '</div><div class="ap-n">' + esc(c[2]) + '</div></div>';
  });
  h += '</div>';

  h += '<div class="ap-secs">';
  secs.forEach(function (sec, i) {
    h += '<div class="ap-sec"><div class="ap-sec-t">' + sec.icon + ' ' + esc(sec.title) +
         '<span class="ap-sec-n">' + sec.lines.length + ' 句</span></div>';
    sec.lines.slice(0, 3).forEach(function (l) {
      h += '<div class="ap-line">' + esc(l.en) + '</div>';
    });
    if (sec.lines.length > 3) h += '<div class="ap-more">… 还有 ' + (sec.lines.length - 3) + ' 句</div>';
    h += '</div>';
  });
  h += '</div>';

  /* 图片 / 音频匹配情况 */
  const imgN = ADMIN.imgs.length, audN = ADMIN.auds.length;
  h += '<div class="ap-assets">';
  h += '<div class="ap-asset' + (imgN ? " ok" : "") + '">🖼 图片：' + (imgN ? imgN + " 张，已按顺序分配到 " + Math.min(imgN, secs.length) + " 个板块" : "未上传（情景页会显示占位）") + '</div>';
  h += '<div class="ap-asset' + (audN ? " ok" : "") + '">🎵 音频：' + (audN ? audN + " 个，可在听力页播放" : "未上传（将用系统朗读替代）") + '</div>';
  h += '</div>';
  box.innerHTML = h;
  box.classList.remove("hidden");
  const go = $("#adminGo");
  if (go) go.disabled = false;
}

/* ---- 选择图片 / 音频 ---- */
function adminAddImages(files) {
  const arr = Array.prototype.slice.call(files || []);
  let added = 0;
  arr.forEach(function (f) {
    if (!/^image\//.test(f.type) && !/\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name)) return;
    /* 同一个文件重复选择时不重复添加（change 可能被触发两次） */
    const dup = ADMIN.imgs.some(function (x) { return x.name === f.name && x.size === f.size; });
    if (dup) return;
    ADMIN.imgs.push({ name: f.name, size: f.size, blob: f, url: URL.createObjectURL(f) });
    added++;
  });
  if (added) { ADMIN.imgs.sort(function (a, b) { return a.name.localeCompare(b.name, "zh-Hans-CN", { numeric: true }); }); }
  if (added) ADMIN.lostImgs = 0;
  renderAdminAssets();
  if (added) adminLog("🖼 已加入 " + added + " 张图片（按文件名排序）。");
  else if (arr.length) adminLog("⚠️ 没有可用的图片文件（支持 jpg / png / webp）。", "warn");
}
function adminAddAudios(files) {
  const arr = Array.prototype.slice.call(files || []);
  let added = 0;
  arr.forEach(function (f) {
    if (!/^audio\//.test(f.type) && !/\.(mp3|m4a|wav|ogg|aac)$/i.test(f.name)) return;
    const dup = ADMIN.auds.some(function (x) { return x.name === f.name && x.size === f.size; });
    if (dup) return;
    ADMIN.auds.push({ name: f.name, size: f.size, blob: f, url: URL.createObjectURL(f) });
    added++;
  });
  if (added) { ADMIN.auds.sort(function (a, b) { return a.name.localeCompare(b.name, "zh-Hans-CN", { numeric: true }); }); }
  if (added) ADMIN.lostAuds = 0;
  renderAdminAssets();
  if (added) adminLog("🎵 已加入 " + added + " 个音频（按文件名排序）。");
  else if (arr.length) adminLog("⚠️ 没有可用的音频文件（支持 mp3 / m4a / wav）。", "warn");
}
function adminRemoveImg(i) {
  const it = ADMIN.imgs[i];
  if (it && it.url) URL.revokeObjectURL(it.url);
  ADMIN.imgs.splice(i, 1);
  renderAdminAssets();
}
function adminRemoveAud(i) {
  const it = ADMIN.auds[i];
  if (it && it.url) URL.revokeObjectURL(it.url);
  ADMIN.auds.splice(i, 1);
  renderAdminAssets();
}
function fmtSize(n) {
  if (!n) return "0 KB";
  if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}
function renderAdminAssets() {
  const ib = $("#adminImgs");
  const ab = $("#adminAuds");
  if (ib) {
    if (!ADMIN.imgs.length) ib.innerHTML = '<div class="as-none">' +
      (ADMIN.lostImgs ? '刷新页面后，之前选的 ' + ADMIN.lostImgs + ' 张图片需要重新选择（浏览器不允许脚本保留本地文件的访问权）。' :
       '还没有图片。建议上传课本页面图，文件名带序号（如 01.jpg、02.jpg），会按顺序对应第 1、2… 个板块。') + '</div>';
    else {
      let h = '';
      ADMIN.imgs.forEach(function (it, i) {
        h += '<div class="as-item"><button class="as-del" data-delimg="' + i + '" title="移除">✕</button>' +
             '<img class="as-thumb" src="' + it.url + '" alt=""><div class="as-name">' + esc(it.name) + '</div>' +
             '<div class="as-meta">第 ' + (i + 1) + ' 页 · ' + fmtSize(it.size) + '</div></div>';
      });
      ib.innerHTML = h;
    }
    $all("[data-delimg]", ib).forEach(function (b) {
      b.onclick = function () { adminRemoveImg(+b.getAttribute("data-delimg")); };
    });
  }
  if (ab) {
    if (!ADMIN.auds.length) ab.innerHTML = '<div class="as-none">' +
      (ADMIN.lostAuds ? '刷新页面后，之前选的 ' + ADMIN.lostAuds + ' 个音频需要重新选择。' :
       '还没有音频。上传后可以在"听力"页播放课本原声；不上传也可以，会用系统朗读代读。') + '</div>';
    else {
      let h = '';
      ADMIN.auds.forEach(function (it, i) {
        h += '<div class="as-item aud"><button class="as-del" data-delaud="' + i + '" title="移除">✕</button>' +
             '<div class="as-aud-name">🎵 ' + esc(it.name) + '</div>' +
             '<div class="as-meta">第 ' + (i + 1) + ' 段 · ' + fmtSize(it.size) + '</div></div>';
      });
      ab.innerHTML = h;
    }
    $all("[data-delaud]", ab).forEach(function (b) {
      b.onclick = function () { adminRemoveAud(+b.getAttribute("data-delaud")); };
    });
  }
  const cnt = $("#adminCount");
  if (cnt) cnt.textContent = "图片 " + ADMIN.imgs.length + " · 音频 " + ADMIN.auds.length;
}

/* ---- 装载：把草稿变成"当前学习的这一课" ---- */
function adminActivate() {
  const m = ADMIN.model || adminParse();
  if (!m) return;
  const btn = $("#adminGo");
  if (btn) { btn.disabled = true; btn.textContent = "装载中…"; }
  adminLog("⏳ 正在保存图片与音频到本机…");

  const saveMedia = function (list, prefix) {
    const out = [];
    let chain = Promise.resolve();
    list.forEach(function (it, i) {
      const key = "lesson/" + prefix + "_" + pad2(i + 1) + "/" + it.name;
      chain = chain.then(function () { return dbPut(key, it.blob); })
        .then(function (ok) {
          out.push({ name: it.name, size: it.size, url: it.url, blobUrl: it.url, key: ok ? key : "", saved: !!ok });
        });
    });
    return chain.then(function () { return out; });
  };

  Promise.all([
    saveMedia(ADMIN.imgs, "img"),
    saveMedia(ADMIN.auds, "aud")
  ]).then(function (res) {
    const imgs = res[0], auds = res[1];
    const savedImgs = imgs.filter(function (x) { return x.saved; });
    const savedAuds = auds.filter(function (x) { return x.saved; });
    adminLog("✅ 图片 " + savedImgs.length + "/" + imgs.length + "，音频 " + savedAuds.length + "/" + auds.length + " 已保存。",
      (savedImgs.length === imgs.length && savedAuds.length === auds.length) ? "" : "warn");

    /* 把图片/音频挂到模型上 */
    applyMediaToModel(m, imgs, auds);

    /* 存文字部分（可恢复），媒体另存 IndexedDB 的 key */
    const rec = {
      title: m.title,
      rawText: ADMIN.text,
      meanings: {},
      createdAt: m.id,
      assets: {
        imgs: imgs.map(function (x) { return { name: x.name, size: x.size, key: x.key }; }),
        auds: auds.map(function (x) { return { name: x.name, size: x.size, key: x.key }; })
      }
    };
    saveJSON(K_CUSTOM, rec);
    S.custom = m;
    S.customCache = m;
    S.sceneId = null;
    S.sceneLine = 0;
    refreshLessonSel();
    adminLog("🎉 已装载！现在可以去各个学习页了。", "ok");
    toast("装载完成：" + m.unitText.length + " 个板块 · 词汇 " + m.words.length + " · 图片 " + imgs.length + " · 音频 " + auds.length);
    if (btn) { btn.disabled = false; btn.textContent = "✅ 装载到学习页"; }
    setTimeout(function () { setTab("lesson"); }, 350);
  }).catch(function (e) {
    adminLog("❌ 装载失败：" + esc(String(e && e.message || e)), "bad");
    if (btn) { btn.disabled = false; btn.textContent = "✅ 装载到学习页"; }
  });
}

/* 把上传的图片/音频装进模型：scenePages / tracks / sectionImages */
function applyMediaToModel(m, imgs, auds) {
  const secs = m.unitText || [];
  m.scenePages = {};
  m.sectionImages = {};
  imgs.forEach(function (it, i) {
    const page = "p" + pad2(i + 1);
    m.scenePages[page] = it.url;
    m.sectionImages[i] = it.url;
  });
  /* 没有上传图片时，给一个占位（避免 <img> 404） */
  if (!imgs.length) m.scenePages.p01 = "";

  m.tracks = auds.map(function (it, i) {
    return { file: it.url, blobKey: it.key, title: "第 " + (i + 1) + " 段原声", zh: it.name, sec: i, dur: fmtSize(it.size) };
  });
  /* 每个情景/板块都用自己那页图；没图的板块退回第一张 */
  const fallback = imgs.length ? imgs[0].url : "";
  (m.scenes || []).forEach(function (sc, si) {
    const own = m.sectionImages[si] || fallback;
    sc.pageImg = own;
    sc.hasImg = !!own;
  });
  /* 音频不够时，用系统朗读兜底：tracks 为空即可 */
  m.hasMedia = { imgs: imgs.length, auds: auds.length };
}

/* ---- 页面渲染 ---- */
function renderAdminTab() {
  const view = $("#view");
  if (!ADMIN.text) adminDraftLoad();
  if (!ADMIN.title) ADMIN.title = "";
  const cur = S.custom;
  let h = '';
  h += '<div class="tab-head card"><div class="tab-title">⚙️ 管理后台 · 装载新课文' +
       '<button class="btn btn-ghost btn-sm" id="adminExit" style="float:right">← 退出管理</button></div>';
  h += '<div class="hint">把课文内容、课本页面图、配套音频放在这里上传，系统会自动分解成<b>情景 / 课文 / 词汇 / 短语 / 句式 / 语法 / 听力 / 生词本 / 综合测验 / 错题本</b> 十个学习板块，和内置 Unit 3 完全一样。装载后内容保存在本机，下次打开还能继续学、继续复习。</div>';
  if (cur) {
    h += '<div class="ad-cur">当前学习：<b>' + esc(cur.title) + '</b>（' + (cur.unitText ? cur.unitText.length : 0) + ' 个板块' +
         (cur.kind === "builtin" ? " · 内置课程" : "") + '）</div>';
  }
  h += '</div>';

  /* 第 1 步：课文文字 */
  h += '<div class="card ad-step"><div class="ad-h"><span class="ad-num">1</span>课文内容</div>';
  h += '<div class="ad-row"><label class="ad-lab" for="adminTitle">课文标题</label>' +
       '<input type="text" id="adminTitle" class="ad-input" placeholder="例如：Unit 4 我的周末" value="' + esc(ADMIN.title) + '"></div>';
  h += '<label class="ad-lab" for="adminText">课文文字（可直接粘贴，也可以上传 txt / pdf）</label>';
  h += '<textarea id="adminText" class="ad-textarea" placeholder="把课文粘贴到这里……&#10;&#10;英文句子会自动切分，识别出词汇、短语、句式和语法点。">' + esc(ADMIN.text) + '</textarea>';
  h += '<div class="ad-row ad-btns">';
  h += '<button class="btn btn-ghost btn-sm" id="adminPickTxt">📄 上传 txt / pdf</button>';
  h += '<input type="file" id="adminTxtFile" accept=".txt,.pdf,text/plain,application/pdf" class="hidden">';
  h += '<span class="ad-tip">没有文字时可以先用 PDF 转换脚本</span>';
  h += '</div></div>';

  /* 第 2 步：图片 */
  h += '<div class="card ad-step"><div class="ad-h"><span class="ad-num">2</span>课本图片（可选）' +
       '<span class="ad-badge" id="adminCount">图片 ' + ADMIN.imgs.length + ' · 音频 ' + ADMIN.auds.length + '</span></div>';
  h += '<div class="hint">一次可以选多张。文件名带序号（01.jpg、02.jpg…）会按顺序对应第 1、2… 个板块，用于"情景"和"课文"页的配图。</div>';
  h += '<div class="ad-row ad-btns"><button class="btn btn-primary btn-sm" id="adminPickImg">🖼 选择图片</button>' +
       '<input type="file" id="adminImgFile" accept="image/*" multiple class="hidden"></div>';
  h += '<div class="as-list" id="adminImgs"></div></div>';

  /* 第 3 步：音频 */
  h += '<div class="card ad-step"><div class="ad-h"><span class="ad-num">3</span>配套音频（可选）</div>';
  h += '<div class="hint">可以不上传——没有音频时会用系统朗读（TTS）代读。上传后可在"听力"页播放课本原声。</div>';
  h += '<div class="ad-row ad-btns"><button class="btn btn-primary btn-sm" id="adminPickAud">🎵 选择音频</button>' +
       '<input type="file" id="adminAudFile" accept="audio/*" multiple class="hidden"></div>';
  h += '<div class="as-list" id="adminAuds"></div></div>';

  /* 第 4 步：解析预览 */
  h += '<div class="card ad-step"><div class="ad-h"><span class="ad-num">4</span>分解预览</div>';
  h += '<div class="ad-row ad-btns"><button class="btn btn-primary" id="adminParse">🔍 解析课文，看看会分成哪些板块</button></div>';
  h += '<div class="admin-log" id="adminLog"></div>';
  h += '<div id="adminPreview" class="hidden"></div>';
  h += '<div class="ad-go"><button class="btn btn-primary btn-lg" id="adminGo" disabled>✅ 装载到学习页</button>' +
       '<button class="btn btn-ghost btn-sm" id="adminBack">↩ 回到内置 Unit 3</button></div></div>';

  view.innerHTML = h;
  renderAdminAssets();

  $("#adminTitle").oninput = function (e) { ADMIN.title = e.target.value; };
  $("#adminText").oninput = function (e) { ADMIN.text = e.target.value; };

  $("#adminPickTxt").onclick = function () { $("#adminTxtFile").click(); };
  $("#adminTxtFile").onchange = function (e) {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (/\.pdf$/i.test(f.name) || f.type === "application/pdf") {
      adminLog("📄 正在读取 PDF：" + esc(f.name));
      adminReadPdf(f);
    } else {
      readFileAsText(f, function (text) {
        $("#adminText").value = text;
        ADMIN.text = text;
        if (!$("#adminTitle").value) {
          const nm = f.name.replace(/\.[^.]+$/, "");
          $("#adminTitle").value = nm;
          ADMIN.title = nm;
        }
        adminLog("📄 已读入文字：" + text.length + " 个字符。");
      });
    }
  };
  $("#adminPickImg").onclick = function () { $("#adminImgFile").click(); };
  $("#adminImgFile").onchange = function (e) { adminAddImages(e.target.files); e.target.value = ""; };
  $("#adminPickAud").onclick = function () { $("#adminAudFile").click(); };
  $("#adminAudFile").onchange = function (e) { adminAddAudios(e.target.files); e.target.value = ""; };

  $("#adminParse").onclick = function () {
    adminParse();
    if (ADMIN.model) adminLog("✅ 解析完成：" + ADMIN.model.unitText.length + " 个板块，可以往下拖看预览。", "ok");
  };
  $("#adminGo").onclick = adminActivate;
  const ax = $("#adminExit");
  if (ax) ax.onclick = function () {
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) { }
    setTab("lesson");
  };
  $("#adminBack").onclick = function () {
    S.custom = null;
    saveJSON(K_CUSTOM, null);
    refreshLessonSel();
    toast("已切回内置 Unit 3");
    setTab("lesson");
  };
}

/* 管理页读 PDF（复用主流程的 pdf.js 逻辑，但写进管理页的文本框） */
function adminReadPdf(file) {
  if (typeof pdfjsLib === "undefined") {
    adminLog("⏳ 正在加载 PDF 解析组件…");
    const sc = document.createElement("script");
    sc.src = "pdfjs/pdf.min.js?v=20261024";
    sc.onload = function () { setTimeout(function () { adminReadPdf(file); }, 0); };
    sc.onerror = function () { adminLog("❌ 未找到 PDF 解析组件（pdfjs/pdf.min.js）。请改用 txt 或直接粘贴文字。", "bad"); };
    document.head.appendChild(sc);
    return;
  }
  const reader = new FileReader();
  reader.onload = function () {
    const buf = reader.result;
    try { pdfjsLib.GlobalWorkerOptions.workerSrc = "pdfjs/pdf.worker.min.js"; } catch (e) {}
    Promise.resolve(pdfjsLib.getDocument({ data: buf }).promise).then(function (pdf) {
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) pages.push(i);
      let out = "";
      let chain = Promise.resolve();
      pages.forEach(function (i) {
        chain = chain.then(function () {
          return pdf.getPage(i).then(function (pg) { return pg.getTextContent(); })
            .then(function (tc) {
              out += tc.items.map(function (it) { return it.str; }).join(" ") + "\n\n";
              adminLog("　已读取第 " + i + "/" + pdf.numPages + " 页");
            });
        });
      });
      return chain.then(function () {
        const text = out.replace(/[ \t]+/g, " ").trim();
        const letters = (text.match(/[A-Za-z]/g) || []).length;
        if (letters < 30) {
          adminLog("⚠️ 这个 PDF 没有文字层（是扫描图片），请改用 txt 或直接粘贴文字。", "warn");
          return;
        }
        $("#adminText").value = text;
        ADMIN.text = text;
        if (!$("#adminTitle").value) {
          const nm = file.name.replace(/\.pdf$/i, "");
          $("#adminTitle").value = nm;
          ADMIN.title = nm;
        }
        adminLog("✅ PDF 读取完成：" + text.length + " 个字符。", "ok");
      });
    }).catch(function (e) {
      adminLog("❌ PDF 读取失败：" + esc(String(e && e.message || e)), "bad");
    });
  };
  reader.readAsArrayBuffer(file);
}

/* 刷新后把 IndexedDB 里的图片/音频重新挂回当前课程 */
function restoreMedia(saved) {
  if (!saved || !saved.assets) return Promise.resolve(false);
  const imgs = saved.assets.imgs || [];
  const auds = saved.assets.auds || [];
  if (!imgs.length && !auds.length) return Promise.resolve(false);
  const job = function (list, i, acc) {
    if (i >= list.length) return Promise.resolve(acc);
    const it = list[i];
    return dbGet(it.key).then(function (blob) {
      if (blob) acc.push({ name: it.name, size: it.size, blob: blob, url: URL.createObjectURL(blob), saved: true, key: it.key });
      return job(list, i + 1, acc);
    });
  };
  return Promise.all([job(imgs, 0, []), job(auds, 0, [])]).then(function (r) {
    if (!S.custom) return false;
    applyMediaToModel(S.custom, r[0], r[1]);
    return true;
  });
}

/* ================= 单词消消乐（Word Match Blast） =================
   两种玩法（可融合切换）：
   ① 配对消消 —— 词表拆成英文卡 + 中文卡，点两张配对，配对成功即消除。
   ② 短语大炮 —— 把短语拆成单词块，用大炮把正确的单词块依次打回托盘，
                   拼出完整短语（更刺激，也练短语搭配）。
   难度：简单（正面朝上、无限时、无生命）/ 普通（背面朝上、3 命）/ 困难（限时更短、3 命、卡片轻微漂浮）
   发音：点英文卡即朗读该单词。 */
const K_GAME = "eclass.game.v1";
const GAME_DIFF = {
  /* maxOpen = 最多能同时翻开几张；达到上限就判定"里面有没有一对"，有就消，没有就全盖回去 */
  easy:   { key: "easy",   label: "简单", pairs: 6, flip: false, time: 0,  lives: 0, drift: false,
            maxOpen: 2, tip: "卡片正面朝上，不限时间，点两张配对。" },
  normal: { key: "normal", label: "普通", pairs: 6, flip: true,  time: 0,  lives: 3, drift: false,
            maxOpen: 3, tip: "6 对共 12 张卡，背面朝上，不限时间。最多同时翻开 3 张，其中有 2 张配成一对就消除。" },
  hard:   { key: "hard",   label: "困难", pairs: 9, flip: true,  time: 0,  lives: 3, drift: true,
            maxOpen: 3, tip: "9 对共 18 张卡，会轻微漂移，不限时间。最多同时翻开 3 张，其中有 2 张配成一对就消除。" }
};
/* 短语大炮的难度：rounds = 要拼几个短语 */
const PHRASE_DIFF = {
  easy:   { key: "easy",   label: "简单", rounds: 4, lives: 0, time: 0,  drift: false, tip: "4 个短语，每个拆成单词块，用大炮按顺序打回托盘。" },
  normal: { key: "normal", label: "普通", rounds: 6, lives: 3, time: 0,  drift: false, tip: "6 个短语，打错 3 次要重来。" },
  hard:   { key: "hard",   label: "困难", rounds: 8, lives: 2, time: 120, drift: true,  tip: "8 个短语，120 秒限时，只允许错 2 次。" }
};
/* 底图池：消除卡片后露出完整动物图。每次开局随机换一张。 */
const GAME_BG = [];
(function () {
  for (let i = 1; i <= 16; i++) GAME_BG.push("scenes/animal/animal" + (i < 10 ? "0" + i : i) + ".jpg");
})();
const GAME = {
  mode: "match",  /* match = 配对消消 / phrase = 短语大炮 */
  bg: "",        /* 本局用的底图 */
  bgOff: 0,      /* 底图池轮换指针，避免连续重复 */
  diff: "normal",
  cards: [],
  picked: [],
  lock: false,
  running: false,
  score: 0,
  combo: 0,
  bestCombo: 0,
  lives: 0,
  timeLeft: 0,
  total: 0,
  timer: null,
  startedAt: 0,
  sound: true,
  music: false,
  lastMatchAt: 0,
  /* ---- 短语大炮专属 ---- */
  ph: null,          /* { rounds:[{phrase, words, zh}], idx, slots, tray, done, miss } */
  phReady: false     /* 短语局是否已准备好（等孩子点开始） */
};

/* 取当前单元的词：优先用有中文释义的词条，生词本里的释义也并进来 */
function gameWordPool() {
  const m = currentModel();
  const out = [];
  const seen = {};
  const push = function (en, zh) {
    const e = String(en || "").trim(), z = String(zh || "").trim();
    if (!e || !z) return;
    if (seen[e.toLowerCase()]) return;
    if (e.length > 22 || z.length > 18) return;
    seen[e.toLowerCase()] = 1;
    out.push({ en: e, zh: z });
  };
  ((m && m.words) || []).forEach(function (w) { push(w.en, w.zh); });
  ((m && m.unknowns) || []).forEach(function (u) {
    const it = (SRS && SRS.items) ? SRS.items[u.en] : null;
    if (it && it.zh) push(u.en, it.zh);
  });
  if (SRS && SRS.items) {
    Object.keys(SRS.items).forEach(function (k) { push(k, SRS.items[k].zh); });
  }
  return out;
}

/* 短语大炮的词块池：短语按单词拆开，2~3 个词的最佳（块太大点不准，太小没挑战） */
function gamePhrasePool() {
  const m = currentModel();
  const out = [];
  const seen = {};
  ((m && m.phrases) || []).forEach(function (p) {
    const en = String(p.en || "").trim(), zh = String(p.zh || "").trim();
    if (!en || !zh) return;
    if (seen[en.toLowerCase()]) return;
    /* 只保留"词组型"短语：2~4 个英文词，且每个词都是纯字母，方便拆块 */
    const ws = en.split(/\s+/);
    if (ws.length < 2 || ws.length > 4) return;
    if (!ws.every(function (w) { return /^[A-Za-z'-]+$/.test(w); })) return;
    seen[en.toLowerCase()] = 1;
    out.push({ en: en, words: ws, zh: zh });
  });
  return out;
}

/* 每次开局换一张底图：顺序轮换 + 小幅随机，保证不连续重复 */
function gameNextBg() {
  if (!GAME_BG.length) return "";
  GAME.bgOff = (GAME.bgOff + 1 + Math.floor(Math.random() * 3)) % GAME_BG.length;
  return GAME_BG[GAME.bgOff];
}

/* 生成 2N 张卡并打乱 */
function gameBuildCards(diff) {
  const cfg = GAME_DIFF[diff];
  const pool = gameWordPool();
  if (pool.length < 2) return null;
  /* 优先挑有例句/核心词，让配对有内容价值 */
  let pick = sample(pool, Math.min(cfg.pairs, pool.length));
  GAME.diff = diff;
  GAME.total = pick.length;
  const cards = [];
  pick.forEach(function (w, i) {
    cards.push({ id: "e" + i, pair: i, side: "en", text: w.en, zh: w.zh, open: !cfg.flip, gone: false });
    cards.push({ id: "z" + i, pair: i, side: "zh", text: w.zh, zh: w.zh, en: w.en, open: !cfg.flip, gone: false });
  });
  /* 槽位 = 底图切片位置。先按填充顺序编号，再整体打乱到棋盘上 */
  cards.forEach(function (c, i) { c.slot = i; });
  GAME.cards = shuffle(cards);
  return GAME.cards;
}

/* ---------- 音效：全部用 WebAudio 合成，不依赖音频文件 ---------- */
function gameBeep(freqs, dur, type, vol) {
  if (!GAME.sound) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    gameBeep.ctx = gameBeep.ctx || new AC();
    const ctx = gameBeep.ctx;
    if (ctx.state === "suspended") ctx.resume();
    freqs.forEach(function (f, i) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || "sine";
      const t0 = ctx.currentTime + i * (dur * 0.7);
      o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.14, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    });
  } catch (e) { }
}
const gameSfx = {
  pick: function () { gameBeep([660], 0.09, "sine", 0.1); },
  good: function () { gameBeep([784, 1046], 0.13, "sine", 0.15); },
  bad: function () { gameBeep([220, 165], 0.16, "sawtooth", 0.11); },
  combo: function () { gameBeep([880, 1174, 1568], 0.11, "triangle", 0.13); },
  win: function () { gameBeep([523, 659, 784, 1046, 1318], 0.16, "sine", 0.16); },
  lose: function () { gameBeep([392, 330, 262], 0.22, "sine", 0.13); },
  tick: function () { gameBeep([880], 0.06, "square", 0.06); }
};

function gameBest() {
  const g = loadJSON(K_GAME, null);
  return (g && g.best) ? g.best : {};
}
function gameSaveBest(diff, lost) {
  const g = loadJSON(K_GAME, null) || {};
  g.best = g.best || {};
  const b = g.best[diff] || { score: 0, time: 0, plays: 0 };
  b.plays = (b.plays || 0) + 1;
  if (!lost && (!b.time || lost.time < b.time)) b.time = lost.time;
  if (lost.score > (b.score || 0)) b.score = lost.score;
  g.best[diff] = b;
  saveJSON(K_GAME, g);
  return b;
}

/* ---------- 计时 ---------- */
/* 当前模式的难度配置 */
function gameCfg() {
  return GAME.mode === "phrase" ? (PHRASE_DIFF[GAME.diff] || PHRASE_DIFF.normal)
                                : (GAME_DIFF[GAME.diff] || GAME_DIFF.normal);
}
function gameStopTimer() {
  if (GAME.timer) { clearInterval(GAME.timer); GAME.timer = null; }
}
function gameStartTimer() {
  gameStopTimer();
  if (!gameCfg().time) return;
  const t0 = Date.now();
  const base = GAME.timeLeft;
  GAME.timer = setInterval(function () {
    GAME.timeLeft = Math.max(0, base - Math.floor((Date.now() - t0) / 1000));
    const el = $("#gTime");
    if (el) {
      el.textContent = GAME.timeLeft + " 秒";
      el.classList.toggle("urgent", GAME.timeLeft <= 10);
    }
    if (GAME.timeLeft <= 5 && GAME.timeLeft > 0) gameSfx.tick();
    if (GAME.timeLeft <= 0) { gameStopTimer(); gameOver(false); }
  }, 250);
}

/* ---------- 面板渲染 ---------- */
function renderGameTab() {
  const view = $("#view");
  const isPhrase = GAME.mode === "phrase";
  const diff = isPhrase ? (PHRASE_DIFF[GAME.diff] || PHRASE_DIFF.normal) : (GAME_DIFF[GAME.diff] || GAME_DIFF.normal);
  const best = gameBest()[GAME.mode + ":" + GAME.diff];
  let h = '<div class="tab-head card"><div class="tab-title">🎮 单词消消乐</div>';
  h += '<div class="hint">两种玩法都能练本课单词：配对消消练英汉对应，短语大炮练短语搭配。点英文卡会朗读这个词。</div></div>';

  /* 玩法选择：两个卡片，选中的高亮 */
  h += '<div class="card gm-setup" id="gmSetup">';
  h += '<div class="gm-modes">';
  h += '<button class="gm-mode' + (isPhrase ? "" : " on") + '" data-mode="match">' +
       '<b>🧩 配对消消</b><span>英文卡 + 中文卡，点两张配一对</span></button>';
  h += '<button class="gm-mode' + (isPhrase ? " on" : "") + '" data-mode="phrase">' +
       '<b>💥 短语大炮</b><span>把单词块打回托盘，拼出短语</span></button>';
  h += '</div>';
  h += '<div class="gm-diffs">';
  ["easy", "normal", "hard"].forEach(function (k) {
    const c = isPhrase ? PHRASE_DIFF[k] : GAME_DIFF[k];
    const sub = isPhrase ? (c.rounds + " 个短语" + (c.time ? " · " + c.time + "秒" : " · 不限时"))
                         : (c.pairs * 2 + " 张卡" + (c.time ? " · " + c.time + "秒" : " · 不限时"));
    h += '<button class="gm-diff' + (k === GAME.diff ? " on" : "") + '" data-diff="' + k + '">' +
         '<b>' + c.label + '</b><span>' + sub + '</span></button>';
  });
  h += '</div>';
  h += '<div class="gm-tip">' + esc(diff.tip) + '</div>';
  if (best && best.plays) {
    h += '<div class="gm-best">🏆 最好成绩：' + (best.score || 0) + ' 分' +
         (best.time ? " · 最快 " + fmtTime(best.time) : "") + ' · 已玩 ' + best.plays + ' 局</div>';
  }
  h += '<div class="gm-actions"><button class="btn btn-primary btn-lg" id="gmStart">▶ 开始游戏</button></div>';
  h += '</div>';

  h += '<div class="card gm-board-wrap hidden" id="gmBoardWrap">';
  h += '<div class="gm-hud">' +
       '<div class="gm-stat"><span>得分</span><b id="gScore">0</b></div>' +
       '<div class="gm-stat"><span>剩余</span><b id="gLeft">0</b></div>' +
       '<div class="gm-stat hidden" id="gTimeBox"><span>时间</span><b id="gTime">0 秒</b></div>' +
       '<div class="gm-stat hidden" id="gLifeBox"><span>生命</span><b id="gLife">❤❤❤</b></div>' +
       '<div class="gm-stat gm-combo hidden" id="gComboBox"><span>连击</span><b id="gCombo">0</b></div>' +
       '</div>';
  /* 短语大炮：先显示本局目标，再开炮 */
  h += '<div class="gm-ph-head hidden" id="gmPhHead"></div>';
  /* 舞台：炮台 + 单词块 */
  h += '<div class="gm-stage" id="gmStage">' +
       '<div class="cannon-layer" id="gmLayer" aria-hidden="true"></div>' +
       '<div class="cannon-wrap" id="gmCannon" aria-hidden="true"><div class="cannon"><div class="cannon-barrel" id="gmBarrel"></div><div class="cannon-wheel" id="gmWheel"></div></div></div>' +
       '<div class="gm-board" id="gmBoard"></div>' +
       '</div>';
  /* 收集托盘：打中的单词块落到这里，拼成完整短语 */
  h += '<div class="gm-tray hidden" id="gmTray"></div>';
  h += '<div class="gm-banner hidden" id="gmBanner"></div>';
  h += '<div class="gm-ctrl">' +
       '<button class="btn btn-ghost btn-sm" id="gmShuffle">🔀 重排</button>' +
       '<button class="btn btn-ghost btn-sm" id="gmSound">🔊 音效开</button>' +
       '<button class="btn btn-ghost btn-sm" id="gmQuit">✖ 退出</button>' +
       '</div></div>';

  h += '<div class="gm-result hidden" id="gmResult"></div>';
  view.innerHTML = h;

  $all("[data-mode]", view).forEach(function (b) {
    b.onclick = function () {
      const m = b.getAttribute("data-mode");
      if (m === GAME.mode) return;
      GAME.mode = m;
      GAME.phReady = false;
      renderGameTab();
    };
  });
  $all("[data-diff]", view).forEach(function (b) {
    b.onclick = function () {
      GAME.diff = b.getAttribute("data-diff");
      GAME.phReady = false;
      renderGameTab();
    };
  });
  $("#gmStart").onclick = function () { gameStart(); };
  $("#gmShuffle").onclick = function () { gameShuffle(); };
  $("#gmQuit").onclick = function () { gameQuit(); };
  const sb = $("#gmSound");
  sb.onclick = function () {
    GAME.sound = !GAME.sound;
    sb.textContent = GAME.sound ? "🔊 音效开" : "🔇 音效关";
  };
  sb.textContent = GAME.sound ? "🔊 音效开" : "🔇 音效关";
}

function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60), r = s % 60;
  return m ? (m + " 分 " + r + " 秒") : (r + " 秒");
}

/* 渲染卡片池 */
/* 棋盘列数：按卡数和屏宽算，保证卡片是正方形且不溢出 */
function gameCols(n) {
  const w = (typeof window !== "undefined" ? window.innerWidth : 1024) || 1024;
  let cols = 4;
  if (w < 400) cols = 3;
  else if (w < 640) cols = 4;
  else cols = 5;
  if (n <= 12) cols = Math.min(cols, 4);
  return cols;
}

function gameRenderBoard() {
  const board = $("#gmBoard");
  if (!board) return;
  if (GAME.mode === "phrase") { gameRenderPhraseRound(false); return; }
  const n = GAME.cards.length;
  const cols = gameCols(n);
  const rows = Math.ceil(n / cols);
  board.style.setProperty("--cols", cols);
  board.style.setProperty("--rows", rows);
  const gapPx = (typeof window !== "undefined" ? window.innerWidth : 1024) > 420 ? 8 : 6;
  board.style.setProperty("--gapw", gapPx + "px");
  /* 底图作为棋盘背景，卡片盖在上面留出缝隙就像拼图块 */
  if (GAME.bg) {
    board.style.setProperty("--bg", 'url("' + GAME.bg + '")');
    board.classList.add("has-bg");
  } else {
    board.classList.remove("has-bg");
  }
  let h = "";
  GAME.cards.forEach(function (c, idx) {
    if (c.gone) { h += '<div class="gm-card gone" data-id="' + c.id + '"></div>'; return; }
    const cls = "gm-card " + (c.side === "zh" ? "zh" : "en") + (c.open ? " open" : "") +
                (GAME.picked.indexOf(c.id) >= 0 ? " sel" : "");
    h += '<button type="button" class="' + cls + '" data-id="' + c.id + '">' +
         '<span class="gm-face">' + (c.open ? esc(c.text) : "") + '</span></button>';
  });
  board.innerHTML = h;
  if (GAME_DIFF[GAME.diff] && GAME_DIFF[GAME.diff].drift) board.classList.add("drift");
  else board.classList.remove("drift");
  $all("[data-id]", board).forEach(function (b) {
    b.onclick = function () { gameTap(b.getAttribute("data-id")); };
  });
  gameHud();
}

function gameHud() {
  const isPhrase = GAME.mode === "phrase";
  let left;
  if (isPhrase) {
    left = GAME.ph ? GAME.ph.slots.filter(function (s) { return !s.shot; }).length : 0;
  } else {
    left = GAME.cards.filter(function (c) { return !c.gone; }).length;
  }
  if ($("#gScore")) $("#gScore").textContent = GAME.score;
  if ($("#gLeft")) $("#gLeft").textContent = isPhrase ? (GAME.total - (GAME.ph ? GAME.ph.done : 0)) + " 个" : left + " 张";
  if ($("#gTime")) $("#gTime").textContent = GAME.timeLeft + " 秒";
  const hasLives = !!(gameCfg().lives);
  if ($("#gLife")) $("#gLife").textContent = hasLives ? "❤".repeat(Math.max(0, GAME.lives)) : "";
  const lb = $("#gLifeBox");
  if (lb) lb.classList.toggle("hidden", !hasLives);
  if ($("#gCombo")) $("#gCombo").textContent = GAME.combo;
  const cb = $("#gComboBox");
  if (cb) cb.classList.toggle("hidden", GAME.combo < 2);
}

/* ---------- 开局 ---------- */
function gameStart() {
  GAME.bg = gameNextBg();
  GAME.phReady = false;
  if (GAME.mode === "phrase") { gameStartPhrase(); return; }
  const cfg = GAME_DIFF[GAME.diff];
  const cards = gameBuildCards(GAME.diff);
  if (!cards) {
    toast("词表里没有足够的词，先去管理页上传课文吧");
    return;
  }
  GAME.picked = [];
  GAME.lock = false;
  GAME.running = true;
  GAME.score = 0;
  GAME.combo = 0;
  GAME.bestCombo = 0;
  GAME.lives = cfg.lives || 0;
  GAME.timeLeft = cfg.time || 0;
  GAME.startedAt = Date.now();
  $("#gmSetup").classList.add("hidden");
  $("#gmBoardWrap").classList.remove("hidden");
  $("#gmResult").classList.add("hidden");
  gameShowChrome(false);
  const tb = $("#gTimeBox"), lb = $("#gLifeBox");
  if (tb) tb.classList.toggle("hidden", !cfg.time);
  if (lb) lb.classList.toggle("hidden", !cfg.lives);
  gameRenderBoard();
  gameStartTimer();
}
/* 短语大炮 / 配对模式 的共用显隐 */
function gameShowChrome(isPhrase) {
  const head = $("#gmPhHead"), tray = $("#gmTray"), cannon = $("#gmCannon"), stage = $("#gmStage");
  if (head) head.classList.toggle("hidden", !isPhrase);
  if (tray) tray.classList.toggle("hidden", !isPhrase);
  if (cannon) cannon.classList.toggle("hidden", !isPhrase);
  if (stage) stage.classList.toggle("phrase", !!isPhrase);
}

/* ---------- 短语大炮：准备一局 ---------- */
function gameStartPhrase() {
  const cfg = PHRASE_DIFF[GAME.diff] || PHRASE_DIFF.normal;
  const pool = gamePhrasePool();
  if (pool.length < 2) {
    toast("本课短语不够，先去管理页上传课文吧");
    return;
  }
  const pick = sample(pool, Math.min(cfg.rounds, pool.length));
  GAME.ph = {
    rounds: pick,
    idx: 0,
    slots: [],      /* 本回合待发射的单词块（打中就移除） */
    tray: [],       /* 已打中的单词（按顺序拼起来） */
    miss: 0,        /* 本回合打错次数 */
    done: 0         /* 已完成的短语数 */
  };
  GAME.score = 0;
  GAME.combo = 0;
  GAME.bestCombo = 0;
  GAME.lives = cfg.lives || 0;
  GAME.timeLeft = cfg.time || 0;
  GAME.total = pick.length;
  GAME.lock = false;
  GAME.running = true;
  GAME.phReady = true;
  GAME.startedAt = Date.now();
  $("#gmSetup").classList.add("hidden");
  $("#gmBoardWrap").classList.remove("hidden");
  $("#gmResult").classList.add("hidden");
  gameShowChrome(true);
  const tb = $("#gTimeBox"), lb = $("#gLifeBox");
  if (tb) tb.classList.toggle("hidden", !cfg.time);
  if (lb) lb.classList.toggle("hidden", !cfg.lives);
  /* 短语局没有"重排"（顺序是谜题的一部分），换成"听一遍" */
  const sh = $("#gmShuffle");
  if (sh) {
    sh.textContent = "🔊 听本句";
    sh.onclick = function () { phSpeakCurrent(); };
  }
  gameRenderPhraseRound(true);
  gameStartTimer();
}

/* 当前回合（第 idx 个短语）的目标与词块 */
function phRound() {
  const ph = GAME.ph;
  if (!ph || ph.idx >= ph.rounds.length) return null;
  const r = ph.rounds[ph.idx];
  return r;
}
function phSpeakCurrent() {
  const r = phRound();
  if (r) speak(r.en);
}

/* 渲染短语大炮的"弹匣"：把短语的单词块打乱排在棋盘上。first=true 表示新回合 */
function gameRenderPhraseRound(first) {
  const board = $("#gmBoard"), head = $("#gmPhHead"), tray = $("#gmTray");
  if (!board || !GAME.ph) return;
  const r = phRound();
  if (!r) { return; }
  if (first || !GAME.ph.slots.length) {
    GAME.ph.slots = shuffle(r.words.map(function (w, i) {
      return { id: "w" + i, text: w, shot: false };
    }));
    GAME.ph.tray = [];
    GAME.ph.miss = 0;
  }
  /* 目标横幅 */
  if (head) {
    head.classList.remove("hidden");
    head.innerHTML = '<div class="gm-ph-goal">🎯 第 ' + (GAME.ph.idx + 1) + ' / ' + GAME.roundsTotal() +
      ' 个短语 · 用大炮把单词块按顺序打下来</div>' +
      '<div class="gm-ph-zh">中文意思：<b>' + esc(r.zh) + '</b></div>';
  }
  /* 棋盘：3 列（手机上也好点） */
  board.style.setProperty("--cols", 3);
  board.style.setProperty("--rows", Math.ceil(GAME.ph.slots.length / 3));
  board.style.setProperty("--bg", 'url("' + GAME.bg + '")');
  board.classList.add("has-bg");
  let h = "";
  GAME.ph.slots.forEach(function (s) {
    if (s.shot) { h += '<div class="gm-card gone" data-id="' + s.id + '"></div>'; return; }
    h += '<button type="button" class="gm-card en open" data-id="' + s.id + '">' +
         '<span class="gm-face">' + esc(s.text) + '</span></button>';
  });
  board.innerHTML = h;
  $all("[data-id]", board).forEach(function (b) {
    b.onclick = function () { gamePhraseFire(b.getAttribute("data-id"), b); };
  });
  gameRenderTray();
  gameHud();
  /* 每次新回合先给一句"预告"：读中文意思，孩子知道要拼什么 */
  if (first) { phSpeakCurrent(); }
}
GAME.roundsTotal = function () { return GAME.total || 0; };

/* 托盘：已打中的单词按顺序排好，拼成短语 */
function gameRenderTray() {
  const tray = $("#gmTray");
  if (!tray || !GAME.ph) return;
  tray.classList.remove("hidden");
  let h = '<div class="gm-tray-label">📥 托盘（按顺序收集单词）</div><div class="gm-tray-slots">';
  const need = phRound() ? phRound().words.length : 0;
  for (let i = 0; i < need; i++) {
    const w = GAME.ph.tray[i];
    h += '<div class="gm-tray-slot' + (w ? " filled" : "") + '">' + (w ? esc(w) : "?") + '</div>';
  }
  h += '</div></div>';
  tray.innerHTML = h;
}

function gameBanner(html, cls) {
  const b = $("#gmBanner");
  if (!b) return;
  b.innerHTML = html;
  b.className = "gm-banner " + (cls || "");
  b.classList.remove("hidden");
  clearTimeout(b._t);
  b._t = setTimeout(function () { b.classList.add("hidden"); }, 2200);
}

/* 奖励时刻：棋盘清空，露出动物底图，中间写上刚拼出的短语 */
function phRevealBg(r) {
  const board = $("#gmBoard");
  if (!board) return;
  board.classList.add("reveal");
  board.innerHTML = '<div class="gm-reveal"><div class="gm-reveal-en">' + esc(r.en) + '</div>' +
                    '<div class="gm-reveal-zh">' + esc(r.zh) + '</div></div>';
  clearTimeout(board._t);
  board._t = setTimeout(function () { board.classList.remove("reveal"); }, 1600);
}

/* 点一个单词块 → 大炮瞄准并发射 */
function gamePhraseFire(id, btn) {
  if (!GAME.running && !GAME.phReady) return;
  if (GAME.lock || !GAME.ph) return;
  const r = phRound();
  if (!r) return;
  const slot = GAME.ph.slots.find(function (s) { return s.id === id; });
  if (!slot || slot.shot) return;
  const layer = $("#gmLayer"), barrel = $("#gmBarrel"), wheel = $("#gmWheel");
  GAME.lock = true;
  const want = r.words[GAME.ph.tray.length];  /* 下一个该收集的单词 */
  const ok = slot.text === want;
  fireCannonCore(layer, barrel, wheel, btn, function () {
    if (ok) {
      slot.shot = true;
      GAME.ph.tray.push(slot.text);
      gameSfx.good();
      GAME.score += 50 + (GAME.combo > 0 ? 10 : 0);
      GAME.combo++;
      if (GAME.combo > GAME.bestCombo) GAME.bestCombo = GAME.combo;
      /* 整句收集完 → 庆祝并进入下一回合 */
      if (GAME.ph.tray.length >= r.words.length) {
        gameBanner('🎉 拼对啦！<b>' + esc(r.en) + '</b> = ' + esc(r.zh), "win");
        if (GAME.combo >= 3) gameSfx.combo(); else gameSfx.win();
        GAME.ph.done++;
        GAME.ph.idx++;
        /* 奖励：把底图亮出来 1.5 秒，孩子看到自己拼出的短语写在动物图上 */
        phRevealBg(r);
        setTimeout(function () {
          GAME.lock = false;
          if (GAME.ph.idx >= GAME.ph.rounds.length) { gameOver(true); return; }
          gameRenderPhraseRound(true);
        }, 1600);
        return;
      }
      GAME.lock = false;
      gameRenderPhraseRound(false);
    } else {
      GAME.combo = 0;
      GAME.ph.miss++;
      gameSfx.bad();
      btn.classList.add("shake");
      setTimeout(function () { btn.classList.remove("shake"); }, 500);
      gameBanner('💨 这一块不是现在要的，现在要收集的是 <b>' + esc(want || "?") + '</b>', "miss");
      const cfg = PHRASE_DIFF[GAME.diff] || PHRASE_DIFF.normal;
      GAME.lock = false;
      if (cfg.lives) {
        GAME.lives = Math.max(0, GAME.lives - 1);
        gameHud();
        if (GAME.lives <= 0) { setTimeout(function () { gameOver(false); }, 900); return; }
      }
    }
  }, 260);
}

/* ---------- 点卡 ---------- */
/* 在一组已翻开的卡里找一对（英文 + 中文且词义相同） */
function gameFindPair(ids) {
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = GAME.cards.find(function (c) { return c.id === ids[i]; });
      const b = GAME.cards.find(function (c) { return c.id === ids[j]; });
      if (a && b && a.pair === b.pair && a.side !== b.side) return [a, b];
    }
  }
  return null;
}

function gameTap(id) {
  if (GAME.mode === "phrase") { return; }
  if (!GAME.running || GAME.lock) return;
  const card = GAME.cards.find(function (c) { return c.id === id; });
  if (!card || card.gone) return;
  {
    /* 再点一次取消选中（并盖回） */
    if (GAME.picked.indexOf(id) >= 0) {
      GAME.picked = GAME.picked.filter(function (x) { return x !== id; });
      if (GAME_DIFF[GAME.diff].flip) card.open = false;
      gameRenderBoard();
      return;
    }
    if (card.side === "en") speak(card.text);
    gameSfx.pick();
    /* 背面朝上的模式：翻开这一张，让玩家看到内容 */
    card.open = true;
    GAME.picked.push(id);

    const cfg = GAME_DIFF[GAME.diff];
    const maxOpen = cfg.maxOpen || 2;

    /* 每翻一张就检查：只要凑成一对就立刻消，不必等翻满 */
    const pair = gameFindPair(GAME.picked);

    /* 还没配对、也没翻满：继续等玩家翻下一张 */
    if (!pair && GAME.picked.length < maxOpen) {
      gameRenderBoard();
      return;
    }

    GAME.lock = true;
    gameRenderBoard();

    if (pair) {
      /* 配对成功：消掉这一对，其余翻开的卡原样保留、继续参与下一轮 */
      const now = Date.now();
      GAME.combo = (now - GAME.lastMatchAt < 4000) ? GAME.combo + 1 : 1;
      GAME.lastMatchAt = now;
      GAME.bestCombo = Math.max(GAME.bestCombo, GAME.combo);
      const bonus = Math.max(0, GAME.combo - 1) * 10;
      GAME.score += 100 + bonus;
      if (GAME.combo >= 3) gameSfx.combo(); else gameSfx.good();
      pair.forEach(function (c) {
        const e = $('.gm-card[data-id="' + c.id + '"]');
        if (e) e.classList.add("boom");
      });
      setTimeout(function () {
        pair.forEach(function (c) { c.gone = true; });
        GAME.picked = GAME.picked.filter(function (x) {
          return pair[0].id !== x && pair[1].id !== x;
        });
        GAME.lock = false;
        gameRenderBoard();
        if (GAME.cards.every(function (c) { return c.gone; })) gameOver(true);
      }, 460);
    } else {
      /* 这组里没有一对：全部盖回去，扣命 */
      GAME.combo = 0;
      gameSfx.bad();
      GAME.picked.forEach(function (x) {
        const e = $('.gm-card[data-id="' + x + '"]');
        if (e) e.classList.add("shake");
      });
      if (cfg.lives) {
        GAME.lives = Math.max(0, GAME.lives - 1);
        gameHud();
      }
      setTimeout(function () {
        GAME.picked.forEach(function (x) {
          const c = GAME.cards.find(function (y) { return y.id === x; });
          if (c && cfg.flip) c.open = false;
        });
        GAME.picked = [];
        GAME.lock = false;
        if (cfg.lives && GAME.lives <= 0) { gameOver(false); return; }
        gameRenderBoard();
      }, 620);
    }
  }
}

function gameShuffle() {
  if (GAME.mode === "phrase") { phSpeakCurrent(); return; }
  if (!GAME.running) return;
  const alive = GAME.cards.filter(function (c) { return !c.gone; });
  const rest = GAME.cards.filter(function (c) { return c.gone; });
  GAME.cards = shuffle(alive).concat(rest);
  GAME.picked = [];
  /* 槽位不变：卡片换位置，但每张卡仍显示自己那块底图切片，拼图不会错位 */
  gameRenderBoard();
}

function gameQuit() {
  GAME.running = false;
  GAME.phReady = false;
  gameStopTimer();
  GAME.picked = [];
  renderGameTab();
}

/* ---------- 结算 ---------- */
function gameOver(win) {
  GAME.running = false;
  GAME.phReady = false;
  gameStopTimer();
  GAME.lock = true;
  const used = Math.round((Date.now() - GAME.startedAt) / 1000);
  const isPhrase = GAME.mode === "phrase";
  if (win) {
    if (!isPhrase) {
      const cfg = GAME_DIFF[GAME.diff];
      let bonus = 0;
      if (cfg.time && GAME.timeLeft > 0) bonus = GAME.timeLeft * 5;
      GAME.score += bonus;
    }
    gameSfx.win();
  } else {
    gameSfx.lose();
  }
  const lost = { score: GAME.score, time: used };
  const best = gameSaveBest(GAME.mode + ":" + GAME.diff, win ? lost : Object.assign({}, lost, { score: 0 }));
  const stars = win ? (GAME.bestCombo >= 5 ? 3 : (GAME.bestCombo >= 2 ? 2 : 1)) : 0;
  const box = $("#gmResult");
  if (!box) return;
  let h = '<div class="card gm-over ' + (win ? "win" : "lose") + '">';
  h += '<div class="gm-over-ico">' + (win ? "🎉" : "😢") + '</div>';
  h += '<div class="gm-over-t">' + (win ? "恭喜通关！" : "这次没成功") + '</div>';
  if (win) {
    h += '<div class="gm-stars">' + "★".repeat(stars) + "☆".repeat(3 - stars) + '</div>';
    h += '<div class="gm-over-s">最高连击 ×' + GAME.bestCombo + (isPhrase ? " · 完成 " + GAME.ph.done + " 个短语" : "") + '</div>';
  } else if (isPhrase && GAME.ph) {
    h += '<div class="gm-over-s">还剩 ' + (GAME.total - GAME.ph.done) + ' 个短语没拼完</div>';
  } else {
    h += '<div class="gm-over-s">还剩 ' + GAME.cards.filter(function (c) { return !c.gone; }).length + ' 张卡没消掉</div>';
  }
  h += '<div class="gm-over-grid">' +
       '<div><span>得分</span><b>' + GAME.score + '</b></div>' +
       '<div><span>用时</span><b>' + fmtTime(used) + '</b></div>' +
       '<div><span>最好</span><b>' + (best.score || 0) + '</b></div>' +
       '</div>';
  h += '<div class="gm-over-btns">' +
       '<button class="btn btn-primary btn-lg" id="gmAgain">🔁 再玩一局</button>' +
       '<button class="btn btn-ghost" id="gmChange">⚙ 换难度</button>' +
       '</div></div>';
  box.innerHTML = h;
  box.classList.remove("hidden");
  box.scrollIntoView({ block: "center" });
  $("#gmAgain").onclick = function () { gameStart(); box.classList.add("hidden"); };
  $("#gmChange").onclick = function () { renderGameTab(); };
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
    try {
      S.custom = buildCustom(saved.rawText, saved.title);
      S.custom.meanings = saved.meanings || {};
      /* 图片/音频存在 IndexedDB，异步挂回来（不阻塞首屏） */
      if (saved.assets) {
        restoreMedia(saved).then(function (ok) {
          if (ok && S.tab === "scene") setTab("scene");
          if (ok && S.tab === "lesson") setTab("lesson");
        }).catch(function () { });
      }
    } catch (e) { S.custom = null; }
  }
  /* 顶栏 */
  const tabs = $("#tabs");
  renderTabs();
  syncAdminChrome();
  /* 隐藏入口①：连点页脚 5 次 */
  const fs_ = $("#footSecret");
  if (fs_) {
    let taps = 0, timer = null;
    fs_.onclick = function () {
      taps++;
      clearTimeout(timer);
      timer = setTimeout(function () { taps = 0; }, 1200);
      if (taps >= 5) {
        taps = 0;
        try { history.replaceState(null, "", location.pathname + "?admin=1" + location.hash); } catch (e) { }
        setTab("admin");
        toast("🔓 已进入管理页");
      }
    };
  }
  /* 隐藏入口②：地址栏带 ?admin=1 —— 由启动尾部统一决定落哪个页 */

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
  if (wantsAdmin()) {
    setTab("admin");
    return;
  }
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
