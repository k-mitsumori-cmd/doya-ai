// ============================================
// ベータで非表示のサービスの入口の判定（2026-10-19 ドヤカンニング）
// ============================================
// 一覧から外すのは src/lib/services.ts の BETA_HIDDEN_SERVICE_IDS。ここは、直接開いた人を止める判定。
// - 許可するのは、メールが UI_PREVIEW_EMAILS（新しい見た目のプレビューと同じ許可リスト）か BETA_SERVICE_EMAILS にある人だけ
// - 画面（/<id>）も API（/api/<id>/*）も同じ判定にする。画面だけ止めて API が動くと、有料の処理を呼べてしまうため
// ⚠️ 判定は毎回サーバーでセッションのメールを確かめる。データは消さない。
import { NextResponse } from 'next/server'
import { BETA_HIDDEN_SERVICE_IDS } from '@/lib/services'
import { canPreviewUiNext, uiPreviewEmails } from '@/lib/ui-next'

/** ベータを使ってよいメールの一覧（UI_PREVIEW_EMAILS と BETA_SERVICE_EMAILS を合わせたもの） */
export function betaAllowEmails(
  preview: string | undefined = process.env.UI_PREVIEW_EMAILS,
  extra: string | undefined = process.env.BETA_SERVICE_EMAILS,
): string[] {
  return [...uiPreviewEmails(preview), ...uiPreviewEmails(extra)]
}

/** このサービスを、このメールの人が使ってよいか（ベータで非表示でなければ、いつでも真） */
export function canUseBetaService(serviceId: string, email: string | null | undefined, allow: string[] = betaAllowEmails()): boolean {
  if (!BETA_HIDDEN_SERVICE_IDS.has(serviceId)) return true
  return canPreviewUiNext(email, allow)
}

async function sessionEmail(): Promise<string | null> {
  try {
    const [{ getServerSession }, { authOptions }] = await Promise.all([import('next-auth'), import('@/lib/auth')])
    const session = await getServerSession(authOptions)
    return session?.user?.email ?? null
  } catch {
    return null
  }
}

/** 画面の入口で使う。使ってよければ true */
export async function betaServiceAllowed(serviceId: string): Promise<boolean> {
  if (!BETA_HIDDEN_SERVICE_IDS.has(serviceId)) return true
  return canUseBetaService(serviceId, await sessionEmail())
}

/**
 * API の入口で使う。使えないときは 403 の応答を返す（使えるときは null）。
 * 例: const blocked = await betaServiceGuard('cunning'); if (blocked) return blocked
 */
export async function betaServiceGuard(serviceId: string): Promise<NextResponse | null> {
  if (await betaServiceAllowed(serviceId)) return null
  return NextResponse.json(
    { error: '開発中のベータ版のため、今は使えません' },
    { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
  )
}
