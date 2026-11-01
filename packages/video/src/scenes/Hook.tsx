import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C, FONT, easeInOut, tween } from '../theme';
import { Headline, useFormat } from '../ui';

/** 0–10 s. The old way: payroll in spreadsheets, leave on chat, deadlines from memory. Illustrations, not product UI. */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { W, H, landscape, u } = useFormat();
  // everything collapses to the centre at the end, into the logo reveal
  const collapse = tween(frame, 262, 296, 0, 1, easeInOut);
  const textOut = 1 - tween(frame, 250, 268, 0, 1, easeInOut);

  const cards: { el: React.ReactNode; x: number; y: number; w: number; rot: number; at: number }[] = landscape
    ? [
        { el: <Sheet />, x: 930, y: 150, w: 600, rot: -3, at: 8 },
        { el: <Chat />, x: 1400, y: 300, w: 400, rot: 2.5, at: 92 },
        { el: <Dues />, x: 1010, y: 610, w: 400, rot: 2, at: 176 },
        { el: <Register />, x: 1430, y: 690, w: 360, rot: -2, at: 196 },
      ]
    : [
        { el: <Sheet />, x: 70, y: 760, w: 640, rot: -3, at: 8 },
        { el: <Chat />, x: 560, y: 980, w: 450, rot: 2.5, at: 92 },
        { el: <Dues />, x: 110, y: 1290, w: 450, rot: 2, at: 176 },
        { el: <Register />, x: 590, y: 1440, w: 400, rot: -2, at: 196 },
      ];

  const lines = ['Payroll in spreadsheets.', 'Leave on chat.', 'Deadlines from memory.'];
  const lineAt = [18, 100, 182];
  const hs = landscape ? 92 : 86;

  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 70% 40%, #1A2448 0%, ${C.ink} 60%, #0C1229 100%)` }}>
      {cards.map((c, i) => {
        const inP = tween(frame, c.at, c.at + 22);
        const drift = Math.sin((frame + i * 40) / 70) * 6;
        const cx = c.x + c.w / 2;
        const tx = (W / 2 - cx) * collapse;
        const ty = (H / 2 - (c.y + 120 * u)) * collapse;
        return (
          <div key={i} style={{ position: 'absolute', left: c.x * (landscape ? u : 1), top: c.y * (landscape ? u : 1), width: c.w * (landscape ? u : 1), opacity: inP * (1 - collapse), rotate: `${c.rot * (1 - collapse)}deg`, translate: `${tx}px ${ty + (1 - inP) * 40 + drift}px`, scale: String((0.96 + 0.04 * inP) * (1 - 0.8 * collapse)) }}>
            {c.el}
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: landscape ? 140 * u : 80, top: landscape ? 330 * u : 230, width: landscape ? 760 * u : 920, opacity: textOut }}>
        {lines.map((l, i) => (
          <Headline key={l} text={l} at={lineAt[i]} size={hs * (landscape ? u : 1)} color={i === 2 ? '#FFFFFF' : 'rgba(255,255,255,0.9)'} style={{ marginBottom: 14 }} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const paper: React.CSSProperties = { background: '#FFFFFF', borderRadius: 18, boxShadow: '0 30px 80px rgba(0,0,0,0.45)', fontFamily: FONT, color: C.ink, overflow: 'hidden' };
const alert: React.CSSProperties = { position: 'absolute', top: -14, right: -14, minWidth: 44, height: 44, borderRadius: 99, background: C.danger, color: '#fff', fontWeight: 600, fontSize: 22, display: 'grid', placeItems: 'center', padding: '0 10px' };

const Sheet: React.FC = () => {
  const rows = [
    ['Aarav M', '48,500', '1,800', '-', '12,424'],
    ['Priya N', '41,000', '1,800', '-', '#REF!'],
    ['Rohan K', '36,250', '1,800', '?', '9,145'],
    ['Neha S', '52,400', '1,800', '-', '17,349'],
    ['Karan P', '28,900', '1,800', '682', '??'],
  ];
  return (
    <div style={{ position: 'relative' }}>
      <div style={paper}>
        <div style={{ padding: '18px 22px', background: '#E9EDF5', fontSize: 22, fontWeight: 600, color: C.secondary }}>Salary_Oct_FINAL_v3 (2).xlsx</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 0.8fr 0.6fr 1fr', fontSize: 21 }}>
          {['Name', 'Basic', 'PF', 'ESI', 'TDS'].map((h) => <div key={h} style={{ padding: '10px 14px', fontWeight: 600, borderBottom: `1px solid ${C.border}`, background: '#F7F8FB' }}>{h}</div>)}
          {rows.flat().map((v, i) => (
            <div key={i} style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, color: v.startsWith('#') || v.includes('?') ? C.danger : C.ink, background: v.startsWith('#') || v.includes('?') ? '#FDECEE' : undefined, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
          ))}
        </div>
      </div>
      <div style={alert}>3</div>
    </div>
  );
};

const Chat: React.FC = () => {
  const msgs = ['Is my leave for Friday approved?', 'When will payslips come?', 'Please fix my attendance for the 12th', 'When do we get Form 16?'];
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ ...paper, background: '#EEF1F6', padding: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: C.secondary, marginBottom: 12 }}>Office group (48)</div>
        {msgs.map((m, i) => (
          <div key={i} style={{ background: '#FFFFFF', borderRadius: 16, padding: '12px 16px', fontSize: 21, marginBottom: 10, width: 'fit-content', maxWidth: '92%', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>{m}</div>
        ))}
      </div>
      <div style={alert}>128</div>
    </div>
  );
};

const Dues: React.FC = () => {
  const due = [['PF ECR', '15th'], ['ESI', '15th'], ['TDS', '7th'], ['Professional tax', '?']];
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ ...paper, background: '#FFF6D9', padding: '20px 24px' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#7A5A00', marginBottom: 10 }}>Don't forget!!</div>
        {due.map(([a, b]) => (
          <div key={a} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, padding: '6px 0', borderBottom: '1px dashed rgba(122,90,0,0.25)' }}>
            <span>{a}</span><span style={{ fontWeight: 600, color: b === '?' ? C.danger : C.ink }}>{b}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Register: React.FC = () => (
  <div style={{ ...paper, padding: '18px 20px' }}>
    <div style={{ fontSize: 22, fontWeight: 600, color: C.secondary, marginBottom: 12 }}>Attendance register, Oct</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 6 }}>
      {Array.from({ length: 40 }).map((_, i) => {
        const v = [3, 11, 17, 26, 29, 34].includes(i) ? '' : [7, 21].includes(i) ? '?' : '✓';
        return <div key={i} style={{ height: 26, borderRadius: 6, background: v === '✓' ? '#E7F4EE' : v === '?' ? '#FDECEE' : '#F1F3F8', color: v === '?' ? C.danger : C.success, fontSize: 16, display: 'grid', placeItems: 'center' }}>{v}</div>;
      })}
    </div>
  </div>
);
