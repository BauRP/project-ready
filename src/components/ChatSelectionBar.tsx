import { ArrowLeft, Copy, Forward, Share2 } from "lucide-react";

interface ChatSelectionBarProps {
  count: number;
  allowCopy: boolean;
  allowMediaActions: boolean;
  onClose: () => void;
  onCopy: () => void;
  onForward: () => void;
  onShare: () => void;
}

const iconButton = "p-2 rounded-lg hover:bg-secondary/50 transition-colors text-muted-foreground";

const ChatSelectionBar = ({
  count,
  allowCopy,
  allowMediaActions,
  onClose,
  onCopy,
  onForward,
  onShare,
}: ChatSelectionBarProps) => {
  return (
    <div className="header-safe-zone glass-panel rounded-none border-x-0 border-t-0 px-3 pb-2 header-bar-56 gap-3 z-10 shrink-0 flex items-center">
      <button onClick={onClose} className={iconButton} aria-label="Close selection">
        <ArrowLeft size={20} className="text-foreground" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground truncate">{count}</p>
      </div>
      {allowCopy && (
        <button onClick={onCopy} className={iconButton} aria-label="Copy messages">
          <Copy size={18} />
        </button>
      )}
      {allowMediaActions && (
        <>
          <button onClick={onForward} className={iconButton} aria-label="Forward media">
            <Forward size={18} />
          </button>
          <button onClick={onShare} className={iconButton} aria-label="Share media externally">
            <Share2 size={18} />
          </button>
        </>
      )}
    </div>
  );
};

export default ChatSelectionBar;