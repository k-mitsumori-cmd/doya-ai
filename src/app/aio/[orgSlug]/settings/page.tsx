'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { aioGet, aioSend } from '@/lib/aio/client'
import { PageHeader, sym } from '@/components/aio/ui'
import toast from 'react-hot-toast'

export default function AioSettingsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ brandName: '', brandUrl: '', aliases: '', competitors: '', category: '', market: '日本' })

  useEffect(() => {
    aioGet<{ profile: any }>('/api/aio/brand-profile', orgSlug)
      .then((d) => {
        const p = d.profile
        if (p) {
          setForm({
            brandName: p.brandName || '',
            brandUrl: p.brandUrl || '',
            aliases: Array.isArray(p.aliases) ? p.aliases.join(', ') : '',
            competitors: Array.isArray(p.competitors) ? p.competitors.join(', ') : '',
            category: p.category || '',
            market: p.market || '日本',
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orgSlug])

  const save = async () => {
    if (!form.brandName.trim()) { setError('ブランド名は必須です'); toast.error('ブランド名は必須です'); return }
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const split = (s: string) => s.split(/[,、\n]/).map((x) => x.trim()).filter(Boolean)
      await aioSend('/api/aio/brand-profile', orgSlug, 'PUT', {
        brandName: form.brandName,
        brandUrl: form.brandUrl,
        aliases: split(form.aliases),
        competitors: split(form.competitors),
        category: form.category,
        market: form.market,
      })
      toast.success('保存しました')
      setSaved(true)
    } catch (e: any) {
      const msg = e?.message || '保存に失敗しました'
      toast.error(msg)
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-slate-400 font-bold">読み込み中…</div>

  const field = (label: string, key: keyof typeof form, placeholder: string, hint?: string) => (
    <div>
      <label className="block text-sm font-black text-slate-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-slate-400 font-bold mb-1">{hint}</p>}
      <input value={form[key]} onChange={(e) => { setForm({ ...form, [key]: e.target.value }); if (saved) setSaved(false); if (error) setError(null) }} placeholder={placeholder}
        className="w-full rounded-xl border-2 border-slate-200 focus:border-purple-400 outline-none px-4 py-2.5 font-bold transition-colors" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto p-6">
      <PageHeader icon="manage_search" title="ブランド設定" subtitle="追跡する自社ブランドと競合を登録します" />
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        {field('追跡ブランド名 *', 'brandName', '例: CARRY ME')}
        {field('自社サイトURL', 'brandUrl', '例: https://carryme.jp', '自社ドメイン引用率の判定に使います')}
        {field('別名・表記ゆれ', 'aliases', '例: キャリーミー, キャリーミー', 'カンマ区切り')}
        {field('競合ブランド', 'competitors', '例: HiPro, lotsful, みらいワークス, Workship', 'カンマ区切り。Share of Voiceの比較対象')}
        {field('カテゴリ', 'category', '例: プロ人材 業務委託マッチング')}
        {field('市場・地域', 'market', '例: 日本')}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
            <span className="text-rose-500">{sym('error', 18)}</span>
            <p className="text-sm font-bold text-rose-700 break-words">{error}</p>
          </div>
        )}
        {saved && !error && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <span className="text-emerald-500">{sym('check_circle', 18)}</span>
            <p className="text-sm font-bold text-emerald-700">保存しました。スキャンに反映されます。</p>
          </div>
        )}

        <button onClick={save} disabled={saving}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black shadow-lg shadow-purple-500/25 hover:-translate-y-0.5 transition-all disabled:opacity-50">
          {saving ? '保存中…' : '保存する'}
        </button>
      </div>
    </div>
  )
}
