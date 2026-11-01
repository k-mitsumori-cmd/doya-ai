// ============================================
// 会社の役割の API の共通処理（/api/company/*）
// ============================================
// ⚠️ 旗 COMPANY_ROLES_ROLLOUT が off、または会社に入っていない人には 404（表を読まない・あることを知らせない）。
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { companyRolesRollout } from './rollout'
import { companyRolesSession, type CompanyRolesSession } from './members.server'

const NO_STORE = { 'Cache-Control': 'private, no-store' }
export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })

export async function companyRolesApi(fn: (s: CompanyRolesSession) => Promise<Response>): Promise<Response> {
  try {
    if (companyRolesRollout() === 'off') return json({ error: '見つかりません。' }, 404)
    const session = await getServerSession(authOptions)
    const userId = (session?.user as { id?: string } | undefined)?.id
    if (!userId) return json({ error: 'ログインが必要です。' }, 401)
    const s = await companyRolesSession(userId, session?.user?.email ?? null)
    if (!s) return json({ error: '見つかりません。' }, 404)
    return await fn(s)
  } catch {
    console.error('[company-roles/api] failed')
    return json({ error: '読み込めませんでした。時間をおいて再度お試しください。' }, 503)
  }
}
