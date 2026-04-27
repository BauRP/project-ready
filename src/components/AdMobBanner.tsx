import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { YandexAds } from "@/lib/yandex-ads";
import { AD_CONFIG, BANNER_HEIGHT } from "@/lib/ad-config";

/**
 * AdMobBanner — Independent Ad Revenue Controller.
 *
 * IMPORTANT (State Isolation Policy):
 *  - This component MUST remain decoupled from any privacy/visibility
 *    settings such as "Invisible Mode" (stealthMode).
 *  - "Invisible Mode" only controls presence broadcasting (see lib/presence.ts).
 *  - Ad containers must remain visible regardless of the user's online/invisible
 *    status to comply with Google AdMob / Yandex Ads monetization policies and
 *    to avoid behavior that resembles ad-blocking.
 *  - Do NOT introduce a `stealthMode` prop or any privacy-related conditional
 *    here. Ads are gated only by network availability and ad-network load state.
 */

// Sequential Waterfall: Google AdMob → Yandex Ads → Hide
const GOOGLE_APP_ID = "ca-app-pub-9902253594429663~2704731172";
const GOOGLE_UNIT_ID = "ca-app-pub-9902253594429663/9137218096";
const YANDEX_APP_ID = "19125430";
const YANDEX_UNIT_ID = "R-M-19125430-1";

type AdState = "idle" | "google-loading" | "google-loaded" | "yandex-loading" | "yandex-loaded" | "hidden";

const AdMobBanner = () => {
  const [adState, setAdState] = useState<AdState>("idle");
  const listenersRef = useRef<Array<{ remove: () => void } | null>>([]);
  const mountedRef = useRef(true);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const RETRY_INTERVAL_MS = 180_000;

  const adjustLayout = (bannerHeightPx: number) => {
    if (typeof document === "undefined") return;
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
    if (!mountedRef.current) return;
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      if (!mountedRef.current) return;
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

  // Step 2: Yandex fallback
  const loadYandex = async () => {
    if (!mountedRef.current) return;
    setAdState("yandex-loading");

    if (!Capacitor.isNativePlatform()) {
      setAdState("yandex-loaded");
      adjustLayout(BANNER_HEIGHT);
      return;
    }

    try {
      await YandexAds.initialize({ appId: YANDEX_APP_ID }).catch(() => ({ initialized: false }));
      const result = await YandexAds.showBanner({
        adUnitId: YANDEX_UNIT_ID,
        position: "top",
        size: String(BANNER_HEIGHT),
      });

      if (!result?.success) {
        setAdState("hidden");
        resetLayout();
        scheduleRetry();
      } else {
        setAdState("yandex-loaded");
        adjustLayout(BANNER_HEIGHT);
      }
    } catch {
      setAdState("hidden");
      resetLayout();
      scheduleRetry();
    }
  };

  // Step 1: Google AdMob first
  const loadGoogle = async () => {
    if (!mountedRef.current) return;
    clearRetryTimer();
    setAdState("google-loading");

    if (!Capacitor.isNativePlatform()) {
      setAdState("google-loaded");
      adjustLayout(BANNER_HEIGHT);
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
          adjustLayout(BANNER_HEIGHT);
        }
      );
      const sizeListener = await AdMob.addListener(
        BannerAdPluginEvents.SizeChanged,
        () => {
          if (!mountedRef.current) return;
          adjustLayout(BANNER_HEIGHT);
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
    loadGoogle();
    return () => {
      mountedRef.current = false;
      clearRetryTimer();
      destroyAds();
    };
  }, []);

  if (adState === "hidden") return null;

  const isVisible =
    adState === "google-loaded" ||
    adState === "yandex-loaded" ||
    adState === "google-loading" ||
    adState === "yandex-loading";

  if (!isVisible) return null;

  return (
    // Block 4 — Standard 320x50 banner, centered. z-index dropped to 10 so
    // the chat Header (Back/Call/Avatar buttons) always wins pointer events
    // and never gets eclipsed by the ad container.
    <div
      className="fixed top-0 left-1/2 -translate-x-1/2 m-0 p-0 ad-banner-container shrink-0 bg-background flex items-center justify-center"
      style={{
        top: AD_CONFIG.TOP_OFFSET,
        width: `${AD_CONFIG.BANNER_WIDTH}px`,
        height: `${BANNER_HEIGHT}px`,
        maxWidth: "100vw",
        zIndex: AD_CONFIG.Z_INDEX,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
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
