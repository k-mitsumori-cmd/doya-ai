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
import { verifyTurnstileToken, isTurnstileRequired } from '@/lib/turnstile'

// cookies() を使用するため、静的最適化を無効化
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const identifier = (body.identifier || body.username || '').toString().trim()
    const password = (body.password || '').toString()
    const turnstileToken = (body.turnstileToken || '').toString()

    // 入力検証
    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'ユーザー名（またはメール）とパスワードが必要です' },
        { status: 400 }
      )
    }

    // IPアドレスとUser Agent取得
    const ipAddress = getClientIP(request)
    const userAgent = getUserAgent(request)

    // Cloudflare Turnstile検証（設定されている場合）
    if (isTurnstileRequired() || turnstileToken) {
      const turnstileResult = await verifyTurnstileToken(turnstileToken, ipAddress)
      if (!turnstileResult.success) {
        await recordLoginAttempt(
          identifier,
          false,
          null,
          ipAddress,
          userAgent,
          `Turnstile検証失敗: ${turnstileResult.error}`
        )
        return NextResponse.json(
          { 
            error: turnstileResult.error || 'CAPTCHA検証に失敗しました',
            turnstileError: true,
          },
          { status: 400 }
        )
      }
    }

    // レート制限チェック
    const rateLimit = await checkRateLimit(ipAddress, identifier)
    if (!rateLimit.allowed) {
      await recordLoginAttempt(
        identifier,
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

    // Break-glass: 緊急復旧ログイン（任意）
    // - 本番で管理者の認証情報が不明になった場合の救済
    // - 有効化は明示的に ADMIN_BREAKGLASS_ENABLED=true を設定した場合のみ
    // - 指定のメールでログイン成功したら、そのメールのAdminUserをDBにupsertして復旧する
    const isEnvTruthy = (v: string | undefined): boolean => {
      const s = String(v || '').trim().toLowerCase()
      return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on'
    }

    const breakglassEnabled = isEnvTruthy(process.env.ADMIN_BREAKGLASS_ENABLED)
    const breakglassEmail = process.env.ADMIN_BREAKGLASS_EMAIL?.trim().toLowerCase()
    const breakglassPassword = process.env.ADMIN_BREAKGLASS_PASSWORD?.trim()
    if (breakglassEnabled && breakglassEmail && breakglassPassword) {
      const idLower = identifier.trim().toLowerCase()
      if (idLower === breakglassEmail && password === breakglassPassword) {
        const pw = validatePassword(breakglassPassword)
        if (!pw.valid) {
          return NextResponse.json(
            { error: '緊急復旧パスワードが要件を満たしていません（ADMIN_BREAKGLASS_PASSWORD）' },
            { status: 500 }
          )
        }

        const passwordHash = await hashPassword(breakglassPassword)
        await prisma.adminUser.upsert({
          where: { username: breakglassEmail },
          create: {
            username: breakglassEmail,
            email: breakglassEmail,
            name: 'Owner',
            passwordHash,
            isActive: true,
          },
          update: {
            email: breakglassEmail,
            name: 'Owner',
            passwordHash,
            isActive: true,
          },
        })
      }
    }

    // Bootstrap: 管理者が0人の時だけ、環境変数から初期管理者を作成
    // - 本番セットアップを簡単にするため（1回だけ）
    // - 既に管理者がいる場合は何もしない
    const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim()
    const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim()
    if (bootstrapEmail && bootstrapPassword) {
      const count = await prisma.adminUser.count()
      if (count === 0) {
        const pw = validatePassword(bootstrapPassword)
        if (pw.valid) {
          const passwordHash = await hashPassword(bootstrapPassword)
          await prisma.adminUser.create({
            data: {
              username: bootstrapEmail,
              email: bootstrapEmail,
              name: 'Owner',
              passwordHash,
              isActive: true,
            },
          })
        } else if (process.env.NODE_ENV === 'development') {
          console.warn('[admin bootstrap] password does not meet requirements:', pw.errors)
        }
      }
    }

    // 管理者ユーザーを検索
    const adminUser = await prisma.adminUser.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier }],
      },
    })

    // デバッグログ（本番環境では削除推奨）
    if (process.env.NODE_ENV === 'development') {
      console.log('Admin user lookup:', {
        identifier,
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
        identifier,
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
    await recordLoginAttempt(identifier, true, adminUser.id, ipAddress, userAgent)

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
    // エラーの詳細をログに出力
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : ''
    console.error('Admin login error details:', { errorMessage, errorStack })
    
    return NextResponse.json(
      { 
        error: 'ログイン処理中にエラーが発生しました',
        // 開発環境でのみエラー詳細を返す
        ...(process.env.NODE_ENV === 'development' && { details: errorMessage }),
      },
      { status: 500 }
    )
  }
}

