# JantaHR self-hosted

One command runs the whole product on your own server: every feature, no seat limit, no licence key, no data leaving
your network. The stack is the official Supabase self-hosting bundle (vendored in `./supabase`) plus the JantaHR API
and web app.

| Service | What JantaHR uses it for |
|---|---|
| `db` · Postgres 17 with **OrioleDB** (`supabase/postgres:17.11.0.001-orioledb`) | All data. OrioleDB is the default table access method, so every JantaHR table is created on it. `pg_cron`, `pg_net`, Vault and pgsodium are available. |
| `storage` · Supabase Storage (S3 protocol) | Documents, receipts, résumés and check-in selfies in a private `jantahr` bucket, created at first boot |
| `realtime` | Instant notification badges (the API broadcasts a ping; the browser refetches) |
| `auth` · GoTrue (Supabase Auth) | All sign-in: passwords, sessions, password-reset and sign-in links, Google, two-factor (TOTP) |
| `functions` · Edge Runtime | `jobs-dispatch` (scheduled jobs) and `billing-webhook` (unused when self-hosted) |
| `supavisor`, `rest`, `meta`, `studio`, `analytics`, `imgproxy`, `api-gw` | Standard Supabase services; Studio is the database console |
| `jantahr-api` | NestJS API, applies migrations on start, runs scheduled jobs in-process |
| `jantahr-web` | Next.js web app built with `NEXT_PUBLIC_EDITION=self_hosted` |

## Requirements

- Docker Engine 24+ with the Compose plugin, 4 vCPU / 8 GB RAM for up to about 500 employees.
- About 8 GB of free disk for images, plus room for data and uploaded files.
- A domain and TLS in front of ports 3000 (web), 3002 (API) and 8000 (Supabase gateway) for production.

## Install

```bash
cd deploy/self-hosted
./jantahr.sh setup    # writes .env with fresh secrets (Supabase keys, JWT, encryption key, S3 keys)
```

Edit `.env` before the first start:

| Variable | Set it to |
|---|---|
| `JANTAHR_WEB_URL` | Public URL of the web app, e.g. `https://hr.example.in` |
| `JANTAHR_API_PUBLIC_URL` | Public URL of the API, e.g. `https://hr-api.example.in` (baked into the web build) |
| `SUPABASE_PUBLIC_URL` | Public URL of the Supabase gateway, e.g. `https://hr-supabase.example.in` |
| `API_EXTERNAL_URL` | The same URL followed by `/auth/v1` |
| `SITE_URL`, `ADDITIONAL_REDIRECT_URLS` | `SITE_URL` = web URL; add `<web URL>/auth/callback` to the redirect list |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL` | Your mail relay (password resets, payslip mails, magic links) |
| `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD` | Studio login |
| `ANTHROPIC_API_KEY` | Optional: LLM answers in the HR assistant (keyword answers work without it) |

Then start it:

```bash
./jantahr.sh up       # builds the JantaHR images and starts everything
./jantahr.sh ps       # all services should be healthy after a minute or two
docker exec jantahr-api node scripts/doctor.mjs   # checks configuration, database, Supabase Auth and storage
```

Open `JANTAHR_WEB_URL`, choose **Create company** and sign up; that account becomes the Super admin.

**Back up `JANTAHR_ENCRYPTION_KEY`** separately from the database. PAN, Aadhaar and bank account numbers are encrypted
with it field by field; without it they cannot be recovered.

## Sign-in (Supabase Auth)

Supabase Auth is the only way into JantaHR. It stores the passwords and sessions, sends reset and sign-in links, and
holds each person's authenticator-app factor; JantaHR keeps who belongs to which company with which role.

- **Email is required.** Invitations are temporary passwords that HR shares, but password-reset links, email sign-in
  links and new-company confirmations are sent by Supabase Auth through `SMTP_*`. Without a mail relay set
  `ENABLE_EMAIL_AUTOCONFIRM=true` so new workspaces work, and reset passwords from *People > Employees* instead.
- In Studio (*Authentication > Policies*) or `.env`, set the minimum password length to 8.
- `ADDITIONAL_REDIRECT_URLS` must contain `<web URL>/auth/callback`.
- **Google (optional):** create an OAuth client (Web application) in Google Cloud with the redirect URI
  `<SUPABASE_PUBLIC_URL>/auth/v1/callback`; uncomment the `GOTRUE_EXTERNAL_GOOGLE_*` lines of the `auth` service in
  `supabase/docker-compose.yml`, add `GOOGLE_ENABLED=true`, `GOOGLE_CLIENT_ID` and `GOOGLE_SECRET` to `.env`, and run
  `./jantahr.sh up`. The sign-in page shows **Continue with Google** only when the provider is on. Supabase links a
  Google sign-in to the existing account with the same verified email.
- **Upgrading an installation from before Supabase Auth:** after `./jantahr.sh up`, run
  `pnpm --filter jantahr-backend auth:link --apply` from a checkout, with the API's `DATABASE_URL` and `SUPABASE_*`
  values in the environment. It creates a Supabase account for every existing user; they then choose a password with
  *Forgot password*. Two-factor has to be set up again.

## Scheduled jobs

`JOBS_MODE=inprocess`: the API runs attendance finalisation (00:10 IST), leave accrual (1st of the month), leave
rollover (1 January) and privacy housekeeping (02:45 IST) itself, with Postgres advisory locks so two API replicas
never run the same job twice. `supabase/sql/cron.sql` is only needed when the API runs somewhere without a
long-lived process (see `docs/deploy-cloud.md`).

## Operations

```bash
./jantahr.sh logs jantahr-api     # follow one service
./jantahr.sh down                 # stop; data stays in supabase/volumes
```

- **Backups:** `docker exec supabase-db pg_dump -U postgres -Fc postgres > jantahr-$(date +%F).dump` nightly, plus
  `supabase/volumes/storage` for files. Test a restore; keep a copy off the server.
- **Upgrades:** replace the repository, then `./jantahr.sh up`. Migrations apply on API start.
- **Uploads** go through the API (`UPLOAD_MODE=proxy`, up to 10 MB per file, checked by type and content).
- **Statutory tables** (PT, LWF, tax slabs, holidays) are seeded defaults. Have your CA confirm them under
  *Payroll > Statutory* before the first real payroll.

## Moving between editions

Self-hosted and cloud run the same code and schema. A `pg_dump` of the self-hosted database restores into a Supabase
project and the reverse; copy the storage bucket alongside it and keep the same `ENCRYPTION_KEY`.
