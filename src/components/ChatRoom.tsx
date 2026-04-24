import { ArrowLeft, FileText, Check, CheckCheck, Phone, Video, Flag, Download, Clock, ShieldAlert, Search } from "lucide-react";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import EmojiPicker from "emoji-picker-react";
import { Share } from "@capacitor/share";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useIdentity } from "@/contexts/IdentityContext";
import DefaultAvatar from "./DefaultAvatar";
import CallScreen from "./CallScreen";
import ReportMenu from "./ReportMenu";
import { uploadMedia, formatFileSize, type MediaAttachment } from "@/lib/media";
import { subscribeToPresence, getPresenceStatus } from "@/lib/presence";
import { toast } from "@/hooks/use-toast";
import { generateUUIDv4, isDuplicateMessage } from "@/lib/gun-setup";
import { simulateSecurityScan, stripExifMetadata, getBlockedFileMessage } from "@/lib/security-scan";
import {
  sendP2PMessage,
  getMessagesForChat,
  onP2PMessage,
  connectToPeer,
  saveChatMeta,
  getChatMeta,
  type P2PMessage,
} from "@/lib/p2p";
import { bufferMessageInCloud, updateMessageStatus, listenForStatusUpdates } from "@/lib/firebase-sync";
import {
  subscribeLifecycle,
  editMessage as fsEditMessage,
  deleteMessageForMe as fsDeleteForMe,
  deleteMessageForEveryone as fsDeleteForEveryone,
  pinMessage as fsPinMessage,
  unpinMessage as fsUnpinMessage,
  type MessageLifecycle,
} from "@/lib/firestore-messages";
import AudioWaveformPlayer from "./AudioWaveformPlayer";
import SecurityScanOverlay from "./SecurityScanOverlay";
import MessageInput from "./MessageInput";
import ChatSelectionBar from "./ChatSelectionBar";
import ChatSearchBar from "./ChatSearchBar";
import ForwardMediaSheet from "./ForwardMediaSheet";
import TranslationPlate from "./TranslationPlate";
import AttachmentMenu from "./AttachmentMenu";
import PinnedHeader from "./PinnedHeader";
import { getChatPreferences, getDeleteAt, isExpired } from "@/lib/chat-preferences";
import { notifyIncomingMessage, translateIncomingMessage } from "@/lib/notifications";

interface Message {
  id: string;
  text: string;
  sent: boolean;
  time: string;
  status: "pending" | "sent" | "delivered" | "read";
  media?: MediaAttachment;
  blocked?: boolean;
  blockedMessage?: { title: string; footer: string };
  caption?: string;
  deleteAt?: number;
  translatedText?: string | null;
}

interface ChatRoomProps {
  chatId: string;
  name: string;
  emoji: string;
  onBack: () => void;
}

const ChatRoom = ({ chatId, name, emoji, onBack }: ChatRoomProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [callType, setCallType] = useState<"audio" | "video" | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [peerStatus, setPeerStatus] = useState<"online" | "away" | "offline">("offline");
  const [scanOverlay, setScanOverlay] = useState(false);
  const [pendingDownload, setPendingDownload] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [forwardingMedia, setForwardingMedia] = useState<MediaAttachment | null>(null);
  const [forwardSheetOpen, setForwardSheetOpen] = useState(false);
  const [disappearingDuration, setDisappearingDuration] = useState<"1h" | "6h" | "12h" | "24h" | "off">("off");
  const [lifecycle, setLifecycle] = useState<Record<string, MessageLifecycle>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { userId } = useIdentity();

  const syncIncomingTranslations = async (items: Message[]) => {
    const translated = await Promise.all(
      items.map(async (message) => {
        if (message.sent || !message.text.trim() || isExpired(message.deleteAt)) {
          return { ...message, translatedText: null };
        }

        const translatedText = await translateIncomingMessage(message.text);
        return { ...message, translatedText };
      }),
    );

    setMessages((prev) => prev.map((message) => translated.find((item) => item.id === message.id) || message));
  };

  // Firestore lifecycle (edit / delete / pin) — source of truth
  useEffect(() => {
    if (!userId || !chatId) return;
    const unsub = subscribeLifecycle(userId, chatId, (map) => {
      setLifecycle(map);
    });
    return unsub;
  }, [userId, chatId]);

  // Presence subscription
  useEffect(() => {
    setPeerStatus(getPresenceStatus(chatId));
    const unsub = subscribeToPresence(chatId);
    const interval = setInterval(() => {
      setPeerStatus(getPresenceStatus(chatId));
    }, 5000);
    return () => { unsub(); clearInterval(interval); };
  }, [chatId]);

  useEffect(() => {
    const loadMessages = async () => {
      const stored = await getMessagesForChat(chatId);
      if (stored.length === 0) setSessionStarted(true);
      const nextMessages = stored.map((m) => ({
          id: m.id,
          text: m.text,
          sent: m.from === userId,
          time: new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: m.status as any || "sent",
          media: (m as any).media,
          caption: (m as any).caption,
          deleteAt: (m as any).deleteAt,
        }))
        .filter((m) => !isExpired(m.deleteAt));

      setMessages(nextMessages);
      await syncIncomingTranslations(nextMessages);
      const preferences = await getChatPreferences(chatId);
      setDisappearingDuration(preferences.disappearingDuration || "off");
      
      for (const m of stored) {
        if (m.from !== userId && m.status !== "read") {
          updateMessageStatus(m.from, m.id, "read");
        }
      }
    };
    loadMessages();
    
    // БОСС: Усиленное подключение к пиру
    const peerId = `trivo-${chatId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 20)}`;
    connectToPeer(peerId);

    const unsubStatus = listenForStatusUpdates(userId || "", (messageId, status) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: status as any } : m))
      );
    });

    return () => { unsubStatus(); };
  }, [chatId, userId]);

  useEffect(() => {
    const handleRefresh = () => {
      setMessages((prev) => prev.filter((message) => !isExpired(message.deleteAt)));
      void syncIncomingTranslations(messages.filter((message) => !isExpired(message.deleteAt)));
    };

    window.addEventListener("focus", handleRefresh);
    const interval = window.setInterval(() => {
      setMessages((prev) => prev.filter((message) => !isExpired(message.deleteAt)));
    }, 30_000);

    return () => {
      window.removeEventListener("focus", handleRefresh);
      window.clearInterval(interval);
    };
  }, [messages]);

  useEffect(() => {
    const unsub = onP2PMessage((msg: P2PMessage) => {
      if (msg.from === chatId || msg.to === chatId) {
        if (isDuplicateMessage(msg.id)) return;

        setMessages((prev: Message[]) => {
          if (prev.some((m: Message) => m.id === msg.id)) return prev;

          let blocked = false;
          let blockedMessage: { title: string; footer: string } | undefined;
          const media = (msg as any).media as MediaAttachment | undefined;
          
          if (media && msg.from !== userId) {
            const scanResult = simulateSecurityScan(media.name, false);
            if (!scanResult.safe) {
              blocked = true;
              blockedMessage = getBlockedFileMessage(language, media.type === "image" ? "photo" : "file");
            }
          }

          return [
            ...prev,
            {
              id: msg.id,
              text: msg.text,
               sent: msg.from === userId,
              time: new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "delivered",
              media,
              blocked,
              blockedMessage,
              caption: (msg as any).caption,
              deleteAt: (msg as any).deleteAt,
            },
          ];
        });
        setSessionStarted(false);
        if (msg.from !== userId) {
          translateIncomingMessage(msg.text).then((translatedText) => {
            setMessages((prev) => prev.map((item) => item.id === msg.id ? { ...item, translatedText: translatedText || null } : item));
          });
          notifyIncomingMessage(name, msg.text || (msg as any).media?.name || "New media");
          updateMessageStatus(msg.from, msg.id, "read");
        }
      }
    });
    return unsub;
  }, [chatId, userId, language]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Apply lifecycle: hide deleted-for-me, mark deleted-for-everyone as tombstones, override text on edit.
  const visibleMessages = useMemo(() => {
    return messages
      .filter((message) => !isExpired(message.deleteAt))
      .filter((message) => {
        const lc = lifecycle[message.id];
        if (!lc) return true;
        if (userId && lc.deletedFor?.includes(userId)) return false;
        return true;
      });
  }, [messages, lifecycle, userId]);

  const getEffectiveText = useCallback(
    (msg: Message): { text: string; isEdited: boolean; isTombstone: boolean } => {
      const lc = lifecycle[msg.id];
      if (lc?.deletedForEveryone) {
        return { text: t("messageDeleted"), isEdited: false, isTombstone: true };
      }
      if (lc?.isEdited && typeof lc.editedText === "string") {
        return { text: lc.editedText, isEdited: true, isTombstone: false };
      }
      return { text: msg.text, isEdited: false, isTombstone: false };
    },
    [lifecycle, t],
  );

  const pinnedMessageId = useMemo(() => {
    let bestId: string | null = null;
    let bestAt = 0;
    for (const [id, lc] of Object.entries(lifecycle)) {
      if (lc.pinnedAt && lc.pinnedAt > bestAt && !lc.deletedForEveryone) {
        // Only show pin if message is still visible to this user
        const exists = messages.some((m) => m.id === id);
        const hiddenForMe = userId ? lc.deletedFor?.includes(userId) : false;
        if (exists && !hiddenForMe) {
          bestId = id;
          bestAt = lc.pinnedAt;
        }
      }
    }
    return bestId;
  }, [lifecycle, messages, userId]);

  const pinnedMessage = pinnedMessageId ? messages.find((m) => m.id === pinnedMessageId) : null;
  const pinnedPreview = pinnedMessage
    ? (() => {
        const eff = getEffectiveText(pinnedMessage);
        if (eff.text) return eff.text;
        if (pinnedMessage.media) return pinnedMessage.media.name || "Media";
        return "Message";
      })()
    : "";

  const filteredMessages = visibleMessages;
  const searchMatches = useMemo(
    () =>
      filteredMessages.filter(
        (message) => searchQuery.trim() && getEffectiveText(message).text.toLowerCase().includes(searchQuery.trim().toLowerCase()),
      ),
    [filteredMessages, searchQuery, getEffectiveText],
  );

  useEffect(() => {
    if (!searchMatches.length) return;
    const current = searchMatches[Math.min(activeMatchIndex, searchMatches.length - 1)];
    const node = messageRefs.current[current.id];
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeMatchIndex, searchMatches]);

  const sendMessage = async () => {
    if (!input.trim() || !userId) return;

    // ── Edit mode: write the new text to Firestore lifecycle and exit edit mode.
    if (editingId) {
      const newText = input.trim();
      try {
        await fsEditMessage(userId, chatId, editingId, newText);
        toast({ title: t("edited") });
      } catch (e) {
        console.error("[ChatRoom] edit failed", e);
      }
      setInput("");
      setEditingId(null);
      setSelectedIds([]);
      return;
    }

    const msgId = generateUUIDv4();
    const currentInput = input;
    const msg: P2PMessage = {
      id: msgId,
      from: userId,
      to: chatId,
      text: currentInput,
      timestamp: Date.now(),
      status: "pending",
      deleteAt: getDeleteAt(Date.now(), disappearingDuration),
    };

    // БОСС: Сразу добавляем в список, чтобы не было задержки
    setMessages((prev) => [
      ...prev,
      { id: msg.id, text: currentInput, sent: true, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), status: "pending", deleteAt: msg.deleteAt },
    ]);
    
    setInput("");
    setShowEmoji(false);
    setSessionStarted(false);

    const peerId = `trivo-${chatId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 20)}`;
    
    // БОСС: Пробуем отправить P2P, если не вышло — кидаем в облако
    try {
      const sentP2P = await sendP2PMessage(peerId, msg);
      
      if (!sentP2P) {
        // Если P2P не сработал, дублируем в облако (Firebase)
        await bufferMessageInCloud(chatId, msg);
        // Как только попало в облако — это уже успех, убираем часики
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, status: "sent" } : m))
        );
      } else {
        // P2P сработал мгновенно
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, status: "delivered" } : m))
        );
      }
    } catch (e) {
      console.error("Ошибка отправки:", e);
    }

    // Сохраняем в историю чатов
    const existing = await getChatMeta(chatId);
    await saveChatMeta({
      friendId: chatId,
      friendName: existing?.friendName || name,
      friendAvatar: existing?.friendAvatar,
      lastMessage: currentInput,
      lastMessageTime: Date.now(),
      unread: 0,
      started: true,
    });
  };

  const handleFileSelect = async (accept: string) => {
    setShowAttach(false);
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file || !userId) return;
    e.target.value = "";

    setUploading(true);
    try {
      file = await stripExifMetadata(file);
      const scanResult = simulateSecurityScan(file.name, false);
      if (!scanResult.safe) {
        toast({ title: getBlockedFileMessage(language, file.type.startsWith("image") ? "photo" : "file").footer, variant: "destructive" });
        setUploading(false);
        return;
      }

      const media = await uploadMedia(file);
      const msgId = generateUUIDv4();
      const msg: P2PMessage & { media: MediaAttachment } = {
        id: msgId,
        from: userId,
        to: chatId,
        text: "",
        timestamp: Date.now(),
        status: "sent",
        media,
        deleteAt: getDeleteAt(Date.now(), disappearingDuration),
      };

      const peerId = `trivo-${chatId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 20)}`;
      const sent = await sendP2PMessage(peerId, msg as any);
      if (!sent) {
        await bufferMessageInCloud(chatId, msg as any);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: msg.id,
          text: "",
          sent: true,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "sent",
          media,
          deleteAt: msg.deleteAt,
        },
      ]);
    } catch {
      toast({ title: t("mediaUploadFailed") || "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const statusLabel = peerStatus === "online" ? t("online") : peerStatus === "away" ? t("away") : t("offline");
  const statusColor = peerStatus === "online" ? "text-primary" : peerStatus === "away" ? "text-yellow-500" : "text-muted-foreground";
  const selectedMessages = filteredMessages.filter((message) => selectedIds.includes(message.id));
  const allowCopy = selectedMessages.length > 0 && selectedMessages.every((message) => !!getEffectiveText(message).text && !message.media);
  const allowMediaActions = selectedMessages.length === 1 && !!selectedMessages[0]?.media;
  const singleSel = selectedMessages.length === 1 ? selectedMessages[0] : null;
  const singleSelLifecycle = singleSel ? lifecycle[singleSel.id] : undefined;
  // Edit only own, text-only, non-tombstone messages.
  const allowEdit = !!singleSel && singleSel.sent && !singleSel.media && !singleSelLifecycle?.deletedForEveryone && !!getEffectiveText(singleSel).text;
  const allowPin = !!singleSel && !singleSelLifecycle?.deletedForEveryone;
  const isPinnedSel = !!singleSel && !!singleSelLifecycle?.pinnedAt;
  // Delete-for-everyone only for messages I sent.
  const allowDeleteForEveryone = selectedMessages.length > 0 && selectedMessages.every((m) => m.sent);

  const handleEditStart = () => {
    if (!singleSel) return;
    setEditingId(singleSel.id);
    setInput(getEffectiveText(singleSel).text);
    setSelectedIds([]);
    setShowEmoji(false);
    setShowAttach(false);
  };

  const handlePinToggle = async () => {
    if (!singleSel || !userId) return;
    try {
      if (singleSelLifecycle?.pinnedAt) {
        await fsUnpinMessage(userId, chatId, singleSel.id);
      } else {
        await fsPinMessage(userId, chatId, singleSel.id);
      }
    } catch (e) {
      console.error("[ChatRoom] pin toggle failed", e);
    }
    setSelectedIds([]);
  };

  const handleDeleteForMe = async () => {
    if (!userId || selectedMessages.length === 0) return;
    try {
      await Promise.all(
        selectedMessages.map((m) => fsDeleteForMe(userId, chatId, m.id)),
      );
    } catch (e) {
      console.error("[ChatRoom] delete for me failed", e);
    }
    setSelectedIds([]);
  };

  const handleDeleteForEveryone = async () => {
    if (!userId || selectedMessages.length === 0) return;
    try {
      await Promise.all(
        selectedMessages.map((m) => fsDeleteForEveryone(userId, chatId, m.id)),
      );
    } catch (e) {
      console.error("[ChatRoom] delete for everyone failed", e);
    }
    setSelectedIds([]);
  };

  const jumpToMessage = (id: string) => {
    const node = messageRefs.current[id];
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  };


  if (callType) {
    return <CallScreen name={name} type={callType} onEnd={() => setCallType(null)} />;
  }

  const renderMediaBubble = (msg: Message) => {
    const media = msg.media!;
    if (msg.blocked && msg.blockedMessage) {
      return (
        <div className="rounded-xl overflow-hidden">
          <div className="bg-destructive/10 backdrop-blur-md p-4 text-center space-y-2">
            <ShieldAlert size={28} className="text-destructive mx-auto" />
            <p className="text-xs font-semibold text-destructive">{msg.blockedMessage.title}</p>
            <p className="text-[10px] text-destructive/70 font-bold uppercase">{msg.blockedMessage.footer}</p>
          </div>
        </div>
      );
    }

    if (media.type === "image") {
      return (
        <a href={media.url} target="_blank" rel="noopener noreferrer" className="block">
          <img src={media.url} alt={media.name} className="rounded-xl max-w-full max-h-[240px] object-cover" loading="lazy" />
        </a>
      );
    }
    if (media.type === "audio") {
      return <AudioWaveformPlayer src={media.url} name={media.name} sent={msg.sent} />;
    }
    return (
      <button onClick={() => { setPendingDownload(media.url); setScanOverlay(true); }} className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left w-full">
        <FileText size={20} className={msg.sent ? "text-primary-foreground/80" : "text-primary"} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate">{media.name}</p>
          <p className={`text-[10px] ${msg.sent ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{formatFileSize(media.size)}</p>
        </div>
        <Download size={14} className={`shrink-0 ${msg.sent ? "text-primary-foreground/60" : "text-muted-foreground"}`} />
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full max-w-[100vw] overflow-x-hidden">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />

      {selectedIds.length > 0 ? (
        <ChatSelectionBar
          count={selectedIds.length}
          allowCopy={allowCopy}
          allowMediaActions={allowMediaActions}
          onClose={() => setSelectedIds([])}
          onCopy={async () => {
            await navigator.clipboard.writeText(selectedMessages.map((message) => message.text).join("\n"));
            toast({ title: "Copied" });
            setSelectedIds([]);
          }}
          onForward={() => {
            setForwardingMedia(selectedMessages[0]?.media || null);
            setForwardSheetOpen(true);
          }}
          onShare={async () => {
            const media = selectedMessages[0]?.media;
            if (!media) return;
            await Share.share({ title: media.name, text: selectedMessages[0]?.caption || "", url: media.url, dialogTitle: "Share media" });
            setSelectedIds([]);
          }}
        />
      ) : (
      <div className="header-safe-zone glass-panel rounded-none border-x-0 border-t-0 px-3 pb-2 header-bar-56 gap-3 z-10 shrink-0 flex items-center">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-secondary/50 transition-colors shrink-0">
          <ArrowLeft size={20} className="text-foreground" />
        </button>
        <div className="relative shrink-0">
          <DefaultAvatar size={36} />
          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${peerStatus === "online" ? "bg-primary" : peerStatus === "away" ? "bg-yellow-500" : "bg-muted-foreground/40"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{name}</p>
          <p className={`text-[11px] ${statusColor}`}>{statusLabel}</p>
        </div>
        <button onClick={() => setCallType("audio")} className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground shrink-0"><Phone size={20} /></button>
        <button onClick={() => setCallType("video")} className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground shrink-0"><Video size={20} /></button>
        <button onClick={() => setSearchOpen((prev) => !prev)} className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground shrink-0"><Search size={18} /></button>
        <button onClick={() => setShowReport(true)} className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground shrink-0"><Flag size={18} /></button>
      </div>
      )}

      {searchOpen && (
        <ChatSearchBar
          value={searchQuery}
          resultCount={searchMatches.length}
          activeIndex={Math.min(activeMatchIndex, Math.max(searchMatches.length - 1, 0))}
          onChange={(value) => { setSearchQuery(value); setActiveMatchIndex(0); }}
          onNext={() => setActiveMatchIndex((prev) => searchMatches.length ? (prev + 1) % searchMatches.length : 0)}
          onPrev={() => setActiveMatchIndex((prev) => searchMatches.length ? (prev - 1 + searchMatches.length) % searchMatches.length : 0)}
          onClose={() => { setSearchOpen(false); setSearchQuery(""); setActiveMatchIndex(0); }}
        />
      )}

      <div
        className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 space-y-2"
        onClick={() => {
          // Click-away dismissal: tapping the chat background closes the emoji picker.
          if (showEmoji) setShowEmoji(false);
          if (showAttach) setShowAttach(false);
        }}
      >
        <AnimatePresence initial={false}>
        {filteredMessages.map((msg) => {
          const isMatch = !!searchQuery.trim() && msg.text.toLowerCase().includes(searchQuery.trim().toLowerCase());
          const isActiveMatch = searchMatches[activeMatchIndex]?.id === msg.id;
          const isSelected = selectedIds.includes(msg.id);
          return (
          <motion.div
            key={msg.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className={`flex ${msg.sent ? "justify-end" : "justify-start"}`}
          >
            <motion.div
              layout
              ref={(node) => { messageRefs.current[msg.id] = node; }}
              onContextMenu={(e) => { e.preventDefault(); setSelectedIds((prev) => prev.includes(msg.id) ? prev.filter((id) => id !== msg.id) : [...prev, msg.id]); }}
              onPointerDown={(e) => {
                const timer = window.setTimeout(() => {
                  setSelectedIds((prev) => prev.includes(msg.id) ? prev : [...prev, msg.id]);
                }, 420);
                const clear = () => window.clearTimeout(timer);
                (e.currentTarget as HTMLDivElement).onpointerup = clear;
                (e.currentTarget as HTMLDivElement).onpointerleave = clear;
              }}
              className={`max-w-[75%] px-3.5 py-2 rounded-2xl border flex flex-col ${msg.sent ? "bg-primary text-primary-foreground rounded-br-md border-primary/20" : "glass-panel-sm rounded-bl-md border-border/30"} ${isSelected ? "ring-2 ring-ring" : ""} ${isActiveMatch ? "ring-2 ring-primary" : isMatch ? "ring-1 ring-border" : ""}`}
            >
              {msg.media && renderMediaBubble(msg)}
              {msg.text && <p className="text-sm leading-relaxed break-words">{msg.text}</p>}
              {msg.caption && <p className="text-sm leading-relaxed break-words mt-2">{msg.caption}</p>}
              {msg.translatedText && !msg.sent && (
                <TranslationPlate translatedText={msg.translatedText} sent={msg.sent} />
              )}
              <div className={`flex items-center gap-1 justify-end mt-1 ${msg.sent ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                <span className="text-[10px]">{msg.time}</span>
                {msg.sent && (
                  msg.status === "pending" ? <Clock size={11} className="animate-pulse" /> :
                  msg.status === "sent" ? <Check size={12} /> :
                  msg.status === "delivered" ? <CheckCheck size={12} /> :
                  <CheckCheck size={12} className="text-blue-400" />
                )}
              </div>
            </motion.div>
          </motion.div>
        )})}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <MessageInput
        value={input}
        onValueChange={setInput}
        onSubmit={sendMessage}
        onToggleEmoji={() => { setShowEmoji(!showEmoji); setShowAttach(false); }}
        onToggleAttach={() => { setShowAttach(!showAttach); setShowEmoji(false); }}
        placeholder={t("typeMessage")}
      />

      <AttachmentMenu
        open={showAttach}
        onClose={() => setShowAttach(false)}
        onSelect={handleFileSelect}
      />

      <AnimatePresence>
        {showEmoji && <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden"><EmojiPicker onEmojiClick={(e) => setInput(prev => prev + e.emoji)} width="100%" height={300} theme={theme as any} /></motion.div>}
      </AnimatePresence>
      
      <ReportMenu userId={chatId} open={showReport} onClose={() => setShowReport(false)} />
      <SecurityScanOverlay visible={scanOverlay} onComplete={() => { setScanOverlay(false); if (pendingDownload) { window.open(pendingDownload, "_blank"); setPendingDownload(null); } }} />
      <ForwardMediaSheet
        open={forwardSheetOpen}
        media={forwardingMedia}
        onClose={() => { setForwardSheetOpen(false); setForwardingMedia(null); }}
        onSubmit={async (targetChatId, caption) => {
          if (!userId || !forwardingMedia) return;
          const targetPreferences = await getChatPreferences(targetChatId);
          const msgId = generateUUIDv4();
          const payload: P2PMessage = {
            id: msgId,
            from: userId,
            to: targetChatId,
            text: "",
            timestamp: Date.now(),
            status: "sent",
            media: forwardingMedia,
            caption,
            deleteAt: getDeleteAt(Date.now(), targetPreferences.disappearingDuration || "off"),
          };
          const peerId = `trivo-${targetChatId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 20)}`;
          const sent = await sendP2PMessage(peerId, payload);
          if (!sent) await bufferMessageInCloud(targetChatId, payload);
          await saveChatMeta({ friendId: targetChatId, friendName: targetChatId.substring(0, 8), lastMessage: caption || forwardingMedia.name, lastMessageTime: Date.now(), unread: 0, started: true });
          setForwardSheetOpen(false);
          setForwardingMedia(null);
          setSelectedIds([]);
        }}
      />
    </div>
  );
};

export default ChatRoom;
