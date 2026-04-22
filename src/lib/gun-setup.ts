import Gun from "gun";
import "gun/sea";
import { getRemoteConfig, getValue, fetchAndActivate } from "firebase/remote-config";
import { firebaseApp } from "./firebase";

const DEFAULT_RELAY_PEERS = [
  "https://relay.gun.eco/gun",
  "https://gun-manhattan.herokuapp.com/gun",
  "https://peer.wall.org/gun",
  "https://dweb.link/gun",
  "https://gun-ams.herokuapp.com/gun",
  "https://gun-sydney.herokuapp.com/gun",
  "https://gun-us.herokuapp.com/gun",
  "https://gun-eu.herokuapp.com/gun",
  "https://gunjs.herokuapp.com/gun",
  "https://gun-us-east.herokuapp.com/gun",
  "https://gun-matrix.herokuapp.com/gun",
  "https://relay.1p2p.io/gun",
  "https://gun-server.herokuapp.com/gun",
  "https://gun-node.herokuapp.com/gun",
  "https://gun-relay.com/gun",
  "https://gun-db.herokuapp.com/gun",
  "https://gun-v2.herokuapp.com/gun",
  "https://gun-main.herokuapp.com/gun",
  "https://gun-core.herokuapp.com/gun",
  "https://gun-cloud.herokuapp.com/gun",
  "https://gun-relay-2.herokuapp.com/gun",
  "https://gun-relay-3.herokuapp.com/gun",
  "https://gun-geo-1.herokuapp.com/gun",
  "https://gun-geo-2.herokuapp.com/gun",
  "https://gun-backup.herokuapp.com/gun",
  "https://gun-mirror.herokuapp.com/gun",
  "https://gun-global.herokuapp.com/gun",
  "https://gun-net.herokuapp.com/gun",
  "https://gun-io.herokuapp.com/gun",
  "https://gun-app.herokuapp.com/gun"
];

let RELAY_PEERS = [...DEFAULT_RELAY_PEERS];

// ─── Peer Health & Latency Tracking ──────────────────────────
interface PeerHealth {
  failures: number;
  lastFail: number;
  latency: number; // ms, rolling average
}

let gun: any;
let activeNodeIndex = 0;
const peerHealth: Map<string, PeerHealth> = new Map();

const FAILURE_THRESHOLD = 2; // Босс, снизил до 2 для скорости
const RECOVERY_COOLDOWN = 60000; 
const BATCH_SIZE = 5;
const HEALTH_CHECK_INTERVAL = 10000; 
const LATENCY_THRESHOLD = 3000; 
const LATENCY_PROBE_INTERVAL = 20000;

// ─── UUID Dedup Set ──────────────────────────────────────────
const seenMessageUUIDs = new Set<string>();
const MAX_SEEN_UUIDS = 10000;

export function isUUIDv4(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export function isDuplicateMessage(uuid: string): boolean {
  if (seenMessageUUIDs.has(uuid)) return true;
  seenMessageUUIDs.add(uuid);
  if (seenMessageUUIDs.size > MAX_SEEN_UUIDS) {
    const first = seenMessageUUIDs.values().next().value;
    if (first) seenMessageUUIDs.delete(first);
  }
  return false;
}

export function generateUUIDv4(): string {
  return crypto.randomUUID?.() ||
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

// ─── Latency Probing ─────────────────────────────────────────
async function probePeerLatency(peer: string): Promise<number> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LATENCY_THRESHOLD + 500);
    await fetch(peer, { method: "HEAD", mode: "no-cors", signal: controller.signal });
    clearTimeout(timeout);
    return Date.now() - start;
  } catch {
    return Infinity;
  }
}

function updatePeerLatency(peer: string, latency: number) {
  const h = peerHealth.get(peer) || { failures: 0, lastFail: 0, latency: 0 };
  h.latency = h.latency === 0 ? latency : h.latency * 0.7 + latency * 0.3;
  if (latency === Infinity || latency > LATENCY_THRESHOLD) {
    h.failures++;
    h.lastFail = Date.now();
  }
  peerHealth.set(peer, h);
}

// ─── Peer Selection ──────────────────────────────────────────
function getActivePeers(): string[] {
  const now = Date.now();
  const healthy: string[] = [];
  let scanned = 0;

  while (healthy.length < BATCH_SIZE && scanned < RELAY_PEERS.length) {
    const idx = (activeNodeIndex + scanned) % RELAY_PEERS.length;
    const peer = RELAY_PEERS[idx];
    const health = peerHealth.get(peer);

    const isHealthy =
      !health ||
      (health.failures < FAILURE_THRESHOLD && health.latency < LATENCY_THRESHOLD) ||
      now - health.lastFail > RECOVERY_COOLDOWN;

    if (isHealthy) healthy.push(peer);
    scanned++;
  }

  if (healthy.length === 0) {
    peerHealth.clear();
    return RELAY_PEERS.slice(0, BATCH_SIZE);
  }
  return healthy;
}

function getSecondaryPeer(primaryPeer: string): string {
  const idx = RELAY_PEERS.indexOf(primaryPeer);
  const nextIdx = (idx + 1) % RELAY_PEERS.length;
  return RELAY_PEERS[nextIdx];
}

function rotateToNextBatch() {
  activeNodeIndex = (activeNodeIndex + BATCH_SIZE) % RELAY_PEERS.length;
  const newPeers = getActivePeers();
  try {
    newPeers.forEach((peer) => {
      try { gun.opt({ peers: [peer] }); } catch {}
    });
  } catch {}
}

// ─── Init Gun ────────────────────────────────────────────────
try {
  gun = Gun({ 
    peers: getActivePeers(), 
    localStorage: true, 
    radisk: true,
    retry: 1000,
    axe: false 
  });
} catch {
  gun = Gun({ localStorage: true, radisk: true });
}

// ─── Health Check Loop ───────────────────────────────────────
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

function startPeerHealthCheck() {
  if (healthCheckInterval) return;
  healthCheckInterval = setInterval(async () => {
    try {
      const mesh = gun?.back?.("opt.peers") || gun?._.opt?.peers;
      const connectedCount = mesh ? Object.keys(mesh).length : 0;

      const activePeers = getActivePeers();
      for (const peer of activePeers.slice(0, 3)) {
        const lat = await probePeerLatency(peer);
        updatePeerLatency(peer, lat);
        if (lat > LATENCY_THRESHOLD) {
          rotateToNextBatch();
          break;
        }
      }

      if (connectedCount < 2) {
        rotateToNextBatch();
      }
    } catch {}
  }, HEALTH_CHECK_INTERVAL);
}

startPeerHealthCheck();

async function loadRemotePeerList() {
  try {
    const remoteConfig = getRemoteConfig(firebaseApp);
    remoteConfig.settings.minimumFetchIntervalMillis = 3600000; 
    await fetchAndActivate(remoteConfig);
    const peersJson = getValue(remoteConfig, "gundb_relay_nodes").asString();
    if (peersJson) {
      const parsed = JSON.parse(peersJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        RELAY_PEERS = parsed;
        activeNodeIndex = 0;
        rotateToNextBatch();
      }
    }
  } catch { }
}

loadRemotePeerList();

export default gun;

export function publishPublicKeys(userId: string, signingPubKey: string, exchangePubKey: string) {
  try {
    gun.get("trivo-users").get(userId).put({
      signingKey: signingPubKey,
      exchangeKey: exchangePubKey,
      updatedAt: Date.now(),
    });
  } catch {}
}

export function lookupPublicKeys(userId: string): Promise<{ signingKey: string; exchangeKey: string } | null> {
  return new Promise((resolve) => {
    try {
      gun.get("trivo-users").get(userId).once((data: any) => {
        if (data && data.signingKey && data.exchangeKey) {
          resolve({ signingKey: data.signingKey, exchangeKey: data.exchangeKey });
        } else {
          resolve(null);
        }
      });
    } catch {
      resolve(null);
    }
    setTimeout(() => resolve(null), 5000);
  });
}

export function sendGunMessage(channelId: string, messagePayload: Record<string, unknown>) {
  try {
    const msgId = (messagePayload.id as string) || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const activePeers = getActivePeers();
    const primaryPeer = activePeers[0];
    const secondaryPeer = primaryPeer ? getSecondaryPeer(primaryPeer) : activePeers[1];

    gun.get("trivo-channels").get(channelId).get(msgId).put({
      ...messagePayload,
      timestamp: Date.now(),
    });

    if (secondaryPeer) {
      gun.get("trivo-channels-backup").get(channelId).get(msgId).put({
        ...messagePayload,
        timestamp: Date.now(),
        _mirror: true,
      });
    }
  } catch {}
}

export function subscribeToChannel(channelId: string, callback: (data: any, key: string) => void) {
  try {
    const deduped = (data: any, key: string) => {
      if (!data || !key) return;
      const uuid = data.id || key;
      if (isDuplicateMessage(uuid)) return;
      callback(data, key);
    };
    gun.get("trivo-channels").get(channelId).map().on(deduped);
    gun.get("trivo-channels-backup").get(channelId).map().on(deduped);
  } catch {}
}

export function sendNoisePacket() {
  try {
    const noiseChannelId = `noise-${Math.random().toString(36).slice(2, 10)}`;
    const dummyPayload = {
      type: "noise",
      data: Array.from(crypto.getRandomValues(new Uint8Array(64)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
      timestamp: Date.now(),
    };
    gun.get("trivo-noise").get(noiseChannelId).put(dummyPayload);
  } catch {}
}
