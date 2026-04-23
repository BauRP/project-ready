import { AnimatePresence, motion } from "framer-motion";
import type { DisappearingDuration } from "@/lib/chat-preferences";

interface DisappearingMessagesModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (duration: DisappearingDuration) => void;
}

const options: Array<{ label: string; value: DisappearingDuration }> = [
  { label: "1 hour", value: "1h" },
  { label: "6 hours", value: "6h" },
  { label: "12 hours", value: "12h" },
  { label: "24 hours", value: "24h" },
  { label: "Always (Off)", value: "off" },
];

const DisappearingMessagesModal = ({ open, onClose, onSelect }: DisappearingMessagesModalProps) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-background/60 backdrop-blur-sm px-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel neon-border rounded-2xl p-5 w-full max-w-sm space-y-3"
          >
            <p className="text-sm font-semibold text-foreground">Disappearing Messages</p>
            <div className="space-y-2">
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onSelect(option.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-left text-sm text-foreground hover:bg-secondary/50"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="w-full rounded-xl border border-border px-4 py-3 text-sm text-foreground">
              Back
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DisappearingMessagesModal;