// Firebase-backed offline sync: store-and-forward for messages & friend requests
import { firebaseApp } from "./firebase";
import {
  getDatabase,
  ref,
  set,
  get,
  remove,
  onValue,
  type Database,
} from "firebase/database";
import gun from "./gun-setup";
import { dbPut, dbGet, dbGetAll } from "./storage";
import type { P2PMessage, ChatMeta } from "./p2p";
import { isExpired } from "./chat-preferences";

let db: Database;
try {
  db = getDatabase(firebaseApp);
} catch {
  // Fallback: will use GunDB only
  console.warn("[FirebaseSync] Realtime Database unavailable, using GunDB only");
}

// ─── Friend Requests ────────────────────────────────────────

export interface FriendRequest {
  id?: string;
  from: string;
  to: string;
  fromName: string;
  signingKey: string;
  exchangeKey: string;
  timestamp: number;
  status: "pending" | "accepted" | "declined";
}

/**
 * Send a friend request. Stores in Firebase RTDB + GunDB for redundancy.
 */
export async function sendFriendRequest(request: FriendRequest): Promise<void> {
  // Store in Firebase
  try {
    if (db) {
      const reqRef = ref(db, `friend_requests/${request.to}/${request.from}`);
      await set(reqRef, {
        ...request,
        timestamp: Date.now(),
        status: "pending",
      });
    }
  } catch (e) {
    console.warn("[FirebaseSync] Failed to store friend request in Firebase:", e);
  }

  // Also broadcast via GunDB for decentralized propagation
  try {
    gun.get("trivo-friend-requests").get(request.to).get(request.from).put({
      from: request.from,
      fromName: request.fromName,
      signingKey: request.signingKey,
      exchangeKey: request.exchangeKey,
      timestamp: Date.now(),
      status: "pending",
    });
  } catch {}

  // Store locally as pending
  await dbPut("settings", `friend-req-out-${request.to}`, {
    ...request,
    status: "pending",
  });
}

/**
 * Listen for incoming friend requests (Firebase + GunDB).
 */
export function listenForFriendRequests(
  userId: string,
  onRequest: (req: FriendRequest) => void
): () => void {
  const unsubs: (() => void)[] = [];

  // Firebase listener
  if (db) {
    try {
      const reqRef = ref(db, `friend_requests/${userId}`);
      const unsubFb = onValue(reqRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.val();
        Object.entries(data).forEach(([fromId, reqData]: [string, any]) => {
          if (reqData.status === "pending") {
            onRequest({
              from: fromId,
              to: userId,
              fromName: reqData.fromName || fromId.substring(0, 8),
              signingKey: reqData.signingKey || "",
              exchangeKey: reqData.exchangeKey || "",
              timestamp: reqData.timestamp || Date.now(),
              status: "pending",
            });
          }
        });
      });
      unsubs.push(() => unsubFb());
    } catch {}
  }

  // GunDB listener
  try {
    gun.get("trivo-friend-requests").get(userId).map().on((data: any, key: string) => {
      if (!data || data.status !== "pending") return;
      onRequest({
        from: key,
        to: userId,
        fromName: data.fromName || key.substring(0, 8),
        signingKey: data.signingKey || "",
        exchangeKey: data.exchangeKey || "",
        timestamp: data.timestamp || Date.now(),
        status: "pending",
      });
    });
    unsubs.push(() => {
      try { gun.get("trivo-friend-requests").get(userId).off(); } catch {}
    });
  } catch {}

  return () => unsubs.forEach((u) => u());
}

/**
 * Accept a friend request — update Firebase + GunDB
 */
export async function acceptFriendRequest(fromId: string, toId: string): Promise<void> {
  if (db) {
    try {
      const reqRef = ref(db, `friend_requests/${toId}/${fromId}/status`);
      await set(reqRef, "accepted");
    } catch {}
  }
  try {
    gun.get("trivo-friend-requests").get(toId).get(fromId).put({ status: "accepted" });
  } catch {}
}

/**
 * Get outgoing friend request status
 */
export async function getOutgoingRequestStatus(
  fromId: string,
  toId: string
): Promise<"pending" | "accepted" | "none"> {
  // Check local cache first
  const local = await dbGet<FriendRequest>("settings", `friend-req-out-${toId}`);
  if (local && local.status === "pending") return "pending";
  if (local && local.status === "accepted") return "accepted";

  // Check Firebase
  if (db) {
    try {
      const reqRef = ref(db, `friend_requests/${toId}/${fromId}`);
      const snapshot = await get(reqRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        return data.status || "pending";
      }
    } catch {}
  }

  return "none";
}

// ─── Offline Message Buffer (Store-and-Forward) ─────────────

export interface BufferedMessage {
  msg: P2PMessage;
  recipientId: string;
  storedAt: number;
}

export async function purgeExpiredBufferedMessages(userId: string): Promise<void> {
  if (db) {
    try {
      const msgRef = ref(db, `offline_messages/${userId}`);
      const snapshot = await get(msgRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        await Promise.all(
          Object.entries(data).map(async ([msgId, value]: [string, any]) => {
            if (isExpired(value?.deleteAt)) {
              await remove(ref(db, `offline_messages/${userId}/${msgId}`));
            }
          }),
        );
      }
    } catch {}
  }
}

export async function purgeExpiredBufferedMessagesForAllUsers(): Promise<number> {
  if (!db) return 0;

  let removedCount = 0;

  try {
    const msgRef = ref(db, "offline_messages");
    const snapshot = await get(msgRef);
    if (!snapshot.exists()) return 0;

    const data = snapshot.val() as Record<string, Record<string, any>>;
    await Promise.all(
      Object.entries(data).flatMap(([recipientId, messages]) =>
        Object.entries(messages || {}).map(async ([msgId, value]) => {
          if (!isExpired(value?.deleteAt)) return;
          await remove(ref(db, `offline_messages/${recipientId}/${msgId}`));
          removedCount += 1;
        }),
      ),
    );
  } catch {}

  return removedCount;
}

/**
 * Buffer a message in Firebase for offline recipient
 */
export async function bufferMessageInCloud(
  recipientId: string,
  msg: P2PMessage
): Promise<void> {
  // Firebase buffer
  if (db) {
    try {
      const msgRef = ref(db, `offline_messages/${recipientId}/${msg.id}`);
      await set(msgRef, {
        ...msg,
        storedAt: Date.now(),
      });
    } catch (e) {
      console.warn("[FirebaseSync] Failed to buffer message in Firebase:", e);
    }
  }

  // GunDB distributed cache (encrypted messages across relay nodes)
  try {
    gun.get("trivo-offline").get(recipientId).get(msg.id).put({
      from: msg.from,
      to: msg.to,
      text: msg.text || "",
      ciphertext: msg.ciphertext || "",
      nonce: msg.nonce || "",
      timestamp: msg.timestamp,
      status: "pending",
      deleteAt: msg.deleteAt || null,
      media: (msg as any).media ? JSON.stringify((msg as any).media) : "",
    });
  } catch {}
}

/**
 * Fetch all buffered messages from Firebase + GunDB for the current user.
 * Called on startup (handshake).
 */
export async function fetchBufferedMessages(userId: string): Promise<P2PMessage[]> {
  const messages: Map<string, P2PMessage> = new Map();

  // Fetch from Firebase
  if (db) {
    try {
      const msgRef = ref(db, `offline_messages/${userId}`);
      const snapshot = await get(msgRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        Object.entries(data).forEach(([msgId, msgData]: [string, any]) => {
          if (isExpired(msgData.deleteAt)) return;
          messages.set(msgId, {
            id: msgId,
            from: msgData.from,
            to: msgData.to,
            text: msgData.text || "",
            ciphertext: msgData.ciphertext,
            nonce: msgData.nonce,
            timestamp: msgData.timestamp,
            status: "delivered" as const,
            deleteAt: msgData.deleteAt || undefined,
            ...(msgData.media ? { media: typeof msgData.media === "string" ? JSON.parse(msgData.media) : msgData.media } : {}),
          } as P2PMessage);
        });
      }
    } catch (e) {
      console.warn("[FirebaseSync] Failed to fetch Firebase buffer:", e);
    }
  }

  // Fetch from GunDB
  try {
    await new Promise<void>((resolve) => {
      let resolved = false;
      gun.get("trivo-offline").get(userId).map().once((data: any, key: string) => {
        if (!data || !data.from) return;
        if (isExpired(data.deleteAt)) return;
        if (!messages.has(key)) {
          const msg: any = {
            id: key,
            from: data.from,
            to: data.to,
            text: data.text || "",
            ciphertext: data.ciphertext,
            nonce: data.nonce,
            timestamp: data.timestamp,
            status: "delivered",
            deleteAt: data.deleteAt || undefined,
          };
          if (data.media) {
            try { msg.media = JSON.parse(data.media); } catch {}
          }
          messages.set(key, msg);
        }
      });
      // Give GunDB 3 seconds to respond
      setTimeout(() => { if (!resolved) { resolved = true; resolve(); } }, 3000);
    });
  } catch {}

  return Array.from(messages.values()).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Clear buffered messages after successful delivery
 */
export async function clearBufferedMessages(userId: string, messageIds: string[]): Promise<void> {
  for (const msgId of messageIds) {
    if (db) {
      try {
        const msgRef = ref(db, `offline_messages/${userId}/${msgId}`);
        await remove(msgRef);
      } catch {}
    }
    try {
      gun.get("trivo-offline").get(userId).get(msgId).put(null);
    } catch {}
  }
}

// ─── Message Status Updates ─────────────────────────────────

/**
 * Update message delivery status in Firebase + GunDB
 */
export async function updateMessageStatus(
  senderId: string,
  messageId: string,
  status: "delivered" | "read"
): Promise<void> {
  // Notify sender via Firebase
  if (db) {
    try {
      const statusRef = ref(db, `message_status/${senderId}/${messageId}`);
      await set(statusRef, { status, updatedAt: Date.now() });
    } catch {}
  }

  // Also via GunDB
  try {
    gun.get("trivo-msg-status").get(senderId).get(messageId).put({
      status,
      updatedAt: Date.now(),
    });
  } catch {}
}

/**
 * Listen for message status updates (delivered/read confirmations)
 */
export function listenForStatusUpdates(
  userId: string,
  onUpdate: (messageId: string, status: "delivered" | "read") => void
): () => void {
  const unsubs: (() => void)[] = [];

  // Firebase listener
  if (db) {
    try {
      const statusRef = ref(db, `message_status/${userId}`);
      const unsubFb = onValue(statusRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.val();
        Object.entries(data).forEach(([msgId, statusData]: [string, any]) => {
          onUpdate(msgId, statusData.status);
        });
      });
      unsubs.push(() => unsubFb());
    } catch {}
  }

  // GunDB listener
  try {
    gun.get("trivo-msg-status").get(userId).map().on((data: any, key: string) => {
      if (!data || !data.status) return;
      onUpdate(key, data.status);
    });
    unsubs.push(() => {
      try { gun.get("trivo-msg-status").get(userId).off(); } catch {}
    });
  } catch {}

  return () => unsubs.forEach((u) => u());
}

/**
 * Clear delivered status notifications after processing
 */
export async function clearStatusNotification(userId: string, messageId: string): Promise<void> {
  if (db) {
    try {
      const statusRef = ref(db, `message_status/${userId}/${messageId}`);
      await remove(statusRef);
    } catch {}
  }
}

// ─── Startup Handshake ──────────────────────────────────────

/**
 * Perform startup handshake: fetch missed messages from Firebase + GunDB,
 * integrate into local storage, and notify sender of delivery.
 */
export async function performStartupHandshake(userId: string): Promise<P2PMessage[]> {
  console.log("[FirebaseSync] Performing startup handshake for", userId);

  const buffered = await fetchBufferedMessages(userId);
  if (buffered.length === 0) {
    console.log("[FirebaseSync] No buffered messages found");
    return [];
  }

  console.log(`[FirebaseSync] Found ${buffered.length} buffered messages`);

  // Save to local IndexedDB
  for (const msg of buffered) {
    (msg as any).status = "delivered";
    await dbPut("messages", msg.id, msg);

    // Update chat meta
    const existingMeta = await dbGet<ChatMeta>("contacts", msg.from);
    await dbPut("contacts", msg.from, {
      friendId: msg.from,
      friendName: existingMeta?.friendName || msg.from.substring(0, 8),
      friendAvatar: existingMeta?.friendAvatar || null,
      lastMessage: msg.text || "📎 Media",
      lastMessageTime: msg.timestamp,
      unread: (existingMeta?.unread || 0) + 1,
      started: true,
    } as ChatMeta);

    // Notify sender that message was delivered
    await updateMessageStatus(msg.from, msg.id, "delivered");
  }

  // Clear the buffer
  await clearBufferedMessages(userId, buffered.map((m) => m.id));

  return buffered;
}
