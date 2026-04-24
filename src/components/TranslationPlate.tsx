import { ChevronDown, ChevronUp, Languages } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

interface TranslationPlateProps {
  translatedText: string;
  sent: boolean;
}

/**
 * Width-matched, expandable translation plate.
 * - Sits inline inside the message bubble, so it inherits the bubble's exact width.
 * - Uses `layout` so siblings reflow smoothly when expanded/collapsed.
 * - Arrow flips ↑ / ↓ to communicate state.
 */
const TranslationPlate = ({ translatedText, sent }: TranslationPlateProps) => {
  const [open, setOpen] = useState(false);

  const tone = sent
    ? "bg-primary-foreground/15 text-primary-foreground/90 hover:bg-primary-foreground/20"
    : "bg-background/60 text-foreground/80 hover:bg-background/80";

  return (
    <motion.div layout="position" className="mt-1 w-full">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${tone}`}
        aria-expanded={open}
        aria-label={open ? "Hide translation" : "Show translation"}
      >
        <Languages size={11} className="shrink-0" />
        <span className="flex-1 text-left tracking-wide uppercase opacity-80">
          {open ? "Translation" : "Translate"}
        </span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="plate"
            layout
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: "auto", opacity: 1, marginTop: 4 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="w-full overflow-hidden"
          >
            <div
              className={`w-full px-3 py-2 rounded-lg text-xs leading-relaxed break-words ${
                sent
                  ? "bg-primary-foreground/10 text-primary-foreground/95"
                  : "bg-background/70 text-foreground/90"
              }`}
            >
              {translatedText}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default TranslationPlate;
