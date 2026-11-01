import React from 'react';
import { AbsoluteFill, Sequence, staticFile } from 'remotion';
import { Audio } from '@remotion/media';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { z } from 'zod';
import { FPS, sec, easeInOut } from './theme';
import { SCENES, TOTAL_SECONDS, VO, sceneFrames, type SceneKey } from './script';
import { Captions } from './captions';
import { buildCues } from './cues';
import { Hook } from './scenes/Hook';
import { Logo } from './scenes/Logo';
import { Employee } from './scenes/Employee';
import { Manager } from './scenes/Manager';
import { Web } from './scenes/Web';
import { Platform } from './scenes/Platform';
import { Proof } from './scenes/Proof';
import { Cta } from './scenes/Cta';

export const pitchSchema = z.object({
  playLive: z.boolean(),
  gstInvoices: z.boolean(),
  captions: z.boolean(),
  /** play the voiceover, music and sound effects (off for storyboard stills) */
  audio: z.boolean(),
  /** seconds per voiceover line, measured from the files (public/audio/vo-durations.json) */
  durations: z.record(z.string(), z.number()),
  /** music gain while the voice speaks; between lines it rises to `musicGap` */
  musicVolume: z.number(),
  musicGap: z.number(),
});
export type PitchProps = z.infer<typeof pitchSchema>;

export const PITCH_FRAMES = sec(TOTAL_SECONDS);
/** Every join is a 15-frame cross-fade. The outgoing scene runs 15 frames longer, so each scene still starts on its cue. */
export const XFADE = 15;

/** Quiet interface sounds at completions only (docs/PRODUCT.md). Times are absolute seconds. */
const SFX: { at: number; src: string; volume: number }[] = [
  { at: 9.7, src: 'audio/sfx/whoosh.mp3', volume: 0.22 },
  { at: SCENES.employee[0] + 70 / FPS, src: 'audio/sfx/tap.mp3', volume: 0.9 },
  { at: SCENES.employee[0] + 84 / FPS, src: 'audio/sfx/chime.mp3', volume: 0.22 },
  { at: SCENES.manager[0] + 40 / FPS, src: 'audio/sfx/tap.mp3', volume: 0.8 },
  { at: SCENES.manager[0] + 112 / FPS, src: 'audio/sfx/tap.mp3', volume: 0.9 },
  { at: SCENES.manager[0] + 124 / FPS, src: 'audio/sfx/chime.mp3', volume: 0.26 },
];

/** Spoken blocks: lines less than 1.5 s apart count as one, so the music never pumps in short pauses. */
const speechBlocks = (durations: Record<string, number>) => {
  const blocks: [number, number][] = [];
  for (const l of VO) {
    const s = l.at;
    const e = l.at + (durations[l.id] ?? l.text.split(' ').length / 2.5);
    const last = blocks[blocks.length - 1];
    if (last && s - last[1] < 1.5) last[1] = Math.max(last[1], e);
    else blocks.push([s, e]);
  }
  return blocks;
};

/** Music gain: `under` while speaking (duck 0.3 s ahead), easing up to `gap` over 0.9 s after a block ends. */
const musicGain = (f: number, under: number, gap: number, blocks: [number, number][]) => {
  const t = f / FPS;
  let speaking = 0;
  for (const [s, e] of blocks) {
    const attack = Math.min(1, Math.max(0, (t - (s - 0.3)) / 0.3));
    const release = Math.min(1, Math.max(0, (e + 0.9 - t) / 0.9));
    speaking = Math.max(speaking, Math.min(attack, release));
  }
  const shaped = easeInOut(speaking);
  const edge = Math.min(1, f / 20) * Math.min(1, (PITCH_FRAMES - f) / 15);
  return (gap + (under - gap) * shaped) * edge;
};

const ORDER: { key: SceneKey; name: string; el: (p: PitchProps) => React.ReactNode }[] = [
  { key: 'hook', name: 'Hook', el: () => <Hook /> },
  { key: 'logo', name: 'Logo and modules', el: () => <Logo /> },
  { key: 'employee', name: 'Employee app', el: () => <Employee /> },
  { key: 'manager', name: 'Manager', el: () => <Manager /> },
  { key: 'web', name: 'Payroll on the web', el: () => <Web /> },
  { key: 'platform', name: 'Whole platform', el: () => <Platform /> },
  { key: 'proof', name: 'Proof and open source', el: (p) => <Proof claims={p} /> },
  { key: 'cta', name: 'CTA', el: (p) => <Cta claims={p} /> },
];

export const Pitch: React.FC<PitchProps> = (p) => {
  const blocks = speechBlocks(p.durations);
  return (
    <AbsoluteFill style={{ backgroundColor: '#121A33' }}>
      <TransitionSeries>
        {ORDER.flatMap((s, i) => {
          const last = i === ORDER.length - 1;
          const items = [
            <TransitionSeries.Sequence key={s.key} name={s.name} durationInFrames={sceneFrames(s.key) + (last ? 0 : XFADE)}>
              {s.el(p)}
            </TransitionSeries.Sequence>,
          ];
          if (!last) items.push(<TransitionSeries.Transition key={`${s.key}-x`} presentation={fade()} timing={linearTiming({ durationInFrames: XFADE })} />);
          return items;
        })}
      </TransitionSeries>
      {p.captions && <Captions cues={buildCues(p.durations)} />}
      {p.audio && (
        <>
          <Audio src={staticFile('audio/music.mp3')} volume={(f) => musicGain(f, p.musicVolume, p.musicGap, blocks)} />
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
