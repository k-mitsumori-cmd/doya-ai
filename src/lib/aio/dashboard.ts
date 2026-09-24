import { aioGet } from './client'

/** Load one complete snapshot; an unavailable dependency is not an empty/free result. */
export async function readAioDashboard(orgSlug: string) {
  const [scanRes, profRes, promptRes, meRes] = await Promise.all([
    aioGet<{ items: any[] }>('/api/aio/scans', orgSlug),
    aioGet<{ profile: any }>('/api/aio/brand-profile', orgSlug),
    aioGet<{ prompts: { text?: string; isActive?: boolean }[] }>('/api/aio/prompts', orgSlug),
    aioGet<{ plan?: string; memberships?: { slug: string; role: string }[] }>('/api/aio/me', orgSlug),
  ])
  if (!meRes.plan || typeof meRes.plan !== 'string') throw new Error('組織の契約情報を確認できません。再試行してください。')
  if (!Array.isArray(scanRes.items) || !Array.isArray(promptRes.prompts)) throw new Error('取得した情報を確認できません。再試行してください。')
  const items = scanRes.items
  const sorted = items.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const done = sorted.filter(s => s.status === 'done')
  const latest = done[0], prev = done[1]
  const detail = latest ? await aioGet<{ scan: any }>(`/api/aio/scans/${latest.id}`, orgSlug) : null
  if (latest && !detail?.scan) throw new Error('スキャン結果を取得できません。再試行してください。')
  const membership = meRes.memberships?.find((item) => item.slug === orgSlug)
  if (!membership) throw new Error('組織の権限を確認できません。再試行してください。')
  return { items, profile: profRes.profile, prompts: promptRes.prompts, plan: meRes.plan, isOwner: membership.role === 'owner',
    latest, prev, lastFailed: sorted[0]?.status === 'failed', summary: detail?.scan?.summary || null }
}
