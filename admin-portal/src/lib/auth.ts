import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'your-super-secret-key-change-in-production'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'doya-admin-2024'
const COOKIE_NAME = 'doya_admin_token'

interface AdminPayload {
  role: 'admin'
  iat: number
  exp: number
}

/**
 * 管理者認証
 */
export async function authenticateAdmin(password: string): Promise<string | null> {
  if (password !== ADMIN_PASSWORD) {
    return null
  }
  
  const token = jwt.sign(
    { role: 'admin' },
    JWT_SECRET,
    { expiresIn: '24h' }
  )
  
  return token
}

/**
 * トークン検証
 */
export function verifyAdminToken(token: string): AdminPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AdminPayload
  } catch {
    return null
  }
}

/**
 * 認証済みかチェック
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  
  if (!token) return false
  
  const payload = verifyAdminToken(token)
  return payload !== null
}

/**
 * Cookie名をエクスポート
 */
export { COOKIE_NAME }

