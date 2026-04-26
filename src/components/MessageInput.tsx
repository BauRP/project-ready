import { AnimatePresence, motion } from "framer-motion";
import { Mic, Paperclip, Send, Smile, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";

interface MessageInputProps {
  value: string;
  placeholder: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onToggleEmoji: () => void;
  onToggleAttach: () => void;
  /** Called with a recorded voice blob when the user releases the mic button. */
  onVoiceRecorded?: (file: File, durationMs: number) => void;
}

const actionTransition = { duration: 0.16, ease: "easeOut" } as const;
const CANCEL_THRESHOLD_PX = 80;

const formatDuration = (ms: number) => {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

const MessageInput = ({
  value,
  placeholder,
  onValueChange,
  onSubmit,
  onToggleEmoji,
  onToggleAttach,
  onVoiceRecorded,
}: MessageInputProps) => {
  const hasText = value.trim().length > 0;
  const { t } = useLanguage();

  const { state: recState, durationMs, start, stop, cancel } = useVoiceRecorder({
    onError: () => {
      toast({ title: t("micPermissionDenied") || "Microphone permission denied", variant: "destructive" });
    },
  });
  const isRecording = recState === "recording" || recState === "requesting" || recState === "stopping";
  const [slideOffset, setSlideOffset] = useState(0);
  const startYRef = useRef<number | null>(null);
  const willCancelRef = useRef(false);

  // Safety: if the picker/keyboard steals focus while recording, hard-cancel.
  useEffect(() => {
    if (!isRecording) return;
    const onVis = () => { if (document.hidden) cancel(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [isRecording, cancel]);

  const handlePointerDown = async (e: React.PointerEvent<HTMLButtonElement>) => {
    if (hasText) return;
    e.preventDefault();
    (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
    startYRef.current = e.clientY;
    willCancelRef.current = false;
    setSlideOffset(0);
    const ok = await start();
    if (!ok) {
      startYRef.current = null;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (startYRef.current === null) return;
    const delta = startYRef.current - e.clientY; // upward = positive
    const offset = Math.max(0, Math.min(delta, 160));
    setSlideOffset(offset);
    willCancelRef.current = offset >= CANCEL_THRESHOLD_PX;
  };

  const finishGesture = async () => {
    if (startYRef.current === null) return;
    startYRef.current = null;
    const cancelled = willCancelRef.current;
    setSlideOffset(0);
    if (cancelled) {
      cancel();
      return;
    }
    const file = await stop();
    if (file) {
      // Reject sub-1s recordings as accidental taps.
      if (durationMs < 1000) {
        toast({ title: t("recordingHold") || "Hold to record" });
        return;
      }
      onVoiceRecorded?.(file, durationMs);
    }
  };

  const handlePointerUp = () => { void finishGesture(); };
  const handlePointerCancel = () => { void finishGesture(); };

  return (
    <>
      {/* Recording overlay — neon-green pulsing pill above the input bar */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            key="rec-overlay"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18 }}
            className="px-3 pb-2"
          >
            <div className="glass-panel-sm border border-emerald-400/40 rounded-full px-4 py-2 flex items-center gap-3">
              <motion.span
                animate={{ scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.1, repeat: Infinity }}
                className="w-2.5 h-2.5 rounded-full bg-emerald-400"
                style={{ boxShadow: "0 0 12px rgb(52 211 153 / 0.8), 0 0 24px rgb(52 211 153 / 0.4)" }}
              />
              <span className="text-xs font-mono tabular-nums text-emerald-400">{formatDuration(durationMs)}</span>
              <span className={`flex-1 text-[11px] truncate ${willCancelRef.current ? "text-destructive" : "text-muted-foreground"}`}>
                {willCancelRef.current ? (t("recordingCancel") || "Release to cancel") : (t("recordingRelease") || "Release to send")}
              </span>
              <Trash2 size={14} className={willCancelRef.current ? "text-destructive" : "text-muted-foreground/50"} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass-panel rounded-none border-x-0 border-b-0 shrink-0 p-2 flex items-center gap-2">
        <button type="button" onClick={onToggleEmoji} className="p-2 text-muted-foreground" aria-label="Emoji" disabled={isRecording}>
          <Smile size={22} />
        </button>
        <button type="button" onClick={onToggleAttach} className="p-2 text-muted-foreground" aria-label="Attachment" disabled={isRecording}>
          <Paperclip size={22} />
        </button>
        <input
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSubmit()}
          placeholder={isRecording ? "" : placeholder}
          readOnly={isRecording}
          className="glass-input flex-1 py-2 px-3 text-sm"
        />
        <div className="relative h-11 w-11 shrink-0">
          <AnimatePresence mode="wait" initial={false}>
            {hasText ? (
              <motion.button
                key="send"
                type="button"
                initial={{ opacity: 0, scale: 0.88, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.88, y: -4 }}
                transition={actionTransition}
                onClick={onSubmit}
                className="absolute inset-0 flex items-center justify-center rounded-xl bg-primary text-primary-foreground"
                aria-label="Send message"
              >
                <Send size={18} />
              </motion.button>
            ) : (
              <motion.button
                key="mic"
                type="button"
                initial={{ opacity: 0, scale: 0.88, y: 4 }}
                animate={{
                  opacity: 1,
                  scale: isRecording ? 1.15 + Math.min(slideOffset / 400, 0.25) : 1,
                  y: -slideOffset * 0.4,
                }}
                exit={{ opacity: 0, scale: 0.88, y: -4 }}
                transition={actionTransition}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onContextMenu={(e) => e.preventDefault()}
                className={`absolute inset-0 flex items-center justify-center rounded-xl transition-colors select-none touch-none ${
                  isRecording
                    ? "bg-emerald-500 text-white"
                    : "bg-secondary text-secondary-foreground"
                }`}
                style={
                  isRecording
                    ? { boxShadow: "0 0 16px rgb(16 185 129 / 0.7), 0 0 32px rgb(16 185 129 / 0.35)" }
                    : undefined
                }
                aria-label={isRecording ? "Recording — release to send, slide up to cancel" : "Hold to record voice"}
              >
                <Mic size={18} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
};

export default MessageInput;
