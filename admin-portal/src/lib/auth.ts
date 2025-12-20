import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import type { AdminRole } from '@/lib/accounts/types'
import { findAccountByEmail, markLogin, verifyPassword } from '@/lib/accounts/store'

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'your-super-secret-key-change-in-production'
const COOKIE_NAME = 'doya_admin_token'

interface AdminPayload {
  sub: string
  email: string
  role: AdminRole
  iat: number
  exp: number
}

/**
 * 管理者ログイン（アカウント制）
 */
export async function authenticateAccount(email: string, password: string): Promise<string | null> {
  const acc = findAccountByEmail(email)
  if (!acc) return null
  if (!verifyPassword(acc, password)) return null

  markLogin(acc.id)

  const token = jwt.sign(
    { sub: acc.id, email: acc.email, role: acc.role },
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

export async function getAuthContext(): Promise<AdminPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyAdminToken(token)
}

/**
 * 認証済みかチェック
 */
export async function isAuthenticated(): Promise<boolean> {
  const ctx = await getAuthContext()
  return ctx !== null
}

export function canManageAccounts(role: AdminRole) {
  return role === 'owner' || role === 'admin'
}

/**
 * Cookie名をエクスポート
 */
export { COOKIE_NAME }

