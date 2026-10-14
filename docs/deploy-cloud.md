# JantaHR cloud: Supabase + Vercel

The cloud edition is the same code as the self-hosted edition with `EDITION=cloud`: plans, a 14-day Professional
trial, per-seat billing through Razorpay and GST invoices. Everything below fits the Supabase and Vercel free tiers
for a pilot; move to paid tiers before real payroll (backups, no project pausing, longer function limits).

```
browser ──► Vercel project (one domain, root vercel.json)
   │    ├─► /       web service (Next.js)       packages/frontend
   │    └─► /api/*  API service (NestJS, bom1)  packages/backend ──► Supabase Postgres (pooler)
   │                                                        ├─► Supabase Storage (S3 protocol)
   │                                                        └─► Supabase Realtime (broadcast pings)
   ├──────► Supabase Storage  (direct uploads and downloads with presigned URLs)
   ├──────► Supabase Auth     (all sign-in: password, email link, Google, TOTP; the API verifies its tokens)
   └──────► Supabase Realtime (notification badge)
Supabase pg_cron ──► Edge Function jobs-dispatch ──► API /internal/jobs/*
Razorpay ──► API /api/billing/webhooks/razorpay  (or Edge Function billing-webhook)
```

## 1. Supabase project

1. Create a project in **Mumbai (ap-south-1)** so personal data stays in India, as the privacy notice states.
2. **Database → Connect**:
   - `DATABASE_URL` = *Transaction pooler* (port 6543) + `?pgbouncer=true&connection_limit=5` (a scheduled job holds one connection for its lock
     while it works on others, so a limit below 5 is raised to 5 at start-up)
   - `DIRECT_URL` = *Session pooler* (port 5432). Migrations need it; the direct host is IPv6-only and Vercel is not.
3. **Settings → API keys**: copy the publishable key (`sb_publishable_…`) and create a secret key (`sb_secret_…`).
   The secret key is server-only: the API uses it to create, disable and reset employee sign-ins and to broadcast
   notification pings. Never put it in a `NEXT_PUBLIC_` or `EXPO_PUBLIC_` variable.
4. **Storage**: nothing to set up. On Vercel the API stores files in Supabase Storage with the secret key from step 3
   and creates the private `jantahr` bucket at first boot. (To use the S3 protocol instead, for example with another
   S3-compatible store, enable *Storage → Settings → S3 connection*, create an access key pair and set the S3
   variables below.)
5. **Authentication** (Supabase Auth is the only sign-in: passwords, sessions, email links, Google, TOTP)
   - *URL configuration*: Site URL = the site URL; Redirect URLs: `https://<site>/auth/callback`.
   - *Policies*: minimum password length 8. *Multi-factor*: TOTP enabled (the default).
   - *Providers → Email*: keep "Confirm email" on, so a new workspace owner proves their address before the company
     is created.
   - *Providers → Google* (optional): an OAuth client from Google Cloud whose redirect URI is
     `https://<ref>.supabase.co/auth/v1/callback`. The sign-in page only shows Google once it is enabled, and on the
     cloud edition only companies whose plan includes it can use it.
   - *SMTP*: add your own mail server. The built-in sender allows only a few emails an hour, which breaks reset links,
     sign-in links and sign-up confirmations.
   - HR creates employee sign-ins through the API (Supabase admin API, secret key); employees cannot sign themselves
     up into a company, and an address that already has an account cannot be registered again.
6. **Scheduled jobs** (free tier friendly). After the API is deployed, in the SQL editor create two Vault secrets and
   run `supabase/sql/cron-direct.sql`:
   ```sql
   select vault.create_secret('https://<site>/api/internal/jobs', 'jantahr_api_jobs_url');
   select vault.create_secret('<same value as the API''s CRON_SECRET>', 'jantahr_cron_secret');
   ```
   pg_cron then calls the API's job endpoints directly: attendance finalisation, leave accrual and rollover, privacy
   housekeeping, the billing sweep and the Razorpay inbox (every 10 minutes). Check with
   `select * from cron.job_run_details order by start_time desc limit 5;` and `select * from net._http_response;`.

   Alternative: route the jobs through the `jobs-dispatch` Edge Function instead (`supabase/sql/cron.sql`):
   ```bash
   supabase functions deploy jobs-dispatch --no-verify-jwt
   supabase secrets set JANTAHR_API_URL=https://<site>/api CRON_SECRET=<same as API> JOBS_DISPATCH_SECRET=<random 48 chars>
   ```
   then create the two Vault secrets named at the top of that file and run it. Both files use the same schedule
   names, so applying one replaces the other.

## 2. Vercel project

One Vercel project serves both applications on one domain, using [Vercel Services](https://vercel.com/docs/services)
(beta). The root `vercel.json` defines them:

| Service | Folder | Public path | Notes |
|---|---|---|---|
| `frontend` | `packages/frontend` | `/` (everything else) | Next.js web app |
| `backend` | `packages/backend` | `/api/*` | NestJS API in Mumbai (`bom1`). Its build step runs `prisma generate` and applies migrations through `DIRECT_URL`; Vercel then compiles `src/main.ts` itself |

A service receives the original request path, so on Vercel the API mounts every route under `/api` (it does this by
itself when the `VERCEL` variable is present; `API_PREFIX` overrides it). The browser calls `/api/...` on the same
domain, so there is no cross-origin setup and no service binding: nothing calls another service from server code.
The six daily jobs in `vercel.json` call `/api/internal/jobs/*` with `CRON_SECRET`.

Each service installs with `npm ci` from the lockfile in its own folder. A service's function only contains files from
its folder, and pnpm keeps the real packages in the repository root, so the API has a `package-lock.json` beside the
workspace's `pnpm-lock.yaml`. After changing API dependencies, refresh it with
`npm install --package-lock-only --ignore-scripts` in `packages/backend`.

The API's Vercel build step must not run `nest build`. If a `dist/main.js` exists after the build command, Vercel ships
that folder as the function and resolves packages from the repository root, where there are none, so every request
fails with `Cannot find module '@nestjs/common'`.

Import the repository with **Root Directory** `./` and the **Services** preset, then add these variables (they are
shared by both services; the web app only ever reads the public ones):

| Variable | Value |
|---|---|
| `EDITION` | `cloud` |
| `JOBS_MODE` | `external` (jobs come from pg_cron and Vercel Cron, never in-process) |
| `DATABASE_URL`, `DIRECT_URL` | from step 1.2 |
| `JWT_SECRET`, `ENCRYPTION_KEY` | 48+ random characters each (`JWT_SECRET` only signs internal HMACs; sessions are Supabase's). **Back up `ENCRYPTION_KEY`**: PAN, Aadhaar and bank numbers cannot be decrypted without it |
| `CRON_SECRET` | 32+ random characters; Vercel Cron sends it automatically as a bearer token |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | from step 1.3; required, the API verifies every request against Supabase Auth and administers employee sign-ins with the secret key. The web app reads the URL and the publishable key from these same variables |
| `STORAGE_DRIVER` | optional. Unset on Vercel means `supabase` (Supabase Storage with the secret key). `s3` uses the S3 protocol and then needs `S3_ENDPOINT` (`https://<ref>.storage.supabase.co/storage/v1/s3`), `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `STORAGE_AUTO_CREATE_BUCKET=true` |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_PLAN_IDS` | step 3 |
| `BILLING_SELLER_NAME`, `BILLING_SELLER_ADDRESS`, `BILLING_SELLER_STATE`, `BILLING_SELLER_GSTIN`, `BILLING_SAC_CODE` | your GST registration; they print on every invoice |
| `PLATFORM_ADMIN_EMAILS` | comma-separated operator logins for the tenant list (`/billing/platform/tenants`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | transactional mail |
| `ANTHROPIC_API_KEY` | optional, for LLM answers in the assistant |
| `NEXT_PUBLIC_SHOW_DEMO_LOGINS` | optional, `false` by default; `true` shows one-click demo sign-ins on the sign-in page |

The web app needs no variables of its own: on Vercel it defaults to `/api` for the API and takes the edition, the
Supabase URL and the publishable key from the variables above (`next.config.mjs`). Set `NEXT_PUBLIC_API_URL` only when
the API lives on a different origin, for example two separate Vercel projects or the mobile app's `EXPO_PUBLIC_API_URL`,
which is `https://<site>/api`.

### Vercel limits and how JantaHR handles them

| Limit | Handling |
|---|---|
| 4.5 MB request and response bodies | On Vercel, uploads go from the browser straight to Supabase Storage with a signed URL; the API then checks size, type and first bytes before attaching the file. Stored files download through five-minute signed links. Both apply automatically (`UPLOAD_MODE=direct`). Up to 10 MB per file. |
| No long-lived process | `JOBS_MODE=external`; jobs arrive over HTTP, guarded by `CRON_SECRET`, and take a Postgres advisory lock so pg_cron and Vercel Cron can both fire without double work |
| Hobby cron runs at most daily | the 10-minute Razorpay inbox runs from pg_cron; Vercel Cron covers the daily jobs as a second trigger |
| Cold starts | the web app is static where it can be; API functions run on Fluid compute in `bom1` |

## 3. Razorpay

### 3.1 Website details Razorpay checks before activating live payments

Razorpay reviews the live website before it issues live keys. It asks for these pages; the cloud edition ships all of
them, linked from the footer of every public page:

| Razorpay asks for | URL |
|---|---|
| Pricing details | `https://<site>/pricing` |
| Terms and conditions | `https://<site>/legal/terms` |
| Privacy policy | `https://<site>/legal/privacy` |
| Cancellation and refunds policy | `https://<site>/legal/refunds` |
| Shipping policy | `https://<site>/legal/shipping` (software: nothing is shipped; says when access is delivered) |
| Contact us | `https://<site>/contact` |

The contact page, the policies and the footer name the business that runs the site. Set these variables (they are not
secret) so they match the legal name and address on your Razorpay account and GST registration, then redeploy:

| Variable | Shown as |
|---|---|
| `BILLING_SELLER_NAME` | legal business name (also the seller on GST invoices) |
| `BILLING_SELLER_ADDRESS` | registered address, one line (also on invoices) |
| `SUPPORT_EMAIL` | contact email, a mailbox you read |
| `SUPPORT_PHONE` | contact phone, with country code |
| `NEXT_PUBLIC_SITE_URL` | the site's public address, e.g. `https://hr.example.in`, once you use your own domain (Vercel's production address is used until then) |
| `BILLING_SELLER_GSTIN` | your GST number, **only if you are registered under GST** (see below) |

**GST.** Only a GST-registered seller may collect GST. JantaHR therefore adds 18% GST, prints tax lines on invoices and
mentions GST on the site only when `BILLING_SELLER_GSTIN` is set. Without it the listed price is the amount charged,
invoices are plain invoices and the site says no GST is added. An individual or a business below the registration
threshold can start this way; set the GSTIN when you register, then run `razorpay:plans` again, because the plan
amounts change.

Read the four policy pages before submitting and adjust anything that is not how you intend to trade (the refund
terms and the response times are commitments to your customers). They are not legal advice.

### 3.2 Keys, plans and webhook

Do this with **test-mode** keys first (`rzp_test_…`); live keys (`rzp_live_…`) arrive after Razorpay approves the
account, and test and live mode have separate plans and webhooks.

1. Put `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `packages/backend/.env`, then create the four **plans**:
   ```bash
   pnpm --filter jantahr-backend razorpay:plans
   ```
   It creates what is missing and prints the `RAZORPAY_PLAN_IDS=…` line for the API. Amounts are per seat. With a
   GSTIN they include 18% GST, because Razorpay charges the plan amount and JantaHR's invoice splits the tax back out;
   without one they are the plain prices (₹59, ₹588, ₹119, ₹1,188):

   | Key | Period | Amount per seat when GST-registered |
   |---|---|---|
   | `STANDARD_MONTHLY` | monthly | ₹69.62 (₹59 + GST) |
   | `STANDARD_ANNUAL` | yearly | ₹693.84 (₹49 × 12 + GST) |
   | `PROFESSIONAL_MONTHLY` | monthly | ₹140.42 (₹119 + GST) |
   | `PROFESSIONAL_ANNUAL` | yearly | ₹1,401.84 (₹99 × 12 + GST) |

   Prices live in `packages/backend/src/modules/billing/plans.ts`; after changing them run
   `pnpm --filter jantahr-backend plans:sync` so the pricing page shows the same numbers, and run `razorpay:plans` again.
   Subscriptions must be enabled on the Razorpay account.
2. **Webhook** (Razorpay dashboard → Account & Settings → Webhooks): URL `https://<site>/api/billing/webhooks/razorpay`
   (or the `billing-webhook` Edge Function, which stores the event in Postgres even when the API is cold). Events:
   `subscription.activated`, `subscription.charged`, `subscription.resumed`, `subscription.pending`,
   `subscription.halted`, `subscription.cancelled`, `subscription.completed`, `subscription.updated`. The secret you
   type there is `RAZORPAY_WEBHOOK_SECRET`.
3. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` and `RAZORPAY_PLAN_IDS` on the deployment
   and redeploy.
4. Test end to end in test mode: sign up, buy Standard for 10 seats with Razorpay's recurring test card (Visa 4718 6091 0820 4366; the ordinary test cards are refused for subscriptions), confirm the plan turns
   active and the GST invoice (`JH/2026-27/000001`) downloads. Then repeat steps 1 to 3 with the live keys.

If Razorpay rejects the key, or a plan ID belongs to another account or mode, the Billing page says "Online payment is
temporarily unavailable" instead of offering a checkout that would fail, and `doctor` names the setting to fix.
Regenerating a key in the Razorpay dashboard replaces the old one: update `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
on the deployment the same day. Plans and the webhook stay valid as long as the account and mode are the same.

### 3.3 Moving to your own domain

Add the domain in Vercel (Settings > Domains) and make it the production domain: canonical links, the sitemap and
`robots.txt` follow automatically. Then point everything that calls or links to the site at the new address:

1. Supabase > Authentication > URL Configuration: set Site URL to `https://your-domain` and add
   `https://your-domain/**` to Redirect URLs. Sign-up confirmations and password-reset links return there; an address
   missing from the list falls back to the Site URL.
2. The Razorpay webhook URL: `https://your-domain/api/billing/webhooks/razorpay` (Dashboard > Webhooks, or the API).
3. The scheduled jobs: update the Vault secret that holds the jobs URL
   (`select vault.update_secret((select id from vault.secrets where name = 'jantahr_api_jobs_url'), 'https://your-domain/api/internal/jobs');`).
4. Behind Cloudflare, set the DNS record to "DNS only": Vercel issues and renews the certificate itself, and
   Cloudflare's bot protection can block server-to-server calls such as Razorpay's webhooks.

## 4. Check the deployment

- Run `pnpm --filter jantahr-backend doctor` with the API's environment: it checks every setting above and prints
  the fix for anything missing.
- `GET https://<site>/api/health` returns ok; `GET /api/meta/runtime` shows `"edition":"cloud"` and `"directUploads":true`.
- Sign up a company: it starts on the Professional trial with a countdown banner.
- Upload a document larger than 4.5 MB under *My work → Profile → Documents* and download it again, or run
  `test/storage-roundtrip.mjs` against the deployment (upload, download, delete through the API).
- A notification (for example a leave request) updates the bell without a page refresh.
- What AI agents and crawlers read: `BASE=https://<site> STRICT_VARY=1 npm run test:agents` in `packages/frontend`
  checks the Markdown version of every public page (`Accept: text/markdown`), the Markdown 404, `/llms.txt`,
  `/sitemap.xml`, `/robots.txt`, the home page's metadata and JSON-LD, the API's OpenAPI document at `/openapi.json`
  (built by the API from its own routes, see `packages/backend/src/openapi`), and the public MCP server at `/mcp`
  (discovery at `/.well-known/mcp`). Add `EXPECT_ADDRESS=1` once `BILLING_SELLER_ADDRESS` is set. A new public page
  is listed once, in `packages/frontend/src/lib/site/site.ts`.

## Plans and entitlements

| | Free | Standard | Professional | Enterprise |
|---|---|---|---|---|
| Price (per employee / month, before GST) | ₹0, up to 20 employees | ₹59 monthly, ₹49 annual | ₹119 monthly, ₹99 annual | quote |
| Minimum seats | | 10 | 10 | 250 |

A lapsed subscription never locks data away: the company drops to Free, paid modules turn read-only (everything
stays visible and exportable), and paying again restores them. Past-due subscriptions keep full access for 7 days.
The self-hosted edition has every feature with no seat limit.
