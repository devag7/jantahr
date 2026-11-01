// Masters the audio of a rendered video in place: two-pass loudnorm to -14 LUFS, -1 dBTP (streaming targets).
// The picture is copied untouched.   node scripts/master-audio.mjs out/a.mp4 [out/b.mp4 ...]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const TARGET = { I: -14, TP: -1, LRA: 11 };
for (const file of process.argv.slice(2)) {
  const first = execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostats -i "$0" -af loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:print_format=json -f null - 2>&1`, file], { encoding: 'utf8' });
  const m = JSON.parse(first.slice(first.lastIndexOf('{'), first.lastIndexOf('}') + 1));
  const filter = `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,alimiter=limit=0.83:level=false:attack=1:release=50`;
  const tmp = file.replace(/\.mp4$/, '.mastering.mp4');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', file, '-map', '0:v', '-map', '0:a', '-c:v', 'copy', '-af', filter, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', tmp]);
  fs.renameSync(tmp, file);
  const after = execFileSync('sh', ['-c', 'ffmpeg -hide_banner -nostats -i "$0" -af ebur128=peak=true -f null - 2>&1 | tail -20', file], { encoding: 'utf8' });
  const I = after.match(/I:\s+(-?[\d.]+) LUFS/g)?.pop();
  const P = after.match(/Peak:\s+(-?[\d.]+) dBFS/g)?.pop();
  console.log(`${file}: was ${m.input_i} LUFS / ${m.input_tp} dBTP, now ${I}, true ${P}`);
}
