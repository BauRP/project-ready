package com.baurp.trivochat.yandexads;

import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.yandex.mobile.ads.banner.BannerAdEventListener;
import com.yandex.mobile.ads.banner.BannerAdSize;
import com.yandex.mobile.ads.banner.BannerAdView;
import com.yandex.mobile.ads.common.AdRequest;
import com.yandex.mobile.ads.common.AdRequestError;
import com.yandex.mobile.ads.common.ImpressionData;
import com.yandex.mobile.ads.common.InitializationListener;
import com.yandex.mobile.ads.common.MobileAds;

/**
 * Local Capacitor 8 bridge for Yandex Mobile Ads SDK 7.x.
 * Optimized for TrivoChat: Fixed 50px height banner.
 */
@CapacitorPlugin(name = "YandexAds")
public class YandexAdsPlugin extends Plugin {

    private BannerAdView bannerAdView;
    private FrameLayout bannerContainer;
    private boolean initialized = false;

    @PluginMethod
    public void initialize(PluginCall call) {
        if (initialized) {
            call.resolve(new JSObject().put("initialized", true));
            return;
        }
        try {
            MobileAds.initialize(getContext(), new InitializationListener() {
                @Override
                public void onInitializationCompleted() {
                    initialized = true;
                    call.resolve(new JSObject().put("initialized", true));
                }
            });
        } catch (Throwable t) {
            call.reject("Yandex init failed: " + t.getMessage());
        }
    }

    @PluginMethod
    public void showBanner(final PluginCall call) {
        final String adUnitId = call.getString("adUnitId");
        final String position = call.getString("position", "top");
        if (adUnitId == null) {
            call.reject("adUnitId is required");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                if (bannerAdView != null) {
                    removeBannerInternal();
                }

                bannerAdView = new BannerAdView(getContext());
                bannerAdView.setAdUnitId(adUnitId);

                // --- Edge-to-edge sticky banner (full screen width, system-style 50dp height) ---
                int adWidthPx = getContext().getResources().getDisplayMetrics().widthPixels;
                float density = getContext().getResources().getDisplayMetrics().density;
                int adWidthDp = Math.round(adWidthPx / density);

                // stickySize gives a Google-style adaptive banner that spans the full width
                bannerAdView.setAdSize(BannerAdSize.stickySize(getContext(), adWidthDp));
                // -------------------------------------------------------------------------------

                bannerAdView.setBannerAdEventListener(new BannerAdEventListener() {
                    @Override
                    public void onAdLoaded() {
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        call.resolve(ret);
                        notifyListeners("yandexAdLoaded", new JSObject());
                    }

                    @Override
                    public void onAdFailedToLoad(AdRequestError error) {
                        JSObject ret = new JSObject();
                        ret.put("success", false);
                        ret.put("code", error.getCode());
                        ret.put("description", error.getDescription());
                        call.resolve(ret);
                        notifyListeners("yandexAdFailed", ret);
                    }

                    @Override public void onAdClicked() {}
                    @Override public void onLeftApplication() {}
                    @Override public void onReturnedToApplication() {}
                    @Override public void onImpression(ImpressionData impressionData) {}
                });

                bannerContainer = new FrameLayout(getContext());
                FrameLayout.LayoutParams containerParams = new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT);
                containerParams.gravity = "bottom".equalsIgnoreCase(position)
                        ? Gravity.BOTTOM | Gravity.FILL_HORIZONTAL
                        : Gravity.TOP | Gravity.FILL_HORIZONTAL;
                // Zero margins so the banner reaches the screen edges
                containerParams.leftMargin = 0;
                containerParams.rightMargin = 0;
                containerParams.topMargin = 0;
                containerParams.bottomMargin = 0;
                bannerContainer.setLayoutParams(containerParams);
                bannerContainer.setPadding(0, 0, 0, 0);

                FrameLayout.LayoutParams bannerParams = new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT);
                bannerParams.gravity = Gravity.FILL_HORIZONTAL;
                bannerParams.leftMargin = 0;
                bannerParams.rightMargin = 0;
                bannerAdView.setLayoutParams(bannerParams);

                bannerContainer.addView(bannerAdView);
                ((ViewGroup) getBridge().getWebView().getRootView()).addView(bannerContainer);

                bannerAdView.loadAd(new AdRequest.Builder().build());
            } catch (Throwable t) {
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("error", t.getMessage());
                call.resolve(ret);
            }
        });
    }

    @PluginMethod
    public void hideBanner(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (bannerContainer != null) {
                bannerContainer.setVisibility(android.view.View.GONE);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void destroyBanner(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            removeBannerInternal();
            call.resolve();
        });
    }

    private void removeBannerInternal() {
        try {
            if (bannerAdView != null) {
                bannerAdView.destroy();
                bannerAdView = null;
            }
            if (bannerContainer != null) {
                ViewGroup parent = (ViewGroup) bannerContainer.getParent();
                if (parent != null) parent.removeView(bannerContainer);
                bannerContainer = null;
            }
        } catch (Throwable ignored) {}
    }

    @Override
    protected void handleOnDestroy() {
        removeBannerInternal();
        super.handleOnDestroy();
    }
}
