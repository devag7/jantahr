import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { C, easeInOut, tween } from '../theme';
import { Chip, Headline, Laptop, Outline, Rings, ScaledCard, Sub, rise, useFormat } from '../ui';
import { beat, sceneFrames } from '../script';

export const WEB = { payroll: 0, statutory: beat('web', 'statutory'), privacy: beat('web', 'privacy'), end: sceneFrames('web') };

/** HR and payroll on the website: a payroll run, statutory files, the compliance calendar, DPDP tools. */
export const Web: React.FC = () => {
  const frame = useCurrentFrame();
  const { W, landscape, u } = useFormat();
  const lw = landscape ? 1340 * u : 1000;
  const lx = landscape ? 500 * u : (W - lw) / 2;
  const ly = landscape ? 290 * u : 650;
  const chip = landscape ? 28 * u : 32;
  const enter = tween(frame, 0, 36);

  const scroll = tween(frame, WEB.statutory + 150, WEB.statutory + 190, 0, -560, easeInOut);
  const zoom = 1 + 0.05 * tween(frame, 20, WEB.statutory - 10, 0, 1, easeInOut);
  const privacyZoom = 1 + 0.04 * tween(frame, WEB.privacy, WEB.end, 0, 1, easeInOut);
  const show = (from: number, to: number) => (frame >= from - 1 && frame < to + 14 ? tween(frame, from, from + 14, 0, 1, easeInOut) : 0);

  const text = landscape ? { x: 110 * u, y: 70 * u, hs: 76 * u, ss: 34 * u, w: 1300 * u } : { x: 80, y: 190, hs: 80, ss: 40, w: 920 };
  const beat = (title: string, sub: string, at: number, out: number) =>
    frame >= at - 2 && frame <= out + 14 ? (
      <div style={{ position: 'absolute', left: text.x, top: text.y, width: text.w }}>
        <Headline text={title} at={at} out={out} size={text.hs} />
        <Sub text={sub} at={at + 14} out={out} size={text.ss} style={{ marginTop: 14 * (landscape ? u : 1) }} />
      </div>
    ) : null;

  const chips = (items: [string, Parameters<typeof Chip>[0]['icon']][], at: number, out: number) =>
    items.map(([t, icon], i) => {
      const style = landscape
        ? { left: 110 * u, top: 330 * u + i * 100 * u }
        : { left: 80 + (i % 2) * 470, top: 1360 + Math.floor(i / 2) * 110 };
      return <Chip key={t} icon={icon} text={t} at={at + i * 12} out={out} size={chip} style={style} />;
    });

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', inset: 0, background: C.bg }} />
      <Rings cx={W / 2} cy={ly + 500 * (landscape ? u : 0.6)} base={500} gap={180} count={5} color={C.cobalt} opacity={0.07} drift={0.25} />
      <Laptop x={lx} y={ly + (1 - enter) * 300} w={lw} style={{ opacity: enter }}>
        <div style={{ position: 'absolute', inset: 0, scale: String(zoom), transformOrigin: '0 0' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 1 - show(WEB.statutory - 12, WEB.privacy) }}>
            <Img src={staticFile('web/hr-payroll-run.webp')} style={{ width: 2880 }} />
            <Outline x={40} y={528} w={820} h={76} at={44} until={WEB.statutory - 20} r={20} stroke={8} />
            <Outline x={1448} y={640} w={684} h={208} at={110} until={WEB.statutory - 20} r={28} stroke={8} />
            <Outline x={48} y={1376} w={2784} h={86} at={170} until={WEB.statutory - 20} r={14} stroke={8} color={C.success} />
          </div>
        </div>
        <div style={{ position: 'absolute', inset: 0, opacity: show(WEB.statutory - 12, WEB.privacy) * (1 - show(WEB.privacy - 12, WEB.end + 99)) }}>
          <div style={{ position: 'absolute', left: 0, top: scroll, width: 2880 }}>
            <Img src={staticFile('web/hr-payroll-statutory-full.webp')} style={{ width: 2880 }} />
            <Outline x={48} y={648} w={1376} h={496} at={WEB.statutory + 30} until={WEB.privacy - 20} r={36} stroke={8} />
            <Outline x={1456} y={648} w={1376} h={496} at={WEB.statutory + 54} until={WEB.privacy - 20} r={36} stroke={8} />
            <Outline x={48} y={1180} w={1376} h={380} at={WEB.statutory + 78} until={WEB.privacy - 20} r={36} stroke={8} />
            <Outline x={1456} y={1180} w={1376} h={380} at={WEB.statutory + 102} until={WEB.privacy - 20} r={36} stroke={8} />
            <Outline x={1456} y={1600} w={1376} h={420} at={WEB.statutory + 196} until={WEB.privacy - 20} r={36} stroke={8} />
          </div>
        </div>
        <div style={{ position: 'absolute', inset: 0, opacity: show(WEB.privacy - 12, WEB.end + 99), scale: String(privacyZoom), transformOrigin: '0 0' }}>
          <Img src={staticFile('web/hr-privacy.webp')} style={{ width: 2880 }} />
          <Outline x={48} y={478} w={2784} h={190} at={WEB.privacy + 30} r={30} stroke={8} />
          <Outline x={48} y={712} w={900} h={84} at={WEB.privacy + 60} r={42} stroke={8} />
        </div>
      </Laptop>

      {chips([['PF', 'shield'], ['ESI', 'shield'], ['Professional tax', 'file'], ['LWF', 'file'], ['TDS', 'rupee'], ['Income-tax Act 2025', 'file'], ['Labour codes', 'file']], 60, landscape ? WEB.statutory - 20 : 186)}

      {/* employees compare the old and new regimes before they choose (real /me/tax view) */}
      <ScaledCard src="cards/tax-compare.webp" nw={1393} nh={525} w={landscape ? 900 * u : 1000} x={landscape ? 960 * u : 40} y={landscape ? 560 * u : 1370} radius={24} style={{ ...rise(frame, 200, 20, 60), opacity: tween(frame, 200, 214) * (1 - tween(frame, WEB.statutory - 24, WEB.statutory - 10, 0, 1, easeInOut)) }} />
      {chips([['PF ECR file', 'file'], ['ESI contribution', 'file'], ['PT register', 'file'], ['Bank advice', 'card'], ['Form 143 (24Q) extract', 'file']], WEB.statutory + 30, WEB.statutory + 200)}

      <ScaledCard src="cards/compliance-calendar.webp" nw={1393} nh={330} w={landscape ? 900 * u : 1000} x={landscape ? 420 * u : 40} y={landscape ? 760 * u : 1380} radius={24} style={{ ...rise(frame, WEB.statutory + 214, 20, 60), opacity: tween(frame, WEB.statutory + 214, WEB.statutory + 228) * (1 - tween(frame, WEB.privacy - 22, WEB.privacy - 8, 0, 1, easeInOut)) }} />

      {chips([['Consent', 'check'], ['Data requests', 'users'], ['Breach register', 'shield'], ['Retention and erasure', 'lock']], WEB.privacy + 40, WEB.end - 28)}

      {beat('Run payroll. Approve. Pay.', 'PF, ESI, PT, LWF and TDS, worked out every month.', 18, WEB.statutory - 16)}
      {beat('Filing files, ready with payroll.', 'Every due date on one compliance calendar. Validate with your CA, then file.', WEB.statutory + 8, WEB.privacy - 16)}
      {beat('DPDP privacy, built in.', 'Consent, data requests, breaches and erasure. On every plan.', WEB.privacy + 8, WEB.end - 26)}
    </AbsoluteFill>
  );
};
