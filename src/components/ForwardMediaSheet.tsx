import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send } from "lucide-react";
import DefaultAvatar from "./DefaultAvatar";
import { getAllChatMetas, type ChatMeta } from "@/lib/p2p";
import type { MediaAttachment } from "@/lib/media";

interface ForwardMediaSheetProps {
  open: boolean;
  media: MediaAttachment | null;
  onClose: () => void;
  onSubmit: (chatId: string, caption: string) => void;
}

const ForwardMediaSheet = ({ open, media, onClose, onSubmit }: ForwardMediaSheetProps) => {
  const [contacts, setContacts] = useState<ChatMeta[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string>("");
  const [caption, setCaption] = useState("");

  useEffect(() => {
    if (!open) return;
    getAllChatMetas().then(setContacts).catch(() => setContacts([]));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSelectedChatId("");
      setCaption("");
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && media && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-end bg-background/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-background border-t border-border rounded-t-2xl p-4 space-y-4 max-h-[80vh] overflow-y-auto"
          >
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Select Contact</p>
              <div className="rounded-xl border border-border bg-secondary/20 p-3 flex items-center gap-3">
                {media.type === "image" ? (
                  <img src={media.url} alt={media.name} className="w-14 h-14 rounded-lg object-cover" loading="lazy" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-secondary flex items-center justify-center text-xs text-muted-foreground px-2 text-center">
                    {media.name}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{media.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{media.mimeType}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {contacts.map((contact) => (
                <button
                  key={contact.friendId}
                  onClick={() => setSelectedChatId(contact.friendId)}
                  className={`w-full flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${selectedChatId === contact.friendId ? "border-primary bg-primary/10" : "border-border bg-background"}`}
                >
                  <DefaultAvatar src={contact.friendAvatar || undefined} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{contact.friendName}</p>
                    <p className="text-xs text-muted-foreground truncate">{contact.friendId}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Caption</p>
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a message"
                className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-xl border border-border px-4 py-3 text-sm text-foreground">
                Cancel
              </button>
              <button
                onClick={() => selectedChatId && onSubmit(selectedChatId, caption)}
                disabled={!selectedChatId}
                className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm text-primary-foreground font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send size={16} /> Send
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ForwardMediaSheet;