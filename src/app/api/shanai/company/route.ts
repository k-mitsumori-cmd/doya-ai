// GET/PUT /api/shanai/company — 会社情報（会社名・色・読み取るURL）
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShanaiUserId, json, unauthorized } from '@/lib/shanai/access'
import { companyDto } from '@/lib/shanai/company-read'
import { getOrCreateCompany, parseSiteUrl, SOURCE_KINDS } from '@/lib/shanai/company'
import { clip, oneOf } from '@/lib/shanai/types'

const MAX_SOURCES = 6

export async function GET() {
  try {
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    await getOrCreateCompany(userId)
    return json({ success: true, company: await companyDto(userId) })
  } catch (e) {
    console.error('[shanai/company][GET] failed', (e as Error)?.name)
    return json({ error: '会社情報の取得に失敗しました。' }, 500)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    const body = await req.json().catch(() => ({}))
    const company = await getOrCreateCompany(userId)

    const brandColor = /^#[0-9a-f]{6}$/i.test(String(body.brandColor || '')) ? String(body.brandColor) : company.brandColor
    const rawSources: any[] = Array.isArray(body.sources) ? body.sources.slice(0, MAX_SOURCES) : []
    const sources: { id?: string; kind: string; label: string; url: string }[] = []
    for (const s of rawSources) {
      const url = parseSiteUrl(s?.url)
      if (!url) {
        if (String(s?.url || '').trim()) return json({ error: `URLの形式が正しくありません: ${clip(s?.url, 80)}` }, 400)
        continue
      }
      if (sources.some((x) => x.url === url)) continue
      sources.push({ id: typeof s?.id === 'string' ? s.id : undefined, kind: oneOf(s?.kind, SOURCE_KINDS, 'other'), label: clip(s?.label, 60), url })
    }
    const corporate = sources.find((s) => s.kind === 'corporate')

    await prisma.$transaction(async (tx) => {
      await tx.shanaiCompany.update({
        where: { id: company.id },
        data: {
          ...(body.name !== undefined ? { name: clip(body.name, 120) } : {}),
          ...(body.manualNote !== undefined ? { manualNote: clip(body.manualNote, 4000) } : {}),
          brandColor,
          websiteUrl: corporate?.url ?? null,
        },
      })
      if (Array.isArray(body.sources)) {
        const existing = await tx.shanaiCompanySource.findMany({ where: { companyId: company.id } })
        const keep = new Set<string>()
        for (const s of sources) {
          const match = existing.find((e) => (s.id && e.id === s.id) || e.url === s.url)
          if (match) {
            keep.add(match.id)
            // URLが変わったら読み取り結果を作り直す
            if (match.url !== s.url) {
              await tx.shanaiProfileItem.deleteMany({ where: { companyId: company.id, sourceId: match.id, origin: 'site' } })
              await tx.shanaiWebPage.deleteMany({ where: { sourceId: match.id } })
            }
            await tx.shanaiCompanySource.update({ where: { id: match.id }, data: { kind: s.kind, label: s.label, url: s.url } })
          } else {
            const created = await tx.shanaiCompanySource.create({ data: { companyId: company.id, kind: s.kind, label: s.label, url: s.url } })
            keep.add(created.id)
          }
        }
        const removed = existing.filter((e) => !keep.has(e.id)).map((e) => e.id)
        if (removed.length) {
          await tx.shanaiProfileItem.deleteMany({ where: { companyId: company.id, sourceId: { in: removed }, origin: 'site' } })
          await tx.shanaiCompanySource.deleteMany({ where: { id: { in: removed } } })
        }
      }
    })

    return json({ success: true, company: await companyDto(userId) })
  } catch (e) {
    console.error('[shanai/company][PUT] failed', (e as Error)?.name)
    return json({ error: '会社情報の保存に失敗しました。' }, 500)
  }
}
