import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck } from "lucide-react";

interface SecurityScanOverlayProps {
  visible: boolean;
  onComplete: () => void;
}

const SCAN_DURATION = 1500; // 1.5 seconds

const SecurityScanOverlay = ({ visible, onComplete }: SecurityScanOverlayProps) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!visible) {
      setProgress(0);
      return;
    }
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / SCAN_DURATION, 1);
      setProgress(p);
      if (p < 1) {
        requestAnimationFrame(tick);
      } else {
        setTimeout(onComplete, 200);
      }
    };
    requestAnimationFrame(tick);
  }, [visible, onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center"
          style={{ backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
        >
          <div className="bg-background/80 border border-border/50 rounded-2xl p-8 text-center space-y-5 max-w-[280px] mx-4 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <ShieldCheck size={28} className="text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Deep Scan in Progress...</p>
              <p className="text-xs text-muted-foreground">Checking file integrity</p>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                style={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">{Math.round(progress * 100)}%</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SecurityScanOverlay;
