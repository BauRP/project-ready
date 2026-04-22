package com.baurp.trivochat;

import android.os.Bundle;

import com.baurp.trivochat.yandexads.YandexAdsPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(YandexAdsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
