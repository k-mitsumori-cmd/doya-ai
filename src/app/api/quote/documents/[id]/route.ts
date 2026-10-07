export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET    /api/quote/documents/[id] — 見積書の詳細
// PATCH  /api/quote/documents/[id] — 更新（明細まるごと差し替え／確定）
// DELETE /api/quote/documents/[id] — 削除
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQuoteContext, hasMinRole, orgSlugFrom } from '@/lib/quote/access'
import { recalcDocument } from '@/lib/quote/document'
import { quoteExpectedRevision, withQuoteDocumentRevision, advanceQuoteDocumentRevision, assertQuoteDocumentRevision, lockQuoteDocumentActor, isQuoteDocumentWriteConflict, QuoteDocumentRevisionError } from '@/lib/quote/document-revision'
import type { PriceSource } from '@/lib/quote/types'

type Ctx = { params: Promise<{ id: string }> }

const VALID_SOURCES: PriceSource[] = ['own_price', 'market', 'competitor', 'manual', 'ai_estimate', 'unknown']

function quoteInteger(value: unknown, fallback: number, min: number): number | null {
  if (value == null || value === '') return fallback
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const raw = String(value).normalize('NFKC').trim().replace(/\s/g, '')
  if (!/^\d+$/.test(raw) && !/^\d{1,3}(,\d{3})+$/.test(raw)) return null
  const parsed = Number(raw.replace(/,/g, ''))
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= 2147483647 ? parsed : null
}

function quoteTaxRate(value: unknown): 8 | 10 | null {
  if (value == null || value === '') return 10
  if (value === 8 || value === '8') return 8
  if (value === 10 || value === '10') return 10
  return null
}

function quoteOptionalRange(value: unknown): number | null | undefined {
  if (value == null || value === '') return null
  return quoteInteger(value, 0, 0) ?? undefined
}

function quoteExpiryDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const input = value.trim()
  const calendarDay = input.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(calendarDay)) return null
  const day = new Date(`${calendarDay}T00:00:00.000Z`)
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== calendarDay) return null
  if (input === calendarDay) return day
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(input)) return null
  const date = new Date(input)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(req: NextRequest, ctxParam: Ctx) {
  const p = await ctxParam.params
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  // ⚠️ id だけで引かない。必ず organizationId との二重条件にする
  const doc = await prisma.quoteDocument.findFirst({
    where: { id: p.id, organizationId: ctx.organizationId },
    include: { lineItems: { orderBy: { ord: 'asc' } }, product: { select: { id: true, name: true } } },
  })
  if (!doc) return NextResponse.json({ error: '見積書が見つかりません' }, { status: 404 })

  const issuer = await prisma.quoteIssuer.findUnique({ where: { organizationId: ctx.organizationId } })
  try { return NextResponse.json({ document: await withQuoteDocumentRevision(prisma, doc), issuer }) } catch (e) { if(e instanceof QuoteDocumentRevisionError) return NextResponse.json({error:e.message},{status:e.status}); throw e }
}

export async function PATCH(req: NextRequest, ctxParam: Ctx) {
  const p = await ctxParam.params
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: '更新内容が不正です' }, { status: 400 })
  }
  if ('title' in body && (typeof body.title !== 'string' || !body.title.trim())) return NextResponse.json({ error: '件名を200文字以内で入力してください。変更は保存されていません。' }, { status: 400 })
  for (const [field, label, max] of [
    ['title', '件名', 200], ['clientCompany', '宛先会社名', 200], ['clientDept', '宛先部署名', 200],
    ['clientPerson', '宛先担当者名', 200], ['notes', '備考', 2000],
    ['paymentTerms', '支払条件', 2000], ['deliveryTerms', '納期', 2000],
  ] as const) {
    if (body[field] != null && (typeof body[field] !== 'string' || body[field].length > max)) {
      return NextResponse.json({ error: `${label}は${max.toLocaleString('ja-JP')}文字以内の文字列で入力してください。入力内容は保存されていません。` }, { status: 400 })
    }
  }
  if (body.items != null && !Array.isArray(body.items)) {
    return NextResponse.json({ error: '明細の形式が正しくありません。変更は保存されていません。' }, { status: 400 })
  }
  if (Array.isArray(body.items) && body.items.length > 60) {
    return NextResponse.json({ error: '明細は60行以内で入力してください。変更は保存されていません。' }, { status: 400 })
  }
  if (Array.isArray(body.items) && body.items.some((i: any) =>
    !i || typeof i !== 'object' || Array.isArray(i) ||
    ([['itemName', 200], ['spec', 1000], ['unit', 12], ['sourceRef', 1000]] as const)
      .some(([field, max]) => i[field] != null && (typeof i[field] !== 'string' || i[field].length > max)))) {
    return NextResponse.json({ error: '明細の文字項目は指定の文字数内で入力してください。変更は保存されていません。' }, { status: 400 })
  }
  const expiryDate = 'expiryDate' in body ? quoteExpiryDate(body.expiryDate) : undefined
  if ('expiryDate' in body && !expiryDate) {
    return NextResponse.json({ error: '有効期限は正しい日付で入力してください。変更は保存されていません。' }, { status: 400 })
  }
  if ('discountValue' in body && quoteInteger(body.discountValue, 0, 0) === null) {
    return NextResponse.json({ error: '割引額・割引率は範囲内の整数で入力してください。変更は保存されていません。' }, { status: 400 })
  }
  if ('discountType' in body && body.discountType != null && body.discountType !== '' &&
    body.discountType !== 'rate' && body.discountType !== 'amount') {
    return NextResponse.json({ error: '値引き方法が正しくありません。変更は保存されていません。' }, { status: 400 })
  }
  if (Array.isArray(body.items) && body.items.filter((i: any) => i && i.itemName).some((i: any) =>
    quoteInteger(i.qty, 1, 1) === null || quoteInteger(i.unitPrice, 0, 0) === null ||
    quoteTaxRate(i.taxRate) === null || quoteOptionalRange(i.rangeMin) === undefined || quoteOptionalRange(i.rangeMax) === undefined
  )) {
    return NextResponse.json({ error: '数量・単価・税率・相場は正しい範囲の整数で入力してください。変更は保存されていません。' }, { status: 400 })
  }
  try {
    const expectedRevision = quoteExpectedRevision(body.expectedRevision)
    // 判定・明細・状態・合計を同じトランザクションで扱う。
    // 同時の確定と編集は直列化し、競合時には再確認を求める。
    return await prisma.$transaction(async (tx) => {
      const actor = await lockQuoteDocumentActor(tx,ctx,p.id)
      if (!actor) return NextResponse.json({ error: '組織へのアクセス権がありません。再読み込みしてください' }, { status: 403 })
      const existing = await tx.quoteDocument.findFirst({
        where: { id: p.id, organizationId: ctx.organizationId },
        include: { lineItems: {orderBy:{ord:'asc'}} },
      })
      if (!existing) return NextResponse.json({ error: '見積書が見つかりません' }, { status: 404 })

      await assertQuoteDocumentRevision(tx,existing,expectedRevision)
      const effectiveDiscountType = 'discountType' in body ? body.discountType : existing.discountType
      const effectiveDiscountValue = 'discountValue' in body ? quoteInteger(body.discountValue, 0, 0)! : existing.discountValue ?? 0
      if (effectiveDiscountType === 'rate' && effectiveDiscountValue > 100) {
        return NextResponse.json({ error: '割引率は100%以内で入力してください。変更は保存されていません。' }, { status: 400 })
      }

      const data: Record<string, unknown> = {}

      for (const f of ['title', 'clientCompany', 'clientDept', 'clientPerson', 'paymentTerms', 'deliveryTerms', 'notes'] as const) {
        if (f in body) {
          const v = body[f]
          data[f] = v == null || v.trim() === '' ? null : v
        }
      }
      if (expiryDate) data.expiryDate = expiryDate
      if ('discountType' in body) {
        data.discountType = body.discountType === 'rate' || body.discountType === 'amount' ? body.discountType : null
      }
      if ('discountValue' in body) {
        data.discountValue = quoteInteger(body.discountValue, 0, 0)!
      }

      // --- ステータス遷移 ---
      // ⚠️ AIが出した金額をそのまま客先に出させないため、確定は人の明示操作にする。
      //    確定は manager 以上（金額の責任を負う立場）に限る。
      if ('status' in body) {
        const next = String(body.status)
        if (!['draft', 'confirmed', 'sent'].includes(next)) {
          return NextResponse.json({ error: 'ステータスが不正です' }, { status: 400 })
        }
        if (next !== existing.status && !hasMinRole(actor.role, 'manager')) {
          return NextResponse.json({ error: '見積書の承認状態を変更する権限がありません' }, { status: 403 })
        }
        if (next === 'sent' && existing.status !== 'confirmed') {
          return NextResponse.json({ error: '送付済みにする前に見積書を確定してください' }, { status: 409 })
        }
        if (next === 'confirmed' && existing.status !== 'draft') {
          return NextResponse.json({ error: '見積書をいったん下書きに戻してから確定してください' }, { status: 409 })
        }
        if (next !== existing.status) {
          data.status = next
          if (next === 'confirmed') {
            data.confirmedBy = ctx.userId
            data.confirmedAt = new Date()
          } else if (next === 'sent') {
            data.sentAt = new Date()
          } else {
            // 下書きに戻したら以前の承認・送付記録を残さない。
            data.confirmedBy = null
            data.confirmedAt = null
            data.sentAt = null
          }
        }
      }

      // --- 確定後の金額変更を禁じる ---
      // ⚠️ status ガードは status フィールドしか守っていなかったため、
      //    確定済み（confirmedBy/confirmedAt 記録済み・PDFの「社内確認用」透かしも消えた）
      //    見積書の単価を後から書き換えられた。承認の記録が、誰も承認していない金額を
      //    承認済みとして証明する状態になる。
      //    金額に関わる変更は下書きに戻してから行わせる。
      const nextStatus = typeof data.status === 'string' ? (data.status as string) : existing.status
      const touchesAmounts =
        Array.isArray(body?.items) || 'discountType' in body || 'discountValue' in body
      const touchesContent = touchesAmounts || Object.keys(body).some((key) => key !== 'status' && key !== 'expectedRevision')
      if (touchesContent && existing.status !== 'draft' && nextStatus !== 'draft') {
        return NextResponse.json({ error: '確定済みの見積書は変更できません。いったん下書きに戻してから編集してください。' }, { status: 409 })
      }
      // --- 明細の差し替え ---
      if (Array.isArray(body?.items)) {
        const items = body.items.filter((i: any) => i && i.itemName)
        await tx.quoteLineItem.deleteMany({ where: { documentId: existing.id } })
        await tx.quoteLineItem.createMany({
          data: items.map((i: any, idx: number) => ({
            documentId: existing.id,
            ord: idx,
            itemName: i.itemName,
            spec: i.spec || null,
            qty: quoteInteger(i.qty, 1, 1)!,
            unit: i.unit || '式',
            unitPrice: quoteInteger(i.unitPrice, 0, 0)!,
            taxRate: quoteTaxRate(i.taxRate)!,
            priceSource: VALID_SOURCES.includes(i.priceSource) ? i.priceSource : 'manual',
            sourceRef: i.sourceRef || null,
            rangeMin: quoteOptionalRange(i.rangeMin)!,
            rangeMax: quoteOptionalRange(i.rangeMax)!,
          })),
        })
      }

      if (Object.keys(data).length > 0) {
        await tx.quoteDocument.update({ where: { id: existing.id }, data })
      }
      await recalcDocument(existing.id, tx)

      const updated = await tx.quoteDocument.findUnique({
        where: { id: existing.id },
        include: { lineItems: { orderBy: { ord: 'asc' } } },
      })
      if (!updated) throw new Error('Saved document unavailable')
      return NextResponse.json({ document: await advanceQuoteDocumentRevision(tx,updated) })
    }, { isolationLevel: 'Serializable' })
  } catch (error) {
    if (error instanceof QuoteDocumentRevisionError) return NextResponse.json({error:error.message},{status:error.status})
    if (error && typeof error === 'object' && 'code' in error && error.code === 'QUOTE_TOTAL_OUT_OF_RANGE') {
      return NextResponse.json({ error: '見積金額の合計が保存可能な上限を超えています。数量・単価を見直してください。変更は保存されていません。' }, { status: 400 })
    }
    if (isQuoteDocumentWriteConflict(error)) {
      return NextResponse.json({ error: '別の操作と更新が重なりました。再読み込みして内容を確認してから保存してください。' }, { status: 409 })
    }
    return NextResponse.json({ error: '見積書を保存できませんでした。再読み込みして状態をご確認ください。' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, ctxParam: Ctx) {
  const p = await ctxParam.params
  const ctx = await getQuoteContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  if (!hasMinRole(ctx.role, 'manager')) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }
  try {
    const versions = new URL(req.url).searchParams.getAll('expectedRevision')
    if(versions.length > 1) return NextResponse.json({error:'見積書の版の指定が正しくありません。'},{status:400})
    const expectedRevision = quoteExpectedRevision(versions[0])
    return await prisma.$transaction(async tx => {
      const actor = await lockQuoteDocumentActor(tx,ctx,p.id)
      if (!actor || !hasMinRole(actor.role, 'manager')) {
        return NextResponse.json({ error: '見積書を削除する権限がありません。再読み込みしてください' }, { status: 403 })
      }
      const existing = await tx.quoteDocument.findFirst({where:{id:p.id,organizationId:ctx.organizationId},include:{lineItems:{orderBy:{ord:'asc'}}}})
      if(!existing) return NextResponse.json({error:'見積書が見つかりません'},{status:404})
      await assertQuoteDocumentRevision(tx,existing,expectedRevision)
      const deleted = await tx.quoteDocument.deleteMany({
        where: { id: p.id, organizationId: ctx.organizationId },
      })
      if (deleted.count === 0) return NextResponse.json({ error: '見積書が見つかりません' }, { status: 404 })
      return NextResponse.json({ ok: true })
    }, { isolationLevel: 'Serializable' })
  } catch (error) {
    if (error instanceof QuoteDocumentRevisionError) return NextResponse.json({error:error.message},{status:error.status})
    if (isQuoteDocumentWriteConflict(error)) {
      return NextResponse.json({ error: '別の操作と削除が重なりました。再読み込みして状態を確認してください。' }, { status: 409 })
    }
    return NextResponse.json({ error: '見積書を削除できませんでした。再読み込みして状態をご確認ください。' }, { status: 500 })
  }
}
