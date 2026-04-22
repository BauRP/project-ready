import { Shield, Key, Fingerprint, Lock, Wifi, Activity, Zap, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { useIdentity } from "@/contexts/IdentityContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";

const SecurityDashboard = () => {
  const { identity, fingerprint, stealthMode } = useIdentity();
  const { t } = useLanguage();
  const { isEnabled: biometricEnabled } = useBiometricAuth();

  const statusItems = [
    {
      icon: Lock,
      label: t("encryptionStatus"),
      value: t("e2eeActive"),
      color: "text-primary",
      active: true,
    },
    {
      icon: Fingerprint,
      label: t("biometricLock"),
      value: biometricEnabled ? t("active") : t("inactive"),
      color: "text-pink-400",
      active: biometricEnabled,
    },
    {
      icon: stealthMode ? EyeOff : Eye,
      label: t("stealthMode"),
      value: stealthMode ? t("active") : t("inactive"),
      color: stealthMode ? "text-primary" : "text-muted-foreground",
      active: stealthMode,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="header-safe-zone px-5 pb-4 shrink-0">
        <h1 className="text-2xl font-bold gradient-text">{t("security")}</h1>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Shield Icon — centrally aligned via fixed vertical flex-gap (rem-based for DPI consistency) */}
        <div className="flex justify-center" style={{ paddingTop: "1.25rem", paddingBottom: "1.5rem" }}>
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center neon-glow"
          >
            <Shield size={40} className="text-primary" />
          </motion.div>
        </div>

        {/* Status Cards — Read-only indicators */}
        <div className="px-5 space-y-2">
          {statusItems.map(({ icon: Icon, label, value, color, active }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl glass-panel-sm neon-border"
            >
              <Icon
                size={20}
                className={color}
                style={active ? { filter: "drop-shadow(0 0 4px currentColor)" } : {}}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className={`text-xs ${active ? "text-primary" : "text-muted-foreground"}`}>{value}</p>
              </div>
              {/* Read-only status badge */}
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                {active ? t("active") : t("inactive")}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Key Info */}
        <div className="px-5 mt-6 space-y-2 pb-6">
          <p className="text-xs text-muted-foreground font-medium px-1">{t("localKeyInfo")}</p>

          <div className="glass-panel neon-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Fingerprint size={18} className="text-pink-400" style={{ filter: "drop-shadow(0 0 4px #f472b6)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{t("keyFingerprint")}</p>
                <p className="text-sm font-mono text-foreground truncate">{fingerprint || "..."}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Key size={18} className="text-yellow-400" style={{ filter: "drop-shadow(0 0 4px #facc15)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{t("signingKey")}</p>
                <p className="text-sm font-mono text-foreground truncate">
                  {identity?.signing.publicKey.substring(0, 24)}...
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Zap size={18} className="text-blue-400" style={{ filter: "drop-shadow(0 0 4px #60a5fa)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{t("exchangeKey")}</p>
                <p className="text-sm font-mono text-foreground truncate">
                  {identity?.exchange.publicKey.substring(0, 24)}...
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Activity size={18} className="text-purple-400" style={{ filter: "drop-shadow(0 0 4px #a78bfa)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{t("pqxdhStatus")}</p>
                <p className="text-sm text-primary font-medium">{t("hybridActive")}</p>
              </div>
            </div>
          </div>

          <div className="glass-panel-sm rounded-xl p-4 mt-2">
            <div className="flex items-start gap-3">
              <Wifi size={18} className="text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">{t("p2pNetwork")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("gunDbConnected")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityDashboard;
