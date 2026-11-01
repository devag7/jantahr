import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { easeInOut, tween } from '../theme';
import { Chip, Outline, RingReveal, ScaledCard, Shot, Tap, rise } from '../ui';
import { Beat, PhoneOnStage, Screens, StageBackground, usePhoneStage } from '../stage';

/** Beat starts inside this 30-second scene (frames at 30 fps). */
export const EMP = { checkin: 0, calendar: 210, leave: 390, payslip: 630, notify: 810, end: 900 };

/** 20–50 s. The employee app: check in, the month, leave with "days left after this", payslips, notifications. */
export const Employee: React.FC = () => {
  const frame = useCurrentFrame();
  const st = usePhoneStage();
  const { side, chip, landscape } = st;

  // calendar rows tint in, top to bottom (grey copies of the real screen fade away)
  const rows = [1296, 1434, 1572, 1710, 1848];
  const calendarTint = rows.map((yc, i) => (
    <div key={i} style={{ position: 'absolute', left: 60, top: yc - 66, width: 960, height: 132, overflow: 'hidden', opacity: 1 - tween(frame, EMP.calendar + 26 + i * 11, EMP.calendar + 46 + i * 11) }}>
      <Img src={staticFile('phone/employee-attendance.webp')} style={{ position: 'absolute', left: -60, top: -(yc - 66), width: 1080, filter: 'grayscale(1) contrast(0.9) brightness(1.04)' }} />
    </div>
  ));

  // payslip bars rise: a white cover over the chart shrinks upwards from the baseline
  const bars = tween(frame, EMP.payslip + 18, EMP.payslip + 62, 0, 1, easeInOut);
  const barCover = <div style={{ position: 'absolute', left: 70, top: 596, width: 940, height: 212 * (1 - bars), background: '#FFFFFF' }} />;

  // the real "Checked in" hero, captured from the same app, laid over the emulator frame
  const checkedIn = <Shot src="phone/checked-in-strip.webp" y={355} w={1080} opacity={tween(frame, 74, 84)} />;

  // a push banner drops in over Home
  const push = (
    <div style={{ position: 'absolute', left: 42, top: 0, width: 996, translate: `0px ${tween(frame, EMP.notify + 16, EMP.notify + 40, -260, 130)}px` }}>
      <div style={{ borderRadius: 52, overflow: 'hidden', boxShadow: '0 30px 60px rgba(18,26,51,0.25)' }}>
        <Img src={staticFile('cards/notif-leave-approved.webp')} style={{ width: 996, display: 'block' }} />
      </div>
    </div>
  );

  const screens = [
    { src: 'phone/employee-home.webp', from: 0, overlay: <>{checkedIn}<Tap x={740} y={526} at={70} size={150} /></> },
    { src: 'phone/employee-attendance.webp', from: EMP.calendar - 12, overlay: <>{calendarTint}<Outline x={70} y={952} w={940} h={150} at={EMP.calendar + 96} until={EMP.leave - 30} r={36} /></> },
    { src: 'phone/apply-leave-preview.webp', from: EMP.leave - 12, overlay: <Outline x={42} y={1797} w={996} h={268} at={EMP.leave + 78} until={EMP.payslip - 20} r={52} /> },
    { src: 'phone/employee-payslips.webp', from: EMP.payslip - 12, overlay: barCover },
    { src: 'phone/employee-home-checked-in.webp', from: EMP.notify - 12, overlay: push },
  ].map((s, i, a) => ({ ...s, to: a[i + 1]?.from ?? EMP.end }));

  const card = (at: number, until: number) => ({ ...rise(frame, at, 20, 50), opacity: tween(frame, at, at + 14) * (1 - tween(frame, until, until + 12, 0, 1, easeInOut)) });
  const prevW = landscape ? side.w : side.w;

  return (
    <AbsoluteFill>
      <StageBackground fromCobalt />
      <PhoneOnStage enter>
        <Screens screens={screens} />
      </PhoneOnStage>

      {/* check-in: what the tap did, and what the company can require */}
      <Chip icon="check" text="Checked in" at={86} size={chip} out={EMP.calendar - 16} style={landscape ? { left: side.x, top: 300 * st.u } : { left: 60, top: 1080 }} />
      <Chip icon="pin" text="Geo-fenced office" at={102} size={chip} out={EMP.calendar - 16} style={landscape ? { left: side.x + 40 * st.u, top: 410 * st.u } : { left: 100, top: 1190 }} />
      <Chip icon="camera" text="Optional selfie" at={118} size={chip} out={EMP.calendar - 16} style={landscape ? { left: side.x, top: 520 * st.u } : { left: 60, top: 1300 }} />

      {/* leave: balances fill in, then the live preview before applying */}
      <ScaledCard src="cards/leave-left.webp" nw={1004} nh={356} w={side.w} x={side.x} y={landscape ? 200 * st.u : 650} radius={44} style={card(EMP.leave + 8, EMP.leave + 150)}>
        {[130, 466, 802].map((cx, i) => <RingReveal key={i} src="cards/leave-left.webp" imgW={1004} cx={cx} cy={132} r={96} at={EMP.leave + 20 + i * 8} dur={36} />)}
      </ScaledCard>
      <ScaledCard src="cards/leave-preview.webp" nw={996} nh={268} w={prevW} x={side.x} y={landscape ? 600 * st.u : 1180} radius={52} style={card(EMP.leave + 92, EMP.payslip - 16)}>
        <RingReveal src="cards/leave-preview.webp" imgW={996} cx={120} cy={131} r={84} at={EMP.leave + 104} dur={30} bg="#E8EEFC" />
      </ScaledCard>

      {/* payslip: the take-home and deductions split */}
      <ScaledCard src="cards/payslip-split.webp" nw={996} nh={430} w={side.w} x={side.x} y={landscape ? 420 * st.u : 1120} radius={52} style={card(EMP.payslip + 70, EMP.notify - 16)}>
        <div style={{ position: 'absolute', left: 39 + 925 * tween(frame, EMP.payslip + 84, EMP.payslip + 120, 0, 1, easeInOut), top: 280, width: 940, height: 52, background: '#FFFFFF' }} />
      </ScaledCard>

      <Chip icon="bell" text="Leave approved" at={EMP.notify + 30} size={chip} out={EMP.end - 4} style={landscape ? { left: side.x, top: 300 * st.u } : { left: 60, top: 1100 }} />

      <Beat title="Check in with one tap." sub="Geo-fenced offices and an optional selfie." at={18} out={EMP.calendar - 16} />
      <Beat title="Your month at a glance." sub="Present, leave, half days and late marks, in colour." at={EMP.calendar + 12} out={EMP.leave - 16} />
      <Beat title="Know what is left before you apply." sub="Live balances for every leave type." at={EMP.leave + 8} out={EMP.payslip - 16} />
      <Beat title="Payday, on your phone." sub="Take-home and every deduction, clearly split." at={EMP.payslip + 12} out={EMP.notify - 16} />
      <Beat title="Hear back the moment it is decided." sub="Push alerts for approvals and payslips." at={EMP.notify + 8} out={EMP.end + 20} />
    </AbsoluteFill>
  );
};
