# Security policy

JantaHR stores salaries, PAN, Aadhaar and bank details, so security reports get priority.

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's
[private vulnerability reporting](../../security/advisories/new) for this repository. Include the affected version or
commit, steps to reproduce and the impact you see. You will get an acknowledgement within 3 working days and a fix
plan within 10.

## Scope

In scope: the API (`packages/backend`), web app (`packages/frontend`), mobile app (`packages/mobile`), the
self-hosted bundle (`deploy/self-hosted`) and the Supabase functions and SQL in `supabase/`.

## How JantaHR protects data

- Supabase Auth for every sign-in (sessions, TOTP two-factor); the API verifies each token and enforces account
  status, sessions ended by HR and two-factor on the server.
- PAN, Aadhaar and bank account numbers are encrypted field by field (AES-256-GCM); Aadhaar is always shown masked.
- Tenant isolation on every query, role-based access, an audit log of every write, row-level security locking the
  Supabase API out of application tables.
- Uploads are checked by size, type and file signature; stored files are served through the API or short-lived
  signed links.
