# JantaHR pitch video

A 2-minute pitch for investors, customers and the Play and website listings, built with [Remotion](https://www.remotion.dev)
from real product captures. It lives outside the pnpm workspace (see `pnpm-workspace.yaml`) and is never part of the app
builds; install it on its own with npm.

| Output | Composition | Size |
|---|---|---|
| `out/jantahr-pitch-16x9.mp4` | `Pitch16x9` | 1920x1080, 30 fps, 120 s |
| `out/jantahr-pitch-9x16.mp4` | `Pitch9x16` (captions burned in) | 1080x1920, 30 fps, 120 s |
| `out/jantahr-teaser-15s-16x9.mp4`, `-9x16.mp4` | `Teaser16x9`, `Teaser9x16` | 15 s, music only |
| `out/jantahr-pitch.srt` | from `src/cues.ts` | subtitles for the 120 s cut |
| `out/jantahr-poster.png` | `Pitch16x9`, frame 560 | poster frame |

Renders stay out of git (`out/` is ignored).

```bash
cd packages/video
npm install
npm run dev              # Remotion Studio
npm run render:16x9
npm run render:9x16
npm run render:teaser
npm run render:poster
npm run srt
```

## How it is put together

- `src/script.ts` is the single source for the voiceover lines and the second each one starts. Captions (burned in and
  SRT) are built from it by `src/cues.ts`, so script, audio and subtitles cannot drift apart.
- `src/scenes/` holds one file per beat: `Hook`, `Logo`, `Employee`, `Manager`, `Web`, `Trust`, `Cta`. Every scene lays
  itself out for both 16:9 and 9:16 (`useFormat()` in `src/ui.tsx`).
- `src/ui.tsx` has the building blocks: phone and laptop frames that place children in the screenshot's own pixels,
  floating cards cut from real screens, ring reveals, tap feedback, kinetic headlines, the J-HR mark drawn as strokes.
- Motion follows `docs/DESIGN.md`: ease-out only (`cubic-bezier(0.22, 1, 0.36, 1)`), no overshoot, quiet concentric
  rings, delight only at completions. Inter 400 and 600 from `public/fonts` (the app's own files). No em dashes on screen.

### Options that change what the video claims

Both default to what is true on 1 Nov 2026. Pass them as props, e.g. `--props='{"audio":true,"playLive":true}'`.

| Prop | Default | Turn on when |
|---|---|---|
| `playLive` | `false` | the Play listing is public (`play.google.com/store/apps/details?id=com.devshipit.jantahr` returns 200; on 1 Nov 2026 it returns 404). Shows "On Google Play" instead of "Android app included". |
| `gstInvoices` | `false` | `BILLING_SELLER_GSTIN` is set in production (the live `/api/billing/plans` reports `gstRate: 0`). Shows "With GST tax invoices" on the Razorpay tile. |
| `captions` | `false` (16:9), `true` (9:16) | burn subtitles into the picture |

## Footage: all real, nothing mocked

| Where | Source |
|---|---|
| Phone screens | `android-journey` artifact of the "Android app on an emulator" workflow, run 40359572557 (Pixel 6, 1080x2400) |
| "In since 6:30 pm / Check out", "2 days of Casual Leave, 4 days left after this", "1/4 in today" | the app's own web preview (`npx expo start --web`) against the local seeded stack, at phone size; the checked-in hero is laid over the emulator frame at the same pixels |
| HR web pages (payroll run, statutory files, compliance calendar, data protection) | `packages/frontend` on `localhost:3000` against `~/.jantahr-dev/stack/mobile-stack.sh` (local test database, auth test double, seeded demo company). Demo logins were never used against production. |
| Hook cards (spreadsheet, chat, sticky note, register) | illustrations of the old way, drawn in `src/scenes/Hook.tsx`; not JantaHR UI |

Captures sit in `public/phone`, `public/web` and `public/cards`. To refresh them, re-run the journey workflow and the
local stack, then crop as described in the scene files (coordinates are in screenshot pixels).

## Voiceover script

Voice: **Nishant, Professional Indian English** (ElevenLabs library voice `j33FKwn3yd055HQ1DQKY`), model `eleven_v4`,
one take of the whole script, split per line on whisper word timestamps (`scripts/transcribe.mjs`, `scripts/split-vo.mjs`).

| Starts | Line |
|---|---|
| 0:00.6 | Every month, growing Indian companies run payroll in spreadsheets, approve leave over chat, and chase PF, ESI and TDS deadlines from memory. |
| 0:11.2 | JantaHR brings it all into one place. HR and payroll, built for India. |
| 0:20.6 | Employees check in with one tap. Geo-fenced, with an optional selfie. |
| 0:27.4 | Their whole month is there at a glance. |
| 0:33.2 | Leave balances are always clear, and before they apply, JantaHR shows exactly how many days will be left. |
| 0:41.4 | On payday, the payslip is on their phone, with take-home and every deduction laid out. |
| 0:47.2 | And they hear back the moment a request is answered. |
| 0:50.8 | Managers approve leave, attendance fixes and expenses on the go, in a single tap. |
| 1:02.4 | And they can see who is in today, without a single phone call. |
| 1:15.6 | On the web, HR runs payroll with PF, ESI, professional tax, LWF and TDS worked out, then approves and pays. |
| 1:24.5 | The PF ECR, ESI and PT files, bank advice and the quarterly TDS extract come ready with payroll, and every due date sits on one calendar. |
| 1:34.3 | DPDP privacy tools are built in, on every plan. |
| 1:40.4 | There is an Android app for the whole team, Google sign-in, Razorpay billing, data hosted in India, and PAN, Aadhaar and bank details encrypted field by field. |
| 1:51.9 | JantaHR. Your workday in one place. Start your fourteen-day free trial at jantahr dot devshipit dot com. |

## Claims and sources

| Claim | Source |
|---|---|
| Geo-fenced, optional selfie check-in | `packages/mobile/src/features/punch-card.tsx`, `device.ts`; plan feature `attendance` |
| "N days left after this" before applying | `packages/mobile/app/(app)/apply-leave.tsx` |
| Payslip take-home and deductions split | emulator capture of `payslip/[id]` |
| Notifications when a request is answered | push prompt copy in `packages/mobile/src/features/push-prompt.tsx` |
| Approve leave, attendance fixes, expenses; "Approved. They have been told." | `packages/mobile/src/features/queries.ts` (`decided()`) and the Approvals tabs |
| PF, ESI, PT, LWF, TDS calculated; run, approve, pay | `README.md` (Payroll), `packages/backend/src/modules/billing/plans.ts` (`payroll`) |
| PF ECR, ESI, PT, bank advice, Form 143 (24Q) TDS extract, compliance calendar | `/hr/payroll/statutory` and `/hr/compliance`; plan feature `statutory`. The page itself says to validate with a CA before filing, and the official Form 130 comes from TRACES, so the video does not claim Form 130 or FVU files (`docs/legal-2026.md`, "Not implemented"). |
| DPDP tools on every plan | `CORE_FEATURES` includes `privacy` in `plans.ts` |
| Google sign-in on every plan | `CORE_FEATURES` includes `googleSignIn` |
| Razorpay billing | `README.md` (Editions), `packages/backend/src/modules/billing` |
| Data hosted in India (Mumbai) | `docs/deploy-cloud.md` (Supabase project in ap-south-1, API in `bom1`) |
| PAN, Aadhaar and bank details encrypted field by field | `README.md` (AES-256-GCM field encryption) |
| 14-day free trial; free for up to 20 employees | `TRIAL_DAYS = 14`, `TRIAL_PLAN = 'PROFESSIONAL'`, Free plan `maxEmployees: 20` in `plans.ts`; live `/api/billing/plans` |

## Credits

- Voiceover: ElevenLabs, voice "Nishant, Professional Indian English", `eleven_v4`.
- Music: ElevenLabs Music `eleven_music_v2_5`, original 120 s instrumental (variation B of 2), generated for this video.
  Prompt: calm premium fintech film, felt piano, soft pads, light arpeggio, brushed percussion, 92 BPM, no vocals.
- Sound effects: ElevenLabs `eleven_text_to_sound_v2`, generated for this video (`public/audio/sfx`: tap, whoosh, chime).
- Font: Inter (SIL Open Font License, `public/fonts/LICENSE.md`).
- Remotion: free for individuals and companies of up to 3 people; larger teams need a
  [company licence](https://www.remotion.pro/license).
- Reference studied for pacing only: "BambooHR 2025: One Platform to Make HR Simpler" (YouTube). Nothing was copied.

## Cost summary (1 Nov 2026)

Credits as charged by ElevenLabs; rupees at the rate the ElevenLabs estimate quoted (≈ ₹0.0145 per credit).

| Item | Credits | ≈ ₹ |
|---|---|---|
| Voiceover, 2 takes (take 2 used) | 2,568 | 37.29 |
| Music, 2 variations (B used) | 1,800 | 26.14 |
| Sound effects, 3 | 50 | 0.73 |
| Estimates (price checks) | 0 | 0 |
| Transcription (local whisper.cpp) and rendering (local Remotion) | 0 | 0 |
| **Total** | **4,418** | **≈ 64.16** |

The approved quote was ≈ 6,180 credits (≈ ₹90). Pika tools were not used (the Pika account has no agent linked).
