import { useState, useEffect, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";

export function useBiometricAuth() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(() => {
    return localStorage.getItem("trivo-biometric") === "true";
  });
  const [isLocked, setIsLocked] = useState(false);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    const init = async () => {
      await checkAvailability();
      // Only lock on startup if biometric was previously enabled
      const enabled = localStorage.getItem("trivo-biometric") === "true";
      if (enabled && Capacitor.isNativePlatform()) {
        setIsLocked(true);
        await authenticate();
      }
    };
    init();
  }, []);

  const checkAvailability = async () => {
    if (!Capacitor.isNativePlatform()) {
      setIsAvailable(false);
      return;
    }
    try {
      const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
      const result = await BiometricAuth.checkBiometry();
      setIsAvailable(result.isAvailable);
    } catch {
      setIsAvailable(false);
    }
  };

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
      setIsLocked(false);
      return true;
    }
    try {
      const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
      await BiometricAuth.authenticate({
        reason: "Unlock Trivo Chat",
        cancelTitle: "Cancel",
      });
      setIsLocked(false);
      return true;
    } catch {
      // Keep locked on failure so user can retry
      return false;
    }
  }, []);

  const toggle = useCallback(async () => {
    if (!isEnabled) {
      const success = await authenticate();
      if (success) {
        setIsEnabled(true);
        localStorage.setItem("trivo-biometric", "true");
      }
    } else {
      setIsEnabled(false);
      localStorage.setItem("trivo-biometric", "false");
      setIsLocked(false);
    }
  }, [isEnabled, authenticate]);

  return { isAvailable, isEnabled, isLocked, toggle, authenticate };
}
