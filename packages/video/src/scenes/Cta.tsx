import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C, FONT } from '../theme';
import { AppIcon, Headline, Rings, Sub, rise, useFormat } from '../ui';
import type { Claims } from '../script';

/** 112–120 s. The offer, the address, and (only once the listing is public) Google Play. */
export const Cta: React.FC<{ claims: Claims }> = ({ claims }) => {
  const frame = useCurrentFrame();
  const { W, H, landscape, u } = useFormat();
  const k = landscape ? u : 1;
  const iconSize = (landscape ? 170 : 200) * k;
  const top = H * (landscape ? 0.16 : 0.24);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 100% at 50% 30%, ${C.cobalt} 0%, ${C.deep} 80%)` }}>
      <Rings cx={W / 2} cy={top + iconSize / 2} base={170 * k} gap={130 * k} count={8} opacity={0.15} />
      <div style={{ position: 'absolute', left: 0, right: 0, top, display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: FONT }}>
        <div style={rise(frame, 0, 20, 30)}><AppIcon size={iconSize} /></div>
        <div style={{ height: 50 * k }} />
        <Headline text="Start your 14-day free trial" at={10} size={(landscape ? 96 : 84) * k} color="#fff" align="center" style={{ padding: '0 60px' }} />
        <div style={{ height: 40 * k }} />
        <div style={{ ...rise(frame, 30, 20, 24), padding: `${22 * k}px ${48 * k}px`, borderRadius: 999, background: '#fff', color: C.cobalt, fontWeight: 600, fontSize: 52 * k, letterSpacing: -0.5 }}>jantahr.devshipit.com</div>
        <div style={{ height: 34 * k }} />
        <Sub text={claims.playLive ? 'Free for up to 20 employees. Get the app on Google Play.' : 'Free for up to 20 employees. Android app included.'} at={48} size={34 * k} color="rgba(255,255,255,0.8)" />
      </div>
    </AbsoluteFill>
  );
};
