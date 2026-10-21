import { getServerSession } from 'next-auth'
import type { NextRequest } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { privateApiJson } from '@/lib/private-api-response'
import { organizationSelection, parseWorkspaceRead } from '@/lib/organization-workspace-selection'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Discovery is read-only, with one actual session principal for the whole read. */
export async function GET(req: NextRequest, context: { params: Promise<{ service: string }> }) {
  const { service } = await context.params
  if (service !== 'aishodan') return privateApiJson({ error: 'サービスが見つかりません' }, { status: 404 })
  try {
    const session = await getServerSession(authOptions)
    const actorId = session?.user?.id
    if (typeof actorId !== 'string' || !actorId) return privateApiJson({ error: 'ログインしてください' }, { status: 401 })
    if (req.headers.get('x-doya-workspace-actor') !== actorId) return privateApiJson({ error: 'ログイン状態を確認してください' }, { status: 409 })
    const selected = organizationSelection(new URL(req.url).search)
    if (selected.kind === 'invalid') return privateApiJson({ error: '組織の指定を確認してください' }, { status: 400 })
    const rows = await prisma.aishodanMember.findMany({
      where: { userId: actorId, status: 'ACTIVE', role: { in: ['owner', 'admin', 'manager', 'member'] } },
      select: { role: true, organization: { select: { id: true, slug: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    })
    // An ACTIVE row with an unknown role is not proof that onboarding is needed.
    if (!rows.length && await prisma.aishodanMember.findFirst({
      where: { userId: actorId, status: 'ACTIVE' }, select: { id: true },
    })) return privateApiJson({ error: '組織の権限を確認できませんでした' }, { status: 503 })
    const memberships = rows.map(row => ({ ...row.organization, role: row.role }))
    // Preserve the existing owner-first, then oldest-membership entry selection.
    const current = selected.kind === 'selected'
      ? memberships.find(row => row.slug === selected.slug) || null
      : memberships.find(row => row.role === 'owner') || memberships[0] || null
    if (selected.kind === 'selected' && !current) return privateApiJson({ error: '組織を表示する権限を確認できませんでした' }, { status: 403 })
    return privateApiJson(parseWorkspaceRead({ service, actorId, memberships, current }, actorId, selected))
  } catch {
    return privateApiJson({ error: '組織を確認できませんでした' }, { status: 503 })
  }
}
