#!/usr/bin/env bash
# Installs the release build on a running emulator, opens it like the launcher does and records what happened:
# crash traces, the activity on screen, the screen's text and screenshots (android-smoke.yml uploads ./smoke).
# Fails when the app crashes, is not in front, or does not show its sign-in screen.
set -u
APK="$1"
PKG=com.devshipit.jantahr
mkdir -p smoke
adb install -r "$APK"
adb logcat -c
adb shell am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n "$PKG/.MainActivity" | tee smoke/start.txt

shot() {
  adb exec-out screencap -p > "smoke/screen-$1.png"
  adb shell dumpsys activity activities | grep -E 'topResumedActivity|mResumedActivity' > "smoke/activity-$1.txt" || true
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 && adb exec-out cat /sdcard/ui.xml > "smoke/ui-$1.xml" || true
}
sleep 8; shot 8s
sleep 12; shot 20s

adb shell pidof "$PKG" > smoke/pid.txt || echo "not running" > smoke/pid.txt
adb logcat -d > smoke/logcat.txt
grep -nE "FATAL EXCEPTION|AndroidRuntime|ReactNativeJS|has died|ANR in" smoke/logcat.txt | head -200 > smoke/summary.txt || true
echo "--- activity after 20s"; cat smoke/activity-20s.txt
echo "--- JS log"; grep -E "ReactNativeJS" smoke/logcat.txt | tail -20 || true
echo "--- crash lines"; grep -nE 'FATAL EXCEPTION' -A 25 smoke/logcat.txt | head -60 || echo none

if grep -q "FATAL EXCEPTION" smoke/logcat.txt && grep -q "Process: $PKG" smoke/logcat.txt; then echo "::error::The app crashed on start"; exit 1; fi
if ! grep -q "$PKG" smoke/activity-20s.txt; then echo "::error::The app is not in front 20 s after start"; exit 1; fi
# the brand header's line is on screen on any phone size (the form can sit below the fold on small ones)
if ! grep -q 'text="Your workday in one place."' smoke/ui-20s.xml; then echo "::error::The sign-in screen did not appear"; exit 1; fi
echo "The app started and shows its sign-in screen"
