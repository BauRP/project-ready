import { dbGet, dbPut } from "@/lib/storage";

export type DisappearingDuration = "1h" | "6h" | "12h" | "24h" | "off";

export interface ChatPreferenceState {
  mutedUntil?: number | null;
  blocked?: boolean;
  favorite?: boolean;
  disappearingDuration?: DisappearingDuration;
}

const KEY_PREFIX = "chat-preferences-";

const durationToMs: Record<Exclude<DisappearingDuration, "off">, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
};

export async function getChatPreferences(chatId: string): Promise<ChatPreferenceState> {
  return (await dbGet<ChatPreferenceState>("settings", `${KEY_PREFIX}${chatId}`)) || {};
}

export async function saveChatPreferences(chatId: string, next: ChatPreferenceState): Promise<void> {
  await dbPut("settings", `${KEY_PREFIX}${chatId}`, next);
}

export async function updateChatPreferences(chatId: string, patch: Partial<ChatPreferenceState>): Promise<ChatPreferenceState> {
  const current = await getChatPreferences(chatId);
  const next = { ...current, ...patch };
  await saveChatPreferences(chatId, next);
  return next;
}

export function getDeleteAt(timestamp: number, duration: DisappearingDuration): number | undefined {
  if (duration === "off") return undefined;
  return timestamp + durationToMs[duration];
}

export function isExpired(deleteAt?: number): boolean {
  return typeof deleteAt === "number" && deleteAt <= Date.now();
}

export function getMuteUntil(duration: DisappearingDuration): number | null {
  if (duration === "off") return null;
  return getDeleteAt(Date.now(), duration) ?? null;
}