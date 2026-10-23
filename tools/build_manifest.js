/* 生成 audio/manifest.js：文本(规范化) -> 音频路径 */
const fs = require('fs'), crypto = require('crypto');
const ROOT = '/home/ubun/work/unit3';
const texts = JSON.parse(fs.readFileSync(ROOT + '/tools/tts_texts.json', 'utf8'));
const map = {};
let ok = 0, miss = [];
for (const t of texts) {
  const h = crypto.createHash('sha1').update(t).digest('hex').slice(0, 16);
  const f = 'audio/' + h + '.mp3';
  if (fs.existsSync(ROOT + '/' + f) && fs.statSync(ROOT + '/' + f).size > 1500) { map[t] = f; ok++; }
  else miss.push(t);
}
fs.writeFileSync(ROOT + '/audio/manifest.js', 'window.OFFLINE_AUDIO = ' + JSON.stringify(map) + ';\n');
console.log('manifest 条目:', ok, '缺失:', miss.length, miss.slice(0, 3));
