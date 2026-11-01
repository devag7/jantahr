// Writes the SRT from the same cue builder the burned-in captions use: node scripts/srt.mjs out/jantahr-pitch.srt
import { buildSync } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const outFile = process.argv[2] || 'out/jantahr-pitch.srt';
const tmp = path.resolve('build/cues.mjs');
buildSync({ entryPoints: ['src/cues.ts'], bundle: true, format: 'esm', platform: 'node', outfile: tmp, logLevel: 'error' });
const { buildCues, toSrt } = await import(tmp);
const durations = JSON.parse(fs.readFileSync('public/audio/vo-durations.json', 'utf8'));
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, toSrt(buildCues(durations)));
console.log('wrote', outFile);
