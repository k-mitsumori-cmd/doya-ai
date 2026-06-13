'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { shodanGet, shodanSend } from '@/lib/shodan/client'
import { DoyaKun, PageHeader, sym, type Mood } from '@/components/shodan/ui'
import toast from 'react-hot-toast'

type Profile = {
  companyName: string; url: string; description: string; valueProp: string
  products: string; targetCustomer: string; pricingNote: string; caseStudies: string
}
const EMPTY: Profile = { companyName: '', url: '', description: '', valueProp: '', products: '', targetCustomer: '', pricingNote: '', caseStudies: '' }

// 充足度・提案精度に効く必須級フィールド（スコア計算対象）
const CORE_FIELDS: (keyof Profile)[] = ['companyName', 'description', 'valueProp', 'products', 'targetCustomer']

const FIELDS: { key: keyof Profile; label: string; placeholder: string; textarea?: boolean; hint?: string }[] = [
  { key: 'companyName', label: '自社名', placeholder: '例: 株式会社スリスタ' },
  { key: 'url', label: '自社URL', placeholder: '例: https://surisuta.jp' },
  { key: 'description', label: '事業内容', placeholder: '何をしている会社か', textarea: true },
  { key: 'valueProp', label: '提供価値・強み（USP）', placeholder: '競合と比べた強み・独自性', textarea: true, hint: '提案の説得力に直結。具体的に。' },
  { key: 'products', label: '主な商材・サービス', placeholder: '提供しているプロダクト/サービス', textarea: true },
  { key: 'targetCustomer', label: 'ターゲット顧客', placeholder: 'どんな企業・部門・役職が顧客か', textarea: true },
  { key: 'pricingNote', label: '価格帯・導入条件', placeholder: '料金イメージや導入の前提（任意）', textarea: true },
  { key: 'caseStudies', label: '導入事例・実績', placeholder: '代表的な事例・実績（任意）', textarea: true },
]

type Status = 'empty' | 'weak' | 'ok'
function fieldStatus(value: string, key: string, gaps: Set<string>): Status {
  const v = (value || '').trim()
  if (!v) return 'empty'
  if (gaps.has(key) || v.length < 8) return 'weak'
  return 'ok'
}
const STATUS_BADGE: Record<Status, { label: string; cls: string }> = {
  empty: { label: '未入力', cls: 'bg-rose-100 text-rose-600' },
  weak: { label: '加筆推奨', cls: 'bg-amber-100 text-amber-700' },
  ok: { label: 'OK', cls: 'bg-emerald-100 text-emerald-700' },
}

export default function ShodanSettingsPage() {
  const params = useParams<{ orgSlug: string }>()
  const orgSlug = decodeURIComponent(String(params.orgSlug))
  const [profile, setProfile] = useState<Profile>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [extractUrl, setExtractUrl] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [gaps, setGaps] = useState<Set<string>>(new Set())

  useEffect(() => {
    shodanGet<{ profile: Partial<Profile> | null }>('/api/shodan/company-profile', orgSlug)
      .then((d) => {
        if (d.profile) {
          const p = { ...EMPTY, ...Object.fromEntries(Object.entries(d.profile).map(([k, v]) => [k, v ?? ''])) } as Profile
          setProfile(p)
          if (p.url) setExtractUrl(p.url)
        }
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [orgSlug])

  const set = (k: keyof Profile, v: string) => setProfile((p) => ({ ...p, [k]: v }))

  const extract = async () => {
    if (!extractUrl.trim()) { toast.error('自社URLを入力してください'); return }
    setExtracting(true)
    try {
      const d = await shodanSend<{ suggested: Partial<Profile>; gaps: string[] }>(
        '/api/shodan/company-profile/extract', orgSlug, 'POST', { url: extractUrl }
      )
      setProfile((p) => {
        const next = { ...p }
        for (const [k, v] of Object.entries(d.suggested)) {
          if (typeof v === 'string' && v.trim()) (next as any)[k] = v
        }
        if (!next.url) next.url = extractUrl
        return next
      })
      setGaps(new Set(d.gaps || []))
      const gapCount = (d.gaps || []).length
      toast.success(gapCount ? `自動入力しました。加筆推奨が${gapCount}項目あります` : '自動入力しました！')
    } catch (e: any) { toast.error(e.message) } finally { setExtracting(false) }
  }

  const save = async () => {
    setSaving(true)
    try {
      await shodanSend('/api/shodan/company-profile', orgSlug, 'PUT', profile)
      toast.success('自社情報を保存しました')
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }

  // 充足度スコア（CORE基準）
  const { score, doneCount, mood, advice } = useMemo(() => {
    const statuses = CORE_FIELDS.map((k) => fieldStatus(profile[k], k, gaps))
    const done = statuses.filter((s) => s === 'ok').length
    const sc = Math.round((done / CORE_FIELDS.length) * 100)
    let m: Mood = 'thinking'; let a = 'まずは自社URLから自動入力してみましょう。'
    if (sc >= 100) { m = 'love'; a = 'バッチリです！この内容で提案が最適化されます。' }
    else if (sc >= 60) { m = 'thumbsup'; a = 'いい感じ！加筆推奨の項目を埋めると更に精度が上がります。' }
    else if (sc > 0) { m = 'point'; a = '加筆推奨（黄色）の項目を埋めていきましょう。' }
    return { score: sc, doneCount: done, mood: m, advice: a }
  }, [profile, gaps])

  if (loading) return <div className="p-10 text-center"><DoyaKun mood="thinking" size={72} /><p className="mt-2 text-slate-400 font-bold">読み込み中…</p></div>

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <PageHeader icon="business_center" title="自社情報" subtitle="ここに登録した情報をもとに、提案資料が「自社の商材・強み」に最適化されます。" />

      {/* 自動入力カード */}
      <div className="relative rounded-3xl bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white p-6 pr-28 shadow-lg shadow-purple-500/20 mb-5 overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-1.5 font-black"><span className="material-symbols-outlined">auto_awesome</span>自社URLから自動入力</div>
          <p className="text-xs font-bold text-white/80 mt-1 mb-3">URLを入れるだけで、AIが自社情報を抽出して下書きします。</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={extractUrl} onChange={(e) => setExtractUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !extracting && extract()}
              placeholder="https://自社サイト.co.jp" disabled={extracting}
              className="flex-1 rounded-xl px-4 py-2.5 font-bold text-slate-800 outline-none disabled:opacity-60" />
            <button onClick={extract} disabled={extracting}
              className="px-5 py-2.5 rounded-xl bg-white text-purple-700 font-black text-sm shadow hover:-translate-y-0.5 transition-all disabled:opacity-60 whitespace-nowrap">
              {extracting ? '抽出中…' : 'AIで自動入力'}
            </button>
          </div>
        </div>
        <DoyaKun mood={extracting ? 'focus' : 'present'} size={110} className="!absolute -bottom-2 right-2" />
      </div>

      {/* 充足度メーター */}
      <div className="flex items-center gap-4 rounded-2xl bg-white border border-slate-200 p-4 mb-5">
        <DoyaKun mood={mood} size={64} float={false} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-black text-slate-700">情報の充実度</span>
            <span className="text-sm font-black text-purple-700">{score}%（{doneCount}/{CORE_FIELDS.length}）</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-all" style={{ width: `${score}%` }} />
          </div>
          <p className="text-xs font-bold text-slate-500 mt-1.5">{advice}</p>
        </div>
      </div>

      {/* フォーム */}
      <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-sm space-y-4">
        {FIELDS.map((f) => {
          const showStatus = f.key !== 'url'
          const st = fieldStatus(profile[f.key], f.key, gaps)
          const badge = STATUS_BADGE[st]
          return (
            <div key={f.key}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-black text-slate-700">{f.label}</label>
                {showStatus && <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>}
              </div>
              {f.textarea ? (
                <textarea value={profile[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} rows={3}
                  className={`w-full rounded-xl border-2 px-4 py-2.5 font-bold text-sm resize-y outline-none transition-colors ${st === 'weak' ? 'border-amber-300 focus:border-amber-400 bg-amber-50/30' : 'border-slate-200 focus:border-purple-400'}`} />
              ) : (
                <input value={profile[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder}
                  className="w-full rounded-xl border-2 border-slate-200 focus:border-purple-400 outline-none px-4 py-2.5 font-bold text-sm transition-colors" />
              )}
              {f.hint && st !== 'ok' && <p className="text-[11px] font-bold text-amber-600 mt-1 flex items-center gap-1">{sym('tips_and_updates', 14)}{f.hint}</p>}
            </div>
          )
        })}
        <button onClick={save} disabled={saving}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black shadow-lg shadow-purple-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {sym('save', 20)}{saving ? '保存中…' : '保存する'}
        </button>
      </div>
    </div>
  )
}
