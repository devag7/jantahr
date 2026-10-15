package com.devshipit.jantahr;

import com.google.androidbrowserhelper.locationdelegation.LocationDelegationExtraCommandHandler;

/** Lets the site ask for location (attendance check-in) through the app's own Android permission. */
public class DelegationService extends com.google.androidbrowserhelper.trusted.DelegationService {
    @Override
    public void onCreate() {
        super.onCreate();
        registerExtraCommandHandler(new LocationDelegationExtraCommandHandler());
    }
}
