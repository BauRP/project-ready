import { registerPlugin } from "@capacitor/core";

export interface YandexAdsPlugin {
  initialize(options: { appId: string }): Promise<{ initialized: boolean }>;
  showBanner(options: {
    adUnitId: string;
    position?: "top" | "bottom";
    size?: string;
  }): Promise<{ success: boolean; code?: number; description?: string; error?: string }>;
  hideBanner(): Promise<void>;
  destroyBanner(): Promise<void>;
}

/**
 * Capacitor 8 bridge to the native Yandex Mobile Ads SDK 7.x.
 * On web it falls back to a no-op so the waterfall logic in
 * AdMobBanner.tsx can render its placeholder safely.
 */
export const YandexAds = registerPlugin<YandexAdsPlugin>("YandexAds", {
  web: {
    async initialize() {
      return { initialized: false };
    },
    async showBanner() {
      return { success: false, description: "Yandex Ads not available on web" };
    },
    async hideBanner() {},
    async destroyBanner() {},
  },
});
