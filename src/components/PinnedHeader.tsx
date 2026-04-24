import { Pin, X } from "lucide-react";
import { motion } from "framer-motion";

interface PinnedHeaderProps {
  preview: string;
  onJump: () => void;
  onUnpin: () => void;
  label: string;
}

const PinnedHeader = ({ preview, onJump, onUnpin, label }: PinnedHeaderProps) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="glass-panel rounded-none border-x-0 border-t-0 border-b border-border/30 px-3 py-2 flex items-center gap-3 shrink-0 z-10"
    >
      <button
        type="button"
        onClick={onJump}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <span className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <Pin size={14} className="text-primary" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] uppercase tracking-wide text-primary/80 font-semibold">
            {label}
          </span>
          <span className="block text-xs text-foreground truncate">
            {preview}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onUnpin}
        className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground shrink-0"
        aria-label="Unpin"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
};

export default PinnedHeader;
