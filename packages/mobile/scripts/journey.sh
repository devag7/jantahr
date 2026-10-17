#!/usr/bin/env bash
# Signs in to a test build of the app on an emulator and walks the main screens, as an employee and as a manager,
# saving a screenshot and the screen's text for each (android-smoke.yml uploads ./journey). The build talks to the
# CI runner's own API and GoTrue test double (10.0.2.2 is the host as seen from the emulator) with the demo seed's
# accounts, never to production. Fails on a crash or when a screen does not show what it should.
set -u
APK="$1"
PKG=com.devshipit.jantahr
OUT=journey
mkdir -p "$OUT"
fail=0

dump() { adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb exec-out cat /sdcard/ui.xml; }
# taps the first element whose attributes contain $1 (for example 'text="Leave"' or 'content-desc="Work email"')
tap() {
  local b; b=$(dump | tr '>' '\n' | grep -F "$1" | grep -o 'bounds="[^"]*"' | head -1)
  if [ -z "$b" ]; then echo "  could not find $1"; return 1; fi
  read -r x1 y1 x2 y2 <<< "$(printf '%s' "$b" | grep -oE '[0-9]+' | tr '\n' ' ')"
  adb shell input tap $(( (x1 + x2) / 2 )) $(( (y1 + y2) / 2 ))
}
shot() {
  sleep "${2:-3}"
  adb exec-out screencap -p > "$OUT/$1.png"
  dump > "$OUT/$1.xml"
  grep -o 'text="[^"]\+"' "$OUT/$1.xml" | sed 's/text="//; s/"$//' | head -40 > "$OUT/$1.txt"
}
expect() { # $1 screen, $2 text that must be on it
  if grep -qF "$2" "$OUT/$1.txt"; then echo "ok    $1 shows \"$2\""; else echo "::error::$1 does not show \"$2\""; fail=1; fi
}
type_into() { tap "content-desc=\"$1\"" && sleep 0.5 && adb shell input text "$2"; }
sign_in() {
  adb shell am force-stop "$PKG"; adb shell pm clear "$PKG" >/dev/null
  adb shell am start -W -n "$PKG/.MainActivity" >/dev/null
  sleep 8
  type_into "Work email" "$1"
  type_into "Password" "$2"
  adb shell input keyevent KEYCODE_BACK   # close the keyboard
  sleep 1; tap 'content-desc="Sign in"' || tap 'text="Sign in"'
}

adb install -r "$APK" >/dev/null
adb logcat -c

echo "--- employee"
sign_in employee@jantahr.com Demo@1234
shot employee-home 10;            expect employee-home "Check in"; expect employee-home "LEAVE LEFT"
# bottom-bar items carry their label as content-desc (More's adds the badge: "More, 14 new notifications")
tap 'content-desc="Attendance'; shot employee-attendance; expect employee-attendance "Present"
tap 'content-desc="Leave'; shot employee-leave;      expect employee-leave "Apply for leave"
tap 'text="Apply for leave"'; shot employee-apply-leave; expect employee-apply-leave "Tap the first day"
adb shell input keyevent KEYCODE_BACK; sleep 1
tap 'content-desc="Payslips'; shot employee-payslips;   expect employee-payslips "Sep 2026"
tap 'content-desc="More'; shot employee-more;       expect employee-more "Vikram Singh"
tap 'text="Notifications"'; shot employee-notifications
adb shell input keyevent KEYCODE_BACK; sleep 1
tap 'content-desc="Home'; shot employee-home-again 2

echo "--- manager"
sign_in manager@jantahr.com Demo@1234
shot manager-home 10;      expect manager-home "waiting for you"
tap 'content-desc="More'; shot manager-more;        expect manager-more "Approvals"
tap 'text="Approvals"';    shot manager-approvals;   expect manager-approvals "Approve"
tap 'text="Reject"';       shot manager-reject-sheet 2; expect manager-reject-sheet "Reject this request?"
adb shell input keyevent KEYCODE_BACK; sleep 1
adb shell input keyevent KEYCODE_BACK; sleep 1
tap 'text="My team"';      shot manager-team;        expect manager-team "in today"

adb logcat -d > "$OUT/logcat.txt"
if grep -q "FATAL EXCEPTION" "$OUT/logcat.txt" && grep -q "Process: $PKG" "$OUT/logcat.txt"; then echo "::error::The app crashed"; grep -A25 "FATAL EXCEPTION" "$OUT/logcat.txt" | head -40; fail=1; fi
grep -E "ReactNativeJS.*(Error|Warning)" "$OUT/logcat.txt" | head -20 || true
exit $fail
