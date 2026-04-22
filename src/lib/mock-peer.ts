// Mock test peer for first-launch initialization
import { dbGet, dbPut } from "./storage";
import type { ChatMeta } from "./p2p";

const MOCK_PEER_ID = "TRIVO_MOCK_PEER_999";
const MOCK_INIT_KEY = "mock-peer-initialized";

interface MockPeerConfig {
  id: string;
  names: Record<string, string>;
}

const MOCK_PEER: MockPeerConfig = {
  id: MOCK_PEER_ID,
  names: {
    en: "Trivo Support (Test)",
    ru: "Trivo Поддержка (Тест)",
    kk: "Trivo Қолдау (Тест)",
  },
};

export function getMockPeerName(lang: string): string {
  return MOCK_PEER.names[lang] || MOCK_PEER.names.en;
}

export async function initMockPeer(language: string): Promise<boolean> {
  const alreadyInit = await dbGet<boolean>("settings", MOCK_INIT_KEY);
  if (alreadyInit) return false;

  const name = getMockPeerName(language);

  // Add to contacts
  await dbPut("contacts", MOCK_PEER_ID, {
    friendId: MOCK_PEER_ID,
    friendName: name,
    friendAvatar: null,
    lastMessage: language === "ru"
      ? "Добро пожаловать в Trivo! 🎉"
      : language === "kk"
      ? "Trivo-ға қош келдіңіз! 🎉"
      : "Welcome to Trivo! 🎉",
    lastMessageTime: Date.now(),
    unread: 1,
    started: true,
  } as ChatMeta);

  // Add a welcome message
  const welcomeMsg = {
    id: `mock-welcome-${Date.now()}`,
    from: MOCK_PEER_ID,
    to: "self",
    text: language === "ru"
      ? "Привет! Я бот поддержки Trivo. Это тестовый чат, чтобы вы могли изучить приложение. Все ваши сообщения зашифрованы сквозным шифрованием. 🔐"
      : language === "kk"
      ? "Сәлем! Мен Trivo қолдау ботымын. Бұл сынақ чат, қолданбаны зерттеуге арналған. Барлық хабарламаларыңыз сквозды шифрланған. 🔐"
      : "Hi! I'm the Trivo support bot. This is a test chat so you can explore the app. All your messages are end-to-end encrypted. 🔐",
    timestamp: Date.now(),
    status: "delivered",
  };
  await dbPut("messages", welcomeMsg.id, welcomeMsg);

  await dbPut("settings", MOCK_INIT_KEY, true);
  return true;
}

export { MOCK_PEER_ID };
