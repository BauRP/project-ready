// Stealth features: Network Noise (Vuvuzela) & Message Fragmentation

import { sendNoisePacket } from "./gun-setup";

let noiseInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the network noise generator (Vuvuzela/Alpenhorn pattern).
 * Sends encrypted dummy packets at random intervals to mask real activity.
 */
export function startNetworkNoise() {
  if (noiseInterval) return;

  const sendNoise = () => {
    sendNoisePacket();
    // Randomize interval between 3-12 seconds for unpredictability
    const nextDelay = 3000 + Math.random() * 9000;
    noiseInterval = setTimeout(() => {
      sendNoise();
    }, nextDelay) as unknown as ReturnType<typeof setInterval>;
  };

  sendNoise();
}

export function stopNetworkNoise() {
  if (noiseInterval) {
    clearTimeout(noiseInterval);
    noiseInterval = null;
  }
}

export function isNoiseActive(): boolean {
  return noiseInterval !== null;
}

/**
 * Message Fragmentation — "Stealth Mode"
 * Splits messages into small chunks before sending across the network.
 * Each fragment is individually encrypted and sent via different nodes.
 */
export interface MessageFragment {
  fragmentId: string;
  messageId: string;
  index: number;
  total: number;
  data: string;
  timestamp: number;
}

export function fragmentMessage(
  messageId: string,
  text: string,
  chunkSize: number = 8
): MessageFragment[] {
  const fragments: MessageFragment[] = [];
  const totalChunks = Math.ceil(text.length / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    fragments.push({
      fragmentId: `${messageId}-frag-${i}`,
      messageId,
      index: i,
      total: totalChunks,
      data: text.slice(i * chunkSize, (i + 1) * chunkSize),
      timestamp: Date.now() + i, // Slight offset per fragment
    });
  }

  return fragments;
}

export function reassembleFragments(fragments: MessageFragment[]): string {
  return fragments
    .sort((a, b) => a.index - b.index)
    .map((f) => f.data)
    .join("");
}

/**
 * Get noise statistics for the security dashboard.
 */
let noisePacketsSent = 0;

export function getNoiseStats() {
  return {
    isActive: isNoiseActive(),
    packetsSent: noisePacketsSent,
    protocol: "Vuvuzela/Alpenhorn",
  };
}

// Patch sendNoisePacket to track count
const originalSend = sendNoisePacket;
export function sendTrackedNoisePacket() {
  originalSend();
  noisePacketsSent++;
}
