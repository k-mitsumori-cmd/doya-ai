import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// refresh token の暗号化（AES-256-GCM）。鍵は環境変数 GMAIL_TOKEN_ENC_KEY（base64、32バイト）。
// 形式: v1:<iv>:<tag>:<暗号文>（すべて base64）
function getKey(): Buffer {
  const raw = process.env.GMAIL_TOKEN_ENC_KEY || ''
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('GMAIL_TOKEN_ENC_KEY が未設定、または 32 バイトの base64 ではありません')
  }
  return key
}

export function isEncryptionConfigured(): boolean {
  try {
    getKey()
    return true
  } catch {
    return false
  }
}

// 機能の旗。GMAIL_SEND_ENABLED=1 で、鍵と Google の設定がそろっているときだけ有効。
// 旗が off のとき（本番に表や鍵がない間）は、DB にも Google にも触れない。
export function isGmailEnabled(): boolean {
  return process.env.GMAIL_SEND_ENABLED === '1' && Boolean(process.env.GOOGLE_CLIENT_ID) && isEncryptionConfigured()
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ['v1', iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':')
}

export function decryptToken(payload: string): string {
  const [v, iv, tag, enc] = payload.split(':')
  if (v !== 'v1' || !iv || !tag || !enc) throw new Error('暗号化トークンの形式が不正です')
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(enc, 'base64')), decipher.final()]).toString('utf8')
}
