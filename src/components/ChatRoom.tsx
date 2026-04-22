import { ArrowLeft, Paperclip, Send, Smile, Image, FileText, Music, Check, CheckCheck, Phone, Video, Flag, Download, Clock, Mic, ShieldAlert } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import EmojiPicker from "emoji-picker-react";
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
import AudioWaveformPlayer from "./AudioWaveformPlayer";
import SecurityScanOverlay from "./SecurityScanOverlay";
import MessageInput from "./MessageInput";

interface Message {
  id: string;
  text: string;
  sent: boolean;
  time: string;
  status: "pending" | "sent" | "delivered" | "read";
  media?: MediaAttachment;
  blocked?: boolean;
  blockedMessage?: { title: string; footer: string };
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { userId } = useIdentity();

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
      setMessages(
        stored.map((m) => ({
          id: m.id,
          text: m.text,
          sent: m.from === userId,
          time: new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: m.status as any || "sent",
          media: (m as any).media,
        }))
      );
      
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
            },
          ];
        });
        setSessionStarted(false);
        if (msg.from !== userId) {
          updateMessageStatus(msg.from, msg.id, "read");
        }
      }
    });
    return unsub;
  }, [chatId, userId, language]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !userId) return;
    
    const msgId = generateUUIDv4();
    const currentInput = input;
    const msg: P2PMessage = {
      id: msgId,
      from: userId,
      to: chatId,
      text: currentInput,
      timestamp: Date.now(),
      status: "pending",
    };

    // БОСС: Сразу добавляем в список, чтобы не было задержки
    setMessages((prev) => [
      ...prev,
      { id: msg.id, text: currentInput, sent: true, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), status: "pending" },
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
        <button onClick={() => setShowReport(true)} className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground shrink-0"><Flag size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 space-y-2">
        {messages.map((msg, i) => (
          <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.sent ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl ${msg.sent ? "bg-primary text-primary-foreground rounded-br-md" : "glass-panel-sm rounded-bl-md"}`}>
              {msg.media && renderMediaBubble(msg)}
              {msg.text && <p className="text-sm leading-relaxed break-words">{msg.text}</p>}
              <div className={`flex items-center gap-1 justify-end mt-1 ${msg.sent ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                <span className="text-[10px]">{msg.time}</span>
                {msg.sent && (
                  msg.status === "pending" ? <Clock size={11} className="animate-pulse" /> : 
                  msg.status === "sent" ? <Check size={12} /> : 
                  msg.status === "delivered" ? <CheckCheck size={12} /> : 
                  <CheckCheck size={12} className="text-blue-400" />
                )}
              </div>
            </div>
          </motion.div>
        ))}
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

      <AnimatePresence>
        {showEmoji && <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden"><EmojiPicker onEmojiClick={(e) => setInput(prev => prev + e.emoji)} width="100%" height={300} theme={theme as any} /></motion.div>}
      </AnimatePresence>
      
      <ReportMenu userId={chatId} open={showReport} onClose={() => setShowReport(false)} />
      <SecurityScanOverlay visible={scanOverlay} onComplete={() => { setScanOverlay(false); if (pendingDownload) { window.open(pendingDownload, "_blank"); setPendingDownload(null); } }} />
    </div>
  );
};

export default ChatRoom;
