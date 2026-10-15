# JantaHR on phones: Android app and iPhone

JantaHR runs on phones in two ways, both built from the web app, so every change to the site reaches them at once:

| Platform | How people get it | What it is |
|---|---|---|
| Android | Google Play | A Trusted Web Activity (`packages/android`): the site full screen, no browser bar, Android 16 (API 36) |
| iPhone and iPad | Safari > Share > **Add to Home Screen** | The installable web app (PWA): icon, full screen, offline screen |

A new Play release is only needed when the Android shell changes (icon, colours, permissions, target SDK). Web
changes ship through the normal web deployment.

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
   graphic `docs/android/store/feature-graphic-1024x500.png`, and at least two phone screenshots (take them in the
   app, or use `packages/frontend/public/marketing/mobile.webp` converted to PNG).

Data safety, in short: the app collects name, email, phone, address, employment and payroll details, approximate
and precise location (attendance check-in) and photos (attendance selfie), for app functionality and account
management; data is encrypted in transit; users can request deletion (`/me/privacy` in the app).

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
