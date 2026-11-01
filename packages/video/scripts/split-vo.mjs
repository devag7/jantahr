// Splits the one-take voiceover into one file per script line, so each line can start on its own beat.
//   node scripts/split-vo.mjs <full-take.mp3> <words.json>
// Lines are found by their first two words in the whisper transcript (scripts/transcribe.mjs); each cut sits in the
// middle of the silence before the next line, and every line is normalised to -18 LUFS.
// Writes public/audio/vo/<id>.mp3 and public/audio/vo-durations.json, and reports any line longer than its slot.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [src, wordsFile] = process.argv.slice(2);
const norm = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, '');
const scriptTs = fs.readFileSync('src/script.ts', 'utf8');
const lines = [...scriptTs.matchAll(/\{ id: '([a-z]+)', at: ([\d.]+), text: '((?:[^'\\]|\\.)*)' \}/g)].map((m) => ({ id: m[1], at: Number(m[2]), text: m[3] }));
if (!src || !wordsFile || lines.length < 2) throw new Error('usage: node scripts/split-vo.mjs <take.mp3> <words.json>');

const probe = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
const total = probe(src);
// word timestamps from scripts/transcribe.mjs; each line starts at its own first two words
// whisper gives sub-word tokens ("J", "anta"); a token that starts with a space starts a new word
const words = [];
for (const c of JSON.parse(fs.readFileSync(wordsFile, 'utf8'))) {
  const w = norm(c.text);
  if (!w) continue;
  if (/^\s/.test(c.text) || !words.length) words.push({ w, s: c.startMs / 1000, e: c.endMs / 1000 });
  else Object.assign(words[words.length - 1], { w: words[words.length - 1].w + w, e: c.endMs / 1000 });
}
// "Janta HR" is one word in the script
for (let i = words.length - 2; i >= 0; i--) if (words[i].w === 'janta' && words[i + 1].w === 'hr') words.splice(i, 2, { w: 'jantahr', s: words[i].s, e: words[i + 1].e });
const same = (a, b) => { const x = a.slice(0, 4), y = b.slice(0, 4); return !!x && !!y && (x.startsWith(y) || y.startsWith(x)); };
let p = 0;
// whisper writes numbers as digits
const NUM = { eighteen: '18', fourteen: '14', two: '2', hundred: '00' };
const scriptWords = (t) => t.replace(/two hundred/gi, '200').split(/\s+/).map(norm).filter(Boolean).map((w) => NUM[w] ?? w);
// find a line by its first two words; if whisper misheard the first word, by its 2nd and 3rd (then step back one)
const firstIdx = lines.map((l) => {
  const w = scriptWords(l.text);
  for (const off of [0, 1]) {
    for (let j = p + off; j < words.length - 1; j++) if (same(words[j].w, w[off]) && same(words[j + 1].w, w[off + 1])) { p = j + 1; return j - off; }
  }
  throw new Error(`could not find the start of "${l.id}" in the transcript`);
});
// silences in the take (silencedetect reports on stderr)
const sd = execFileSync('sh', ['-c', 'ffmpeg -hide_banner -nostats -i "$0" -af silencedetect=noise=-40dB:d=0.12 -f null - 2>&1', src], { encoding: 'utf8' });
const sStart = [...sd.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
const sEnd = [...sd.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
const silences = sStart.map((s, i) => ({ s, e: sEnd[i] ?? total }));
// a line boundary is the middle of the silence nearest before the next line's first word (whisper times run late)
const boundary = (t) => {
  const near = silences.filter((x) => x.s < t + 0.15 && x.s > t - 1.6).sort((a, b) => b.e - b.s - (a.e - a.s))[0];
  return near ? { cutEnd: near.s + 0.12, cutStart: Math.max(near.s + 0.12, near.e - 0.15) } : { cutEnd: t - 0.06, cutStart: t - 0.06 };
};
const bounds = lines.map((_, i) => (i === 0 ? null : boundary(words[firstIdx[i]].s)));

fs.mkdirSync('public/audio/vo', { recursive: true });
const durations = {};
const report = [];
lines.forEach((l, i) => {
  const a = i === 0 ? Math.max(0, words[0].s - 0.15) : bounds[i].cutStart;
  const b = i === lines.length - 1 ? total : bounds[i + 1].cutEnd;
  const file = path.join('public/audio/vo', `${l.id}.mp3`);
  // trim, soften the edges, and bring every line to the same loudness
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', a.toFixed(3), '-to', b.toFixed(3), '-i', src, '-af', 'afade=t=in:d=0.015,areverse,afade=t=in:d=0.08,areverse,loudnorm=I=-18:TP=-2:LRA=11', '-ar', '44100', '-c:a', 'libmp3lame', '-q:a', '2', file]);
  const d = probe(file);
  durations[l.id] = Number(d.toFixed(3));
  const slot = (lines[i + 1]?.at ?? Infinity) - l.at;
  report.push(`${l.id.padEnd(10)} ${d.toFixed(2)}s  slot ${slot.toFixed(2)}s  ${d > slot - 0.25 ? 'TOO LONG' : 'ok'}   "${l.text.slice(0, 48)}…"`);
});
fs.writeFileSync('public/audio/vo-durations.json', JSON.stringify(durations, null, 2) + '\n');
console.log(`take ${total.toFixed(2)}s, ${words.length} words\n` + report.join('\n'));
