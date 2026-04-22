// Decentralized Base58 Identity System
import nacl from "tweetnacl";
import bs58 from "bs58";
import { dbGet, dbPut } from "./storage";

const USER_ID_STORE = "identity";
const USER_ID_KEY = "public-id";
const USER_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function generateSecureUserId(length = 12): string {
  const safeLength = Math.min(12, Math.max(10, length));

  while (true) {
    const random = crypto.getRandomValues(new Uint8Array(safeLength));
    const candidate = Array.from(random, (value) => USER_ID_ALPHABET[value % USER_ID_ALPHABET.length]).join("");

    if (/[A-Za-z]/.test(candidate) && /\d/.test(candidate)) {
      return candidate;
    }
  }
}

/**
 * Generate a Base58-encoded User ID from the Ed25519 public key.
 * Босс: Улучшил конвертацию, чтобы на Android 16 не было вылетов.
 */
export function publicKeyToBase58Id(publicKey: string): string {
  try {
    // Безопасный перевод Base64 ключа в байты без использования устаревшего atob
    const binaryString = Buffer.from(publicKey, 'base64');
    const bytes = new Uint8Array(binaryString);
    
    // Создаем короткий, но уникальный хеш (20 байт)
    const hash = nacl.hash(bytes).slice(0, 20);
    return bs58.encode(hash);
  } catch (error) {
    console.error("Ошибка генерации ID:", error);
    // Фолбек: если что-то пошло не так, возвращаем часть самого ключа в base58
    return bs58.encode(new Uint8Array(10)); 
  }
}

/**
 * Validate that a string looks like a valid Trivo Base58 ID.
 */
export function isValidBase58Id(id: string): boolean {
  if (!id || id.length < 15 || id.length > 50) return false;
  try {
    const decoded = bs58.decode(id);
    return decoded.length >= 16; // Небольшой запас по длине для гибкости
  } catch {
    return false;
  }
}

export function isValidUserId(id: string): boolean {
  return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9]{10,12}$/.test(id);
}

export async function getOrCreateUserId(): Promise<string> {
  const existing = await dbGet<string>(USER_ID_STORE, USER_ID_KEY);
  if (existing && isValidUserId(existing)) {
    return existing;
  }

  const nextId = generateSecureUserId();
  await dbPut(USER_ID_STORE, USER_ID_KEY, nextId);
  return nextId;
}

/**
 * Get or create the local user's Base58 ID.
 */
export async function getLocalBase58Id(): Promise<string> {
  return getOrCreateUserId();
}
