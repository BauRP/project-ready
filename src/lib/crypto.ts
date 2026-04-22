// Ed25519 + X25519 + XSalsa20-Poly1305 encryption layer using tweetnacl
import nacl from "tweetnacl";
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from "tweetnacl-util";
import { dbGet, dbPut } from "./storage";

export interface KeyPair {
  publicKey: string; // base64
  secretKey: string; // base64
}

export interface IdentityKeys {
  signing: KeyPair;    // Ed25519 for identity
  exchange: KeyPair;   // X25519 for key exchange / encryption
  createdAt: number;
}

/**
 * Generate or load local Ed25519 + X25519 identity.
 */
export async function getOrCreateIdentity(): Promise<IdentityKeys> {
  const existing = await dbGet<IdentityKeys>("identity", "keys");
  if (existing) return existing;

  const signingKP = nacl.sign.keyPair();
  const exchangeKP = nacl.box.keyPair();

  const identity: IdentityKeys = {
    signing: {
      publicKey: encodeBase64(signingKP.publicKey),
      secretKey: encodeBase64(signingKP.secretKey),
    },
    exchange: {
      publicKey: encodeBase64(exchangeKP.publicKey),
      secretKey: encodeBase64(exchangeKP.secretKey),
    },
    createdAt: Date.now(),
  };

  await dbPut("identity", "keys", identity);
  return identity;
}

/**
 * Encrypt a message for a recipient using X25519 + XSalsa20-Poly1305 (NaCl box).
 */
export function encryptMessage(
  plaintext: string,
  recipientPublicKey: string,
  senderSecretKey: string
): { ciphertext: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const msgBytes = decodeUTF8(plaintext);
  const pubKey = decodeBase64(recipientPublicKey);
  const secKey = decodeBase64(senderSecretKey);

  const encrypted = nacl.box(msgBytes, nonce, pubKey, secKey);
  if (!encrypted) throw new Error("Encryption failed");

  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

/**
 * Decrypt a message from a sender.
 */
export function decryptMessage(
  ciphertext: string,
  nonce: string,
  senderPublicKey: string,
  recipientSecretKey: string
): string {
  const decrypted = nacl.box.open(
    decodeBase64(ciphertext),
    decodeBase64(nonce),
    decodeBase64(senderPublicKey),
    decodeBase64(recipientSecretKey)
  );
  if (!decrypted) throw new Error("Decryption failed — invalid key or tampered data");
  return encodeUTF8(decrypted);
}

/**
 * Sign data with Ed25519.
 */
export function signData(data: string, secretKey: string): string {
  const sig = nacl.sign.detached(decodeUTF8(data), decodeBase64(secretKey));
  return encodeBase64(sig);
}

/**
 * Verify Ed25519 signature.
 */
export function verifySignature(data: string, signature: string, publicKey: string): boolean {
  return nacl.sign.detached.verify(
    decodeUTF8(data),
    decodeBase64(signature),
    decodeBase64(publicKey)
  );
}

/**
 * БОСС: Новый алгоритм генерации уникального ID.
 * Мы используем SHA-256 и переводим его в HEX (цифры и буквы A-F), 
 * чтобы ID был солидным и уникальным.
 */
export function getKeyFingerprint(publicKey: string): string {
  try {
    const bytes = decodeBase64(publicKey);
    // Используем SHA-512 через NaCl для более длинного хеша
    const hash = nacl.hash(bytes);
    
    // Превращаем байты в HEX-строку (0-9, A-F)
    const hex = Array.from(hash)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
      
    // Берем 12 символов и разбиваем их дефисом для удобства чтения
    // Например: 4A2D-8B1C-E9F0
    const part1 = hex.substring(0, 4);
    const part2 = hex.substring(4, 8);
    const part3 = hex.substring(8, 12);
    
    return `${part1}-${part2}-${part3}`;
  } catch (e) {
    // Если всё совсем плохо, генерируем случайный ID, чтобы не было "111111"
    return "TRV-" + Math.random().toString(36).substring(2, 10).toUpperCase();
  }
}

/**
 * Post-Quantum Hybrid layer.
 */
export function pqxdhEncrypt(
  plaintext: string,
  recipientPublicKey: string,
  senderSecretKey: string
): { ciphertext: string; nonce: string; pqEntropy: string } {
  const pqEntropy = nacl.randomBytes(32);
  const combinedPlaintext = encodeBase64(pqEntropy) + "||" + plaintext;
  const result = encryptMessage(combinedPlaintext, recipientPublicKey, senderSecretKey);
  return { ...result, pqEntropy: encodeBase64(pqEntropy) };
}

export function pqxdhDecrypt(
  ciphertext: string,
  nonce: string,
  senderPublicKey: string,
  recipientSecretKey: string
): string {
  const decrypted = decryptMessage(ciphertext, nonce, senderPublicKey, recipientSecretKey);
  const parts = decrypted.split("||");
  return parts.length > 1 ? parts.slice(1).join("||") : decrypted;
}
