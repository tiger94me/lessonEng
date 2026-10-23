/* 从 data.js 提取全部需要朗读的英文文本 → tools/tts_texts.json */
const fs = require('fs'), vm = require('vm');
const ctx = { console, Math, JSON, Date };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('/home/ubun/work/unit3/data.js', 'utf8'), ctx);
const get = n => vm.runInContext(n, ctx);
const texts = new Set();
function add(t) {
  t = String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
  if (!t || t.length > 600) return;
  if (!/[A-Za-z]/.test(t)) return;
  if (/[^^\x00-\xff]/.test(t.replace(/[\u2018\u2019\u201c\u201d\u2026\u2014-]/g, ''))) return; // 含中文的跳过
  texts.add(t);
}
get('WORDS').forEach(w => { add(w.en); add(w.ex); });
get('PHRASES').forEach(p => { add(p.en); add(p.ex); });
get('PATTERNS').forEach(p => p.examples.forEach(e => add(e.en)));
get('WRITE_TASKS').forEach(t => add(t.ref));
get('SPEAK_TASK').frames.forEach(add);
get('LISTEN_SENTS').forEach(add);
get('PASSAGES').forEach(p => p.sents.forEach(add));
get('SEED_SRS').forEach(s => add(s.en));
add(get('SALLY_TEXT'));
get('UNIT_TEXT').forEach(sec => sec.lines.forEach(l => add(l.en)));
get('STORY_TF').forEach(t => add(t.s));
fs.writeFileSync('/home/ubun/work/unit3/tools/tts_texts.json', JSON.stringify([...texts], null, 1));
console.log('待合成文本:', texts.size, '条');
