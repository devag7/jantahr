# JantaHR for Android (React Native, Expo)

The native phone app for employees and managers: sign-in (email and password, Google through Android's Credential
Manager, two-factor), check-in with location and an optional selfie, attendance and corrections, leave and comp-off,
payslips with the PDF, expense claims with receipt photos, documents, holidays, policies, notifications, and approvals
for managers. HR and payroll administration opens the website. It replaces the earlier Trusted Web Activity under the
same package, `com.devshipit.jantahr`, so Play installs update in place.

- **Data:** the same REST API and Supabase Auth as the website. Response types are the web app's
  (`@/types/*` resolves to `packages/frontend/src/types`, type-only), and dates and money use the website's formatters
  (`src/lib/format.ts`, see `metro.config.js`).
- **Config:** `app.config.ts` talks to production unless `EXPO_PUBLIC_*` says otherwise (`.env.example`).
- **Google sign-in:** `modules/google-id` (Kotlin, Credential Manager) returns an ID token for the web OAuth client with
  a hashed nonce; Supabase verifies it (`signInWithIdToken`). Google also needs an *Android* OAuth client in the same
  Google Cloud project with this package name and the Play app-signing SHA-1, or the sheet reports "developer console
  is not set up".

## Working on it

```bash
npm install
npm run typecheck
npm run bundle:check
```

For a quick look without a phone, run the screens in a browser against a local stack (the API on :3010 with the
GoTrue test double `packages/backend/test/support/gotrue-stub.mjs` on :9999 and the demo seed): `EXPO_PUBLIC_API_URL=http://localhost:3010
EXPO_PUBLIC_SUPABASE_URL=http://localhost:9999 EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=anon-local npx expo start --web`.
Native pieces (Google sign-in, app lock, file preview) only work on Android.

Builds happen in GitHub Actions (no Android SDK needed locally): **Android app on an emulator** opens every change on
Android 11 and 14 emulators, and **Android app** builds the signed bundle and uploads it to Play (docs/android.md).
