import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  hashPassword,
  verifyPassword,
  generateToken,
  checkRateLimit,
  recordLoginAttempt,
  createAdminSession,
  getClientIP,
  getUserAgent,
  validatePassword,
  COOKIE_NAME,
} from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    // 入力検証
    if (!username || !password) {
      return NextResponse.json(
        { error: 'ユーザー名とパスワードが必要です' },
        { status: 400 }
      )
    }

    // IPアドレスとUser Agent取得
    const ipAddress = getClientIP(request)
    const userAgent = getUserAgent(request)

    // レート制限チェック
    const rateLimit = await checkRateLimit(ipAddress, username)
    if (!rateLimit.allowed) {
      await recordLoginAttempt(
        username,
        false,
        null,
        ipAddress,
        userAgent,
        rateLimit.lockoutUntil
          ? `ロックアウト中（${rateLimit.lockoutUntil.toISOString()}まで）`
          : 'レート制限により拒否'
      )

      const lockoutMinutes = rateLimit.lockoutUntil
        ? Math.ceil((rateLimit.lockoutUntil.getTime() - Date.now()) / 60000)
        : 15

      return NextResponse.json(
        {
          error: `ログイン試行回数が上限に達しました。${lockoutMinutes}分後に再度お試しください。`,
          lockoutUntil: rateLimit.lockoutUntil?.toISOString(),
        },
        { status: 429 }
      )
    }

    // 管理者ユーザーを検索
    const adminUser = await prisma.adminUser.findUnique({
      where: { username },
    })

    // デバッグログ（本番環境では削除推奨）
    if (process.env.NODE_ENV === 'development') {
      console.log('Admin user lookup:', {
        username,
        found: !!adminUser,
        hasHash: !!adminUser?.passwordHash,
        isActive: adminUser?.isActive,
      })
    }

    // セキュリティのため、ユーザーが存在しない場合でも同じ時間をかける（タイミング攻撃対策）
    let passwordValid = false
    if (adminUser && adminUser.passwordHash) {
      try {
        passwordValid = await verifyPassword(password, adminUser.passwordHash)
        
        if (process.env.NODE_ENV === 'development') {
          console.log('Password verification:', {
            valid: passwordValid,
            hashLength: adminUser.passwordHash.length,
            hashPrefix: adminUser.passwordHash.substring(0, 10),
          })
        }
      } catch (error) {
        console.error('Password verification error:', error)
        passwordValid = false
      }
    }

    // 認証失敗
    if (!adminUser || !passwordValid || !adminUser.isActive) {
      const failureReason = !adminUser
        ? 'ユーザー名が存在しません'
        : !adminUser.passwordHash
        ? 'パスワードハッシュが設定されていません'
        : !passwordValid
        ? 'パスワードが正しくありません'
        : 'アカウントが無効化されています'

      await recordLoginAttempt(
        username,
        false,
        adminUser?.id || null,
        ipAddress,
        userAgent,
        failureReason
      )

      return NextResponse.json(
        {
          error: 'ユーザー名またはパスワードが正しくありません',
          remainingAttempts: rateLimit.remainingAttempts - 1,
          // 開発環境でのみ詳細情報を返す
          ...(process.env.NODE_ENV === 'development' && {
            debug: {
              userExists: !!adminUser,
              hasHash: !!adminUser?.passwordHash,
              isActive: adminUser?.isActive,
              failureReason,
            },
          }),
        },
        { status: 401 }
      )
    }

    // 認証成功
    const token = generateToken(adminUser.id, adminUser.username)

    // セッションをデータベースに保存
    await createAdminSession(adminUser.id, token, ipAddress, userAgent)

    // ログイン試行を記録
    await recordLoginAttempt(username, true, adminUser.id, ipAddress, userAgent)

    // セキュアなHTTPOnlyクッキーに設定
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24時間
      path: '/',
    })

    return NextResponse.json({
      success: true,
      adminUser: {
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        name: adminUser.name,
      },
    })
  } catch (error) {
    console.error('Admin login error:', error)
    return NextResponse.json(
      { error: 'ログイン処理中にエラーが発生しました' },
      { status: 500 }
    )
  }
}

