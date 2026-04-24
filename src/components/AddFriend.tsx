import { Copy, UserPlus, Check, Clock, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIdentity } from "@/contexts/IdentityContext";
import { toast } from "sonner";
import gun from "@/lib/gun-setup";
import { saveChatMeta } from "@/lib/p2p";
import { isValidUserId } from "@/lib/identity";
import { isUserBlocked, unblockUser } from "@/lib/report";
import { sendFriendRequest, getOutgoingRequestStatus } from "@/lib/firebase-sync";
import { getPresenceStatus } from "@/lib/presence";

const AddFriend = () => {
  const [peerId, setPeerId] = useState("");
  const [copied, setCopied] = useState(false);
  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const [pendingUnblockId, setPendingUnblockId] = useState("");
  const [addingStatus, setAddingStatus] = useState<"idle" | "adding" | "pending" | "done">("idle");
  const { t } = useLanguage();
  const { userId, identity } = useIdentity();

  const handleCopy = async () => {
    if (!userId) return;
    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      toast.success(t("idCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  const handleAddFriend = async () => {
    const trimmed = peerId.trim();
    if (!trimmed) return;

    if (!isValidUserId(trimmed)) {
      toast.error(t("invalidIdFormat"));
      return;
    }

    if (trimmed === userId) {
      toast.error(t("cannotAddSelf"));
      return;
    }

    // Check if user is blocked
    const blocked = await isUserBlocked(trimmed);
    if (blocked) {
      setPendingUnblockId(trimmed);
      setShowUnblockModal(true);
      return;
    }

    await addFriend(trimmed);
  };

  const addFriend = async (friendId: string) => {
    if (!userId || !identity) return;
    setAddingStatus("adding");

    const requestStatus = await getOutgoingRequestStatus(userId, friendId);
    if (requestStatus === "pending") {
      setAddingStatus("pending");
      toast.info("Friend request already pending");
      return;
    }

    const peerStatus = getPresenceStatus(friendId);

    // Bi-directional Gun handshake
    gun.get("trivo-friends").get(userId).get(friendId).put({
      addedAt: Date.now(),
      status: peerStatus === "online" ? "confirmed" : "pending",
    });
    gun.get("trivo-friends").get(friendId).get(userId).put({
      addedAt: Date.now(),
      status: peerStatus === "online" ? "confirmed" : "pending",
    });

    // Send friend request via Firebase + GunDB for offline delivery
    await sendFriendRequest({
      from: userId,
      to: friendId,
      fromName: userId,
      signingKey: identity.signing.publicKey,
      exchangeKey: identity.exchange.publicKey,
      timestamp: Date.now(),
      status: "pending",
    });

    await saveChatMeta({
      friendId,
      friendName: friendId.substring(0, 8),
      lastMessage: "",
      lastMessageTime: Date.now(),
      unread: 0,
      started: false,
    });

    if (peerStatus === "online") {
      toast.success(t("friendAdded"));
      setAddingStatus("done");
    } else {
      toast.success("Friend request sent — waiting for them to come online");
      setAddingStatus("pending");
    }
    setPeerId("");
    setTimeout(() => setAddingStatus("idle"), 3000);
  };

  const handleUnblockAndAdd = async () => {
    await unblockUser(pendingUnblockId);
    await addFriend(pendingUnblockId);
    setShowUnblockModal(false);
    setPendingUnblockId("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="header-safe-zone px-5 pb-4 shrink-0">
        <h1 className="text-2xl font-bold gradient-text">{t("addFriend")}</h1>
      </div>

      <div className="flex-1 flex flex-col px-5 gap-6 overflow-y-auto scrollbar-hide">
        {/* Your Unique ID */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-5 neon-border rounded-xl"
        >
          <p className="text-xs text-muted-foreground mb-2">{t("yourUniqueId")}</p>
          <div className="flex items-center gap-3">
            <p className="flex-1 font-mono text-sm text-foreground break-all select-all">
              {userId || "..."}
            </p>
            <button
              onClick={handleCopy}
              className="shrink-0 p-2.5 rounded-xl glass-panel-sm hover:neon-border transition-all"
              aria-label="Copy ID"
            >
              {copied ? (
                <Check size={18} className="text-primary" />
              ) : (
                <Copy size={18} className="text-muted-foreground" />
              )}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">{t("shareIdDesc")}</p>
        </motion.div>

        {/* Add Peer ID */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel p-5 neon-border rounded-xl"
        >
          <p className="text-xs text-muted-foreground mb-3">{t("addPeerById")}</p>
          <div className="flex items-center gap-2">
            <input
              value={peerId}
              onChange={(e) => setPeerId(e.target.value)}
              placeholder={t("enterFriendId")}
              className="glass-input flex-1 py-2.5 text-sm font-mono"
              onKeyDown={(e) => e.key === "Enter" && handleAddFriend()}
            />
            <button
              onClick={handleAddFriend}
              disabled={!peerId.trim() || addingStatus === "adding"}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium neon-glow disabled:opacity-30 transition-all flex items-center gap-2"
            >
              {addingStatus === "adding" ? (
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : addingStatus === "pending" ? (
                <><Clock size={16} /> {t("offline")}</>
              ) : addingStatus === "done" ? (
                <><Check size={16} /> {t("friendAdded")}</>
              ) : (
                <><UserPlus size={16} /> {t("add")}</>
              )}
            </button>
          </div>
          {addingStatus === "pending" && (
            <div className="flex items-center gap-2 mt-3 px-1">
              <Clock size={12} className="text-yellow-500" />
              <span className="text-[11px] text-yellow-500">Pending — request will sync when they come online</span>
            </div>
          )}
        </motion.div>

        {/* Security Advisory */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 flex items-start gap-3"
          role="note"
          aria-label="Security notice"
        >
          <ShieldAlert size={16} className="text-yellow-500 shrink-0 mt-0.5" />
          <p className="text-[12.5px] leading-relaxed text-foreground/90">
            {t("securityNotice")}
          </p>
        </motion.div>
      </div>

      {/* Unblock Modal */}
      {showUnblockModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel neon-border rounded-2xl p-6 max-w-sm w-full space-y-4"
          >
            <h2 className="text-lg font-bold text-foreground text-center">{t("unblockRestore")}</h2>
            <p className="text-sm text-muted-foreground text-center leading-relaxed">
              {t("unblockRestoreDesc")}
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowUnblockModal(false); setPendingUnblockId(""); }}
                className="flex-1 py-2.5 rounded-xl glass-panel-sm text-sm text-foreground font-medium hover:bg-secondary/50 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleUnblockAndAdd}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
              >
                {t("unblock")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AddFriend;
