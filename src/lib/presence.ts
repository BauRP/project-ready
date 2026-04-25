// Real-time presence system via GunDB
//
// State Isolation Policy:
//  - "Invisible Mode" (stealthMode) is enforced HERE on presence broadcasting.
//  - When invisible, the user's heartbeat / online status is NOT published —
//    peers will see them as "offline".
//  - This MUST NOT be coupled to ad rendering. Ads remain visible regardless.
import gun from "./gun-setup";

type PresenceStatus = "online" | "away" | "offline";
type PresenceCallback = (userId: string, status: PresenceStatus) => void;

const listeners = new Set<PresenceCallback>();
const presenceCache = new Map<string, PresenceStatus>();

const HEARTBEAT_INTERVAL = 15000; // 15s
const OFFLINE_THRESHOLD = 60000; // 60s

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let invisibleMode = false;

export function setInvisibleMode(enabled: boolean, userId?: string) {
  const wasInvisible = invisibleMode;
  invisibleMode = enabled;
  if (!userId) return;
  if (enabled && !wasInvisible) {
    // Going invisible: tell peers we're offline immediately.
    try {
      gun.get("trivo-presence").get(userId).put({
        status: "offline",
        lastSeen: Date.now(),
      });
    } catch {}
  } else if (!enabled && wasInvisible) {
    publishHeartbeat(userId);
  }
}

export function startPresence(userId: string) {
  publishHeartbeat(userId);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => publishHeartbeat(userId), HEARTBEAT_INTERVAL);

  const handleVisibility = () => {
    if (invisibleMode) return;
    if (document.hidden) {
      publishStatus(userId, "away");
    } else {
      publishStatus(userId, "online");
    }
  };
  document.addEventListener("visibilitychange", handleVisibility);

  const handleUnload = () => publishStatus(userId, "offline");
  window.addEventListener("beforeunload", handleUnload);

  return () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    document.removeEventListener("visibilitychange", handleVisibility);
    window.removeEventListener("beforeunload", handleUnload);
    publishStatus(userId, "offline");
  };
}

function publishHeartbeat(userId: string) {
  // Invisible Mode: skip presence broadcast so other users see us offline.
  // Does NOT affect ads, P2P messaging, or any other subsystem.
  if (invisibleMode) return;
  try {
    gun.get("trivo-presence").get(userId).put({
      status: document.hidden ? "away" : "online",
      lastSeen: Date.now(),
    });
  } catch {}
}

function publishStatus(userId: string, status: PresenceStatus) {
  // Respect Invisible Mode: never advertise online/away while invisible.
  if (invisibleMode && status !== "offline") return;
  try {
    gun.get("trivo-presence").get(userId).put({
      status,
      lastSeen: Date.now(),
    });
  } catch {}
}

export function subscribeToPresence(userId: string): () => void {
  try {
    // Босс: добавили очистку, чтобы не было дублей подписок
    gun.get("trivo-presence").get(userId).on((data: any) => {
      if (!data || !data.lastSeen) return;
      
      const elapsed = Date.now() - data.lastSeen;
      let status: PresenceStatus;
      
      if (elapsed > OFFLINE_THRESHOLD) {
        status = "offline";
      } else {
        status = data.status || "offline";
      }
      
      const prev = presenceCache.get(userId);
      if (prev !== status) {
        presenceCache.set(userId, status);
        listeners.forEach((cb) => cb(userId, status));
      }
    });
  } catch {}

  return () => {
    try {
      gun.get("trivo-presence").get(userId).off();
    } catch {}
  };
}

export function getPresenceStatus(userId: string): PresenceStatus {
  return presenceCache.get(userId) || "offline";
}

export function onPresenceChange(cb: PresenceCallback): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
