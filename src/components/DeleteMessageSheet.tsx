import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Users, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface DeleteMessageSheetProps {
  open: boolean;
  /** True when at least one selected message belongs to the current user. */
  canDeleteForEveryone: boolean;
  onClose: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
}

/**
 * Bottom sheet confirmation for message deletion.
 * Elite dark aesthetic: pure-black background, subtle borders, cyan accent.
 */
const DeleteMessageSheet = ({
  open,
  canDeleteForEveryone,
  onClose,
  onDeleteForMe,
  onDeleteForEveryone,
}: DeleteMessageSheetProps) => {
  const { t } = useLanguage();

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="ds-backdrop"
            className="fixed inset-0 z-[1000] bg-black/70"
            style={{ backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="ds-sheet"
            role="dialog"
            aria-modal="true"
            className="fixed left-0 right-0 bottom-0 z-[1001] mx-auto max-w-md"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
          >
            <div
              className="rounded-t-2xl border-t border-x border-border/30 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]"
              style={{ background: "#000000" }}
            >
              {/* Drag handle */}
              <div className="flex justify-center mb-3">
                <span className="block w-10 h-1 rounded-full bg-white/15" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[15px] font-semibold text-foreground">
                  {t("deleteMessageTitle")}
                </h3>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-white/5 transition-colors"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                {t("deleteMessageDescription")}
              </p>

              {/* Options */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={onDeleteForMe}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border/30 bg-white/[0.02] hover:bg-primary/10 hover:border-primary/40 transition-colors text-left"
                >
                  <Trash2 size={18} className="text-primary shrink-0" />
                  <span className="text-sm font-medium text-foreground">
                    {t("deleteForMe")}
                  </span>
                </button>

                {canDeleteForEveryone && (
                  <button
                    onClick={onDeleteForEveryone}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-destructive/30 bg-destructive/[0.06] hover:bg-destructive/15 transition-colors text-left"
                  >
                    <Users size={18} className="text-destructive shrink-0" />
                    <span className="text-sm font-semibold text-destructive">
                      {t("deleteForEveryone")}
                    </span>
                  </button>
                )}

                <button
                  onClick={onClose}
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-border/20 bg-transparent hover:bg-white/[0.04] transition-colors text-sm font-medium text-muted-foreground"
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default DeleteMessageSheet;
