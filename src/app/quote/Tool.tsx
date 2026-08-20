'use client'

// ============================================
// ドヤ見積もりAI ダッシュボード
// ============================================
// 商談中に開いて使う画面。
// 「URL入力 → 品目候補 → 編集 → 見積書作成」までを1画面で完結させる。
// 迷わせないため、未完了のステップだけを開いた状態にする。

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import OrgSwitcher, { withOrg, type Membership } from '@/components/org/OrgSwitcher'
import MemberPanel from '@/components/org/MemberPanel'
import { billableLines, calcTotals, yen } from '@/lib/quote/money'
import { PRICE_SOURCE_LABEL, QUOTE_STATUS_LABEL, type PriceSource, type ProductProfile, type SuggestedItem } from '@/lib/quote/types'
import QuoteLp from './Lp'
import { notifyError } from '@/lib/ui/notify'
import { DoyaKun } from '@/components/lp'
import LoadingProgress from '@/components/LoadingProgress'
import { EmptyState } from '@/components/EmptyState'

interface Product {
  id: string
  name: string
  sourceUrl: string | null
  profile: ProductProfile | null
}
interface DocRow {
  id: string
  quoteNo: string
  title: string
  clientCompany: string | null
  status: string
  expiryDate: string
  totalInclTax: number
}

const SOURCE_STYLE: Record<PriceSource, string> = {
  own_price: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  market: 'bg-blue-50 text-blue-700 border-blue-200',
  competitor: 'bg-amber-50 text-amber-700 border-amber-200',
  manual: 'bg-slate-100 text-slate-600 border-slate-200',
  ai_estimate: 'bg-violet-50 text-violet-700 border-violet-200',
  unknown: 'bg-rose-50 text-rose-700 border-rose-200',
}

export default function QuoteTool() {
  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState<{ slug: string; name: string; role: string } | null>(null)
  const [orgName, setOrgName] = useState('')
  const [memberships, setMemberships] = useState<Membership[]>([])
  /** 未ログイン。⚠️ 組織が無いのか、そもそもログインしていないのかを区別する。
   *  区別しないと、未ログインの人に「組織を作成」フォームを見せてしまい、
   *  押しても401で何も起きない（何が悪いのか分からない画面になる）。 */
  const [needsLogin, setNeedsLogin] = useState(false)
  const [hasIssuer, setHasIssuer] = useState(false)

  const [products, setProducts] = useState<Product[]>([])
  const [docs, setDocs] = useState<DocRow[]>([])

  // 商材の取り込み
  const [url, setUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [draftProfile, setDraftProfile] = useState<ProductProfile | null>(null)
  const [draftUrl, setDraftUrl] = useState('')
  const [productName, setProductName] = useState('')

  // 品目生成
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [situation, setSituation] = useState('')
  const [budget, setBudget] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [items, setItems] = useState<SuggestedItem[]>([])

  // 見積書作成
  const [clientCompany, setClientCompany] = useState('')
  const [clientPerson, setClientPerson] = useState('')
  const [creating, setCreating] = useState(false)

  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(withOrg('quote', '/api/quote/organizations'))
      if (r.status === 401) {
        setNeedsLogin(true)
        return
      }
      const d = await r.json()
      setOrg(d.current)
      setMemberships(d.memberships || [])
      if (d.current) {
        const [pr, dr, ir] = await Promise.all([
          fetch(withOrg('quote', '/api/quote/products')).then((x) => x.json()),
          fetch(withOrg('quote', '/api/quote/documents')).then((x) => x.json()),
          fetch(withOrg('quote', '/api/quote/issuer')).then((x) => x.json()),
        ])
        setProducts(pr.products || [])
        setDocs(dr.documents || [])
        setHasIssuer(Boolean(ir.issuer))
        if ((pr.products || []).length > 0) setSelectedProduct(pr.products[0].id)
      }
    } catch {
      notifyError(setError, '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function createOrg() {
    if (!orgName.trim()) return
    setError('')
    const r = await fetch(withOrg('quote', '/api/quote/organizations'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: orgName.trim() }),
    })
    if (!r.ok) {
      setError((await r.json().catch(() => ({})))?.error || '作成に失敗しました')
      return
    }
    await load()
  }

  async function analyze() {
    if (!url.trim()) return
    setAnalyzing(true)
    setError('')
    setDraftProfile(null)
    try {
      const r = await fetch(withOrg('quote', '/api/quote/products/analyze'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || '解析に失敗しました')
      setDraftProfile(d.profile)
      setDraftUrl(d.sourceUrl)
      setProductName(d.profile?.companyName || '')
    } catch (e) {
      notifyError(setError, e instanceof Error ? e.message : '解析に失敗しました')
    } finally {
      setAnalyzing(false)
    }
  }

  async function saveProduct() {
    if (!draftProfile || !productName.trim()) return
    setError('')
    const r = await fetch(withOrg('quote', '/api/quote/products'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: productName.trim(), sourceUrl: draftUrl, profile: draftProfile }),
    })
    const d = await r.json()
    if (!r.ok) {
      notifyError(setError, d?.error || '登録に失敗しました')
      return
    }
    setDraftProfile(null)
    setUrl('')
    setProductName('')
    await load()
    setSelectedProduct(d.product.id)
  }

  async function suggest() {
    if (!selectedProduct) return
    setSuggesting(true)
    setError('')
    try {
      const r = await fetch(withOrg('quote', '/api/quote/documents/suggest'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct,
          situation: situation.trim() || undefined,
          budget: budget ? Number(budget.replace(/[^0-9]/g, '')) : undefined,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || '生成に失敗しました')
      setItems(d.items || [])
    } catch (e) {
      notifyError(setError, e instanceof Error ? e.message : '生成に失敗しました')
    } finally {
      setSuggesting(false)
    }
  }

  function updateItem(idx: number, patch: Partial<SuggestedItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }
  function addItem() {
    setItems((prev) => [
      ...prev,
      { itemName: '', spec: '', qty: 1, unit: '式', unitPrice: 0, taxRate: 10, priceSource: 'manual', sourceRef: '', rangeMin: null, rangeMax: null },
    ])
  }

  // 「要見積」の行は合計から除く（0円として足すと総額を誤らせる）
  // ⚠️ 税額は必ず calcTotals に通す。ここで 10% 固定で計算すると、
  //    軽減税率の行が混ざったときに画面の合計とPDFの合計がずれる。
  const billable = billableLines(items.map((i) => ({ ...i, unitPrice: i.unitPrice ?? 0 })))
  const totals = calcTotals(billable.map((i) => ({ qty: i.qty, unitPrice: i.unitPrice ?? 0, taxRate: i.taxRate })))
  const subtotal = totals.totalExclTax
  const tax = totals.taxAmount

  async function createDocument() {
    if (items.length === 0) return
    setCreating(true)
    setError('')
    try {
      const product = products.find((p) => p.id === selectedProduct)
      const r = await fetch(withOrg('quote', '/api/quote/documents'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct || undefined,
          title: product ? `${product.name} お見積り` : 'お見積り',
          clientCompany: clientCompany.trim() || undefined,
          clientPerson: clientPerson.trim() || undefined,
          items: items.map((i) => ({ ...i, unitPrice: i.unitPrice ?? 0 })),
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || '作成に失敗しました')
      window.location.href = `/quote/documents/${d.id}`
    } catch (e) {
      notifyError(setError, e instanceof Error ? e.message : '作成に失敗しました')
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-slate-50">
        {/* ⚠️ 規約(§4.3)ではローディングはドヤくん working。テキストだけにしない */}
        <DoyaKun mood="working" size={88} />
        <p className="text-sm font-bold text-slate-400">読み込んでいます…</p>
      </div>
    )
  }

  // ⚠️ 未ログインの方にはLPを見せる。以前は「ログインが必要です」の小さな箱だけで、
  //    何をするサービスなのか説明する面がどこにも無かった。
  if (needsLogin) {
    return <QuoteLp />
  }

  // --- 初回オンボーディング ---
  if (!org) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-xl font-bold text-slate-900">ドヤ見積もりAI</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 font-semibold">
            はじめに、見積書を発行する組織を作成してください。
          </p>
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="株式会社スリスタ"
            className="mt-5 w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm focus:border-[#0066ff] focus:outline-none font-semibold"
          />
          {error && <p className="mt-3 text-sm text-rose-600 font-semibold">{error}</p>}
          <button
            onClick={createOrg}
            disabled={!orgName.trim()}
            className="mt-4 w-full rounded-lg bg-[#0066ff] px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            組織を作成する
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* ⚠️ AI処理中は全画面で「何をしているか」を出す。無言で待たせない */}
      <LoadingProgress
        isLoading={analyzing}
        operationKey="quote-analyzing"
        title="サービスを解析しています"
        subtitle="ページを読み取って、見積もりの品目候補と相場を組み立てています。"
        tips={['Tip: 品目は後から自由に追加・編集できます', 'Tip: 金額の出所（自社価格 / 相場 / AI推定 / 手入力）が1件ずつ表示されます', 'Tip: 確定するとPDFの「社内確認用」透かしが消えます']}
      />
      <LoadingProgress
        isLoading={creating}
        operationKey="quote-creating"
        title="見積書を作成しています"
        subtitle="品目と税区分を計算して、見積書の形に整えています。"
        tips={['Tip: 発行者情報を設定しておくと、以後の見積書すべてに反映されます', 'Tip: 確定はマネージャー以上が行えます']}
      />
      <LoadingProgress
        isLoading={suggesting}
        operationKey="quote-suggest"
        title="品目の候補を作っています"
        subtitle="商材と相場から、見積書に載せる品目を組み立てています。"
        tips={['Tip: 想定予算を入れると、その範囲に寄せた構成になります', 'Tip: 相手の状況を書くほど、刺さる品目が出ます', 'Tip: 出てきた品目は追加・削除・単価変更が自由にできます']}
      />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">ドヤ見積もりAI</h1>
            <p className="text-xs text-slate-500 font-semibold">{org.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <OrgSwitcher
              service="quote"
              memberships={memberships}
              currentSlug={org.slug}
              onChange={() => void load()}
            />
            <Link href="/quote/settings" className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 font-semibold">
              発行元設定
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {!hasIssuer && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 font-semibold">
            見積書に印字する自社情報が未設定です。PDFを出力する前に
            <Link href="/quote/settings" className="mx-1 font-bold underline">
              発行元設定
            </Link>
            を登録してください。
          </div>
        )}

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-semibold">{error}</div>}

        {/* --- 1. 商材の取り込み --- */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-base font-bold text-slate-900">1. 商材を取り込む</h2>
          <p className="mt-1 text-sm text-slate-600 font-semibold">
            自社のサービスURLを入力すると、提供形態・課金の軸・公開している価格を読み取ります。
          </p>
          <div className="mt-4 flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/service"
              className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-3 text-sm focus:border-[#0066ff] focus:outline-none font-semibold"
            />
            <button
              onClick={analyze}
              disabled={analyzing || !url.trim()}
              className="rounded-lg bg-gradient-to-r from-[#0066ff] via-[#7c3aed] to-[#ec4899] shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              {analyzing ? '解析中...' : '解析する'}
            </button>
          </div>

          {draftProfile && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <dl className="space-y-2 text-sm font-semibold">
                {draftProfile.summary && (
                  <div><dt className="text-xs font-bold text-slate-500">概要</dt><dd className="text-slate-800">{draftProfile.summary}</dd></div>
                )}
                <div className="flex gap-6">
                  {draftProfile.deliveryModel && (
                    <div><dt className="text-xs font-bold text-slate-500">提供形態</dt><dd className="text-slate-800">{draftProfile.deliveryModel}</dd></div>
                  )}
                  {draftProfile.pricingAxis && (
                    <div><dt className="text-xs font-bold text-slate-500">課金の軸</dt><dd className="text-slate-800">{draftProfile.pricingAxis}</dd></div>
                  )}
                </div>
                <div>
                  <dt className="text-xs font-bold text-slate-500">サイトに記載の価格</dt>
                  <dd className="text-slate-800">
                    {draftProfile.publishedPrices?.length ? (
                      <ul className="mt-1 list-disc space-y-0.5 pl-5">
                        {draftProfile.publishedPrices.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    ) : (
                      <span className="text-slate-500">記載なし（相場データから提案します）</span>
                    )}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex gap-2">
                <input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="商材名（例: SEOコンサルティング）"
                  className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none font-semibold"
                />
                <button
                  onClick={saveProduct}
                  disabled={!productName.trim()}
                  className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                >
                  商材として保存
                </button>
              </div>
            </div>
          )}
        </section>

        {/* --- 2. 品目候補の生成 --- */}
        {products.length > 0 && (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-base font-bold text-slate-900">2. 見積もりの品目を出す</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="text-sm font-semibold">
                <span className="mb-1 block text-xs font-bold text-slate-500">商材</span>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none font-semibold"
                >
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold">
                <span className="mb-1 block text-xs font-bold text-slate-500">想定予算（任意）</span>
                <input
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="1000000"
                  inputMode="numeric"
                  className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none font-semibold"
                />
              </label>
              <label className="text-sm font-semibold">
                <span className="mb-1 block text-xs font-bold text-slate-500">相手の状況（任意）</span>
                <input
                  value={situation}
                  onChange={(e) => setSituation(e.target.value)}
                  placeholder="自社サイトの流入が伸び悩んでいる"
                  className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none font-semibold"
                />
              </label>
            </div>
            {/* ⚠️ ここが本サービスの主役の操作。押すと何が起きるかを添えて、
                 主要アクションだと分かる見た目にする（AIが動く＝待ち時間が出るボタン） */}
            <button
              onClick={suggest}
              disabled={suggesting || !selectedProduct}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0066ff] via-[#7c3aed] to-[#ec4899] px-7 py-3.5 text-base font-black text-white shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none"
            >
              <span className="material-symbols-outlined text-[20px]">
                {suggesting ? 'hourglass_top' : 'auto_awesome'}
              </span>
              {suggesting ? '候補を作っています…' : '品目の候補を出す'}
            </button>
            <p className="mt-2 text-xs font-bold text-slate-500">
              相場つきの品目候補をまとめて出します。単価はあとから自由に調整できます。
            </p>
          </section>
        )}

        {/* --- 3. 編集して見積書へ --- */}
        {items.length > 0 && (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-bold text-slate-900">3. 内容を調整する</h2>
              <p className="text-xs text-slate-500 font-semibold">金額の出所は行ごとに表示されます</p>
            </div>

            <div className="mt-4 space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-2">
                      <input
                        value={it.itemName}
                        onChange={(e) => updateItem(idx, { itemName: e.target.value })}
                        placeholder="品目名"
                        className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-semibold focus:border-[#0066ff] focus:outline-none"
                      />
                      <textarea
                        value={it.spec}
                        onChange={(e) => updateItem(idx, { spec: e.target.value })}
                        placeholder="内訳・含まれるもの"
                        rows={2}
                        className="w-full resize-none rounded-xl border-2 border-slate-200 px-3 py-2 text-xs text-slate-600 focus:border-[#0066ff] focus:outline-none font-semibold"
                      />
                    </div>
                    <button
                      onClick={() => removeItem(idx)}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 font-semibold"
                    >
                      削除
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <label className="text-xs font-semibold">
                      <span className="mb-1 block text-slate-500">数量</span>
                      <input
                        value={it.qty}
                        onChange={(e) => updateItem(idx, { qty: Math.max(1, Number(e.target.value.replace(/[^0-9]/g, '')) || 1) })}
                        inputMode="numeric"
                        className="w-16 rounded-xl border-2 border-slate-200 px-2 py-1.5 text-right text-sm focus:border-[#0066ff] focus:outline-none font-semibold"
                      />
                    </label>
                    <label className="text-xs font-semibold">
                      <span className="mb-1 block text-slate-500">単位</span>
                      <input
                        value={it.unit}
                        onChange={(e) => updateItem(idx, { unit: e.target.value })}
                        className="w-16 rounded-xl border-2 border-slate-200 px-2 py-1.5 text-sm focus:border-[#0066ff] focus:outline-none font-semibold"
                      />
                    </label>
                    <label className="text-xs font-semibold">
                      <span className="mb-1 block text-slate-500">単価</span>
                      <input
                        value={it.unitPrice ?? ''}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^0-9]/g, '')
                          // 手で金額を入れたら出所は「手入力」に変える。
                          // AIが出した根拠のラベルを、人が変えた数字に付けたままにしない。
                          updateItem(idx, { unitPrice: v === '' ? null : Number(v), priceSource: 'manual', sourceRef: '手入力' })
                        }}
                        placeholder="要見積"
                        inputMode="numeric"
                        className="w-28 rounded-xl border-2 border-slate-200 px-2 py-1.5 text-right text-sm focus:border-[#0066ff] focus:outline-none font-semibold"
                      />
                    </label>
                    <div className="text-xs font-semibold">
                      <span className="mb-1 block text-slate-500">金額</span>
                      <span className="block py-1.5 text-sm font-bold text-slate-900">
                        {it.unitPrice != null && it.unitPrice > 0 ? yen(it.qty * it.unitPrice) : '要見積'}
                      </span>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${SOURCE_STYLE[it.priceSource]}`}>
                      {PRICE_SOURCE_LABEL[it.priceSource]}
                    </span>
                    {it.rangeMin != null && it.rangeMax != null && (
                      <span className="text-[11px] text-slate-500 font-semibold">
                        相場 {yen(it.rangeMin)}〜{yen(it.rangeMax)}
                      </span>
                    )}
                    {/* ⚠️ 空欄の行に金額を自動で埋めない（根拠のない数字を作らないため）。
                         ただし相場が分かっている行は、押すだけで中央値が入るようにして
                         「そのまま出せる状態」に近づける。押した時点で出所は手入力になる。 */}
                    {it.unitPrice == null && it.rangeMin != null && it.rangeMax != null && (
                      <button
                        onClick={() => {
                          const mid = Math.round((it.rangeMin! + it.rangeMax!) / 2)
                          updateItem(idx, {
                            unitPrice: mid,
                            priceSource: 'manual',
                            sourceRef: `相場の中央値を採用（${yen(it.rangeMin!)}〜${yen(it.rangeMax!)}）`,
                          })
                        }}
                        className="rounded-lg border-2 border-[#0066ff] px-2.5 py-1 text-[11px] font-black text-[#0066ff] transition-colors hover:bg-blue-50"
                      >
                        相場で埋める
                      </button>
                    )}
                  </div>
                  {it.sourceRef && <p className="mt-2 text-[11px] leading-relaxed text-slate-500">根拠: {it.sourceRef}</p>}
                </div>
              ))}
            </div>

            <button onClick={addItem} className="mt-3 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 font-semibold">
              品目を追加
            </button>

            <div className="mt-6 rounded-xl bg-slate-50 p-4">
              <div className="flex items-center justify-between text-sm text-slate-600 font-semibold">
                <span>税抜合計</span><span className="font-semibold text-slate-900">{yen(subtotal)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm text-slate-600 font-semibold">
                <span>消費税</span><span className="font-semibold text-slate-900">{yen(tax)}</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-2">
                <span className="text-sm font-bold text-slate-900">合計（税込）</span>
                <span className="text-2xl font-bold text-[#0066ff]">{yen(subtotal + tax)}</span>
              </div>
              {/* ⚠️ 相場が分かっている空欄をまとめて埋める。1件ずつ押させない。
                   根拠が無い（相場表に無い）行は対象外＝勝手に数字を作らない。 */}
              {items.some((i) => i.unitPrice == null && i.rangeMin != null && i.rangeMax != null) && (
                <button
                  onClick={() => {
                    setItems((prev) =>
                      prev.map((it) =>
                        it.unitPrice == null && it.rangeMin != null && it.rangeMax != null
                          ? {
                              ...it,
                              unitPrice: Math.round((it.rangeMin + it.rangeMax) / 2),
                              priceSource: 'manual' as const,
                              sourceRef: `相場の中央値を採用（${yen(it.rangeMin)}〜${yen(it.rangeMax)}）`,
                            }
                          : it
                      )
                    )
                  }}
                  className="mb-3 inline-flex items-center gap-1.5 rounded-xl border-2 border-[#0066ff] px-4 py-2 text-sm font-black text-[#0066ff] transition-colors hover:bg-blue-50"
                >
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                  相場が分かる品目をまとめて埋める
                </button>
              )}
              {items.some((i) => i.priceSource === 'unknown' || !i.unitPrice) && (
                <p className="mt-2 text-[11px] text-rose-600">
                  「要見積」の品目は合計に含まれていません。
                </p>
              )}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <input
                value={clientCompany}
                onChange={(e) => setClientCompany(e.target.value)}
                placeholder="宛先の会社名"
                className="rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none font-semibold"
              />
              <input
                value={clientPerson}
                onChange={(e) => setClientPerson(e.target.value)}
                placeholder="ご担当者名"
                className="rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none font-semibold"
              />
            </div>
            {/* ⚠️ 作成前に「実際どう見えるか」を出す。作ってから確認では手戻りになる。
                 金額の計算は画面・PDF・保存値で同じ calcTotals を使うので、ここと最終物はずれない。 */}
            <div className="mt-5 rounded-2xl border-2 border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-slate-500">visibility</span>
                <span className="text-sm font-black text-slate-700">見積書プレビュー</span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  作成前
                </span>
              </div>
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-lg font-black text-slate-900">御見積書</p>
                    <p className="mt-1 truncate text-sm font-bold text-slate-700">
                      {clientCompany.trim() || '（宛先の会社名）'} 御中
                    </p>
                    {clientPerson.trim() && (
                      <p className="text-xs font-bold text-slate-500">{clientPerson.trim()} 様</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-[11px] font-bold text-slate-500">
                    {hasIssuer ? '発行者情報あり' : '発行者情報は未設定です'}
                  </div>
                </div>

                <div className="mb-4 rounded-lg bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-bold text-slate-500">御見積金額（税込）</p>
                  <p className="text-2xl font-black tabular-nums text-slate-900">{yen(subtotal + tax)}</p>
                </div>

                <div className="space-y-1.5">
                  {items.map((it, i) => (
                    <div key={i} className="flex items-center gap-2 border-b border-slate-100 pb-1.5 last:border-0">
                      <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700">{it.itemName}</span>
                      <span className="shrink-0 text-[11px] font-bold text-slate-400">
                        {it.qty}
                        {it.unit}
                      </span>
                      <span className={`shrink-0 text-xs font-black tabular-nums ${it.unitPrice ? 'text-slate-900' : 'text-amber-600'}`}>
                        {it.unitPrice ? yen(it.qty * it.unitPrice) : '要見積'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-xs font-bold">
                  <div className="flex justify-between text-slate-500">
                    <span>税抜合計</span>
                    <span className="tabular-nums text-slate-800">{yen(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>消費税</span>
                    <span className="tabular-nums text-slate-800">{yen(tax)}</span>
                  </div>
                </div>
              </div>
              {!hasIssuer && (
                <p className="mt-2 text-[11px] font-bold text-amber-700">
                  発行者情報（社名・住所・担当者）を設定すると、PDFに反映されます。
                </p>
              )}
            </div>

            <button
              onClick={createDocument}
              disabled={creating || items.length === 0}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#0066ff] via-[#7c3aed] to-[#ec4899] px-5 py-4 text-base font-black text-white shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none"
            >
              {creating ? '作成しています…' : '見積書を作成する'}
            </button>
          </section>
        )}

        <MemberPanel
          basePath="/api/quote"
          service="quote"
          description="招待した方は、この組織の商材と見積書を扱えるようになります。"
        />

        {/* --- 見積書一覧 --- */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-base font-bold text-slate-900">見積書</h2>
          {docs.length === 0 ? (
            <EmptyState kind="not-generated" title="まだ見積書はありません" description="商材と商談条件を入力すると、根拠つきの見積書を作成できます。" />
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {docs.map((d) => (
                <Link key={d.id} href={`/quote/documents/${d.id}`} className="flex items-center justify-between py-3 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {d.clientCompany || '宛先未設定'} — {d.title}
                    </p>
                    <p className="text-xs text-slate-500 font-semibold">
                      {d.quoteNo} / 有効期限 {new Date(d.expiryDate).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-bold text-slate-900">{yen(d.totalInclTax)}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      d.status === 'draft' ? 'bg-slate-100 text-slate-600'
                      : d.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-blue-50 text-blue-700'
                    }`}>
                      {QUOTE_STATUS_LABEL[d.status] || d.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
