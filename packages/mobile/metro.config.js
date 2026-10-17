// Metro, plus the web app's format helpers (packages/frontend/src/lib/format): one date and money format for the
// site and the phone app, without copying the file.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../frontend/src/lib/format')];
module.exports = config;
