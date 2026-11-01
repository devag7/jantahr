// Word-level timestamps for a voiceover take, with a local whisper.cpp (free, offline).
//   node scripts/transcribe.mjs <take.mp3> <out.json>
// whisper.cpp and the model live outside the repo: WHISPER_DIR (default ~/.cache/jantahr-whisper).
import { downloadWhisperModel, installWhisperCpp, toCaptions, transcribe } from '@remotion/install-whisper-cpp';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [input, out] = process.argv.slice(2);
const to = process.env.WHISPER_DIR || path.join(os.homedir(), '.cache/jantahr-whisper');
const model = 'small.en';
await installWhisperCpp({ to, version: '1.5.5' });
await downloadWhisperModel({ model, folder: to });
const wav = path.join(os.tmpdir(), `vo-${Date.now()}.wav`);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', input, '-ar', '16000', '-ac', '1', wav]);
const whisperCppOutput = await transcribe({ model, whisperPath: to, whisperCppVersion: '1.5.5', inputPath: wav, tokenLevelTimestamps: true });
const { captions } = toCaptions({ whisperCppOutput });
fs.writeFileSync(out, JSON.stringify(captions, null, 1));
fs.unlinkSync(wav);
console.log(captions.map((c) => c.text).join('').trim());
