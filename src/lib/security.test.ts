import { beforeAll, describe, expect, it } from 'vitest'
import { decrypt, decryptJson, encrypt, encryptJson, safeEqual, secretsMatch, decryptBytes, encryptBytes } from './crypto'
import { safeRedirectPath } from './auth'

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'test-key-that-is-definitely-long-enough-0123456789'
})

describe('encrypt / decrypt', () => {
  it('round-trips a string', () => {
    const secret = 'my-tradovate-password'
    expect(decrypt(encrypt(secret))).toBe(secret)
  })

  it('round-trips a JSON credential object', () => {
    const credentials = { name: 'trader', password: 'hunter2', cid: 12345, sec: 'abc' }
    expect(decryptJson(encryptJson(credentials))).toEqual(credentials)
  })

  it('produces a different ciphertext each time', () => {
    // A random IV per record means identical plaintexts do not look identical
    // at rest, so a leaked table reveals nothing by comparison.
    expect(encrypt('same')).not.toBe(encrypt('same'))
  })

  it('refuses to decrypt a tampered ciphertext', () => {
    const payload = encrypt('sensitive')
    const bytes = Buffer.from(payload, 'base64')
    // Flip a bit in the middle of the ciphertext; GCM's auth tag must catch it.
    bytes[bytes.length - 20] ^= 0xff
    expect(() => decrypt(bytes.toString('base64'))).toThrow()
  })

  it('rejects a truncated payload rather than returning garbage', () => {
    expect(() => decrypt('AAAA')).toThrow(/malformed|truncated/i)
  })

  it('handles unicode and long values', () => {
    const value = 'סיסמה־בעברית 🔐 ' + 'x'.repeat(5000)
    expect(decrypt(encrypt(value))).toBe(value)
  })
})

describe('safeEqual', () => {
  it('matches identical strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
  })

  it('rejects different strings of the same length', () => {
    expect(safeEqual('abc', 'abd')).toBe(false)
  })

  it('rejects strings of different lengths', () => {
    expect(safeEqual('abc', 'abcd')).toBe(false)
  })
})

describe('secretsMatch', () => {
  it('matches a correct secret', () => {
    expect(secretsMatch('s3cret', 's3cret')).toBe(true)
  })

  it('rejects a wrong secret', () => {
    expect(secretsMatch('wrong', 's3cret')).toBe(false)
  })

  it('rejects empty input on either side', () => {
    expect(secretsMatch('', 's3cret')).toBe(false)
    expect(secretsMatch('s3cret', '')).toBe(false)
  })

  it('compares secrets of wildly different lengths without short-circuiting', () => {
    // Both sides are hashed to 64 hex characters first, so the comparison
    // length is constant and the real secret's length is not observable.
    expect(secretsMatch('a', 'a-very-much-longer-secret-value')).toBe(false)
  })
})

describe('safeRedirectPath', () => {
  it('allows an ordinary in-app path', () => {
    expect(safeRedirectPath('/trades')).toBe('/trades')
    expect(safeRedirectPath('/trades?symbol=MNQ')).toBe('/trades?symbol=MNQ')
  })

  it('blocks a protocol-relative URL', () => {
    // The bug this exists to prevent: "//evil.com" starts with a slash but is
    // an absolute link to another host.
    expect(safeRedirectPath('//evil.com')).toBe('/')
    expect(safeRedirectPath('//evil.com/phish')).toBe('/')
  })

  it('blocks an absolute URL', () => {
    expect(safeRedirectPath('https://evil.com')).toBe('/')
    expect(safeRedirectPath('http://evil.com')).toBe('/')
  })

  it('blocks backslash tricks', () => {
    expect(safeRedirectPath('/\\evil.com')).toBe('/')
    expect(safeRedirectPath('\\\\evil.com')).toBe('/')
  })

  it('blocks a javascript: scheme', () => {
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/')
  })

  it('falls back to root for empty or missing input', () => {
    expect(safeRedirectPath('')).toBe('/')
    expect(safeRedirectPath(null)).toBe('/')
    expect(safeRedirectPath(undefined)).toBe('/')
  })
})

describe('encryptBytes / decryptBytes', () => {
  it('round-trips arbitrary binary without corrupting it', () => {
    // Every byte value, including sequences that are invalid UTF-8 — which is
    // exactly what a JPEG or a PDF looks like.
    const original = Buffer.from(Array.from({ length: 256 }, (_, index) => index))
    const restored = decryptBytes(encryptBytes(original))
    expect(restored.equals(original)).toBe(true)
  })

  it('produces different ciphertext each time, so identical files do not match', () => {
    const file = Buffer.from('same document contents')
    expect(encryptBytes(file).equals(encryptBytes(file))).toBe(false)
  })

  it('refuses tampered ciphertext rather than returning wrong bytes', () => {
    const sealed = encryptBytes(Buffer.from('statement.pdf contents'))
    sealed[sealed.length - 20] ^= 0xff
    expect(() => decryptBytes(sealed)).toThrow()
  })

  it('refuses a truncated payload', () => {
    expect(() => decryptBytes(Buffer.from([1, 2, 3]))).toThrow(/malformed|truncated/i)
  })
})
