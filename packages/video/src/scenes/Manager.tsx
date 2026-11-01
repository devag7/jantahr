import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C, FONT, easeInOut, tween } from '../theme';
import { Icon, Outline, RingReveal, ScaledCard, Tap, rise } from '../ui';
import { Beat, PhoneOnStage, Screens, StageBackground, usePhoneStage } from '../stage';
import { beat, sceneFrames } from '../script';

export const MGR = { approvals: 0, team: beat('manager', 'team'), end: sceneFrames('manager') };

/** The manager: approvals on the go, then who is in today. */
export const Manager: React.FC = () => {
  const frame = useCurrentFrame();
  const st = usePhoneStage();
  const { side, landscape, u } = st;

  const screens = [
    { src: 'phone/employee-home-checked-in.webp', from: 0 },
    { src: 'phone/manager-home.webp', from: 0, fade: 18, overlay: <><Outline x={22} y={1562} w={1036} h={196} at={8} until={52} r={52} /><Tap x={540} y={1660} at={40} size={150} /></> },
    { src: 'phone/manager-approvals.webp', from: 50, overlay: <Tap x={776} y={1058} at={112} size={150} /> },
    { src: 'phone/manager-team-local.webp', from: MGR.team - 12, overlay: <><RingReveal src="phone/manager-team-local.webp" imgW={1080} cx={208} cy={486} r={150} at={MGR.team + 24} dur={36} /><Outline x={40} y={1372} w={1000} h={166} at={MGR.team + 70} until={MGR.end - 26} r={40} color={C.success} /></> },
  ].map((s, i, a) => ({ ...s, to: a[i + 1]?.from ?? MGR.end }));

  const card = (at: number, until: number) => ({ ...rise(frame, at, 20, 50), opacity: tween(frame, at, at + 14) * (1 - tween(frame, until, until + 12, 0, 1, easeInOut)) });
  const toastAt = 124;

  return (
    <AbsoluteFill>
      <StageBackground />
      <PhoneOnStage>
        <Screens screens={screens} />
      </PhoneOnStage>

      <ScaledCard src="cards/approval-card.webp" nw={996} nh={653} w={side.w} x={side.x} y={landscape ? 230 * u : 1000} radius={52} style={card(62, MGR.team - 20)}>
        <Tap x={734} y={552} at={112} size={170} />
      </ScaledCard>

      {/* the app's own confirmation, word for word */}
      <div style={{ position: 'absolute', left: landscape ? side.x - 60 * u : side.x, top: landscape ? 640 * u : 900, display: 'flex', alignItems: 'center', gap: 16, padding: landscape ? `${18 * u}px ${28 * u}px` : '20px 30px', borderRadius: 999, background: C.ink, color: '#fff', fontFamily: FONT, fontWeight: 600, fontSize: landscape ? 28 * u : 34, whiteSpace: 'nowrap', ...rise(frame, toastAt, 16, 24), opacity: tween(frame, toastAt, toastAt + 10) * (1 - tween(frame, MGR.team - 24, MGR.team - 12)) }}>
        <div style={{ width: 44, height: 44, borderRadius: 99, background: C.success, display: 'grid', placeItems: 'center' }}><Icon name="check" size={30} color="#fff" draw={tween(frame, toastAt + 4, toastAt + 20)} /></div>
        Approved. They have been told.
      </div>

      <ScaledCard src="cards/team-summary.webp" nw={996} nh={337} w={side.w} x={side.x} y={landscape ? 200 * u : 1120} radius={52} style={card(MGR.team + 26, MGR.end - 28)}>
        <RingReveal src="cards/team-summary.webp" imgW={996} cx={166} cy={166} r={150} at={MGR.team + 36} dur={36} />
      </ScaledCard>
      <ScaledCard src="cards/team-list.webp" nw={996} nh={724} w={side.w} x={side.x} y={landscape ? 470 * u : 1500} radius={52} style={{ ...card(MGR.team + 70, MGR.end - 28), ...(landscape ? {} : { display: 'none' }) }} />

      <Beat title="Approve on the go." sub="Leave, attendance fixes and expenses, in one tap." at={8} out={MGR.team - 16} />
      <Beat title="See who is in today." sub="Your whole team at a glance, without a phone call." at={MGR.team + 10} out={MGR.end - 26} />
    </AbsoluteFill>
  );
};
