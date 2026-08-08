'use client'

// ============================================
// ドヤ見積もりAI 見積書の詳細・確定・PDF
// ============================================
// 商談の場で開く画面。確定してPDFを出すまでが1画面で終わる。
//
// ⚠️ 「確定」は人の明示操作。下書きのPDFには「社内確認用」の透かしが入る。
//    AIが出した金額を、人が見る前に客先へ渡させないための設計。

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { yen } from '@/lib/quote/money'
import { PRICE_SOURCE_LABEL, QUOTE_STATUS_LABEL, type PriceSource } from '@/lib/quote/types'

interface LineItem {
  id: string
  itemName: string
  spec: string | null
  qty: number
  unit: string
  unitPrice: number
  taxRate: number
  priceSource: string
  sourceRef: string | null
  rangeMin: number | null
  rangeMax: number | null
}
interface Doc {
  id: string
  quoteNo: string
  title: string
  status: string
  clientCompany: string | null
  clientDept: string | null
  clientPerson: string | null
  issueDate: string
  expiryDate: string
  paymentTerms: string | null
  deliveryTerms: string | null
  notes: string | null
  discountType: string | null
  discountValue: number
  totalExclTax: number
  taxAmount: number
  totalInclTax: number
  lineItems: LineItem[]
}

const SOURCE_STYLE: Record<string, string> = {
  own_price: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  market: 'bg-blue-50 text-blue-700 border-blue-200',
  competitor: 'bg-amber-50 text-amber-700 border-amber-200',
  manual: 'bg-slate-100 text-slate-600 border-slate-200',
  unknown: 'bg-rose-50 text-rose-700 border-rose-200',
}

export default function QuoteDocumentPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [doc, setDoc] = useState<Doc | null>(null)
  const [issuer, setIssuer] = useState<{ companyName: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [items, setItems] = useState<LineItem[]>([])
  const [clientCompany, setClientCompany] = useState('')
  const [clientPerson, setClientPerson] = useState('')
  const [discountType, setDiscountType] = useState<string>('')
  const [discountValue, setDiscountValue] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [deliveryTerms, setDeliveryTerms] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const r = await fetch(`/api/quote/documents/${id}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || '読み込みに失敗しました')
      setDoc(d.document)
      setIssuer(d.issuer)
      setItems(d.document.lineItems || [])
      setClientCompany(d.document.clientCompany || '')
      setClientPerson(d.document.clientPerson || '')
      setDiscountType(d.document.discountType || '')
      setDiscountValue(d.document.discountValue ? String(d.document.discountValue) : '')
      setNotes(d.document.notes || '')
      setPaymentTerms(d.document.paymentTerms || '')
      setDeliveryTerms(d.document.deliveryTerms || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  function updateItem(idx: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  async function save(extra: Record<string, unknown> = {}) {
    if (!id) return
    setSaving(true)
    setError('')
    try {
      const r = await fetch(`/api/quote/documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientCompany,
          clientPerson,
          discountType: discountType || null,
          discountValue: discountValue ? Number(discountValue.replace(/[^0-9]/g, '')) : 0,
          notes,
          paymentTerms,
          deliveryTerms,
          items: items.map((i) => ({
            itemName: i.itemName, spec: i.spec, qty: i.qty, unit: i.unit,
            unitPrice: i.unitPrice, taxRate: i.taxRate,
            priceSource: i.priceSource, sourceRef: i.sourceRef,
            rangeMin: i.rangeMin, rangeMax: i.rangeMax,
          })),
          ...extra,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || '保存に失敗しました')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50"><p className="text-slate-500">読み込み中...</p></div>
  }
  if (!doc) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <p className="text-slate-600">{error || '見積書が見つかりません'}</p>
        <Link href="/quote" className="text-sm text-[#0066ff] underline">ダッシュボードに戻る</Link>
      </div>
    )
  }

  const hasUndecided = items.some((i) => i.priceSource === 'unknown' || i.unitPrice <= 0)

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <Link href="/quote" className="text-xs text-slate-500 hover:underline">← 見積もり一覧</Link>
            <h1 className="truncate text-base font-bold text-slate-900">{doc.quoteNo}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
              doc.status === 'draft' ? 'bg-slate-100 text-slate-600'
              : doc.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700'
              : 'bg-blue-50 text-blue-700'
            }`}>
              {QUOTE_STATUS_LABEL[doc.status] || doc.status}
            </span>
            <button
              onClick={() => save()}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <a
              href={`/api/quote/documents/${doc.id}/pdf`}
              target="_blank"
              rel="noopener"
              className="rounded-lg bg-[#0066ff] px-4 py-2 text-sm font-semibold text-white"
            >
              PDF
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

        {doc.status === 'draft' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            この見積書は下書きです。PDFには「社内確認用」の透かしが入ります。内容を確認のうえ確定してください。
          </div>
        )}
        {!issuer && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            発行元情報が未設定のためPDFを出力できません。
            <Link href="/quote/settings" className="ml-1 font-semibold underline">発行元設定</Link>
          </div>
        )}

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-bold text-slate-900">宛先</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} placeholder="会社名"
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none" />
            <input value={clientPerson} onChange={(e) => setClientPerson(e.target.value)} placeholder="ご担当者名"
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none" />
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-bold text-slate-900">明細</h2>
          <div className="mt-3 space-y-3">
            {items.map((it, idx) => (
              <div key={it.id || idx} className="rounded-xl border border-slate-200 p-4">
                <input value={it.itemName} onChange={(e) => updateItem(idx, { itemName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium focus:border-[#0066ff] focus:outline-none" />
                <textarea value={it.spec || ''} onChange={(e) => updateItem(idx, { spec: e.target.value })} rows={2}
                  placeholder="内訳・含まれるもの"
                  className="mt-2 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 focus:border-[#0066ff] focus:outline-none" />
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <label className="text-xs">
                    <span className="mb-1 block text-slate-500">数量</span>
                    <input value={it.qty} inputMode="numeric"
                      onChange={(e) => updateItem(idx, { qty: Math.max(1, Number(e.target.value.replace(/[^0-9]/g, '')) || 1) })}
                      className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-right text-sm focus:border-[#0066ff] focus:outline-none" />
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block text-slate-500">単位</span>
                    <input value={it.unit} onChange={(e) => updateItem(idx, { unit: e.target.value })}
                      className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-[#0066ff] focus:outline-none" />
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block text-slate-500">単価</span>
                    <input value={it.unitPrice || ''} inputMode="numeric" placeholder="要見積"
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9]/g, '')
                        // 人が金額を変えたら出所ラベルも「手入力」に揃える
                        updateItem(idx, { unitPrice: v === '' ? 0 : Number(v), priceSource: 'manual', sourceRef: '手入力' })
                      }}
                      className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-right text-sm focus:border-[#0066ff] focus:outline-none" />
                  </label>
                  <div className="text-xs">
                    <span className="mb-1 block text-slate-500">金額</span>
                    <span className="block py-1.5 text-sm font-semibold text-slate-900">
                      {it.unitPrice > 0 ? yen(it.qty * it.unitPrice) : '要見積'}
                    </span>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${SOURCE_STYLE[it.priceSource] || SOURCE_STYLE.manual}`}>
                    {PRICE_SOURCE_LABEL[it.priceSource as PriceSource] || it.priceSource}
                  </span>
                  {it.rangeMin != null && it.rangeMax != null && (
                    <span className="text-[11px] text-slate-500">相場 {yen(it.rangeMin)}〜{yen(it.rangeMax)}</span>
                  )}
                </div>
                {it.sourceRef && <p className="mt-2 text-[11px] text-slate-500">根拠: {it.sourceRef}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-bold text-slate-900">値引き・条件</h2>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-xs">
              <span className="mb-1 block text-slate-500">値引き</span>
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0066ff] focus:outline-none">
                <option value="">なし</option>
                <option value="rate">率（%）</option>
                <option value="amount">金額（円）</option>
              </select>
            </label>
            {discountType && (
              <label className="text-xs">
                <span className="mb-1 block text-slate-500">{discountType === 'rate' ? '割引率' : '割引額'}</span>
                <input value={discountValue} inputMode="numeric"
                  onChange={(e) => setDiscountValue(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-right text-sm focus:border-[#0066ff] focus:outline-none" />
              </label>
            )}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs">
              <span className="mb-1 block text-slate-500">納期</span>
              <textarea value={deliveryTerms} onChange={(e) => setDeliveryTerms(e.target.value)} rows={2}
                className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0066ff] focus:outline-none" />
            </label>
            <label className="text-xs">
              <span className="mb-1 block text-slate-500">お支払い条件</span>
              <textarea value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} rows={2}
                className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0066ff] focus:outline-none" />
            </label>
          </div>
          <label className="mt-3 block text-xs">
            <span className="mb-1 block text-slate-500">備考</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0066ff] focus:outline-none" />
          </label>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>税抜合計</span><span className="font-medium text-slate-900">{yen(doc.totalExclTax)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>消費税</span><span className="font-medium text-slate-900">{yen(doc.taxAmount)}</span>
            </div>
            <div className="flex items-baseline justify-between border-t border-slate-200 pt-2">
              <span className="font-semibold text-slate-900">合計（税込）</span>
              <span className="text-2xl font-bold text-[#0066ff]">{yen(doc.totalInclTax)}</span>
            </div>
          </div>
          {hasUndecided && (
            <p className="mt-2 text-[11px] text-rose-600">「要見積」の品目は合計に含まれていません。</p>
          )}
          <p className="mt-2 text-[11px] text-slate-500">保存すると合計が再計算されます。</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {doc.status === 'draft' ? (
              <button onClick={() => save({ status: 'confirmed' })} disabled={saving}
                className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">
                内容を確認して確定する
              </button>
            ) : (
              <button onClick={() => save({ status: 'draft' })} disabled={saving}
                className="rounded-lg border border-slate-300 px-5 py-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                下書きに戻す
              </button>
            )}
            {doc.status === 'confirmed' && (
              <button onClick={() => save({ status: 'sent' })} disabled={saving}
                className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">
                送付済みにする
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
