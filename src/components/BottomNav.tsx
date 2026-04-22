import { MessageCircle, UserPlus, Users, User, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { TranslationKey } from "@/i18n/translations";
import { AD_CONFIG } from "@/lib/ad-config";

type Tab = "chats" | "add-friend" | "friends" | "security" | "profile";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; labelKey: TranslationKey; icon: typeof MessageCircle }[] = [
  { id: "chats", labelKey: "chats", icon: MessageCircle },
  { id: "add-friend", labelKey: "add", icon: UserPlus },
  { id: "friends", labelKey: "friends", icon: Users },
  { id: "security", labelKey: "security", icon: Shield },
  { id: "profile", labelKey: "profile", icon: User },
];

const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  const { t } = useLanguage();

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto"
      style={{
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
      }}
    >
      <div
        className="glass-panel px-2 rounded-none rounded-t-2xl neon-border border-b-0"
        style={{
          minHeight: AD_CONFIG.BOTTOM_NAV_HEIGHT,
          paddingTop: 4,
          paddingBottom: "calc(4px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="flex items-center justify-around">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative flex flex-col items-center gap-1 py-3 px-3 transition-colors flex-1"
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-1 left-3 right-3 h-0.5 rounded-full"
                    style={{
                      background: "hsl(var(--neon-glow))",
                      boxShadow: "0 0 8px hsl(var(--neon-glow) / 0.6), 0 0 20px hsl(var(--neon-glow) / 0.3)",
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <div className={`transition-all ${isActive ? "drop-shadow-[0_0_6px_hsl(var(--neon-glow)/0.5)]" : ""}`}>
                  <Icon
                    size={22}
                    className={`transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}
                  />
                </div>
                <span
                  className={`text-[10px] font-medium transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {t(tab.labelKey)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
