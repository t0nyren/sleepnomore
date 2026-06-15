package com.sleepnomore.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(SleepHealthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
