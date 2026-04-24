// Firestore-backed source of truth for message lifecycle (edit, delete, pin).
// Each lifecycle doc lives at:  chat_lifecycle/{chatKey}/messages/{messageId}
// chatKey = sorted("userA", "userB") so both participants read/write the same doc.
//
// Document shape:
//   {
//     editedText?:        string   // present only when isEdited
//     isEdited?:          boolean
//     deletedForEveryone?: boolean
//     deletedFor?:        string[] // userIds who chose "Delete for me"
//     pinnedAt?:          number   // ms timestamp; absent => not pinned
//     pinnedBy?:          string
//     updatedAt:          number
//   }

import { db } from "./firebase";
import {
  doc,
  setDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  deleteField,
  type DocumentData,
} from "firebase/firestore";

export interface MessageLifecycle {
  messageId: string;
  isEdited?: boolean;
  editedText?: string;
  deletedForEveryone?: boolean;
  deletedFor?: string[];
  pinnedAt?: number;
  pinnedBy?: string;
  updatedAt?: number;
}

export function chatKey(a: string, b: string): string {
  return [a, b].sort().join("__");
}

function lifecycleDoc(chatA: string, chatB: string, messageId: string) {
  // Replace any '/' so Firestore doesn't treat segments incorrectly.
  const safeId = messageId.replace(/\//g, "_");
  return doc(db, "chat_lifecycle", chatKey(chatA, chatB), "messages", safeId);
}

// ─── Mutations ──────────────────────────────────────────────

export async function editMessage(
  selfId: string,
  peerId: string,
  messageId: string,
  newText: string,
): Promise<void> {
  await setDoc(
    lifecycleDoc(selfId, peerId, messageId),
    {
      isEdited: true,
      editedText: newText,
      updatedAt: Date.now(),
      lastEditBy: selfId,
    },
    { merge: true },
  );
}

export async function deleteMessageForMe(
  selfId: string,
  peerId: string,
  messageId: string,
): Promise<void> {
  await setDoc(
    lifecycleDoc(selfId, peerId, messageId),
    {
      deletedFor: arrayUnion(selfId),
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

export async function deleteMessageForEveryone(
  selfId: string,
  peerId: string,
  messageId: string,
): Promise<void> {
  await setDoc(
    lifecycleDoc(selfId, peerId, messageId),
    {
      deletedForEveryone: true,
      editedText: deleteField(),
      isEdited: deleteField(),
      updatedAt: Date.now(),
      deletedBy: selfId,
    },
    { merge: true },
  );
}

export async function pinMessage(
  selfId: string,
  peerId: string,
  messageId: string,
): Promise<void> {
  await setDoc(
    lifecycleDoc(selfId, peerId, messageId),
    {
      pinnedAt: Date.now(),
      pinnedBy: selfId,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

export async function unpinMessage(
  selfId: string,
  peerId: string,
  messageId: string,
): Promise<void> {
  await setDoc(
    lifecycleDoc(selfId, peerId, messageId),
    {
      pinnedAt: deleteField(),
      pinnedBy: deleteField(),
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

// ─── Subscription ───────────────────────────────────────────

/**
 * Subscribe to all lifecycle docs for the (selfId, peerId) chat.
 * Callback fires with the full map on every change.
 */
export function subscribeLifecycle(
  selfId: string,
  peerId: string,
  onUpdate: (map: Record<string, MessageLifecycle>) => void,
): () => void {
  try {
    const col = collection(
      db,
      "chat_lifecycle",
      chatKey(selfId, peerId),
      "messages",
    );
    const q = query(col);
    const unsub = onSnapshot(
      q,
      (snap) => {
        const out: Record<string, MessageLifecycle> = {};
        snap.forEach((d) => {
          const data = d.data() as DocumentData;
          out[d.id] = {
            messageId: d.id,
            isEdited: !!data.isEdited,
            editedText: data.editedText,
            deletedForEveryone: !!data.deletedForEveryone,
            deletedFor: Array.isArray(data.deletedFor) ? data.deletedFor : [],
            pinnedAt: typeof data.pinnedAt === "number" ? data.pinnedAt : undefined,
            pinnedBy: data.pinnedBy,
            updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : undefined,
          };
        });
        onUpdate(out);
      },
      (err) => {
        console.warn("[firestore-messages] snapshot error:", err);
      },
    );
    return unsub;
  } catch (e) {
    console.warn("[firestore-messages] subscribe failed:", e);
    return () => {};
  }
}
