import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Minimize2 } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import DefaultAvatar from "./DefaultAvatar";
import { useLanguage } from "@/contexts/LanguageContext";

interface CallScreenProps {
  name: string;
  type: "audio" | "video";
  onEnd: () => void;
}

const CallScreen = ({ name, type, onEnd }: CallScreenProps) => {
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(type === "video");
  const [pip, setPip] = useState(false);
  const { t } = useLanguage();

  // PiP: small floating window (manual only via Minimize button)
  if (pip) {
    return (
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="fixed bottom-24 right-4 z-50 w-36 h-48 rounded-2xl glass-panel neon-border overflow-hidden flex flex-col items-center justify-center gap-2 cursor-pointer"
        onClick={() => setPip(false)}
      >
        <DefaultAvatar size={40} />
        <p className="text-xs text-foreground font-medium">{name}</p>
        <div className="flex gap-2">
          <button onClick={(e) => { e.stopPropagation(); setMuted(!muted); }} className="p-1.5 rounded-full glass-panel-sm">
            {muted ? <MicOff size={14} className="text-destructive" /> : <Mic size={14} className="text-foreground" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onEnd(); }} className="p-1.5 rounded-full bg-destructive">
            <PhoneOff size={14} className="text-destructive-foreground" />
          </button>
        </div>
      </motion.div>
    );
  }

  // Full-screen call view (100% viewport)
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9998] flex flex-col items-center justify-center"
      style={{
        width: "100vw",
        height: "100dvh",
        backgroundImage: "var(--gradient-bg)",
        backgroundColor: "hsl(var(--background))",
      }}
    >
      {/* Minimize (PiP) button — manual only */}
      <button
        onClick={() => setPip(true)}
        className="absolute top-6 right-6 p-2.5 rounded-lg hover:bg-secondary/50 text-muted-foreground z-10"
      >
        <Minimize2 size={22} />
      </button>

      <DefaultAvatar size={100} className="mb-6" />
      <h2 className="text-2xl font-bold text-foreground mb-1">{name}</h2>
      <p className="text-sm text-primary mb-2">
        {type === "video" ? t("videoCall") : t("audioCall")}
      </p>
      <p className="text-xs text-muted-foreground mb-12 animate-pulse">
        Calling...
      </p>

      <div className="flex items-center gap-6">
        <button
          onClick={() => setMuted(!muted)}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${muted ? "bg-destructive/20 neon-border" : "glass-panel-sm neon-border"}`}
        >
          {muted ? <MicOff size={22} className="text-destructive" /> : <Mic size={22} className="text-foreground" />}
        </button>

        {type === "video" && (
          <button
            onClick={() => setCameraOn(!cameraOn)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${!cameraOn ? "bg-destructive/20 neon-border" : "glass-panel-sm neon-border"}`}
          >
            {cameraOn ? <Video size={22} className="text-foreground" /> : <VideoOff size={22} className="text-destructive" />}
          </button>
        )}

        <button
          onClick={onEnd}
          className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center neon-glow"
        >
          <PhoneOff size={24} className="text-destructive-foreground" />
        </button>
      </div>
    </motion.div>
  );
};

export default CallScreen;
