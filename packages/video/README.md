# JantaHR pitch video

A 2:11 pitch for investors, customers and the Play and website listings, built with [Remotion](https://www.remotion.dev)
from real product captures. It shows the whole product: the employee and manager app, payroll and statutory work on the
web, the rest of the platform (hiring, appraisals, exits, insights, reports), proof numbers and the open-source story.
It lives outside the pnpm workspace (see `pnpm-workspace.yaml`) and is never part of the app builds; install it on its own
with npm.

| Output | Composition | Size |
|---|---|---|
| `out/jantahr-pitch-16x9.mp4` | `Pitch16x9` | 1920x1080, 30 fps, 131 s |
| `out/jantahr-pitch-9x16.mp4` | `Pitch9x16` (captions burned in) | 1080x1920, 30 fps, 131 s |
| `out/jantahr-teaser-15s-16x9.mp4`, `-9x16.mp4` | `Teaser16x9`, `Teaser9x16` | 15 s, music only |
| `out/jantahr-pitch.srt` | from `src/cues.ts` | subtitles for the full cut |
| `out/jantahr-poster.png` | `Pitch16x9`, frame 600 | poster: the mark with the module orbit |

Renders stay out of git (`out/` is ignored). Audio is mastered to -14 LUFS integrated, -1 dBTP.

```bash
cd packages/video
npm install
npm run dev              # Remotion Studio
npm run render:16x9 && npm run render:9x16 && npm run render:teaser && npm run render:poster
npm run master           # two-pass loudness normalisation of the four videos, picture copied untouched
npm run srt
```

## How it is put together

- `src/script.ts` is the single source of truth: the voiceover lines, the second each starts, and the scene boundaries.
  Every scene times its beats with `beat(scene, lineId)`, and the captions (burned in and SRT) come from the same lines
  through `src/cues.ts`, so voice, picture and subtitles cannot drift apart.
- `src/Pitch.tsx` joins the scenes with 15-frame cross-fades (`TransitionSeries`). Each outgoing scene runs 15 frames
  longer, so the incoming one still starts exactly on its cue.
- `src/scenes/`: `Hook`, `Logo` (mark, name, module orbit), `Employee`, `Manager`, `Web` (payroll, tax regimes,
  statutory files, DPDP), `Platform` (hiring, appraisals, exits, attrition, reports), `Proof` (numbers, open source,
  trust tiles), `Cta` ("One app. One payroll. One calendar." and the offer). Each lays itself out for 16:9 and 9:16.
- `src/ui.tsx`: phone and laptop frames that place children in the screenshot's own pixels, floating cards cut from real
  screens, ring reveals, tap feedback, kinetic headlines, the J-HR mark drawn as strokes.
- Motion follows `docs/DESIGN.md`: ease-out only, no overshoot, quiet concentric rings, delight only at completions,
  Inter 400 and 600 from the app's own font files, no em dashes on screen.

### Audio

- Voice: one take of the whole script, transcribed locally with whisper.cpp (`scripts/transcribe.mjs`), then split per
  line (`scripts/split-vo.mjs`): each line is found by its first words, the cut sits in the middle of the silence before
  the next line, and every line is normalised to -18 LUFS.
- Music ducking (`musicGain()` in `src/Pitch.tsx`): lines less than 1.5 s apart count as one block, so the music never
  pumps in short pauses. Under the voice it sits at 0.17; between blocks it eases up to 0.5 over 0.9 s, and it ducks
  0.3 s before the next line.
- `scripts/master-audio.mjs` normalises the finished mix (two-pass `loudnorm`, -14 LUFS, -1 dBTP).

### Options that change what the video claims

Both default to what is true on 2 Nov 2026. Pass them as props, e.g. `--props='{"audio":true,"playLive":true}'`.

| Prop | Default | Turn on when |
|---|---|---|
| `playLive` | `false` | the Play listing is public (`play.google.com/store/apps/details?id=com.devshipit.jantahr` returns 200; on 2 Nov 2026 it returns 404) |
| `gstInvoices` | `false` | `BILLING_SELLER_GSTIN` is set in production (the live `/api/billing/plans` reports `gstRate: 0`) |
| `captions` | `false` (16:9), `true` (9:16) | burn subtitles into the picture |

## Footage: all real, nothing mocked

| Where | Source |
|---|---|
| Phone screens | `android-journey` artifact of the "Android app on an emulator" workflow, run 40359572557 (Pixel 6, 1080x2400) |
| Checked-in hero, "4 days left after this", "1/4 in today" | the app's own web preview (`npx expo start --web`) on the local seeded stack, at phone size; the checked-in hero is laid over the emulator frame at the same pixels |
| Web pages: payroll run, statutory files, compliance calendar, data protection, recruitment pipeline, careers page, appraisal cycle, exits and F&F, attrition risk, custom report builder, tax regime comparison | `packages/frontend` on `localhost:3000` against `~/.jantahr-dev/stack/mobile-stack.sh` (local test database, auth test double, seeded demo company). Demo logins were never used against production. |
| Activity behind the DPDP, hiring, exits, appraisal and report screens | added to the local demo company through the app's own API and UI before capture, so no screen is empty: four privacy requests from staff (one completed, one in progress) and one contained breach; four applicants through the public careers form (with the DPDP consent the form requires), moved through screening, interview and offer, and one hired with the one-click hire; the pending resignation approved, clearances done and full & final computed; the completed Annual Review FY 2025-26 cycle selected; the custom report run |
| Hook cards (spreadsheet, chat, sticky note, register) and the terminal card | drawn in the scene files; the terminal shows the real command from `deploy/self-hosted/README.md` |

## Voiceover script

Voice: **Nishant, Professional Indian English** (ElevenLabs library voice `j33FKwn3yd055HQ1DQKY`), model `eleven_v4`.

| Starts | Line |
|---|---|
| 0:00.6 | Every month, growing Indian companies run payroll in spreadsheets, approve leave over chat, and chase PF, ESI and TDS deadlines from memory. |
| 0:11.0 | JantaHR brings it all into one place. People, payroll, leave and attendance, hiring, performance and exits. Open source, and built for India. |
| 0:22.6 | Employees check in with one tap. Geo-fenced, with an optional selfie. |
| 0:27.6 | Their whole month, at a glance. |
| 0:30.4 | Before they apply for leave, JantaHR shows exactly how many days will be left. |
| 0:36.6 | On payday, the payslip is on their phone, with take-home and every deduction laid out. |
| 0:42.5 | And they hear back the moment a request is answered. |
| 0:47.6 | Managers approve leave, attendance fixes and expenses in a single tap. |
| 0:53.0 | And see who is in today, without a phone call. |
| 0:58.6 | On the web, HR runs payroll with PF, ESI, professional tax, LWF and TDS worked out, under the new Income-tax Act and the labour codes. |
| 1:09.8 | The PF ECR, ESI and PT files, bank advice and the quarterly TDS extract come ready with payroll, and every due date sits on one calendar. |
| 1:20.0 | DPDP privacy tools come built in, on every plan. |
| 1:25.6 | Beyond payroll, hire from your own careers page, run appraisals, settle full and final, and spot attrition risk early. |
| 1:34.8 | Eighteen MIS reports and a custom report builder put every number a click away. |
| 1:42.6 | Over two hundred automated tests check the maths on every change. |
| 1:47.9 | And it is open source. Use our cloud, hosted in India, or run every feature on your own server, free, with one command. |
| 1:59.8 | One app. One payroll. One calendar. JantaHR. Start your fourteen-day free trial at jantahr dot devshipit dot com. |

## Claims and sources

| Claim | Source |
|---|---|
| Modules in the orbit: people, payroll, leave and attendance, hiring, performance, exits and F&F, statutory filing, insights, expenses, DPDP privacy | `README.md` (Features), `packages/backend/src/modules/*`, `FEATURES` in `plans.ts` |
| Geo-fenced, optional selfie check-in | `packages/mobile/src/features/punch-card.tsx`, `device.ts` |
| "N days left after this" before applying | `packages/mobile/app/(app)/apply-leave.tsx` |
| Approve leave, attendance fixes, expenses; "Approved. They have been told." | `packages/mobile/src/features/queries.ts` (`decided()`) |
| PF, ESI, PT, LWF, TDS; Income-tax Act 2025; labour codes and the 50% wage rule | `README.md` (Payroll), `packages/backend/src/modules/payroll/engine`, `docs/legal-2026.md` §1 |
| Old vs new regime comparison | `/me/tax`, Regime comparison tab (captured) |
| PF ECR, ESI, PT, bank advice, Form 143 (24Q) TDS extract, compliance calendar | `/hr/payroll/statutory`, `/hr/compliance`. The page says to validate with a CA before filing; the official Form 130 comes from TRACES, so the video claims neither Form 130 nor FVU files (`docs/legal-2026.md`, "Not implemented"). |
| DPDP tools on every plan; Google sign-in on every plan | `CORE_FEATURES` in `plans.ts` |
| Careers page, pipeline, one-click hire | `/careers/[companyId]`, `/hr/recruitment`, `recruitment.controller.ts` (`hire`) |
| Appraisal cycles, exits and full & final, attrition risk (a transparent heuristic, labelled as such in the app) | `/hr/performance`, `/hr/lifecycle`, `/hr/insights`, `modules/ai/ai.service.ts` |
| 18 MIS reports and a custom report builder | 18 `key:` entries in `modules/reports/mis.service.ts`; `custom-report.service.ts` |
| 210 automated tests, all passing | run on 2 Nov 2026: `npx jest` in `packages/backend` (182 passed, 24 suites) and `npm test` in `packages/frontend` (28 passed) |
| 291 API endpoints | count of `@Get/@Post/@Put/@Patch/@Delete` decorators in `packages/backend/src` |
| 76 data models | `^model` in `packages/backend/prisma/schema.prisma` |
| Every statutory rule links to its notification | `README.md` and `docs/legal-2026.md` |
| Open source (AGPL-3.0), every feature self-hosted with no seat limit or licence key, one command | `LICENSE`, `README.md` (Editions), `deploy/self-hosted/README.md` |
| Cloud hosted in India (Mumbai) | `docs/deploy-cloud.md` (Supabase ap-south-1, API in `bom1`) |
| PAN, Aadhaar and bank details encrypted field by field; two-factor, audit log, row-level security | `README.md` (Security, What's implemented) |
| Razorpay billing | `README.md` (Editions), `packages/backend/src/modules/billing` |
| 14-day free trial; free for up to 20 employees | `TRIAL_DAYS`, Free plan `maxEmployees: 20` in `plans.ts`; live `/api/billing/plans` |

Not claimed on purpose: Play availability and GST invoices (see the props above); Form 130 and FVU files; "80+
employee fields" (the schema has 62); professional tax "for 12 states" (one of them repealed it in April 2026).

## Credits

- Voiceover: ElevenLabs, voice "Nishant, Professional Indian English", `eleven_v4`.
- Music: ElevenLabs Music `eleven_music_v2_5`, an original 131 s instrumental generated for this video (calm fintech
  film, felt piano, soft pads, arpeggio, brushed percussion, 92 BPM, lifts at the section changes, no vocals).
- Sound effects: ElevenLabs `eleven_text_to_sound_v2`, generated for this video (`public/audio/sfx`: tap, whoosh, chime).
- Font: Inter (SIL Open Font License, `public/fonts/LICENSE.md`).
- Remotion: free for individuals and companies of up to 3 people; larger teams need a
  [company licence](https://www.remotion.pro/license).
- Reference studied for structure only: "BambooHR 2025: One Platform to Make HR Simpler" (YouTube). Nothing was copied.

## Cost summary

Credits as charged by ElevenLabs; rupees at the rate the ElevenLabs estimate quoted (≈ ₹0.0145 per credit).

| Item | Credits | ≈ ₹ |
|---|---|---|
| Cut 1: voiceover, 2 takes | 2,568 | 37.29 |
| Cut 1: music, 2 variations | 1,800 | 26.14 |
| Sound effects, 3 | 50 | 0.73 |
| Cut 2: voiceover, 1 take of the expanded script (used) | 1,558 | 22.62 |
| Cut 2: music, 131 s (used) | 900 | 13.07 |
| Price checks, transcription (local whisper.cpp), rendering (local) | 0 | 0 |
| **Total** | **6,876** | **≈ 99.85** |

Pika tools were not used (the Pika account has no agent linked).
