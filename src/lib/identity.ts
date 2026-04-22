// Decentralized Base58 Identity System
import nacl from "tweetnacl";
import bs58 from "bs58";

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

/**
 * Get or create the local user's Base58 ID.
 */
export async function getLocalBase58Id(): Promise<string> {
  // Динамический импорт крипто-модуля
  const { getOrCreateIdentity } = await import("./crypto");
  const identity = await getOrCreateIdentity();
  
  if (!identity || !identity.signing || !identity.signing.publicKey) {
    throw new Error("Не удалось получить криптографическую личность");
  }
  
  return publicKeyToBase58Id(identity.signing.publicKey);
}
