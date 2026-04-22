import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import BottomNav from "@/components/BottomNav";
import ChatList from "@/components/ChatList";
import ChatRoom from "@/components/ChatRoom";
import AddFriend from "@/components/AddFriend";
import FriendsList from "@/components/FriendsList";
import ProfilePage from "@/components/ProfilePage";
import SecurityDashboard from "@/components/SecurityDashboard";
import AdMobBanner from "@/components/AdMobBanner";
import { useIdentity } from "@/contexts/IdentityContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { initPeer, onP2PMessage, onConnectionChange, flushPendingMessages, saveChatMeta, getChatMeta, type P2PMessage } from "@/lib/p2p";
import { executePanic, createPanicLongPress } from "@/lib/panic";
import { startPresence } from "@/lib/presence";
import { performStartupHandshake, listenForFriendRequests, acceptFriendRequest } from "@/lib/firebase-sync";
import { initMockPeer } from "@/lib/mock-peer";
import { isDuplicateMessage } from "@/lib/gun-setup";
import { AD_CONFIG, getAppTopOffset, getBottomNavOffset } from "@/lib/ad-config";
import { toast } from "sonner";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";

type Tab = "chats" | "add-friend" | "friends" | "security" | "profile";

const BIOMETRIC_GRACE_PERIOD = 5000; // 5 seconds

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("chats");
  const [openChat, setOpenChat] = useState<{ id: string; name: string; emoji: string } | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [biometricLocked, setBiometricLocked] = useState(false);
  const { fingerprint, stealthMode } = useIdentity();
  const { language } = useLanguage();
  const { isEnabled: biometricEnabled, authenticate } = useBiometricAuth();
  const backgroundTimestamp = useRef<number>(0);

  const panicHandlers = useMemo(() => createPanicLongPress(executePanic), []);

  // Biometric Guard: lock after 5s in background
  useEffect(() => {
    if (!biometricEnabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        backgroundTimestamp.current = Date.now();
      } else {
        const elapsed = Date.now() - backgroundTimestamp.current;
        if (elapsed > BIOMETRIC_GRACE_PERIOD && backgroundTimestamp.current > 0) {
          setBiometricLocked(true);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [biometricEnabled]);

  const handleUnlock = useCallback(async () => {
    const success = await authenticate();
    if (success) {
      setBiometricLocked(false);
    }
  }, [authenticate]);

  // Auto-prompt on lock
  useEffect(() => {
    if (biometricLocked) {
      handleUnlock();
    }
  }, [biometricLocked, handleUnlock]);

  useEffect(() => {
    if (!fingerprint) return;
    initPeer(fingerprint).catch(() => {});
    const stopPresence = startPresence(fingerprint);

    // Initialize mock peer on first launch
    initMockPeer(language).then((created) => {
      if (created) {
        toast.info("Welcome to Trivo! Check your chats 🎉");
      }
    }).catch(() => {});

    // Startup handshake
    performStartupHandshake(fingerprint).then((buffered) => {
      if (buffered.length > 0) {
        toast.info(`${buffered.length} missed message${buffered.length > 1 ? "s" : ""} synced`);
      }
    }).catch(() => {});

    // Listen for incoming friend requests
    const unsubFriendReq = listenForFriendRequests(fingerprint, async (req) => {
      const existing = await getChatMeta(req.from);
      if (!existing) {
        await saveChatMeta({
          friendId: req.from,
          friendName: req.fromName || req.from.substring(0, 8),
          lastMessage: "",
          lastMessageTime: req.timestamp,
          unread: 0,
          started: false,
        });
        await acceptFriendRequest(req.from, fingerprint);
        toast.info(`${req.fromName || "Someone"} added you as a friend`);
      }
    });

    const unsubMsg = onP2PMessage(async (msg: P2PMessage) => {
      // UUID deduplication at root level
      if (isDuplicateMessage(msg.id)) return;

      const existing = await getChatMeta(msg.from);
      await saveChatMeta({
        friendId: msg.from,
        friendName: existing?.friendName || msg.from.substring(0, 8),
        friendAvatar: existing?.friendAvatar,
        lastMessage: msg.text || "New message",
        lastMessageTime: msg.timestamp,
        unread: (existing?.unread || 0) + 1,
        started: true,
      });
    });

    const unsubConn = onConnectionChange((peerId, connected) => {
      if (connected) {
        flushPendingMessages(peerId);
      }
    });

    return () => {
      unsubMsg();
      unsubConn();
      unsubFriendReq();
      stopPresence();
    };
  }, [fingerprint, language]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleOpenChat = (id: string, name: string, emoji: string) => {
    setOpenChat({ id, name, emoji });
  };

  // Biometric lock screen — full blur overlay to prevent data peeking
  const biometricOverlay = biometricLocked ? (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Blur layer: prevents reading underlying chat content */}
      <div className="absolute inset-0 bg-background/80" style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }} />
      <div className="relative z-10 glass-panel neon-border rounded-2xl p-8 text-center space-y-4 mx-6 max-w-sm">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto neon-glow">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-foreground">Trivo Locked</h2>
        <p className="text-sm text-muted-foreground">Use biometric authentication to unlock</p>
        <button
          onClick={handleUnlock}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold neon-glow"
        >
          Unlock
        </button>
      </div>
    </div>
  ) : null;

  const showAd = isOnline && !stealthMode;
  const rootStyle = {
    backgroundImage: "var(--gradient-bg)",
    paddingTop: getAppTopOffset(),
    ["--bottom-nav-offset" as string]: getBottomNavOffset(),
    ["--bottom-nav-height" as string]: `${AD_CONFIG.BOTTOM_NAV_HEIGHT}px`,
  } as React.CSSProperties;

  if (openChat) {
    return (
      <div className="h-screen max-w-md mx-auto flex flex-col overflow-hidden" style={rootStyle}>
        {biometricOverlay}
        {showAd && <AdMobBanner stealthMode={stealthMode} />}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <ChatRoom
            chatId={openChat.id}
            name={openChat.name}
            emoji={openChat.emoji}
            onBack={() => setOpenChat(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen max-w-md mx-auto flex flex-col overflow-hidden" style={rootStyle}>
      {biometricOverlay}
      {showAd && <AdMobBanner stealthMode={stealthMode} />}
      <div
        {...panicHandlers}
        className="absolute left-0 w-12 h-12 z-50 safe-top-offset"
        aria-hidden="true"
      />
      <div className="flex-1 min-h-0 overflow-hidden" style={{ paddingBottom: getBottomNavOffset() }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="h-full overflow-y-auto scrollbar-hide"
          >
            {activeTab === "chats" && <ChatList onOpenChat={handleOpenChat} />}
            {activeTab === "add-friend" && <AddFriend />}
            {activeTab === "friends" && <FriendsList onOpenChat={handleOpenChat} />}
            {activeTab === "security" && <SecurityDashboard />}
            {activeTab === "profile" && <ProfilePage />}
          </motion.div>
        </AnimatePresence>
      </div>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
