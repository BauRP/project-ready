import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { YandexAds } from "@/lib/yandex-ads";

interface AdMobBannerProps {
  stealthMode?: boolean;
}

// Sequential Waterfall: Google AdMob → Yandex Ads → Hide
// Google IDs
const GOOGLE_APP_ID = "ca-app-pub-9902253594429663~2704731172";
const GOOGLE_UNIT_ID = "ca-app-pub-9902253594429663/9137218096";
// Yandex IDs
const YANDEX_APP_ID = "19125430";
const YANDEX_UNIT_ID = "R-M-19125430-1";

type AdState = "idle" | "google-loading" | "google-loaded" | "yandex-loading" | "yandex-loaded" | "hidden";

const AdMobBanner = ({ stealthMode = false }: AdMobBannerProps) => {
  const [adState, setAdState] = useState<AdState>("idle");
  const listenersRef = useRef<Array<{ remove: () => void } | null>>([]);
  const mountedRef = useRef(true);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const RETRY_INTERVAL_MS = 180_000;

  const adjustLayout = (bannerHeightPx: number) => {
    if (typeof document === "undefined") return;
    // Banner is position: fixed on both web and native, so we MUST publish the
    // real height — headers consume it via .header-safe-zone to push down.
    const effective = Math.max(0, bannerHeightPx);
    document.documentElement.style.setProperty("--ad-banner-height", `${effective}px`);
  };

  const resetLayout = () => adjustLayout(0);

  const clearRetryTimer = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const scheduleRetry = () => {
    clearRetryTimer();
    if (!mountedRef.current || stealthMode) return;
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      if (!mountedRef.current || stealthMode) return;
      loadGoogle();
    }, RETRY_INTERVAL_MS);
  };

  const destroyAds = async () => {
    clearRetryTimer();
    resetLayout();
    for (const l of listenersRef.current) {
      try { l?.remove?.(); } catch {}
    }
    listenersRef.current = [];

    if (Capacitor.isNativePlatform()) {
      try {
        const { AdMob } = await import("@capacitor-community/admob");
        await AdMob.hideBanner().catch(() => {});
        await AdMob.removeBanner().catch(() => {});
      } catch {}

      try {
        await YandexAds.hideBanner().catch(() => {});
        await YandexAds.destroyBanner().catch(() => {});
      } catch {}
    }
  };

  // Step 2: Yandex fallback - ИСПРАВЛЕНО ДЛЯ ТОНКОЙ ПЛАШКИ
  const loadYandex = async () => {
    if (!mountedRef.current) return;
    setAdState("yandex-loading");

    if (!Capacitor.isNativePlatform()) {
      setAdState("yandex-loaded");
      adjustLayout(50);
      return;
    }

    try {
      await YandexAds.initialize({ appId: YANDEX_APP_ID }).catch(() => ({ initialized: false }));
      const result = await YandexAds.showBanner({
        adUnitId: YANDEX_UNIT_ID,
        position: "top",
        size: "50", // Передаем 50, чтобы плагин знал о высоте
      });

      if (!result?.success) {
        setAdState("hidden");
        resetLayout();
        scheduleRetry();
      } else {
        setAdState("yandex-loaded");
        adjustLayout(50); // Фиксируем высоту интерфейса на 50px
      }
    } catch {
      setAdState("hidden");
      resetLayout();
      scheduleRetry();
    }
  };

  // Step 1: Google AdMob first
  const loadGoogle = async () => {
    if (!mountedRef.current || stealthMode) return;
    clearRetryTimer();
    setAdState("google-loading");

    if (!Capacitor.isNativePlatform()) {
      setAdState("google-loaded");
      adjustLayout(50);
      return;
    }

    try {
      const { AdMob, BannerAdSize, BannerAdPosition, BannerAdPluginEvents } =
        await import("@capacitor-community/admob");

      await AdMob.initialize({ initializeForTesting: false });

      const failListener = await AdMob.addListener(
        BannerAdPluginEvents.FailedToLoad,
        () => {
          if (!mountedRef.current) return;
          resetLayout();
          AdMob.removeBanner().catch(() => {});
          loadYandex();
        }
      );
      const loadListener = await AdMob.addListener(
        BannerAdPluginEvents.Loaded,
        () => {
          if (!mountedRef.current) return;
          setAdState("google-loaded");
          adjustLayout(50);
        }
      );
      const sizeListener = await AdMob.addListener(
        BannerAdPluginEvents.SizeChanged,
        (info: { width: number; height: number }) => {
          if (!mountedRef.current) return;
          // Для Google тоже стараемся держать 50, если пришло что-то иное
          adjustLayout(info?.height && info.height > 0 ? info.height : 50);
        }
      );
      listenersRef.current.push(failListener, loadListener, sizeListener);

      await AdMob.showBanner({
        adId: GOOGLE_UNIT_ID,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.TOP_CENTER,
        margin: 0,
      });
    } catch {
      loadYandex();
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    if (stealthMode) {
      clearRetryTimer();
      destroyAds();
      setAdState("hidden");
      return () => { mountedRef.current = false; clearRetryTimer(); };
    }
    loadGoogle();
    return () => {
      mountedRef.current = false;
      clearRetryTimer();
      destroyAds();
    };
  }, [stealthMode]);

  if (stealthMode || adState === "hidden") return null;

  const isVisible =
    adState === "google-loaded" ||
    adState === "yandex-loaded" ||
    adState === "google-loading" ||
    adState === "yandex-loading";

  if (!isVisible) return null;

  return (
    <div
      className="ad-banner-container shrink-0 bg-background flex items-center justify-center"
      style={{
        position: "fixed",
        top: Capacitor.isNativePlatform() ? "var(--safe-top, 0px)" : 0,
        left: 0,
        right: 0,
        width: "100vw",
        maxWidth: "100vw",
        height: 50,
        zIndex: 9999,
        margin: 0,
        padding: 0,
        boxSizing: "border-box",
      }}
    >
      {!Capacitor.isNativePlatform() && (
        <span className="text-xs font-medium text-muted-foreground tracking-wide">
          {adState === "google-loaded" || adState === "google-loading" ? "Google AdMob" : "Yandex Ads"}
        </span>
      )}
    </div>
  );
};

export default AdMobBanner;
