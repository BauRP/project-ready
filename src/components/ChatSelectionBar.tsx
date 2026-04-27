import { ArrowLeft, Copy, CornerUpLeft, Forward, Share2, Pencil, Pin, PinOff, Trash2 } from "lucide-react";

interface ChatSelectionBarProps {
  count: number;
  allowCopy: boolean;
  allowMediaActions: boolean;
  allowEdit?: boolean;
  allowPin?: boolean;
  isPinned?: boolean;
  /** Reply is only available when exactly one message is selected. */
  allowReply?: boolean;
  /** Show the trash icon. False when no selected message can be deleted (e.g. only foreign tombstones). */
  allowDelete?: boolean;
  onClose: () => void;
  onCopy: () => void;
  onForward: () => void;
  onShare: () => void;
  onEdit?: () => void;
  onPinToggle?: () => void;
  onReply?: () => void;
  /** Opens the delete confirmation bottom sheet. */
  onDelete?: () => void;
}

const iconButton = "p-2 rounded-lg hover:bg-secondary/50 transition-colors text-muted-foreground";

const ChatSelectionBar = ({
  count,
  allowCopy,
  allowMediaActions,
  allowEdit,
  allowPin,
  isPinned,
  allowReply,
  allowDelete,
  onClose,
  onCopy,
  onForward,
  onShare,
  onEdit,
  onPinToggle,
  onReply,
  onDelete,
}: ChatSelectionBarProps) => {
  return (
    <div className="header-safe-zone glass-panel rounded-none border-x-0 border-t-0 px-3 pb-2 header-bar-56 gap-2 z-10 shrink-0 flex items-center">
      <button onClick={onClose} className={iconButton} aria-label="Close selection">
        <ArrowLeft size={20} className="text-foreground" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground truncate">{count}</p>
      </div>

      {/*
        Action cluster: right-aligned, evenly spaced. The "two red people"
        (Users) icon was permanently removed — destructive deletion is now a
        single Trash button that opens a bottom-sheet confirmation. The
        remaining icons (Edit · Copy · Pin · Forward/Share · Trash) flow
        naturally to the right thanks to the flex-1 spacer above.
      */}

      {allowReply && onReply && (
        <button onClick={onReply} className={iconButton} aria-label="Reply to message">
          <CornerUpLeft size={18} />
        </button>
      )}

      {allowEdit && onEdit && (
        <button onClick={onEdit} className={iconButton} aria-label="Edit message">
          <Pencil size={18} />
        </button>
      )}

      {allowCopy && (
        <button onClick={onCopy} className={iconButton} aria-label="Copy messages">
          <Copy size={18} />
        </button>
      )}

      {allowPin && onPinToggle && (
        <button onClick={onPinToggle} className={iconButton} aria-label={isPinned ? "Unpin message" : "Pin message"}>
          {isPinned ? <PinOff size={18} /> : <Pin size={18} />}
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

      {allowDelete && onDelete && (
        <button onClick={onDelete} className={iconButton} aria-label="Delete message">
          <Trash2 size={18} />
        </button>
      )}
    </div>
  );
};

export default ChatSelectionBar;
