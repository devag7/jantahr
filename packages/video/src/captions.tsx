import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, tween } from './theme';

import { type Cue } from './cues';
export { buildCues, toSrt } from './cues';
export type { Cue, Durations } from './cues';

/** Burned-in captions: one short line, bottom centre, on a soft ink pill. */
export const Captions: React.FC<{ cues: Cue[] }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const c = cues.find((q) => t >= q.start && t < q.end + 0.05);
  if (!c) return null;
  const landscape = width >= height;
  const o = tween(frame, c.start * fps, c.start * fps + 4);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: landscape ? 60 : 90, display: 'flex', justifyContent: 'center', opacity: o }}>
      <div style={{ maxWidth: landscape ? 1300 : 940, padding: '14px 28px', borderRadius: 18, background: 'rgba(18,26,51,0.82)', color: '#fff', fontFamily: FONT, fontWeight: 600, fontSize: landscape ? 40 : 46, lineHeight: 1.25, textAlign: 'center' }}>
        {c.text}
      </div>
    </div>
  );
};

export { C };
