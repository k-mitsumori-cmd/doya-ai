import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from './prisma'

// JWT秘密鍵（環境変数から取得、なければ警告）
export const JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret-change-in-production'
export const JWT_EXPIRES_IN = '24h'
export const COOKIE_NAME = 'admin_session_token'
export const MAX_LOGIN_ATTEMPTS = 5
export const LOCKOUT_DURATION = 15 * 60 * 1000 // 15分（ミリ秒）

// IPアドレス取得ヘルパー
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  return forwarded?.split(',')[0] || realIP || 'unknown'
}

// User Agent取得ヘルパー
export function getUserAgent(request: Request): string {
  return request.headers.get('user-agent') || 'unknown'
}

// パスワードハッシュ化
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12
  return bcrypt.hash(password, saltRounds)
}

// パスワード検証
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// JWTトークン生成
export function generateToken(adminUserId: string, username: string): string {
  return jwt.sign(
    {
      adminUserId,
      username,
      type: 'admin',
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )
}

// JWTトークン検証
export function verifyToken(token: string): { adminUserId: string; username: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { adminUserId: string; username: string }
    return decoded
  } catch (error) {
    return null
  }
}

// レート制限チェック（IPアドレスベース）
export async function checkRateLimit(ipAddress: string, username: string): Promise<{
  allowed: boolean
  remainingAttempts: number
  lockoutUntil?: Date
}> {
  const fifteenMinutesAgo = new Date(Date.now() - LOCKOUT_DURATION)
  
  // 最近の失敗したログイン試行をカウント
  const recentFailedAttempts = await prisma.adminLoginAttempt.count({
    where: {
      OR: [
        { ipAddress, success: false, createdAt: { gte: fifteenMinutesAgo } },
        { username, success: false, createdAt: { gte: fifteenMinutesAgo } },
      ],
    },
  })

  if (recentFailedAttempts >= MAX_LOGIN_ATTEMPTS) {
    // 最も最近の失敗試行からロックアウト期間を計算
    const lastAttempt = await prisma.adminLoginAttempt.findFirst({
      where: {
        OR: [
          { ipAddress, success: false },
          { username, success: false },
        ],
      },
      orderBy: { createdAt: 'desc' },
    })

    if (lastAttempt) {
      const lockoutUntil = new Date(lastAttempt.createdAt.getTime() + LOCKOUT_DURATION)
      if (lockoutUntil > new Date()) {
        return {
          allowed: false,
          remainingAttempts: 0,
          lockoutUntil,
        }
      }
    }
  }

  return {
    allowed: true,
    remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - recentFailedAttempts),
  }
}

// ログイン試行記録
export async function recordLoginAttempt(
  username: string,
  success: boolean,
  adminUserId: string | null,
  ipAddress: string,
  userAgent: string,
  failureReason?: string
): Promise<void> {
  await prisma.adminLoginAttempt.create({
    data: {
      adminUserId: adminUserId || null,
      username,
      ipAddress,
      userAgent,
      success,
      failureReason: failureReason || null,
    },
  })
}

// 管理者認証チェック（ミドルウェア用）
export async function verifyAdminSession(token: string | null): Promise<{
  valid: boolean
  adminUser?: { id: string; username: string; email: string | null; name: string | null }
}> {
  if (!token) {
    return { valid: false }
  }

  const decoded = verifyToken(token)
  if (!decoded) {
    return { valid: false }
  }

  // データベースで管理者を確認
  const adminUser = await prisma.adminUser.findUnique({
    where: { id: decoded.adminUserId },
    select: { id: true, username: true, email: true, name: true, isActive: true },
  })

  if (!adminUser || !adminUser.isActive) {
    return { valid: false }
  }

  // セッションがデータベースに存在するか確認（オプション）
  const session = await prisma.adminSession.findFirst({
    where: {
      token,
      adminUserId: adminUser.id,
      expiresAt: { gt: new Date() },
    },
  })

  if (!session) {
    return { valid: false }
  }

  return {
    valid: true,
    adminUser: {
      id: adminUser.id,
      username: adminUser.username,
      email: adminUser.email,
      name: adminUser.name,
    },
  }
}

// セッション作成
export async function createAdminSession(
  adminUserId: string,
  token: string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 24) // 24時間後

  await prisma.adminSession.create({
    data: {
      token,
      adminUserId,
      ipAddress,
      userAgent,
      expiresAt,
    },
  })

  // 古いセッションを削除（同じユーザーのセッションを最大5つまで）
  const sessions = await prisma.adminSession.findMany({
    where: { adminUserId },
    orderBy: { createdAt: 'desc' },
    skip: 4, // 最新4つを残す
  })

  if (sessions.length > 0) {
    await prisma.adminSession.deleteMany({
      where: {
        id: { in: sessions.map(s => s.id) },
      },
    })
  }

  // 最後ログイン時刻を更新
  await prisma.adminUser.update({
    where: { id: adminUserId },
    data: { lastLoginAt: new Date() },
  })
}

// セッション削除（ログアウト）
export async function deleteAdminSession(token: string): Promise<void> {
  await prisma.adminSession.deleteMany({
    where: { token },
  })
}

// 管理者パスワード要件チェック
export function validatePassword(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 12) {
    errors.push('パスワードは12文字以上である必要があります')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('パスワードには大文字を含める必要があります')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('パスワードには小文字を含める必要があります')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('パスワードには数字を含める必要があります')
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('パスワードには記号を含める必要があります')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

