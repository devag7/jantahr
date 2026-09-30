# Contributing to JantaHR

Thank you for helping build open-source HR and payroll for India. This guide gets you from clone to pull request.

## Ground rules

- **Statutory logic needs a source.** A change to PF, ESI, professional tax, LWF, TDS, gratuity, bonus, labour-code
  wages or DPDP handling must cite the notification, circular or section it implements (link it in the PR and add it
  to [`docs/legal-2026.md`](docs/legal-2026.md)). Include a unit test with a worked example.
- **Follow the design system.** UI changes follow [`docs/design-system.md`](docs/design-system.md): one accent colour,
  the type scale tokens (no `text-sm`, no `text-[13px]`), no shadows except on product imagery, weights 300/400/600/700.
- **Follow the folder structure.** One folder per feature in every layer (`components/<feature>`,
  `services/<feature>`, `hooks/<feature>`, `types/<feature>`); components never call the HTTP client directly.
- **No secrets in commits.** `.env` files are ignored; use the `*.example` templates.

## Local setup

```bash
pnpm install
cp packages/backend/.env.example packages/backend/.env
# Postgres: docker compose up -d postgres   (or any Postgres 16/17)
# Sign-in: a Supabase project, or the local GoTrue test double:
GOTRUE_JWT_SECRET=local-gotrue-jwt-secret-0123456789abcdef GOTRUE_SERVICE_KEY=service-local-key \
  pnpm --filter jantahr-backend gotrue:stub
pnpm db:migrate && pnpm db:seed
pnpm dev
pnpm --filter jantahr-backend doctor     # tells you exactly what is misconfigured
```

## Before you open a pull request

```bash
pnpm --filter jantahr-backend test:unit
pnpm --filter jantahr-backend exec tsc --noEmit
pnpm --filter jantahr-frontend exec tsc --noEmit
API=http://localhost:3002 pnpm --filter jantahr-backend test:e2e    # needs a freshly seeded database
```

Keep pull requests focused: one feature or fix, with a short description of what changed and why. Screenshots help
for UI changes (desktop and a 390 px phone width).

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org): `feat(payroll): …`, `fix(leave): …`, `docs: …`.

## Where to start

Issues labelled [`good first issue`](../../issues?q=is%3Aopen+label%3A%22good+first+issue%22) are scoped for a first
contribution. State-specific rules (professional tax slabs, LWF, holidays) are a great way in: they are small,
well-defined and valuable to every company in that state.
