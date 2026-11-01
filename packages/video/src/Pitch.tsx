import React from 'react';
import { AbsoluteFill, Sequence, Series, staticFile } from 'remotion';
import { Audio } from '@remotion/media';
import { z } from 'zod';
import { FPS, sec } from './theme';
import { SCENES, VO } from './script';
import { Captions } from './captions';
import { buildCues } from './cues';
import { Hook } from './scenes/Hook';
import { Logo } from './scenes/Logo';
import { Employee } from './scenes/Employee';
import { Manager } from './scenes/Manager';
import { Web } from './scenes/Web';
import { Trust } from './scenes/Trust';
import { Cta } from './scenes/Cta';

export const pitchSchema = z.object({
  playLive: z.boolean(),
  gstInvoices: z.boolean(),
  captions: z.boolean(),
  /** play the voiceover, music and sound effects (off for storyboard stills) */
  audio: z.boolean(),
  /** seconds per voiceover line, measured from the files (public/audio/vo-durations.json) */
  durations: z.record(z.string(), z.number()),
  musicVolume: z.number(),
});
export type PitchProps = z.infer<typeof pitchSchema>;

const len = (k: keyof typeof SCENES) => sec(SCENES[k][1] - SCENES[k][0]);
export const PITCH_FRAMES = sec(120);

/** Quiet interface sounds at the moments something is done (docs/PRODUCT.md: delight only at completions). */
const SFX: { at: number; src: string; volume: number }[] = [
  { at: 9.1, src: 'audio/sfx/whoosh.mp3', volume: 0.35 },
  { at: 20 + 70 / FPS, src: 'audio/sfx/tap.mp3', volume: 0.45 },
  { at: 20 + 86 / FPS, src: 'audio/sfx/chime.mp3', volume: 0.2 },
  { at: 50 + 112 / FPS, src: 'audio/sfx/tap.mp3', volume: 0.4 },
  { at: 50 + 236 / FPS, src: 'audio/sfx/tap.mp3', volume: 0.45 },
  { at: 50 + 250 / FPS, src: 'audio/sfx/chime.mp3', volume: 0.25 },
];

/** Music sits at `level` under the voice and rises to 2x between lines, with 10-frame ramps. */
const musicVolume = (f: number, level: number, durations: Record<string, number>) => {
  const t = f / FPS;
  const under = Math.max(0, ...VO.map((l) => {
    const d = durations[l.id] ?? 0;
    const into = Math.min(1, (t - (l.at - 0.35)) / 0.35);
    const out = Math.min(1, (l.at + d + 0.4 - t) / 0.4);
    return Math.max(0, Math.min(into, out));
  }));
  const edge = Math.min(1, f / 30) * Math.min(1, (PITCH_FRAMES - f) / 75);
  return level * (2 - under) * edge;
};

export const Pitch: React.FC<PitchProps> = (p) => {
  const claims = { playLive: p.playLive, gstInvoices: p.gstInvoices, captions: p.captions };
  return (
    <AbsoluteFill style={{ backgroundColor: '#121A33' }}>
      <Series>
        <Series.Sequence name="Hook" durationInFrames={len('hook')}><Hook /></Series.Sequence>
        <Series.Sequence name="Logo" durationInFrames={len('logo')}><Logo /></Series.Sequence>
        <Series.Sequence name="Employee app" durationInFrames={len('employee')}><Employee /></Series.Sequence>
        <Series.Sequence name="Manager" durationInFrames={len('manager')}><Manager /></Series.Sequence>
        <Series.Sequence name="HR on the web" durationInFrames={len('web')}><Web /></Series.Sequence>
        <Series.Sequence name="Trust" durationInFrames={len('trust')}><Trust claims={claims} /></Series.Sequence>
        <Series.Sequence name="CTA" durationInFrames={len('cta')}><Cta claims={claims} /></Series.Sequence>
      </Series>
      {p.captions && <Captions cues={buildCues(p.durations)} />}
      {p.audio && (
        <>
          <Audio src={staticFile('audio/music.mp3')} volume={(f) => musicVolume(f, p.musicVolume, p.durations)} />
          {VO.map((l) => (
            <Sequence key={l.id} name={`VO ${l.id}`} from={sec(l.at)} layout="none">
              <Audio src={staticFile(`audio/vo/${l.id}.mp3`)} />
            </Sequence>
          ))}
          {SFX.map((s, i) => (
            <Sequence key={i} name="SFX" from={sec(s.at)} layout="none">
              <Audio src={staticFile(s.src)} volume={s.volume} />
            </Sequence>
          ))}
        </>
      )}
    </AbsoluteFill>
  );
};
