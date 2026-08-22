// ============================================
// バナーテンプレート保守APIの管理者ガード
// ============================================
// なぜ必要か（2026-08-22 に発見）:
//   /api/banner/test/templates/* には、テンプレートを削除する DELETE が
//   4本ぶら下がっていた。うち clear は `deleteMany({})` で**全件削除**する。
//   そしてどれにも認証が無く（コードには「認証チェックは一時的に無効化（テスト用）」
//   と書かれたまま本番に出ていた）、ミドルウェアもこの名前空間を保護していない。
//   つまり URL を知っている人が DELETE を1回投げるだけで、
//   ドヤバナーAI のテンプレート348件（＝サービスの中核資産）が消える状態だった。
//   画像は Postgres の base64 にしか無いため、消えたら復旧は困難。
//
// 通し方は2つ:
//   1. 管理画面にログイン済み（admin_session_token クッキー）
//   2. Authorization: Bearer ${CRON_SECRET}（スクリプト・運用作業から叩く場合）
//
// ⚠️ 保守APIを追加したら、必ずこのガードを最初の1行で呼ぶこと。
import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME, verifyToken } from '@/lib/admin-auth'

/**
 * 管理者でなければ 401 の NextResponse を返す。通過した場合は null。
 *
 * 使い方:
 *   const denied = requireBannerAdmin(request)
 *   if (denied) return denied
 */
export function requireBannerAdmin(request: NextRequest | Request): NextResponse | null {
  // 1) 運用スクリプト用のトークン
  const cronSecret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (cronSecret && auth === `Bearer ${cronSecret}`) return null

  // 2) 管理画面のログインセッション
  const cookieHeader = request.headers.get('cookie') || ''
  const token = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1)

  if (token && verifyToken(decodeURIComponent(token))) return null

  return NextResponse.json(
    { error: 'この操作には管理者権限が必要です' },
    { status: 401 }
  )
}
