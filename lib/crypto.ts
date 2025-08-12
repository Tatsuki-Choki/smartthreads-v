import crypto from 'crypto'

// AES-256-GCM encryption/decryption helpers
// KEY: 32-byte secret provided via env THREADS_TOKEN_ENC_KEY (base64 or hex or raw)

function getKeyFromEnv(): Buffer | null {
  const raw = process.env.THREADS_TOKEN_ENC_KEY
  if (!raw) return null
  try {
    // Try base64
    if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length % 4 === 0) {
      const b64 = Buffer.from(raw, 'base64')
      if (b64.length === 32) return b64
    }
    // Try hex
    if (/^[0-9a-fA-F]+$/.test(raw) && raw.length === 64) {
      return Buffer.from(raw, 'hex')
    }
    // Fallback: treat as utf-8 and pad/trim to 32 bytes
    const buf = Buffer.alloc(32)
    Buffer.from(raw, 'utf8').copy(buf)
    return buf
  } catch {
    return null
  }
}

export function encrypt(value: string): { cipher: string; iv: string; tag: string } {
  const key = getKeyFromEnv()
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('THREADS_TOKEN_ENC_KEY is required in production')
    }
    console.warn('[encrypt] Missing THREADS_TOKEN_ENC_KEY; returning plaintext marker')
    return { cipher: value, iv: 'plain', tag: 'plain' }
  }
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    cipher: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  }
}

export function decrypt(payload: { cipher: string; iv: string; tag: string } | null): string | null {
  if (!payload) return null
  const { cipher, iv, tag } = payload
  if (iv === 'plain' && tag === 'plain') return cipher
  const key = getKeyFromEnv()
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('THREADS_TOKEN_ENC_KEY is required to decrypt')
    }
    console.warn('[decrypt] Missing THREADS_TOKEN_ENC_KEY; returning null')
    return null
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  const dec = Buffer.concat([decipher.update(Buffer.from(cipher, 'base64')), decipher.final()])
  return dec.toString('utf8')
}

