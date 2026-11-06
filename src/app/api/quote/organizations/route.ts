import { privateApiJson } from '@/lib/private-api-response'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET  /api/quote/organizations — 所属組織一覧＋現在の組織
// POST /api/quote/organizations — 初回オンボーディング（組織作成）
import { NextRequest } from 'next/server'
import { getQuoteContext, getOrCreateOrganization, listMemberships, orgSlugFrom, resolveUserId } from '@/lib/quote/access'

export async function GET(req: NextRequest) {
  const userId = await resolveUserId()
  if (!userId) return privateApiJson({ error: 'ログインが必要です' }, { status: 401 })
  const ctx = await getQuoteContext(orgSlugFrom(req))
  const memberships = await listMemberships()
  return privateApiJson({
    current: ctx ? { slug: ctx.organizationSlug, name: ctx.organizationName, role: ctx.role } : null,
    memberships,
  })
}

export async function POST(req: NextRequest) {
  const userId = await resolveUserId()
  if (!userId) return privateApiJson({ error: 'ログインが必要です' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return privateApiJson({ error: '入力内容が正しくありません' }, { status: 400 })
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return privateApiJson({ error: '組織名を入力してください' }, { status: 400 })
  if (name.length > 120) return privateApiJson({ error: '組織名は120文字以内で入力してください' }, { status: 400 })
  if (body.memberName != null && typeof body.memberName !== 'string') {
    return privateApiJson({ error: '氏名の形式が正しくありません' }, { status: 400 })
  }
  const memberName = typeof body.memberName === 'string' ? body.memberName.trim() || undefined : undefined
  if (memberName && memberName.length > 80) return privateApiJson({ error: '氏名は80文字以内で入力してください' }, { status: 400 })
  try {
    const org = await getOrCreateOrganization(userId, name, memberName)
    return privateApiJson({ slug: org.slug, name: org.name })
  } catch (e) {
    if (e instanceof Error && 'code' in e && e.code === 'INVALID_MEMBERSHIP_ROLE') return privateApiJson({ error: '組織の権限を確認できません。管理者に確認してください。', code: 'INVALID_MEMBERSHIP_ROLE' }, { status: 403 })
    throw e
  }
}
