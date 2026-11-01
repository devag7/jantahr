import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { C, FONT, easeInOut, tween } from '../theme';
import { Headline, Icon, Rings, Sub, rise, useFormat } from '../ui';
import { beat, sceneFrames, type Claims } from '../script';

export const PROOF = { proof: 0, open: beat('proof', 'opensource'), end: sceneFrames('proof') };

/** Numbers counted from the code on 2 Nov 2026 (see README, "Claims and sources"). */
const NUMBERS = [
  { n: 210, label: 'automated tests, all passing' },
  { n: 291, label: 'API endpoints' },
  { n: 76, label: 'data models' },
  { n: 18, label: 'MIS reports' },
];

const COMMAND = './jantahr.sh setup && ./jantahr.sh up';

/** Proof numerals, then open source: one command to self-host, or the cloud hosted in India. */
export const Proof: React.FC<{ claims: Claims }> = ({ claims }) => {
  const frame = useCurrentFrame();
  const { W, H, landscape, u } = useFormat();
  const k = landscape ? u : 1;
  const numbersOut = 1 - tween(frame, PROOF.open - 24, PROOF.open - 6, 0, 1, easeInOut);
  const exit = 1;
  const typed = Math.round(interpolate(frame, [PROOF.open + 120, PROOF.open + 190], [0, COMMAND.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));

  const tiles: { icon: React.ReactNode; title: string; sub: string; at: number }[] = [
    { icon: <Icon name="globe" size={40} color={C.ice} />, title: 'Cloud hosted in India', sub: 'Mumbai region', at: PROOF.open + 60 },
    { icon: <Icon name="phone" size={40} color={C.ice} />, title: 'Android app', sub: claims.playLive ? 'On Google Play' : 'For employees and managers', at: PROOF.open + 76 },
    { icon: <div style={{ width: 40, height: 40, borderRadius: 99, background: '#fff', display: 'grid', placeItems: 'center' }}><Img src={staticFile('brand/google-g.png')} style={{ width: 24 }} /></div>, title: 'Sign in with Google', sub: 'On every plan', at: PROOF.open + 92 },
    { icon: <Icon name="lock" size={40} color={C.ice} />, title: 'Encrypted field by field', sub: 'PAN, Aadhaar, bank details', at: PROOF.open + 108 },
    { icon: <Icon name="card" size={40} color={C.ice} />, title: 'Billing by Razorpay', sub: claims.gstInvoices ? 'With GST tax invoices' : 'Per employee, monthly or yearly', at: PROOF.open + 124 },
    { icon: <Icon name="shield" size={40} color={C.ice} />, title: 'Two-factor and audit log', sub: 'Row-level security per company', at: PROOF.open + 140 },
  ];

  return (
    <AbsoluteFill style={{ background: `radial-gradient(110% 90% at 50% 0%, ${C.cobalt} 0%, ${C.deep} 75%)`, fontFamily: FONT }}>
      <Rings cx={W / 2} cy={H * 0.1} base={300 * k} gap={170 * k} count={7} opacity={0.12} />

      {/* proof */}
      <div style={{ opacity: numbersOut }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: landscape ? 150 * u : 260 }}>
          <Headline text="Built properly." at={4} size={(landscape ? 80 : 84) * k} color="#fff" align="center" />
          <div style={{ display: 'flex', justifyContent: 'center' }}><Sub text="Every statutory rule links to its notification." at={18} size={(landscape ? 34 : 38) * k} color="rgba(255,255,255,0.78)" /></div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: landscape ? 470 * u : 720, display: 'grid', gridTemplateColumns: landscape ? 'repeat(4, auto)' : 'repeat(2, auto)', justifyContent: 'center', columnGap: (landscape ? 90 : 80) * k, rowGap: 70 }}>
          {NUMBERS.map((x, i) => {
            const at = 14 + i * 14;
            const v = Math.round(interpolate(frame, [at, at + 34], [0, x.n], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeInOut }));
            return (
              <div key={x.label} style={{ textAlign: 'center', ...rise(frame, at, 18, 30) }}>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: (landscape ? 150 : 140) * k, letterSpacing: -4, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                <div style={{ color: C.ice, fontSize: (landscape ? 28 : 32) * k, marginTop: 14 }}>{x.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* open source */}
      {frame >= PROOF.open - 6 && (
        <div style={{ opacity: exit }}>
          <div style={{ position: 'absolute', left: landscape ? 130 * u : 80, top: landscape ? 120 * u : 200, width: landscape ? 780 * u : 920 }}>
            <Headline text="Open source. Yours to run." at={PROOF.open} size={(landscape ? 76 : 80) * k} color="#fff" />
            <Sub text="AGPL-3.0. Every feature, no seat limit, no licence key." at={PROOF.open + 14} size={(landscape ? 32 : 38) * k} color="rgba(255,255,255,0.78)" style={{ marginTop: 14 }} />
          </div>
          {/* the real one-command self-host, from deploy/self-hosted/README.md */}
          <div style={{ position: 'absolute', left: landscape ? 130 * u : 80, top: landscape ? 470 * u : 620, width: landscape ? 780 * u : 920, borderRadius: 22, overflow: 'hidden', background: '#0B1022', boxShadow: '0 40px 100px rgba(5,10,40,0.45)', ...rise(frame, PROOF.open + 20, 20, 40) }}>
            <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 22, background: '#141B33' }}>
              {[0, 1, 2].map((i) => <div key={i} style={{ width: 14, height: 14, borderRadius: 99, background: '#2A3357' }} />)}
              <div style={{ marginLeft: 16, color: '#A3ABC4', fontSize: 20 }}>jantahr/deploy/self-hosted</div>
            </div>
            <div style={{ padding: '30px 30px 34px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: (landscape ? 25 : 27) * k, color: '#EEF1FA', lineHeight: 1.6 }}>
              <div style={{ color: '#7D86A3' }}># Supabase + Postgres 17 + OrioleDB + JantaHR</div>
              <div><span style={{ color: C.ice }}>$ </span>{COMMAND.slice(0, typed)}<span style={{ opacity: frame % 30 < 15 ? 1 : 0, color: C.ice }}>▍</span></div>
              <div style={{ color: '#7D86A3', opacity: tween(frame, PROOF.open + 200, PROOF.open + 214) }}># then open http://localhost:3000 and create your company</div>
            </div>
          </div>
          <div style={{ position: 'absolute', left: landscape ? 990 * u : 80, top: landscape ? 160 * u : 1060, width: landscape ? 800 * u : 920, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 22 }}>
            {tiles.map((t) => (
              <div key={t.title} style={{ borderRadius: 24, background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.16)', padding: landscape ? 26 * u : 26, ...rise(frame, t.at, 18, 26), opacity: tween(frame, t.at, t.at + 12) }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(169,231,255,0.14)', display: 'grid', placeItems: 'center' }}>{t.icon}</div>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: (landscape ? 30 : 32) * k, marginTop: 14 }}>{t.title}</div>
                <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: (landscape ? 24 : 26) * k, marginTop: 4 }}>{t.sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
