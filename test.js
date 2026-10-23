const fs = require('fs'), vm = require('vm');
const store = {};
const ctx = {
  console, Date, Math, JSON, Object, Array, String, Number, RegExp,
  setTimeout, clearTimeout,
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  confirm: () => true
};
ctx.window = ctx; // 让 APP 注册分支可用，但 document 为 undefined，initApp 不会执行
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('/home/ubun/work/unit3/data.js', 'utf8'), ctx, {filename:'data.js'});
vm.runInContext(fs.readFileSync('/home/ubun/work/unit3/app.js', 'utf8'), ctx, {filename:'app.js'});

function run(expr){ return vm.runInContext(expr, ctx); }
function validate(q, where){
  if (q.kind === 'reorder') {
    if (!q.sentence || !q.tokens || q.tokens.length < 4) throw new Error('reorder bad: ' + JSON.stringify(q).slice(0,200));
    if (q.tokens.join(' ') === q.sentence) throw new Error('reorder not shuffled');
    return;
  }
  if (!Array.isArray(q.options) || q.options.length < 2) throw new Error(where + ' options<2: ' + q.prompt);
  const uniq = new Set(q.options);
  if (uniq.size !== q.options.length) throw new Error(where + ' dup options: ' + JSON.stringify(q.options) + ' | ' + q.prompt);
  if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.options.length) throw new Error(where + ' bad answer: ' + q.prompt + ' a=' + q.answer);
  if (q.options[q.answer] == null) throw new Error(where + ' answer undefined');
}

const m = run('builtinModel()');
console.log('内置课文: words=%d phrases=%d patterns=%d grammarQs=%d listenSents=%d passages=%d pool=%d',
  m.words.length, m.phrases.length, m.patterns.length, m.grammarQs.length, m.listenSents.length, m.passages.length, m.sentencePool.length);

const gens = {
  wordE2C: 'genWordE2C(builtinModel(),10)', wordC2E: 'genWordC2E(builtinModel(),10)',
  listenWord: 'genListenWord(builtinModel(),10)', listenWordZh: 'genListenWordZh(builtinModel(),10)',
  phraseE2C: 'genPhraseE2C(builtinModel(),8)', phraseC2E: 'genPhraseC2E(builtinModel(),8)',
  listenPhrase: 'genListenPhrase(builtinModel(),8)', grammar: 'genGrammar(builtinModel(),10)',
  cloze: 'genCloze(builtinModel(),8)', reorder: 'genReorder(builtinModel(),8)',
  listenSent: 'genListenSent(builtinModel(),8)', passage: 'genPassage(builtinModel(),6)',
  tf: 'genStoryTF(builtinModel(),4)'
};
for (const [name, expr] of Object.entries(gens)) {
  const qs = run(expr);
  if (!qs.length) throw new Error(name + ' produced 0 questions');
  qs.forEach(q => validate(q, name));
  console.log('OK', name, '->', qs.length, '题 | 示例:', String(qs[0].prompt).slice(0,42).replace(/\n/g,' '));
}

const mixed = run('genMixed(builtinModel(), 20)');
if (mixed.length < 18) throw new Error('mixed too few: ' + mixed.length);
const ids = new Set(mixed.map(q=>q.id));
if (ids.size !== mixed.length) throw new Error('mixed duplicate ids');
mixed.forEach(q => validate(q, 'mixed'));
console.log('OK 综合测验 20 题（唯一）');

/* 生词本 */
run('initSRS()');
const dueBefore = run('srsDueList().length');
run('srsUpdate("miss", true); srsUpdate("join", false); srsAdd("hello word","你好词","","test")');
console.log('OK 生词本: 预录=%d 今日待复习=%d srsReview=%d 题', run('Object.keys(SRS.items).length'), dueBefore, run('genSrsReview(srsDueList().concat(["miss","hello word"]),5).length'));

/* 自定义课文解析 */
const text = `My Best Friend
Amy is my best friend. We live in the same street. Every day we go to school together.
Amy likes reading books and she often shares her books with me. She helps me with my homework, and I help her too.
Last week I was sad because I lost my new pen. Amy said, "Don't cry. I will find it." We looked for it everywhere. At last we found it in the school bag!
We are friends because we are happy together. We help each other and we take care of each other. Friends should listen to each other, too.
There are many happy things in our friendship. Amy wants to be a teacher. She wants to help children. I want to be a doctor. We are different, but we are best friends.`;
const cm = run(`buildCustom(${JSON.stringify(text)}, "My Best Friend")`);
console.log('自定义课文: words=%d unknowns=%d phrases=%d patterns=%d grammarQs=%d listenSents=%d reorder=%d passages=%d sents=%d',
  cm.words.length, cm.unknowns.length, cm.phrases.length, cm.patterns.length, cm.grammarQs.length, cm.listenSents.length, cm.reorderSents.length, cm.passages.length, cm.sentences.length);
console.log('  词汇示例:', cm.words.slice(0,8).map(w=>w.en+'='+w.zh).join(' | '));
console.log('  生词示例:', cm.unknowns.slice(0,8).map(u=>u.en).join(', '));
console.log('  短语:', cm.phrases.map(p=>p.en).join(' / '));
console.log('  句式:', cm.patterns.map(p=>p.name+'('+p.examples.length+')').join(' ; '));
console.log('  语法题示例:', cm.grammarQs.slice(0,3).map(g=>g.q+' ['+g.opts+']→'+g.opts[g.a]).join(' || '));

const cgens = {
  wordE2C: 'genWordE2C(buildCustom(TXT,"t"),10)', phraseE2C: 'genPhraseE2C(buildCustom(TXT,"t"),5)',
  grammar: 'genGrammar(buildCustom(TXT,"t"),10)', cloze: 'genCloze(buildCustom(TXT,"t"),8)',
  reorder: 'genReorder(buildCustom(TXT,"t"),8)', listenSent: 'genListenSent(buildCustom(TXT,"t"),8)',
  passage: 'genPassage(buildCustom(TXT,"t"),4)', mixed: 'genMixed(buildCustom(TXT,"t"),15)'
};
run('var TXT=' + JSON.stringify(text));
for (const [name, expr] of Object.entries(cgens)) {
  const qs = run(expr);
  qs.forEach(q => validate(q, 'custom-' + name));
  console.log('OK 自定义', name, '->', qs.length, '题 | 示例:', String(qs[0].prompt).slice(0,40).replace(/\n/g,' '));
}

/* mutateSentence 稳定性 */
let okc = 0, same = 0;
const M = run('builtinModel()');
for (let i = 0; i < 200; i++) {
  const s = M.listenSents[i % M.listenSents.length];
  const mu = run(`mutateSentence(${JSON.stringify(s)}, builtinModel())`);
  if (mu === null) continue;
  if (mu === s) same++;
  else okc++;
}
console.log('OK mutateSentence: 200次中成功变异 %d 次, 未变化 %d 次', okc, same);

/* SRS 日期逻辑 */
const t1 = run('addDaysISO("2026-10-22", 1)');
const t2 = run('addDaysISO("2026-12-31", 1)');
if (t1 !== '2026-10-23' || t2 !== '2027-01-01') throw new Error('date calc wrong: ' + t1 + ',' + t2);
console.log('OK 日期计算: +1天 =', t1, ' 跨年 =', t2);
console.log('\n全部冒烟测试通过 ✅');
