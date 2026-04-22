import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { getOrCreateIdentity, getKeyFingerprint, type IdentityKeys } from "@/lib/crypto";
import { publishPublicKeys } from "@/lib/gun-setup";
import { nukeAllData } from "@/lib/storage";

interface IdentityContextType {
  identity: IdentityKeys | null;
  fingerprint: string;
  isLoading: boolean;
  stealthMode: boolean;
  toggleStealth: () => void;
  deleteAccount: () => Promise<void>;
}

const IdentityContext = createContext<IdentityContextType | undefined>(undefined);

export const IdentityProvider = ({ children }: { children: ReactNode }) => {
  const [identity, setIdentity] = useState<IdentityKeys | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stealthMode, setStealthMode] = useState(() => {
    try { return localStorage.getItem("trivo-stealth") === "true"; } catch { return false; }
  });

  useEffect(() => {
    let cancelled = false;
    
    const initIdentity = async () => {
      try {
        const keys = await getOrCreateIdentity();
        if (cancelled) return;

        setIdentity(keys);
        setIsLoading(false);

        const userId = getKeyFingerprint(keys.signing.publicKey);
        
        // БОСС: Публикуем ключи не мгновенно, а даем GunDB 2 секунды на прогрев
        setTimeout(() => {
          try {
            publishPublicKeys(userId, keys.signing.publicKey, keys.exchange.publicKey);
            console.log("Личность опубликована в сети:", userId);
          } catch (e) {
            console.error("Ошибка публикации ключей:", e);
          }
        }, 2000);

      } catch (error) {
        console.error("Критическая ошибка инициализации личности:", error);
        if (!cancelled) setIsLoading(false);
      }
    };

    initIdentity();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem("trivo-stealth", String(stealthMode)); } catch {}
  }, [stealthMode]);

  const toggleStealth = useCallback(() => setStealthMode((p) => !p), []);

  const deleteAccount = useCallback(async () => {
    // Полная очистка перед удалением
    await nukeAllData();
    localStorage.clear();
    window.location.reload();
  }, []);

  const fingerprint = identity ? getKeyFingerprint(identity.signing.publicKey) : "";

  return (
    <IdentityContext.Provider
      value={{ identity, fingerprint, isLoading, stealthMode, toggleStealth, deleteAccount }}
    >
      {children}
    </IdentityContext.Provider>
  );
};

export const useIdentity = () => {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error("useIdentity must be used within IdentityProvider");
  return ctx;
};
