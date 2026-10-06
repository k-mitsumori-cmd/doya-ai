'use client'

// ============================================
// ドヤ見積もりAI 設定
// ============================================
// 発行者情報（見積書に印字される自社情報）とメンバー招待。

import Link from 'next/link'
import { useQuoteIssuerSettings } from '@/lib/quote/use-issuer-settings'
import MemberPanel from '@/components/org/MemberPanel'
import { DoyaKun } from '@/components/lp'

const FIELDS = [
  { key: 'companyName', label: '会社名', placeholder: '株式会社スリスタ', required: true },
  { key: 'postalCode', label: '郵便番号', placeholder: '150-0001' },
  { key: 'address', label: '住所', placeholder: '東京都渋谷区...' },
  { key: 'tel', label: '電話番号', placeholder: '03-0000-0000' },
  { key: 'personName', label: '担当者名', placeholder: '三森 捷暉' },
  { key: 'invoiceNo', label: '適格請求書発行事業者 登録番号', placeholder: 'T1234567890123' },
] as const

const TEXTAREAS = [
  { key: 'deliveryTerms', label: '既定の納期', placeholder: 'ご発注後、約2週間' },
  { key: 'paymentTerms', label: '既定のお支払い条件', placeholder: '月末締め翌月末払い（銀行振込）' },
  { key: 'notes', label: '既定の備考', placeholder: '本見積書の有効期限は発行日より30日間です。' },
] as const

export default function QuoteSettingsPage() {
  const { form, loading, loaded, saving, error, message, unknown, canEdit, update, load, save } = useQuoteIssuerSettings()


  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <Link href="/quote" className="text-xs text-slate-500 hover:underline font-semibold">← 見積もり一覧</Link>
          <h1 className="text-lg font-bold text-slate-900">設定</h1>
          <p className="text-xs text-slate-500 font-semibold">発行者情報とメンバーを管理します。</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        {loading && <DoyaKun mood="working" size={88} />}
        <h2 className="text-base font-bold text-slate-900">発行者情報</h2>
        <p className="-mt-2 text-xs font-semibold text-slate-500">見積書に印字される自社情報です。</p>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-semibold">{error}</div>}
        {(!loaded || unknown) && (
          <button type="button" onClick={() => void load()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">
            発行者情報を再読み込みする
          </button>
        )}
        {unknown && <p className="text-sm font-semibold text-amber-800">保存結果が未確認のため、再送信を停止しています。再読み込みで保存済みの情報を確認してください。</p>}
        {loaded && !canEdit && <p className="text-sm text-slate-600">発行者情報の変更はオーナーまたは管理者にご依頼ください。</p>}
        {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 font-semibold">{message}</div>}

        <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          {FIELDS.map((f) => (
            <label key={f.key} className="block text-sm font-semibold">
              <span className="mb-1 block text-xs font-bold text-slate-500">
                {f.label}{'required' in f && f.required ? '（必須）' : ''}
              </span>
              <input
                disabled={!canEdit || saving}
                maxLength={f.key === 'companyName' ? 200 : 2000}
                value={form[f.key] ?? ''}
                onChange={(e) => update(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none font-semibold"
              />
            </label>
          ))}
        </section>

        <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs text-slate-500 font-semibold">
            以下は新しく見積書を作るときの初期値として使われます。個別の見積書ごとに上書きできます。
          </p>
          {TEXTAREAS.map((f) => (
            <label key={f.key} className="block text-sm font-semibold">
              <span className="mb-1 block text-xs font-bold text-slate-500">{f.label}</span>
              <textarea
                disabled={!canEdit || saving}
                maxLength={2000}
                value={form[f.key] ?? ''}
                onChange={(e) => update(f.key, e.target.value)}
                placeholder={f.placeholder}
                rows={2}
                className="w-full resize-none rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none font-semibold"
              />
            </label>
          ))}
        </section>

        <button
          onClick={save}
          disabled={!canEdit || saving || unknown || !form.companyName?.trim()}
          className="w-full rounded-lg bg-[#0066ff] px-5 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {saving ? '保存中...' : '保存する'}
        </button>

        {/* メンバー招待。トップ（見積書一覧の上）にあったものをここへ移した。 */}
        <MemberPanel
          basePath="/api/quote"
          service="quote"
          description="招待した方は、この組織の商材と見積書を扱えるようになります。"
        />
      </main>
    </div>
  )
}
