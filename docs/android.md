# JantaHR on phones: Android app and iPhone

JantaHR runs on phones in two ways, both built from the web app, so every change to the site reaches them at once:

| Platform | How people get it | What it is |
|---|---|---|
| Android | Google Play | A Trusted Web Activity (`packages/android`): the site full screen, no browser bar, Android 16 (API 36) |
| iPhone and iPad | Safari > Share > **Add to Home Screen** | The installable web app (PWA): icon, full screen, offline screen |

A new Play release is only needed when the Android shell changes (icon, colours, permissions, target SDK). Web
changes ship through the normal web deployment.

**No purchases in the Android app.** Google Play's payments policy does not allow selling the subscription inside a
Play app through Razorpay, so the app hides plan purchase, seat changes and upgrade prompts; Billing there only shows
the plan and invoices. The app opens `/dashboard?source=android-app` and Chrome sends the referrer
`android-app://com.devshipit.jantahr`; `inAndroidApp()` in `packages/frontend/src/components/pwa/pwa.ts` checks
either and remembers it for the session. The iPhone web app is not distributed through a store and keeps them.

Play's Data safety form asks for an account deletion link: `https://<your domain>/legal/delete-account`.

## Costs

| Item | Cost |
|---|---|
| Google Play developer account | US$25 once |
| GitHub Actions builds | free on a public repository |
| iPhone (PWA) | free; an App Store app would need the Apple Developer Program, US$99 a year |

## How a release works

1. On GitHub: **Releases > Draft a new release**, tag `android-v1.0.1` (create it on `main`), write the notes
   (the first 500 characters become Play's "What's new"), and publish.
2. The **Android app** workflow builds the bundle, signs it with the upload key, attaches
   `jantahr-1.0.1.aab` to the release and uploads it to Play Console.
3. A normal release goes to the track in the `PLAY_TRACK` repository variable (default `alpha`, Play's closed
   testing track). Tick **Set as a pre-release** to send it to internal testing instead. Moving it to production is
   done in Play Console (**Promote release**), or with **Actions > Android app > Run workflow** and track
   `production`.

Version numbers come from the tag: `android-v1.2.3` is version name `1.2.3` and version code `10203`, so each
release must have a higher number than the last.

Before a release, check that the **Android app on an emulator** workflow passed for that commit (it runs on every
change to `packages/android`, or with **Run workflow**). It opens the release build on Android 11 and 14 emulators with
Chrome and fails if the app crashes or does not open the site in Chrome; its artifact holds logcat and screenshots.
Version 1.0.2 crashed on every start (a component missing from the manifest) and nothing caught it until a tester
installed it.

## One-time setup

The upload key and its password are already GitHub secrets (`ANDROID_UPLOAD_KEYSTORE_BASE64`,
`ANDROID_KEYSTORE_PASSWORD`). The originals are in `~/Downloads/hrm/android-upload-key/` on the maintainer's Mac:
**back that folder up** (a password manager or an encrypted drive). Play App Signing lets Google reset a lost upload
key, but it takes days.

### 1. Create the app in Play Console

1. [Play Console](https://play.google.com/console) > **Create app**: name `JantaHR`, default language
   **English (United States) – en-US**, App, Free. Accept the declarations.
2. **Dashboard > Set up your app**: privacy policy `https://jantahr.devshipit.com/legal/privacy`, app access
   (the app needs an account: give reviewers a demo login), ads: no, content rating questionnaire, target audience
   18+, data safety (see below), category Business, contact email `jantahr@devshipit.com`, website
   `https://jantahr.devshipit.com`.
3. **Store listing**: short and full description, the icon `docs/android/store/play-icon-512.png`, the feature
   graphic `docs/android/store/feature-graphic-1024x500.png`, and the phone screenshots in
   `docs/android/store/phone/` (1080x1920, the seeded demo company on a local stack, 360x640 at 3x).

Data safety, as submitted: no data shared with third parties (Supabase, Vercel, Resend and Razorpay process it on
our behalf); encrypted in transit; account deletion at `/legal/delete-account`, partial deletion through erasure
requests (`#employees` on the same page). Collected, not processed ephemerally:

| Data type | Required | Purposes |
|---|---|---|
| Name, email address, user IDs | Yes | App functionality, account management (email also developer communications, IDs also security) |
| Address, phone number, religion (optional employee field) | No | App functionality (phone also account management) |
| Other info (date of birth, gender, PAN, Aadhaar) | Yes | App functionality, compliance |
| Purchase history (subscription invoices), other financial info (salary, bank account) | Yes | App functionality, account management / compliance |
| Health info (blood group, optional) | No | App functionality |
| Approximate and precise location (check-in at geo-fenced offices) | No | App functionality, fraud prevention |
| Photos (profile photo, check-in selfie), files and docs | No | App functionality (selfies also fraud prevention) |
| Other in-app messages (helpdesk), other user-generated content | No | App functionality |
| App interactions (audit log) | Yes | Security and compliance |

### 2. First upload, by hand

Google requires the very first bundle to be uploaded in Play Console.

1. On GitHub, publish release `android-v1.0.0` as above. Without Play credentials the workflow builds the bundle and
   attaches `jantahr-1.0.0.aab` to the release; download it.
2. Play Console > **Test and release > Testing > Closed testing** > create a track (or use **Alpha**) > **Create
   release**. Play App Signing: choose **Use Google-generated key**. Upload the `.aab`, add notes, save and roll out.
3. **Setup > App signing**: copy the **SHA-256 certificate fingerprint** of the *App signing key*. Add it, together
   with the upload key's fingerprint, to the web deployment (step 4).

### 3. Let GitHub upload future releases

1. [Google Cloud console](https://console.cloud.google.com/) > create a project (or reuse one) > **APIs & Services >
   Enable APIs** > enable **Google Play Android Developer API**.
2. **IAM & Admin > Service accounts > Create service account** (name `github-play-upload`), no roles. Open it >
   **Keys > Add key > JSON**: a `.json` file downloads.
3. Play Console > **Users and permissions > Invite new users**: the service account's email, with app permissions
   for JantaHR: *Release to testing tracks*, *Release to production* (if the workflow may promote), *View app
   information*.
4. Store the file as a GitHub secret, from a terminal in the repository:
   `gh secret set PLAY_SERVICE_ACCOUNT_JSON < ~/Downloads/<the-file>.json`, then delete the downloaded file.

If an upload fails with "Only releases with status draft may be created on draft app", set the repository variable
`PLAY_RELEASE_STATUS` to `draft` until the first release is rolled out, then remove it.

### 4. Link the site and the app

The app opens full screen only when the site vouches for it. On the web deployment (Vercel) set:

| Variable | Value |
|---|---|
| `ANDROID_PACKAGE_NAME` | `com.devshipit.jantahr` |
| `ANDROID_CERT_SHA256` | the Play app signing key's SHA-256 and the upload key's, comma-separated |

then redeploy and check `https://jantahr.devshipit.com/.well-known/assetlinks.json`. Google's
[Statement List Tester](https://developers.google.com/digital-asset-links/tools/generator) should report the link
as valid. If the app shows a browser bar at the top, this file is wrong or the app was signed with another key.

### 5. Testers, then production

New personal developer accounts must run a **closed test with at least 12 testers, opted in for 14 days in a row**,
before Play lets them apply for production access. In **Closed testing > Testers**, add an email list (Google
accounts) of 12 or more people, share the opt-in link with them, and keep them installed for the full 14 days
(recruit a few extra: the count reportedly restarts if it drops below 12). Then **Dashboard > Apply for production**.

## iPhone and iPad

There is nothing to publish. People open `https://jantahr.devshipit.com` in **Safari**, tap **Share**, then **Add to
Home Screen**. Inside the app, **Account menu > Install the app** shows the same steps, and on Android and desktop
browsers it offers the browser's own install or the Play Store app.

What makes this work: the web app manifest (`packages/frontend/src/app/manifest.ts`), the PNG icons in
`packages/frontend/public/icons/` (iPhones ignore SVG icons), and the service worker (`public/sw.js`), which serves
an offline page when there is no connection and keeps the app's build files on the device. Pages and API responses
are never cached, so personal data is not stored by it.

## Building locally

Needs JDK 17, the Android SDK (platform 36) and Gradle 8.11.1:

```bash
gradle -p packages/android bundleRelease
```

The bundle is in `packages/android/app/build/outputs/bundle/release/`. Without `ANDROID_KEYSTORE_PATH` and
`ANDROID_KEYSTORE_PASSWORD` it is unsigned.
