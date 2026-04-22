import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

interface MuteModalProps {
  open: boolean;
  onClose: () => void;
  onMute: (duration: string) => void;
}

const MuteModal = ({ open, onClose, onMute }: MuteModalProps) => {
  const { t } = useLanguage();
  const options = [
    { key: "oneHour", value: "1h" },
    { key: "sixHours", value: "6h" },
    { key: "twelveHours", value: "12h" },
    { key: "always", value: "always" },
  ] as const;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel neon-border p-5 mx-6 w-full max-w-xs"
          >
            <p className="text-sm font-semibold text-foreground mb-4">{t("muteFor")}</p>
            <div className="space-y-2">
              {options.map(({ key, value }) => (
                <button
                  key={value}
                  onClick={() => onMute(value)}
                  className="w-full text-left px-4 py-2.5 rounded-lg text-sm text-foreground hover:bg-secondary/50 transition-colors"
                >
                  {t(key)}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-4 pt-3 border-t border-border/30">
              <button
                onClick={onClose}
                className="flex-1 py-2 rounded-lg glass-panel-sm text-sm text-foreground"
              >
                {t("cancel")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MuteModal;
