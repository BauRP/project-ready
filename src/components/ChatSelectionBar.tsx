import { ArrowLeft, Copy, Forward, Share2, Pencil, Pin, PinOff, Trash2, Users } from "lucide-react";

interface ChatSelectionBarProps {
  count: number;
  allowCopy: boolean;
  allowMediaActions: boolean;
  allowEdit?: boolean;
  allowPin?: boolean;
  isPinned?: boolean;
  allowDeleteForEveryone?: boolean;
  onClose: () => void;
  onCopy: () => void;
  onForward: () => void;
  onShare: () => void;
  onEdit?: () => void;
  onPinToggle?: () => void;
  onDeleteForMe?: () => void;
  onDeleteForEveryone?: () => void;
}

const iconButton = "p-2 rounded-lg hover:bg-secondary/50 transition-colors text-muted-foreground";

const ChatSelectionBar = ({
  count,
  allowCopy,
  allowMediaActions,
  allowEdit,
  allowPin,
  isPinned,
  allowDeleteForEveryone,
  onClose,
  onCopy,
  onForward,
  onShare,
  onEdit,
  onPinToggle,
  onDeleteForMe,
  onDeleteForEveryone,
}: ChatSelectionBarProps) => {
  return (
    <div className="header-safe-zone glass-panel rounded-none border-x-0 border-t-0 px-3 pb-2 header-bar-56 gap-2 z-10 shrink-0 flex items-center">
      <button onClick={onClose} className={iconButton} aria-label="Close selection">
        <ArrowLeft size={20} className="text-foreground" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground truncate">{count}</p>
      </div>

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

      {onDeleteForMe && (
        <button onClick={onDeleteForMe} className={iconButton} aria-label="Delete for me">
          <Trash2 size={18} />
        </button>
      )}

      {allowDeleteForEveryone && onDeleteForEveryone && (
        <button
          onClick={onDeleteForEveryone}
          className="p-2 rounded-lg hover:bg-destructive/15 transition-colors text-destructive"
          aria-label="Delete for everyone"
        >
          <Users size={18} />
        </button>
      )}
    </div>
  );
};

export default ChatSelectionBar;
