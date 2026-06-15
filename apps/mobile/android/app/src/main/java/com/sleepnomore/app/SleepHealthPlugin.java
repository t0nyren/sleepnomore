package com.sleepnomore.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.fitness.Fitness;
import com.google.android.gms.fitness.FitnessActivities;
import com.google.android.gms.fitness.FitnessOptions;
import com.google.android.gms.fitness.data.Session;
import com.google.android.gms.fitness.request.SessionReadRequest;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "SleepHealth")
public class SleepHealthPlugin extends Plugin {
    private static final int GOOGLE_FIT_PERMISSIONS_REQUEST_CODE = 7042;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        int result = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(getContext());
        JSObject ret = new JSObject();
        ret.put("available", result == ConnectionResult.SUCCESS);
        ret.put("source", "google_fit");
        if (result != ConnectionResult.SUCCESS) {
            ret.put("detail", "Google Play services unavailable: " + result);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void requestSleepPermission(PluginCall call) {
        if (!isGooglePlayServicesReady()) {
            JSObject ret = new JSObject();
            ret.put("granted", false);
            ret.put("status", "unavailable");
            call.resolve(ret);
            return;
        }

        FitnessOptions options = sleepFitnessOptions();
        if (GoogleSignIn.hasPermissions(GoogleSignIn.getAccountForExtension(getContext(), options), options)) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            ret.put("status", "available");
            call.resolve(ret);
            return;
        }

        GoogleSignIn.requestPermissions(
            getActivity(),
            GOOGLE_FIT_PERMISSIONS_REQUEST_CODE,
            GoogleSignIn.getAccountForExtension(getContext(), options),
            options
        );

        JSObject ret = new JSObject();
        ret.put("granted", false);
        ret.put("status", "permission_required");
        ret.put("detail", "Google Fit permission request started");
        call.resolve(ret);
    }

    @PluginMethod
    public void getRecentSleep(PluginCall call) {
        if (!isGooglePlayServicesReady()) {
            JSObject ret = baseResult("unavailable");
            ret.put("detail", "Google Play services unavailable");
            call.resolve(ret);
            return;
        }

        FitnessOptions options = sleepFitnessOptions();
        if (!GoogleSignIn.hasPermissions(GoogleSignIn.getAccountForExtension(getContext(), options), options)) {
            call.resolve(baseResult("permission_required"));
            return;
        }

        int lookbackHours = clamp(call.getInt("lookbackHours", 12), 1, 48);
        int staleMinutes = clamp(call.getInt("staleMinutes", 30), 5, 180);
        long now = System.currentTimeMillis();
        long start = now - TimeUnit.HOURS.toMillis(lookbackHours);
        long staleCutoff = now - TimeUnit.MINUTES.toMillis(staleMinutes);

        SessionReadRequest request = new SessionReadRequest.Builder()
            .setTimeInterval(start, now, TimeUnit.MILLISECONDS)
            .readSessionsFromAllApps()
            .includeSleepSessions()
            .build();

        Fitness.getSessionsClient(getActivity(), GoogleSignIn.getAccountForExtension(getContext(), options))
            .readSession(request)
            .addOnSuccessListener(response -> {
                Session latestSleep = null;
                for (Session session : response.getSessions()) {
                    if (!FitnessActivities.SLEEP.equals(session.getActivity())) continue;
                    if (latestSleep == null || session.getEndTime(TimeUnit.MILLISECONDS) > latestSleep.getEndTime(TimeUnit.MILLISECONDS)) {
                        latestSleep = session;
                    }
                }

                if (latestSleep == null) {
                    call.resolve(baseResult("available"));
                    return;
                }

                long sessionStart = latestSleep.getStartTime(TimeUnit.MILLISECONDS);
                long sessionEnd = latestSleep.getEndTime(TimeUnit.MILLISECONDS);
                JSObject ret = baseResult("available");
                ret.put("isSleeping", sessionEnd >= staleCutoff);
                ret.put("startedAt", iso(sessionStart));
                ret.put("endedAt", iso(sessionEnd));
                ret.put("stage", "sleep");
                call.resolve(ret);
            })
            .addOnFailureListener(error -> {
                JSObject ret = baseResult("error");
                ret.put("detail", error.getMessage());
                call.resolve(ret);
            });
    }

    private boolean isGooglePlayServicesReady() {
        return GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(getContext()) == ConnectionResult.SUCCESS;
    }

    private FitnessOptions sleepFitnessOptions() {
        return FitnessOptions.builder()
            .accessSleepSessions(FitnessOptions.ACCESS_READ)
            .build();
    }

    private JSObject baseResult(String status) {
        JSObject ret = new JSObject();
        ret.put("isSleeping", false);
        ret.put("status", status);
        ret.put("source", "google_fit");
        return ret;
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(value, max));
    }

    private String iso(long millis) {
        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        formatter.setTimeZone(TimeZone.getTimeZone("UTC"));
        return formatter.format(new Date(millis));
    }
}
