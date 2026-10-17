#!/usr/bin/env bash
# Installs the release build on a running emulator, opens it like the launcher does and records what happened:
# crash traces, the activity on screen and screenshots (android-smoke.yml uploads ./smoke).
set -u
APK="$1"
PKG=com.devshipit.jantahr
mkdir -p smoke
adb install -r "$APK"
adb shell pm list packages | grep -E 'chrome|webview' > smoke/browsers.txt || true
adb shell dumpsys package com.android.chrome | grep -m1 versionName >> smoke/browsers.txt || true
adb logcat -c
adb shell am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n "$PKG/.LauncherActivity" | tee smoke/start.txt
for t in 5 15 30; do
  sleep $(( t == 5 ? 5 : 10 ))
  adb exec-out screencap -p > "smoke/screen-${t}s.png"
  adb shell dumpsys activity activities | grep -E 'topResumedActivity|mResumedActivity' > "smoke/activity-${t}s.txt" || true
done
adb shell pidof "$PKG" > smoke/pid.txt || echo "not running" > smoke/pid.txt
adb logcat -d > smoke/logcat.txt
grep -nE 'FATAL EXCEPTION|AndroidRuntime|has died|ANR in|TWA|TrustedWebActivity|androidbrowserhelper|cr_' smoke/logcat.txt | head -200 > smoke/summary.txt || true
echo "--- pid"; cat smoke/pid.txt
echo "--- activity after 30s"; cat smoke/activity-30s.txt
echo "--- browsers"; cat smoke/browsers.txt
echo "--- crash lines"; grep -nE 'FATAL EXCEPTION' -A 25 smoke/logcat.txt | head -60 || echo none
exit 0
