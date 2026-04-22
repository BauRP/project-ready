import { AnimatePresence, motion } from "framer-motion";
import { Mic, Paperclip, Send, Smile } from "lucide-react";

interface MessageInputProps {
  value: string;
  placeholder: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onToggleEmoji: () => void;
  onToggleAttach: () => void;
}

const actionTransition = { duration: 0.16, ease: "easeOut" } as const;

const MessageInput = ({
  value,
  placeholder,
  onValueChange,
  onSubmit,
  onToggleEmoji,
  onToggleAttach,
}: MessageInputProps) => {
  const hasText = value.trim().length > 0;

  return (
    <div className="glass-panel rounded-none border-x-0 border-b-0 shrink-0 p-2 flex items-center gap-2">
      <button type="button" onClick={onToggleEmoji} className="p-2 text-muted-foreground" aria-label="Emoji">
        <Smile size={22} />
      </button>
      <button type="button" onClick={onToggleAttach} className="p-2 text-muted-foreground" aria-label="Attachment">
        <Paperclip size={22} />
      </button>
      <input
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSubmit()}
        placeholder={placeholder}
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
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: -4 }}
              transition={actionTransition}
              className="absolute inset-0 flex items-center justify-center rounded-xl bg-secondary text-secondary-foreground"
              aria-label="Record voice message"
            >
              <Mic size={18} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MessageInput;