import React from 'react';
import { Composition, Folder, continueRender, delayRender, staticFile } from 'remotion';
import { PITCH_FRAMES, Pitch, pitchSchema, type PitchProps } from './Pitch';
import { TEASER_FRAMES, Teaser } from './Teaser';
import { fontsReady } from './theme';
import { defaultClaims } from './script';

const fonts = delayRender('Inter');
fontsReady.then(() => continueRender(fonts));

const base: PitchProps = { ...defaultClaims, audio: false, durations: {}, musicVolume: 0.16 };

/** Reads the measured voiceover durations (written by scripts/measure-vo.mjs), so captions follow the real audio. */
const withDurations = async ({ props }: { props: PitchProps }) => {
  try {
    const res = await fetch(staticFile('audio/vo-durations.json'));
    if (res.ok) return { props: { ...props, durations: await res.json() } };
  } catch {
    /* no voiceover yet: captions use an estimate */
  }
  return { props };
};

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="Pitch">
      <Composition id="Pitch16x9" component={Pitch} schema={pitchSchema} calculateMetadata={withDurations} durationInFrames={PITCH_FRAMES} fps={30} width={1920} height={1080} defaultProps={base} />
      <Composition id="Pitch9x16" component={Pitch} schema={pitchSchema} calculateMetadata={withDurations} durationInFrames={PITCH_FRAMES} fps={30} width={1080} height={1920} defaultProps={{ ...base, captions: true }} />
    </Folder>
    <Folder name="Teaser">
      <Composition id="Teaser16x9" component={Teaser} schema={pitchSchema} durationInFrames={TEASER_FRAMES} fps={30} width={1920} height={1080} defaultProps={base} />
      <Composition id="Teaser9x16" component={Teaser} schema={pitchSchema} durationInFrames={TEASER_FRAMES} fps={30} width={1080} height={1920} defaultProps={base} />
    </Folder>
  </>
);
