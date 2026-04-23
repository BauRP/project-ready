import { ArrowDown, ArrowUp, Search, X } from "lucide-react";

interface ChatSearchBarProps {
  value: string;
  resultCount: number;
  activeIndex: number;
  onChange: (value: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

const ChatSearchBar = ({ value, resultCount, activeIndex, onChange, onNext, onPrev, onClose }: ChatSearchBarProps) => {
  return (
    <div className="glass-panel border-x-0 px-3 py-2 flex items-center gap-2 shrink-0">
      <div className="flex items-center gap-2 flex-1 rounded-lg border border-border bg-background px-3 py-2">
        <Search size={16} className="text-muted-foreground" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search in chat"
          className="bg-transparent outline-none text-sm text-foreground w-full"
        />
      </div>
      <span className="text-xs text-muted-foreground min-w-12 text-center">
        {resultCount > 0 ? `${activeIndex + 1}/${resultCount}` : "0/0"}
      </span>
      <button onClick={onPrev} className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground" aria-label="Previous match">
        <ArrowUp size={16} />
      </button>
      <button onClick={onNext} className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground" aria-label="Next match">
        <ArrowDown size={16} />
      </button>
      <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground" aria-label="Close search">
        <X size={16} />
      </button>
    </div>
  );
};

export default ChatSearchBar;