import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { C, FONT, easeInOut, tween } from '../theme';
import { Headline, Icon, Rings, rise, useFormat } from '../ui';
import type { Claims } from '../script';

/** 100–112 s. Proof points, each one checked in the code (see README, "Claims and sources"). */
export const Trust: React.FC<{ claims: Claims }> = ({ claims }) => {
  const frame = useCurrentFrame();
  const { W, H, landscape, u } = useFormat();
  const tiles: { icon: React.ReactNode; title: string; sub: string; at: number }[] = [
    { icon: <Icon name="phone" size={44} color={C.ice} />, title: 'Android app', sub: claims.playLive ? 'On Google Play' : 'For employees and managers', at: 20 },
    { icon: <div style={{ width: 44, height: 44, borderRadius: 99, background: '#fff', display: 'grid', placeItems: 'center' }}><Img src={staticFile('brand/google-g.png')} style={{ width: 28 }} /></div>, title: 'Sign in with Google', sub: 'On every plan', at: 90 },
    { icon: <Icon name="card" size={44} color={C.ice} />, title: 'Billing by Razorpay', sub: claims.gstInvoices ? 'With GST tax invoices' : 'Monthly or yearly, per employee', at: 128 },
    { icon: <Icon name="globe" size={44} color={C.ice} />, title: 'Data hosted in India', sub: 'Mumbai region', at: 166 },
    { icon: <Icon name="lock" size={44} color={C.ice} />, title: 'Encrypted field by field', sub: 'PAN, Aadhaar and bank details', at: 212 },
    { icon: <Icon name="rupee" size={44} color={C.ice} />, title: 'Made for Indian payroll', sub: 'PF, ESI, PT, LWF, TDS, labour codes', at: 262 },
  ];
  const cols = landscape ? 3 : 2;
  const tw = landscape ? 500 * u : 450;
  const th = landscape ? 190 * u : 230;
  const gap = landscape ? 36 * u : 30;
  const gx = (W - (cols * tw + (cols - 1) * gap)) / 2;
  const gy = landscape ? 400 * u : 620;
  const out = 1 - tween(frame, 344, 360, 0, 1, easeInOut);

  return (
    <AbsoluteFill style={{ background: `radial-gradient(110% 90% at 50% 0%, ${C.cobalt} 0%, ${C.deep} 75%)` }}>
      <div style={{ opacity: tween(frame, 0, 20) }}>
        <Rings cx={W / 2} cy={H * 0.08} base={300 * u} gap={170 * u} count={7} opacity={0.12} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: landscape ? 150 * u : 220, opacity: out }}>
        <Headline text="Made for India. Built to be trusted." at={6} size={landscape ? 76 * u : 76} color="#fff" align="center" style={{ padding: '0 60px' }} />
      </div>
      {tiles.map((t, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        return (
          <div key={t.title} style={{ position: 'absolute', left: gx + c * (tw + gap), top: gy + r * (th + gap), width: tw, height: th, borderRadius: 28, background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.16)', padding: landscape ? 32 * u : 32, boxSizing: 'border-box', fontFamily: FONT, ...rise(frame, t.at, 20, 30), opacity: tween(frame, t.at, t.at + 14) * out }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(169,231,255,0.14)', display: 'grid', placeItems: 'center' }}>{t.icon}</div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: landscape ? 34 * u : 36, marginTop: 18 }}>{t.title}</div>
            <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: landscape ? 26 * u : 28, marginTop: 6 }}>{t.sub}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
