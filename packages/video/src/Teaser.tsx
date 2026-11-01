import React from 'react';
import { AbsoluteFill, Sequence, staticFile } from 'remotion';
import { Audio } from '@remotion/media';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import type { PitchProps } from './Pitch';
import { Logo } from './scenes/Logo';
import { EMP, Employee } from './scenes/Employee';
import { PLAT, Platform } from './scenes/Platform';
import { Cta } from './scenes/Cta';
import { beat } from './script';
import { sec } from './theme';

export const TEASER_FRAMES = 450;
const X = 10;

/** Plays a full scene from its own frame `start`. */
const Clip: React.FC<{ start: number; children: React.ReactNode }> = ({ start, children }) => (
  <Sequence from={-start} layout="absolute-fill">{children}</Sequence>
);

/** 15 s: the mark and name, one-tap check-in, the leave preview, the whole platform, the offer. Music only. */
export const Teaser: React.FC<PitchProps> = (p) => {
  const claims = { playLive: p.playLive, gstInvoices: p.gstInvoices, captions: false };
  // each clip starts where its beat starts, so headlines animate in rather than appearing half-done
  const clips: { name: string; dur: number; el: React.ReactNode }[] = [
    { name: 'Logo', dur: 118, el: <Logo /> },
    { name: 'Check in', dur: 96, el: <Clip start={EMP.checkin}><Employee /></Clip> },
    { name: 'Leave', dur: 96, el: <Clip start={EMP.leave - 14}><Employee /></Clip> },
    { name: 'Platform', dur: 96, el: <Clip start={PLAT.platform + 30}><Platform /></Clip> },
    { name: 'Offer', dur: 84, el: <Clip start={beat('cta', 'cta', 0.15) + 100}><Cta claims={claims} /></Clip> },
  ];
  return (
    <AbsoluteFill style={{ backgroundColor: '#121A33' }}>
      <TransitionSeries>
        {clips.flatMap((c, i) => {
          const items = [<TransitionSeries.Sequence key={c.name} name={c.name} durationInFrames={c.dur}>{c.el}</TransitionSeries.Sequence>];
          if (i < clips.length - 1) items.push(<TransitionSeries.Transition key={`${c.name}-x`} presentation={fade()} timing={linearTiming({ durationInFrames: X })} />);
          return items;
        })}
      </TransitionSeries>
      {p.audio && <Audio src={staticFile('audio/music.mp3')} trimBefore={sec(48)} volume={(f) => Math.min(1, f / 12) * Math.min(1, (TEASER_FRAMES - f) / 24)} />}
    </AbsoluteFill>
  );
};
