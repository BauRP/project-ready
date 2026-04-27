import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X } from "lucide-react";

interface UploadOverlayProps {
  /** When true, the banner is rendered above the message input. */
  visible: boolean;
  /** Optional name of the file being uploaded — shown for context. */
  fileName?: string;
  /** Translated label, e.g. "Uploading…". */
  label: string;
  /** Cancel button accessible label. */
  cancelLabel: string;
  /** Cancel handler — must abort the upload AND clear the visible state. */
  onCancel: () => void;
}

/**
 * Block 3 — Upload status overlay.
 *
 * Sits directly above the MessageInput (WhatsApp / Telegram pattern) instead
 * of the system toast area, so it's always visually paired with the chat
 * input. Includes a hard cancel control so a hung upload never traps the UI.
 */
const UploadOverlay = ({ visible, fileName, label, cancelLabel, onCancel }: UploadOverlayProps) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        key="upload-overlay"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.18 }}
        className="px-3 pb-2 will-change-transform"
      >
        <div className="glass-panel-sm border border-primary/30 rounded-full px-3 py-2 flex items-center gap-3">
          <Loader2 size={16} className="text-primary animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{label}</p>
            {fileName && (
              <p className="text-[10px] text-muted-foreground truncate">{fileName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={cancelLabel}
            className="p-1.5 rounded-full hover:bg-destructive/15 text-destructive transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default UploadOverlay;
