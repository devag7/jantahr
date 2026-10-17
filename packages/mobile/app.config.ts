import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * JantaHR for Android (and later iPhone): the same package as the earlier Play app, so installs update in place.
 * Version and version code come from the release workflow (APP_VERSION, APP_VERSION_CODE). The defaults talk to the
 * production site; set EXPO_PUBLIC_* to point a development build at a local stack. The Supabase publishable key is
 * public by design (the website ships it too).
 */
const SITE = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://jantahr.devshipit.com';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'JantaHR',
  slug: 'jantahr',
  scheme: 'jantahr',
  version: process.env.APP_VERSION ?? '2.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  backgroundColor: '#F5F5F7',
  android: {
    package: 'com.devshipit.jantahr',
    versionCode: Number(process.env.APP_VERSION_CODE ?? 20000),
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', monochromeImage: './assets/monochrome-icon.png', backgroundColor: '#1260BD' },
    permissions: ['android.permission.ACCESS_COARSE_LOCATION', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.CAMERA', 'android.permission.USE_BIOMETRIC'],
    // nothing in the app records audio or reads the photo library: keep these out of the Play listing
    blockedPermissions: [
      'android.permission.RECORD_AUDIO', 'android.permission.READ_MEDIA_IMAGES', 'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE', 'android.permission.SYSTEM_ALERT_WINDOW',
    ],
  },
  ios: { bundleIdentifier: 'com.devshipit.jantahr', supportsTablet: false },
  web: { favicon: './assets/favicon.png', bundler: 'metro', output: 'single' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-web-browser',
    ['expo-location', { locationWhenInUsePermission: 'JantaHR uses your location when you check in, to confirm you are at an office your company has set up.' }],
    ['expo-image-picker', { cameraPermission: 'JantaHR uses the camera for your check-in selfie and to photograph expense receipts.', photosPermission: false, microphonePermission: false }],
    ['expo-local-authentication', { faceIDPermission: 'Unlock JantaHR with Face ID.' }],
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 96, backgroundColor: '#F5F5F7', dark: { backgroundColor: '#161617' } }],
    // plain HTTP only for the emulator journey build, which talks to the CI runner's own API (10.0.2.2)
    ['expo-build-properties', { android: { minSdkVersion: 24, usesCleartextTraffic: (process.env.EXPO_PUBLIC_API_URL ?? '').startsWith('http://') } }],
    './plugins/with-release-signing',
  ],
  // the React Compiler memoizes components and hooks, so screens re-render only what changed
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    siteUrl: SITE,
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? `${SITE}/api`,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://ldjcybaijvvjrzkozcqe.supabase.co',
    supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_BZrNLwBYroLpkoFkmx7j8Q_ILJWIVby',
    // the OAuth web client: Android's Credential Manager returns a Google ID token issued for it, which Supabase accepts
    googleWebClientId: '1078518384820-m67bbl245iu1so9d29ib2nc404psl2nl.apps.googleusercontent.com',
  },
});
