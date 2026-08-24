'use client'

// ============================================
// ドヤ見積もりAI 発行者情報
// ============================================
// 見積書に印字される自社情報。ここが空だとPDFを出せない。

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { withOrg } from '@/components/org/OrgSwitcher'
import { notifyError } from '@/lib/ui/notify'
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

type Form = Record<string, string>

export default function QuoteSettingsPage() {
  const [form, setForm] = useState<Form>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(withOrg('quote', '/api/quote/issuer'))
      const d = await r.json()
      if (d.issuer) {
        const f: Form = {}
        for (const k of [...FIELDS.map((x) => x.key), ...TEXTAREAS.map((x) => x.key)]) {
          f[k] = d.issuer[k] ?? ''
        }
        setForm(f)
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

  async function save() {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const r = await fetch(withOrg('quote', '/api/quote/issuer'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || '保存に失敗しました')
      setMessage('保存しました')
    } catch (e) {
      notifyError(setError, e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-slate-50">
        {/* ⚠️ 規約(§4.3)ではローディングはドヤくん working */}
        <DoyaKun mood="working" size={88} />
        <p className="text-sm font-bold text-slate-400">読み込んでいます…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <Link href="/quote" className="text-xs text-slate-500 hover:underline font-semibold">← 見積もり一覧</Link>
          <h1 className="text-lg font-bold text-slate-900">発行者情報</h1>
          <p className="text-xs text-slate-500 font-semibold">見積書に印字される自社情報です。</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-semibold">{error}</div>}
        {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 font-semibold">{message}</div>}

        <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          {FIELDS.map((f) => (
            <label key={f.key} className="block text-sm font-semibold">
              <span className="mb-1 block text-xs font-bold text-slate-500">
                {f.label}{'required' in f && f.required ? '（必須）' : ''}
              </span>
              <input
                value={form[f.key] ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
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
                value={form[f.key] ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                rows={2}
                className="w-full resize-none rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none font-semibold"
              />
            </label>
          ))}
        </section>

        <button
          onClick={save}
          disabled={saving || !form.companyName?.trim()}
          className="w-full rounded-lg bg-[#0066ff] px-5 py-3.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {saving ? '保存中...' : '保存する'}
        </button>
      </main>
    </div>
  )
}
