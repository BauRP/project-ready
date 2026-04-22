import { MessageCircle, MoreVertical, VolumeX, Trash2, Ban, Star, StarOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import DefaultAvatar from "./DefaultAvatar";
import MuteModal from "./MuteModal";
import { getAllChatMetas, type ChatMeta } from "@/lib/p2p";
import { subscribeToPresence, getPresenceStatus, onPresenceChange } from "@/lib/presence";
import { dbGet, dbPut } from "@/lib/storage";

interface Friend {
  id: string;
  name: string;
  avatar?: string | null;
  status: "online" | "away" | "offline";
  blocked: boolean;
  starred: boolean;
}

interface FriendsListProps {
  onOpenChat: (id: string, name: string, emoji: string) => void;
}

const statusColors = {
  online: "bg-primary",
  away: "bg-yellow-500",
  offline: "bg-muted-foreground/40",
};

const FriendsList = ({ onOpenChat }: FriendsListProps) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [muteTarget, setMuteTarget] = useState<string | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const loadFriends = async () => {
      const metas = await getAllChatMetas();
      const starred = (await dbGet<string[]>("settings", "starred-friends")) || [];
      const friendList: Friend[] = metas.map((m: ChatMeta) => ({
        id: m.friendId,
        name: m.friendName,
        avatar: m.friendAvatar || null,
        status: getPresenceStatus(m.friendId),
        blocked: false,
        starred: starred.includes(m.friendId),
      }));
      setFriends(friendList);
    };
    loadFriends();

    const unsubPresence = onPresenceChange((userId, status) => {
      setFriends((prev) => prev.map((f) => f.id === userId ? { ...f, status } : f));
    });

    const interval = setInterval(loadFriends, 5000);
    return () => { clearInterval(interval); unsubPresence(); };
  }, []);

  useEffect(() => {
    const unsubs = friends.map((f) => subscribeToPresence(f.id));
    return () => unsubs.forEach((u) => u());
  }, [friends.length]);

  const removeFriend = (id: string) => {
    setFriends((prev) => prev.filter((f) => f.id !== id));
    setMenuOpen(null);
  };

  const toggleBlock = (id: string) => {
    setFriends((prev) => prev.map((f) => (f.id === id ? { ...f, blocked: !f.blocked } : f)));
    setMenuOpen(null);
  };

  const toggleStar = async (id: string) => {
    setFriends((prev) => prev.map((f) => (f.id === id ? { ...f, starred: !f.starred } : f)));
    setMenuOpen(null);
    const starred = (await dbGet<string[]>("settings", "starred-friends")) || [];
    const updated = starred.includes(id) ? starred.filter((s) => s !== id) : [...starred, id];
    await dbPut("settings", "starred-friends", updated);
  };

  const statusLabelMap: Record<string, string> = {
    online: t("online"),
    away: t("away"),
    offline: t("offline"),
  };

  const sorted = [...friends].sort((a, b) => {
    if (a.starred && !b.starred) return -1;
    if (!a.starred && b.starred) return 1;
    const statusOrder = { online: 0, away: 1, offline: 2 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  if (friends.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="header-safe-zone px-5 pb-4 flex items-center justify-between shrink-0">
          <h1 className="text-2xl font-bold gradient-text">{t("friends")}</h1>
          <span className="text-sm text-muted-foreground">0 {t("contacts")}</span>
        </div>
        <div className="flex-1 flex items-center justify-center px-8">
          <p className="text-sm text-muted-foreground text-center">{t("emptyFriendsList")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="header-safe-zone px-5 pb-4 flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-bold gradient-text">{t("friends")}</h1>
        <span className="text-sm text-muted-foreground">{friends.length} {t("contacts")}</span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide px-3 space-y-1.5">
        <AnimatePresence>
          {sorted.map((friend, i) => (
            <motion.div
              key={friend.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-xl glass-panel-sm hover:neon-border transition-all relative cursor-pointer"
              style={{ zIndex: menuOpen === friend.id ? 30 : 1 }}
              onClick={() => onOpenChat(friend.id, friend.name, "")}
            >
              <div className="relative shrink-0">
                <DefaultAvatar src={friend.avatar} size={48} />
                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${statusColors[friend.status]}`}
                  style={friend.status === "online" ? { boxShadow: "0 0 6px hsl(var(--neon-glow) / 0.6)" } : {}}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-foreground">{friend.name}</p>
                  {friend.starred && <Star size={12} className="fill-primary text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground">{statusLabelMap[friend.status]}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === friend.id ? null : friend.id); }}
                className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground"
              >
                <MoreVertical size={18} />
              </button>

              <AnimatePresence>
                {menuOpen === friend.id && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute right-3 top-14 glass-panel py-1 z-20 min-w-[170px] neon-border"
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenChat(friend.id, friend.name, ""); setMenuOpen(null); }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-secondary/50 w-full"
                    >
                      <MessageCircle size={14} className="text-primary" /> {t("message")}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setMuteTarget(friend.id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-secondary/50 w-full">
                      <VolumeX size={14} className="text-yellow-400" /> {t("mute")}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); toggleBlock(friend.id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-secondary/50 w-full">
                      <Ban size={14} className="text-red-400" /> {friend.blocked ? t("unblock") : t("block")}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); toggleStar(friend.id); }} className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-secondary/50 w-full">
                      {friend.starred ? <StarOff size={14} className="text-primary" /> : <Star size={14} className="text-primary" />}
                      {friend.starred ? t("removeFromFavorites") : t("addToFavorites")}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFriend(friend.id); }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-secondary/50 w-full"
                    >
                      <Trash2 size={14} /> {t("deleteFriend")}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <MuteModal open={!!muteTarget} onClose={() => setMuteTarget(null)} onMute={() => setMuteTarget(null)} />
    </div>
  );
};

export default FriendsList;
