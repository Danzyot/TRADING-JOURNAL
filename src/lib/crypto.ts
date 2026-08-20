/**
 * Symmetric encryption for broker credentials at rest.
 *
 * Broker passwords and API secrets are the only genuinely dangerous thing this
 * app stores — a leaked database row should not be a leaked trading account.
 * AES-256-GCM with a random IV per record, keyed by ENCRYPTION_KEY.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw || raw.length < 32) {
    throw new Error(
      'ENCRYPTION_KEY must be set to at least 32 characters. Generate one with: openssl rand -base64 48',
    )
  }
  // Hashing accepts any passphrase length while always yielding 32 bytes.
  return createHash('sha256').update(raw).digest()
}

/** Returns base64 of iv || ciphertext || authTag. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString('base64')
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, 'base64')
  if (buf.length < IV_BYTES + TAG_BYTES + 1) throw new Error('Ciphertext is malformed or truncated')
  const iv = buf.subarray(0, IV_BYTES)
  const tag = buf.subarray(buf.length - TAG_BYTES)
  const ciphertext = buf.subarray(IV_BYTES, buf.length - TAG_BYTES)
  const decipher = createDecipheriv(ALGO, key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

export function encryptJson(value: unknown): string {
  return encrypt(JSON.stringify(value))
}

export function decryptJson<T>(payload: string): T {
  return JSON.parse(decrypt(payload)) as T
}

/** Constant-time comparison of two equal-length strings. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Compares two secrets without leaking the length of the expected one.
 *
 * `safeEqual` returns early when lengths differ, which tells an attacker how
 * long the real secret is. Hashing both sides first makes every comparison
 * exactly 64 characters, so only equality is observable.
 */
export function secretsMatch(candidate: string, expected: string): boolean {
  if (!candidate || !expected) return false
  const a = createHash('sha256').update(candidate).digest('hex')
  const b = createHash('sha256').update(expected).digest('hex')
  return safeEqual(a, b)
}
