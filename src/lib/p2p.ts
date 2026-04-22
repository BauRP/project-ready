// P2P messaging service using PeerJS (WebRTC DataChannels)
import Peer, { DataConnection } from "peerjs";
import { dbGet, dbPut, dbGetAll } from "./storage";

export interface P2PMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  ciphertext?: string;
  nonce?: string;
  timestamp: number;
  status: "pending" | "sent" | "delivered" | "read";
}

export interface ChatMeta {
  friendId: string;
  friendName: string;
  friendAvatar?: string | null;
  lastMessage: string;
  lastMessageTime: number;
  unread: number;
  started: boolean;
}

let peer: Peer | null = null;
const connections: Map<string, DataConnection> = new Map();
const messageListeners: Set<(msg: P2PMessage) => void> = new Set();
const connectionListeners: Set<(peerId: string, connected: boolean) => void> = new Set();

// БОСС: Вот твой список из 10 мощных STUN серверов Google для обхода любых блокировок
const GOOGLE_STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "stun:stun.l.google.com:19305" },
  { urls: "stun:stun1.l.google.com:19305" },
  { urls: "stun:stun2.l.google.com:19305" },
  { urls: "stun:stun3.l.google.com:19305" },
  { urls: "stun:stun4.l.google.com:19305" }
];

/**
 * Initialize PeerJS with the user's fingerprint and 10 Google STUN servers.
 */
export function initPeer(fingerprint: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      if (peer && !peer.destroyed) {
        resolve(peer.id);
        return;
      }

      const sanitizedId = `trivo-${fingerprint.replace(/[^a-zA-Z0-9]/g, "").substring(0, 20)}`;

      // Инициализируем Peer с конфигом из 10 серверов
      peer = new Peer(sanitizedId, { 
        debug: 1,
        config: {
          iceServers: GOOGLE_STUN_SERVERS,
          iceCandidatePoolSize: 10
        }
      });

      const timeout = setTimeout(() => {
        resolve(sanitizedId);
      }, 10000);

      peer.on("open", (id) => {
        clearTimeout(timeout);
        resolve(id);
      });

      peer.on("connection", (conn) => {
        handleConnection(conn);
      });

      peer.on("error", (err) => {
        clearTimeout(timeout);
        
        if (err.type === "unavailable-id") {
          const retryId = `trivo-${fingerprint.replace(/[^a-zA-Z0-9]/g, "").substring(0, 16)}-${Date.now().toString(36)}`;
          try {
            // При ретрае тоже используем наши 10 серверов
            peer = new Peer(retryId, { 
              debug: 1,
              config: { iceServers: GOOGLE_STUN_SERVERS }
            });
            peer.on("open", resolve);
            peer.on("connection", handleConnection);
            peer.on("error", () => resolve(retryId));
          } catch {
            resolve(retryId);
          }
        } else {
          resolve(sanitizedId);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

function handleConnection(conn: DataConnection) {
  conn.on("open", () => {
    connections.set(conn.peer, conn);
    connectionListeners.forEach((cb) => cb(conn.peer, true));
  });

  conn.on("data", (data) => {
    try {
      const msg = data as P2PMessage;
      messageListeners.forEach((cb) => cb(msg));
    } catch (e) {}
  });

  conn.on("close", () => {
    connections.delete(conn.peer);
    connectionListeners.forEach((cb) => cb(conn.peer, false));
  });
}

export function connectToPeer(peerId: string): DataConnection | null {
  if (!peer || peer.destroyed) return null;
  
  const existing = connections.get(peerId);
  if (existing && existing.open) return existing;

  try {
    const conn = peer.connect(peerId, { reliable: true });
    handleConnection(conn);
    return conn;
  } catch (e) {
    return null;
  }
}

export async function sendP2PMessage(
  toPeerId: string,
  message: P2PMessage
): Promise<boolean> {
  const conn = connections.get(toPeerId);
  if (conn && conn.open) {
    conn.send(message);
    message.status = "sent";
    await saveMessage(message);
    return true;
  }

  message.status = "pending";
  await saveMessage(message);
  await addToPendingQueue(toPeerId, message.id);
  return false;
}

export async function flushPendingMessages(peerId: string) {
  const pending = await getPendingQueue(peerId);
  if (!pending || pending.length === 0) return;

  for (const msgId of pending) {
    const msg = await dbGet<P2PMessage>("messages", msgId);
    if (msg && msg.status === "pending") {
      const conn = connections.get(peerId);
      if (conn && conn.open) {
        conn.send(msg);
        msg.status = "sent";
        await saveMessage(msg);
      }
    }
  }
  await clearPendingQueue(peerId);
}

async function saveMessage(msg: P2PMessage) {
  await dbPut("messages", msg.id, msg);
}

export async function getMessagesForChat(friendId: string): Promise<P2PMessage[]> {
  const all = await dbGetAll<P2PMessage>("messages");
  return all
    .filter((m) => m.from === friendId || m.to === friendId)
    .sort((a, b) => a.timestamp - b.timestamp);
}

async function addToPendingQueue(peerId: string, msgId: string) {
  const key = `pending-${peerId}`;
  const existing = (await dbGet<string[]>("settings", key)) || [];
  existing.push(msgId);
  await dbPut("settings", key, existing);
}

async function getPendingQueue(peerId: string): Promise<string[]> {
  return (await dbGet<string[]>("settings", `pending-${peerId}`)) || [];
}

async function clearPendingQueue(peerId: string) {
  await dbPut("settings", `pending-${peerId}`, []);
}

export async function saveChatMeta(meta: ChatMeta) {
  await dbPut("contacts", meta.friendId, meta);
}

export async function getChatMeta(friendId: string): Promise<ChatMeta | undefined> {
  return dbGet<ChatMeta>("contacts", friendId);
}

export async function getAllChatMetas(): Promise<ChatMeta[]> {
  return dbGetAll<ChatMeta>("contacts");
}

export function onP2PMessage(cb: (msg: P2PMessage) => void): () => void {
  messageListeners.add(cb);
  return () => { messageListeners.delete(cb); };
}

export function onConnectionChange(cb: (peerId: string, connected: boolean) => void): () => void {
  connectionListeners.add(cb);
  return () => { connectionListeners.delete(cb); };
}

export function getPeerId(): string | null {
  return peer?.id || null;
}

export function isConnectedTo(peerId: string): boolean {
  const conn = connections.get(peerId);
  return !!conn && conn.open;
}

export function destroyPeer() {
  peer?.destroy();
  peer = null;
  connections.clear();
}
