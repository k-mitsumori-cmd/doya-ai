'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { shodanGet, shodanSend } from '@/lib/shodan/client'
import toast from 'react-hot-toast'

const sym = (name: string, size = 18) => <span className="material-symbols-outlined" style={{ fontSize: size }}>{name}</span>

type Profile = {
  companyName: string; url: string; description: string; valueProp: string
  products: string; targetCustomer: string; pricingNote: string; caseStudies: string
}
const EMPTY: Profile = { companyName: '', url: '', description: '', valueProp: '', products: '', targetCustomer: '', pricingNote: '', caseStudies: '' }

const FIELDS: { key: keyof Profile; label: string; placeholder: string; textarea?: boolean }[] = [
  { key: 'companyName', label: '自社名', placeholder: '例: 株式会社スリスタ' },
  { key: 'url', label: '自社URL', placeholder: '例: https://surisuta.jp' },
  { key: 'description', label: '事業内容', placeholder: '何をしている会社か', textarea: true },
  { key: 'valueProp', label: '提供価値・強み（USP）', placeholder: '競合と比べた強み・独自性', textarea: true },
  { key: 'products', label: '主な商材・サービス', placeholder: '提供しているプロダクト/サービス', textarea: true },
  { key: 'targetCustomer', label: 'ターゲット顧客', placeholder: 'どんな企業・部門・役職が顧客か', textarea: true },
  { key: 'pricingNote', label: '価格帯・導入条件', placeholder: '料金イメージや導入の前提（任意）', textarea: true },
  { key: 'caseStudies', label: '導入事例・実績', placeholder: '代表的な事例・実績（任意）', textarea: true },
]

export default function ShodanSettingsPage() {
  const params = useParams<{ orgSlug: string }>()
  const orgSlug = decodeURIComponent(String(params.orgSlug))
  const [profile, setProfile] = useState<Profile>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    shodanGet<{ profile: Partial<Profile> | null }>('/api/shodan/company-profile', orgSlug)
      .then((d) => { if (d.profile) setProfile({ ...EMPTY, ...Object.fromEntries(Object.entries(d.profile).map(([k, v]) => [k, v ?? ''])) as any }) })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [orgSlug])

  const save = async () => {
    setSaving(true)
    try {
      await shodanSend('/api/shodan/company-profile', orgSlug, 'PUT', profile)
      toast.success('自社情報を保存しました')
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }

  if (loading) return <div className="p-8 text-slate-400 font-bold">読み込み中…</div>

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-black text-slate-900">自社情報</h1>
      <p className="text-sm font-bold text-slate-400 mt-1 mb-6">ここに登録した情報をもとに、提案資料が「自社の商材・強み」に最適化されます。</p>

      <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-sm space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="block text-sm font-black text-slate-700 mb-1">{f.label}</label>
            {f.textarea ? (
              <textarea
                value={profile[f.key]}
                onChange={(e) => setProfile((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 font-bold text-sm resize-y focus:border-purple-400 outline-none"
              />
            ) : (
              <input
                value={profile[f.key]}
                onChange={(e) => setProfile((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 font-bold text-sm focus:border-purple-400 outline-none"
              />
            )}
          </div>
        ))}
        <button
          onClick={save}
          disabled={saving}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black shadow-lg shadow-purple-500/25 hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {sym('save', 20)}{saving ? '保存中…' : '保存する'}
        </button>
      </div>
    </div>
  )
}
