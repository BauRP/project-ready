import { Flag, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { submitReport, type ReportCategory } from "@/lib/report";
import { toast } from "sonner";

interface ReportMenuProps {
  userId: string;
  open: boolean;
  onClose: () => void;
}

const ReportMenu = ({ userId, open, onClose }: ReportMenuProps) => {
  const { t } = useLanguage();
  const [submitting, setSubmitting] = useState(false);

  const categories: { id: ReportCategory; labelKey: string }[] = [
    { id: "spam", labelKey: "reportSpam" },
    { id: "harassment", labelKey: "reportHarassment" },
    { id: "child_safety", labelKey: "reportChildSafety" },
    { id: "illegal", labelKey: "reportIllegal" },
    { id: "hate_speech", labelKey: "reportHateSpeech" },
  ];

  const handleReport = async (category: ReportCategory) => {
    setSubmitting(true);
    try {
      await submitReport(userId, category);
      toast.success(t("reportSubmitted"));
      onClose();
    } catch {
      toast.error(t("reportFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="glass-panel neon-border rounded-2xl p-5 max-w-sm w-full space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Flag size={18} className="text-destructive" />
                {t("reportUser")}
              </h2>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/50">
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-1.5">
              {categories.map(({ id, labelKey }) => (
                <button
                  key={id}
                  disabled={submitting}
                  onClick={() => handleReport(id)}
                  className="w-full text-left px-4 py-3 rounded-xl glass-panel-sm hover:neon-border transition-all text-sm text-foreground disabled:opacity-50"
                >
                  {t(labelKey as any)}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ReportMenu;
