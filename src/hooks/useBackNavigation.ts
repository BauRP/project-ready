import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";

/**
 * Global back-navigation stack.
 *
 * Components push a handler when they open something dismissable (modal,
 * sheet, full-screen overlay, opened chat). The top handler is invoked on:
 *   - Android hardware Back button (via @capacitor/app)
 *   - Browser Back button / popstate
 *   - Esc key on web
 *
 * The handler should close ONE layer and return true. If no handlers are
 * registered, on native we minimize the app; on web we let the browser do
 * its default thing.
 */
type BackHandler = () => boolean | void;

const stack: BackHandler[] = [];

const runTop = (): boolean => {
  const top = stack[stack.length - 1];
  if (!top) return false;
  try {
    const r = top();
    return r !== false;
  } catch {
    return false;
  }
};

let installed = false;

const install = () => {
  if (installed) return;
  installed = true;

  // Seed a history entry so popstate fires on web back without leaving the app.
  if (typeof window !== "undefined" && window.history) {
    try {
      window.history.pushState({ trivoBack: true }, "");
    } catch {}
  }

  const onPopState = () => {
    if (runTop()) {
      // Re-seed the history entry we just consumed so the next back press
      // also fires popstate instead of leaving the SPA.
      try {
        window.history.pushState({ trivoBack: true }, "");
      } catch {}
    }
    // If nothing on the stack, allow the navigation (browser will leave).
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && stack.length > 0) {
      e.preventDefault();
      runTop();
    }
  };

  window.addEventListener("popstate", onPopState);
  window.addEventListener("keydown", onKeyDown);

  if (Capacitor.isNativePlatform()) {
    CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      if (runTop()) return;
      if (canGoBack) {
        window.history.back();
      } else {
        CapacitorApp.minimizeApp().catch(() => {});
      }
    }).catch(() => {});
  }
};

/**
 * Register a back handler while `active` is true. Most-recently-mounted
 * active handler wins (LIFO), matching the visual layering of overlays.
 */
export const useBackNavigation = (active: boolean, handler: BackHandler) => {
  useEffect(() => {
    install();
    if (!active) return;
    stack.push(handler);
    return () => {
      const i = stack.lastIndexOf(handler);
      if (i >= 0) stack.splice(i, 1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, handler]);
};
