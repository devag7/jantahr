// Signs release builds with the Play upload key when the release workflow provides it (ANDROID_KEYSTORE_PATH,
// ANDROID_KEYSTORE_PASSWORD, optional ANDROID_KEY_ALIAS / ANDROID_KEY_PASSWORD; PKCS12). Without it the release
// build keeps Expo's debug signing, which is enough for the emulator check but is never uploaded to Play.
const { withAppBuildGradle } = require('expo/config-plugins');

const SIGNING = `
        release {
            if (System.getenv('ANDROID_KEYSTORE_PATH')) {
                storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'))
                storeType 'pkcs12'
                storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
                keyAlias System.getenv('ANDROID_KEY_ALIAS') ?: 'upload'
                keyPassword System.getenv('ANDROID_KEY_PASSWORD') ?: System.getenv('ANDROID_KEYSTORE_PASSWORD')
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (!gradle.includes("System.getenv('ANDROID_KEYSTORE_PATH')")) {
      gradle = gradle.replace(/signingConfigs\s*\{/, (m) => `${m}${SIGNING}`);
      // the release build type: use the upload key when present
      gradle = gradle.replace(/(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/, "$1signingConfig System.getenv('ANDROID_KEYSTORE_PATH') ? signingConfigs.release : signingConfigs.debug");
      if (!gradle.includes('signingConfigs.release : signingConfigs.debug')) throw new Error('with-release-signing: the release build type was not found in android/app/build.gradle');
    }
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
