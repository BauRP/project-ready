import { Settings, ChevronRight, Camera, X } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useRef } from "react";
import SettingsPage from "./SettingsPage";
import DefaultAvatar from "./DefaultAvatar";
import { useLanguage } from "@/contexts/LanguageContext";

const ProfilePage = () => {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [name, setName] = useState("You");
  const [status, setStatus] = useState("online");
  const [customStatus, setCustomStatus] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAvatar(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const statusOptions = [
    { id: "online", label: t("online"), color: "bg-primary" },
    { id: "away", label: t("away"), color: "bg-yellow-500" },
    { id: "dnd", label: t("doNotDisturb"), color: "bg-destructive" },
    { id: "offline", label: t("offline"), color: "bg-muted-foreground/40" },
    { id: "custom", label: t("custom"), color: "bg-blue-400" },
  ];

  if (showSettings) {
    return <SettingsPage onBack={() => setShowSettings(false)} />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="header-safe-zone px-5 pb-2 shrink-0">
        <div className="header-bar-56 flex items-center justify-between">
          <h1 className="text-2xl font-bold gradient-text">{t("profile")}</h1>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-xl hover:bg-secondary/50 text-muted-foreground transition-colors"
            aria-label={t("settings")}
          >
            <Settings size={22} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Avatar */}
        <div className="flex flex-col items-center px-5 pb-6">
          <div className="relative group">
            <DefaultAvatar src={avatar} size={112} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 rounded-full bg-background/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
            >
              <Camera size={24} className="text-foreground" />
            </button>
            {avatar && (
              <button
                onClick={() => setAvatar(null)}
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-4 text-xl font-bold text-foreground bg-transparent text-center border-none outline-none focus:ring-0"
            placeholder={t("yourName")}
          />

          <div className="flex items-center gap-2 mt-2">
            <div className={`w-2.5 h-2.5 rounded-full ${statusOptions.find((s) => s.id === status)?.color}`}
              style={status === "online" ? { boxShadow: "0 0 6px hsl(var(--neon-glow) / 0.6)" } : {}}
            />
            <span className="text-sm text-muted-foreground">
              {status === "custom" ? customStatus || t("setStatus") : statusOptions.find(s => s.id === status)?.label}
            </span>
          </div>
        </div>

        {/* Status selector */}
        <div className="px-5 space-y-1.5 pb-6">
          <p className="text-xs text-muted-foreground font-medium mb-2 px-1">{t("status")}</p>
          {statusOptions.map((s) => (
            <button
              key={s.id}
              onClick={() => setStatus(s.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                status === s.id ? "glass-panel neon-border" : "glass-panel-sm hover:neon-border"
              }`}
            >
              <div className={`w-3 h-3 rounded-full ${s.color}`}
                style={s.id === "online" && status === s.id ? { boxShadow: "0 0 6px hsl(var(--neon-glow) / 0.6)" } : {}}
              />
              <span className="text-sm text-foreground flex-1 text-left">{s.label}</span>
              {status === s.id && <ChevronRight size={16} className="text-primary" />}
            </button>
          ))}

          {status === "custom" && (
            <input
              value={customStatus}
              onChange={(e) => setCustomStatus(e.target.value)}
              placeholder={t("whatsOnYourMind")}
              className="glass-input w-full mt-2 text-sm"
              maxLength={50}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
