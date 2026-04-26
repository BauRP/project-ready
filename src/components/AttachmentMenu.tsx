import { motion, AnimatePresence } from "framer-motion";
import { Image as ImageIcon, Music, FileText } from "lucide-react";

interface AttachmentMenuProps {
  open: boolean;
  onClose: () => void;
  onSelect: (accept: string) => void;
}

const items = [
  { key: "photo", label: "Photo / Gallery", accept: "image/*", icon: ImageIcon, tone: "bg-primary/15 text-primary" },
  { key: "audio", label: "Audio / Music", accept: "audio/*", icon: Music, tone: "bg-yellow-500/15 text-yellow-500" },
  { key: "file", label: "Files", accept: "*/*", icon: FileText, tone: "bg-secondary text-secondary-foreground" },
] as const;

const AttachmentMenu = ({ open, onClose, onSelect }: AttachmentMenuProps) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-background/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ y: 32, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="fixed left-0 right-0 z-50 px-4"
            style={{ bottom: "calc(var(--bottom-nav-offset, 60px) + 76px)" }}
            role="dialog"
            aria-label="Attach media"
          >
            <div className="mx-auto w-full max-w-2xl glass-panel neon-border rounded-2xl p-3 space-y-1">
              {items.map(({ key, label, accept, icon: Icon, tone }) => (
                <button
                  key={key}
                  onClick={() => {
                    onSelect(accept);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-secondary/50 transition-colors text-left"
                >
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}>
                    <Icon size={20} />
                  </span>
                  <span className="text-sm font-medium text-foreground">{label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AttachmentMenu;
