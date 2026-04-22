import { Star, Check, CheckCheck, MoreVertical, VolumeX, Trash2, Ban, StarOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import DefaultAvatar from "./DefaultAvatar";
import MuteModal from "./MuteModal";
import { getAllChatMetas, type ChatMeta } from "@/lib/p2p";
import { dbGet, dbPut } from "@/lib/storage";

interface Chat {
  id: string;
  name: string;
  avatar?: string | null;
  lastMessage: string;
  time: string;
  unread: number;
  starred: boolean;
  status: "sent" | "read";
  muted: boolean;
  blocked: boolean;
}

interface ChatListProps {
  onOpenChat: (chatId: string, name: string, emoji: string) => void;
}

const ChatList = ({ onOpenChat }: ChatListProps) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [muteTarget, setMuteTarget] = useState<string | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const loadChats = async () => {
      const metas = await getAllChatMetas();
      const starred = (await dbGet<string[]>("settings", "starred-chats")) || [];
      const chatList: Chat[] = metas.map((m: ChatMeta) => ({
        id: m.friendId,
        name: m.friendName,
        avatar: m.friendAvatar || null,
        lastMessage: m.lastMessage || (t("e2eSessionStarted") || "E2E Encrypted Session Started"),
        time: m.lastMessageTime
          ? new Date(m.lastMessageTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "",
        unread: m.unread,
        starred: starred.includes(m.friendId),
        status: "sent" as const,
        muted: false,
        blocked: false,
      }));
      setChats(chatList);
    };
    loadChats();
    const interval = setInterval(loadChats, 3000);
    return () => clearInterval(interval);
  }, [t]);

  const toggleStar = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, starred: !c.starred } : c)));
    const starred = (await dbGet<string[]>("settings", "starred-chats")) || [];
    const updated = starred.includes(id) ? starred.filter((s) => s !== id) : [...starred, id];
    await dbPut("settings", "starred-chats", updated);
  };

  const clearChat = (id: string) => {
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, lastMessage: "", unread: 0 } : c)));
    setMenuOpen(null);
  };

  const toggleBlock = (id: string) => {
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, blocked: !c.blocked } : c)));
    setMenuOpen(null);
  };

  const deleteChat = (id: string) => {
    setChats((prev) => prev.filter((c) => c.id !== id));
    setMenuOpen(null);
  };

  const handleMute = (duration: string) => {
    if (muteTarget) {
      setChats((prev) => prev.map((c) => (c.id === muteTarget ? { ...c, muted: true } : c)));
    }
    setMuteTarget(null);
    setMenuOpen(null);
  };

  const sorted = [...chats].sort((a, b) => {
    if (a.starred && !b.starred) return -1;
    if (!a.starred && b.starred) return 1;
    return 0;
  });

  if (chats.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="header-safe-zone px-5 pb-4 shrink-0">
          <h1 className="text-2xl font-bold gradient-text">{t("chats")}</h1>
        </div>
        <div className="flex-1 flex items-center justify-center px-8">
          <p className="text-sm text-muted-foreground text-center">
            {t("noActiveChats")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="header-safe-zone px-5 pb-4 shrink-0">
        <h1 className="text-2xl font-bold gradient-text">{t("chats")}</h1>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide px-3 space-y-1.5 pb-20">
        <AnimatePresence>
          {sorted.map((chat, i) => (
            <motion.div
              key={chat.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: i * 0.05 }}
              className="relative"
              style={{ zIndex: menuOpen === chat.id ? 30 : 1 }}
            >
              <button
                onClick={() => {
                  setChats((prev) => prev.map((c) => c.id === chat.id ? { ...c, unread: 0 } : c));
                  onOpenChat(chat.id, chat.name, "");
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl glass-panel-sm hover:neon-border transition-all text-left"
              >
                <DefaultAvatar src={chat.avatar} size={48} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground truncate">{chat.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-auto">{chat.time}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {chat.lastMessage ? (
                      <>
                        {chat.status === "sent" ? (
                          <Check size={14} className="tick-sent shrink-0" />
                        ) : (
                          <CheckCheck size={14} className="tick-read shrink-0" />
                        )}
                        <span className="text-sm text-muted-foreground truncate">{chat.lastMessage}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t("e2eSessionStarted") || "E2E Session"}
                      </span>
                    )}
                    {chat.muted && <VolumeX size={12} className="text-muted-foreground/40 shrink-0" />}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0 ml-1">
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => toggleStar(e, chat.id)} className="p-1">
                      <Star
                        size={16}
                        className={chat.starred ? "fill-primary text-primary drop-shadow-[0_0_4px_hsl(var(--neon-glow)/0.5)]" : "text-muted-foreground/40"}
                      />
                    </button>
                    {chat.unread > 0 && (
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center neon-glow">
                        {chat.unread}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === chat.id ? null : chat.id); }}
                  className="p-1 rounded-lg hover:bg-secondary/50 text-muted-foreground shrink-0"
                >
                  <MoreVertical size={16} />
                </button>
              </button>

              <AnimatePresence>
                {menuOpen === chat.id && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute right-3 top-14 glass-panel py-1 z-20 min-w-[160px] neon-border"
                  >
                    <button onClick={() => { setMuteTarget(chat.id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-secondary/50 w-full">
                      <VolumeX size={14} className="text-yellow-400" /> {t("mute")}
                    </button>
                    <button onClick={() => clearChat(chat.id)} className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-secondary/50 w-full">
                      <Trash2 size={14} className="text-orange-400" /> {t("clearChat")}
                    </button>
                    <button onClick={() => toggleBlock(chat.id)} className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-secondary/50 w-full">
                      <Ban size={14} className="text-red-400" /> {chat.blocked ? t("unblock") : t("block")}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); toggleStar(e, chat.id); setMenuOpen(null); }} className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-secondary/50 w-full">
                      {chat.starred ? <StarOff size={14} className="text-primary" /> : <Star size={14} className="text-primary" />}
                      {chat.starred ? t("removeFromFavorites") : t("addToFavorites")}
                    </button>
                    <button onClick={() => deleteChat(chat.id)} className="flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-secondary/50 w-full">
                      <Trash2 size={14} /> {t("deleteFriend")}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <MuteModal open={!!muteTarget} onClose={() => setMuteTarget(null)} onMute={handleMute} />
    </div>
  );
};

export default ChatList;
