#!/usr/bin/env bash
# Installs the release build on a running emulator, opens it like the launcher does and records what happened:
# crash traces, the activity on screen and screenshots (android-smoke.yml uploads ./smoke). Fails when the app
# crashes or does not hand the site to a browser.
set -u
APK="$1"
PKG=com.devshipit.jantahr
mkdir -p smoke
adb install -r "$APK"
adb shell pm list packages | grep -E 'chrome|webview' > smoke/browsers.txt || true
adb shell dumpsys package com.android.chrome | grep -m1 versionName >> smoke/browsers.txt || true
adb logcat -c
adb shell am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n "$PKG/.LauncherActivity" | tee smoke/start.txt
# Taps the first on-screen element whose text is one of the arguments (Chrome's first-run screens on a fresh
# emulator; a phone that has used Chrome never shows them).
tap_text() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || return 1
  local xml; xml=$(adb exec-out cat /sdcard/ui.xml)
  for label in "$@"; do
    local b; b=$(printf '%s' "$xml" | tr '>' '\n' | grep -F "text=\"$label\"" | grep -o 'bounds="[^"]*"' | head -1)
    if [ -n "$b" ]; then
      read -r x1 y1 x2 y2 <<< "$(printf '%s' "$b" | grep -oE '[0-9]+' | tr '\n' ' ')"
      adb shell input tap $(( (x1 + x2) / 2 )) $(( (y1 + y2) / 2 )); echo "tapped: $label"; return 0
    fi
  done
  return 1
}
shot() {
  adb exec-out screencap -p > "smoke/screen-$1.png"
  adb shell dumpsys activity activities | grep -E 'topResumedActivity|mResumedActivity' > "smoke/activity-$1.txt" || true
}
sleep 5; shot 5s
for i in 1 2 3 4 5; do
  tap_text "Use without an account" "Accept & continue" "No thanks" "No, thanks" "Got it" || break
  sleep 3
done
sleep 10; shot 20s
sleep 10; shot 30s
adb shell pidof "$PKG" > smoke/pid.txt || echo "not running" > smoke/pid.txt
adb logcat -d > smoke/logcat.txt
grep -nE 'FATAL EXCEPTION|AndroidRuntime|has died|ANR in|TWA|TrustedWebActivity|androidbrowserhelper|cr_' smoke/logcat.txt | head -200 > smoke/summary.txt || true
echo "--- pid"; cat smoke/pid.txt
echo "--- activity after 30s"; cat smoke/activity-30s.txt
echo "--- browsers"; cat smoke/browsers.txt
echo "--- crash lines"; grep -nE 'FATAL EXCEPTION' -A 25 smoke/logcat.txt | head -60 || echo none
# Fail on a crash of the app, or when it never handed the site to the browser. The launcher finishes itself after the
# hand-off, so Android may end the app's own process: that is normal, the site runs in Chrome's Trusted Web Activity.
if grep -q "FATAL EXCEPTION" smoke/logcat.txt && grep -q "Process: $PKG" smoke/logcat.txt; then echo "::error::The app crashed on start"; exit 1; fi
if ! grep -q "Found TWA provider" smoke/logcat.txt; then echo "::error::The app did not hand the site to a browser"; exit 1; fi
if grep -q "CustomTabActivity" smoke/activity-30s.txt; then echo "The site is open in the app (Trusted Web Activity)"
else echo "::warning::The app handed the site to the browser, but the screen after 30 s is: $(cat smoke/activity-30s.txt)"; fi
