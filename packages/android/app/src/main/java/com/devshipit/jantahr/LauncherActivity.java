package com.devshipit.jantahr;

import android.content.pm.ActivityInfo;
import android.os.Build;
import android.os.Bundle;

public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Setting an orientation crashes the transparent splash on Android 8.0 and below
        // (https://github.com/GoogleChromeLabs/bubblewrap/issues/496); the web app follows the device either way.
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
    }
}
