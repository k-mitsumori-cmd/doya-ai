// PUT /api/shanai/company/items — 会社プロフィール項目の確認・修正・手入力
// body: { items: [{ id?, category, statement, approved, delete? }] }
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShanaiUserId, json, unauthorized } from '@/lib/shanai/access'
import { companyDto } from '@/lib/shanai/company-read'
import { getOrCreateCompany, PROFILE_CATEGORIES } from '@/lib/shanai/company'
import { clip, oneOf } from '@/lib/shanai/types'

export async function PUT(req: NextRequest) {
  try {
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    const company = await getOrCreateCompany(userId)
    const body = await req.json().catch(() => ({}))
    const items: any[] = Array.isArray(body.items) ? body.items.slice(0, 200) : []

    await prisma.$transaction(async (tx) => {
      for (const it of items) {
        const statement = clip(it?.statement, 300)
        const category = oneOf(it?.category, PROFILE_CATEGORIES, 'other')
        if (typeof it?.id === 'string') {
          // 他社の項目は触れない（companyId の二重条件）
          if (it.delete) {
            await tx.shanaiProfileItem.deleteMany({ where: { id: it.id, companyId: company.id } })
            continue
          }
          await tx.shanaiProfileItem.updateMany({
            where: { id: it.id, companyId: company.id },
            data: { category, approved: it.approved !== false, ...(statement ? { statement } : {}) },
          })
        } else if (statement && !it?.delete) {
          await tx.shanaiProfileItem.create({ data: { companyId: company.id, category, statement, origin: 'manual', approved: true } })
        }
      }
    })
    return json({ success: true, company: await companyDto(userId) })
  } catch (e) {
    console.error('[shanai/company/items] failed', (e as Error)?.name)
    return json({ error: '会社プロフィールの保存に失敗しました。' }, 500)
  }
}
