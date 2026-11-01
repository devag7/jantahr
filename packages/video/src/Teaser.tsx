import React from 'react';
import { AbsoluteFill, Sequence, Series, staticFile } from 'remotion';
import { Audio } from '@remotion/media';
import type { PitchProps } from './Pitch';
import { Logo } from './scenes/Logo';
import { EMP, Employee } from './scenes/Employee';
import { WEB, Web } from './scenes/Web';
import { Cta } from './scenes/Cta';

export const TEASER_FRAMES = 450;

/** Plays `children` (a full scene) from its own frame `start`, for `dur` frames. */
const Clip: React.FC<{ start: number; children: React.ReactNode }> = ({ start, children }) => (
  <Sequence from={-start} layout="absolute-fill">{children}</Sequence>
);

/** 15 s: the mark, one-tap check-in, the leave preview, statutory files, the offer. */
export const Teaser: React.FC<PitchProps> = (p) => {
  const claims = { playLive: p.playLive, gstInvoices: p.gstInvoices, captions: false };
  return (
    <AbsoluteFill style={{ backgroundColor: '#121A33' }}>
      <Series>
        <Series.Sequence name="Logo" durationInFrames={105}><Clip start={12}><Logo /></Clip></Series.Sequence>
        <Series.Sequence name="Check in" durationInFrames={90}><Clip start={EMP.checkin + 12}><Employee /></Clip></Series.Sequence>
        <Series.Sequence name="Leave" durationInFrames={90}><Clip start={EMP.leave + 30}><Employee /></Clip></Series.Sequence>
        <Series.Sequence name="Statutory" durationInFrames={75}><Clip start={WEB.statutory + 40}><Web /></Clip></Series.Sequence>
        <Series.Sequence name="CTA" durationInFrames={90}><Cta claims={claims} /></Series.Sequence>
      </Series>
      {p.audio && <Audio src={staticFile('audio/music.mp3')} volume={(f) => p.musicVolume * 1.4 * Math.min(1, f / 15) * Math.min(1, (TEASER_FRAMES - f) / 30)} />}
    </AbsoluteFill>
  );
};
