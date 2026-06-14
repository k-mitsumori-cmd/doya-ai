'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { DoyaKun, sym } from '@/components/shodan/ui'
import type { BannerFeedback } from '@/lib/adbanner/types'
import toast from 'react-hot-toast'

type Banner = { id: string; size: string; variantLabel: string | null; model: string | null; feedback: BannerFeedback | null; generation: number; imageUrl: string | null }
type Detail = { id: string; name: string; serviceName: string | null; media: string | null; brandColors: string[] | null; banners: Banner[] }

export default function AdBannerCampaignPage() {
  const params = useParams<{ campaignId: string }>()
  const id = String(params.campaignId)
  const [data, setData] = useState<Detail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState<Record<string, 'fb' | 'refine'>>({})
  const [more, setMore] = useState(false)

  const load = () => fetch(`/api/adbanner/campaigns/${id}`, { cache: 'no-store' }).then((r) => r.json())
    .then((d) => { if (d.success) setData(d.data); else setNotFound(true) }).catch(() => setNotFound(true))
  useEffect(() => { load() }, [id])

  const runFeedback = async (bid: string) => {
    setBusy((b) => ({ ...b, [bid]: 'fb' }))
    try {
      const r = await fetch('/api/adbanner/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creativeId: bid }) })
      const d = await r.json()
      if (!d.success) throw new Error(d.error)
      setData((prev) => prev ? { ...prev, banners: prev.banners.map((b) => b.id === bid ? { ...b, feedback: d.data } : b) } : prev)
    } catch (e: any) { toast.error(e.message || 'フィードバックに失敗') } finally { setBusy((b) => { const n = { ...b }; delete n[bid]; return n }) }
  }
  const runRefine = async (bid: string) => {
    setBusy((b) => ({ ...b, [bid]: 'refine' }))
    try {
      const r = await fetch('/api/adbanner/refine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creativeId: bid }) })
      const d = await r.json()
      if (!d.success) throw new Error(d.error)
      setData((prev) => prev ? { ...prev, banners: [d.data, ...prev.banners] } : prev)
      toast.success('改善版を生成しました')
    } catch (e: any) { toast.error(e.message || '再生成に失敗') } finally { setBusy((b) => { const n = { ...b }; delete n[bid]; return n }) }
  }
  const genMore = async () => {
    setMore(true)
    try {
      const r = await fetch('/api/adbanner/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaignId: id, variants: 4 }) })
      const d = await r.json()
      if (!d.success) throw new Error(d.error)
      setData((prev) => prev ? { ...prev, banners: [...d.data, ...prev.banners] } : prev)
      toast.success(`${d.data.length}枚 追加しました`)
    } catch (e: any) { toast.error(e.message || '量産に失敗') } finally { setMore(false) }
  }

  if (notFound) return <div className="p-10 text-center"><DoyaKun mood="error" size={96} /><p className="text-slate-500 font-bold mt-3">キャンペーンが見つかりません。<Link href="/adbanner/dashboard" className="text-purple-600 underline ml-1">一覧へ</Link></p></div>
  if (!data) return <div className="p-10 text-center"><DoyaKun mood="thinking" size={88} /><p className="mt-2 text-slate-400 font-bold">読み込み中…</p></div>

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-400 mb-3">
        <Link href="/adbanner/dashboard" className="hover:text-purple-600 flex items-center gap-1">{sym('arrow_back', 16)}一覧</Link>
      </div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{data.name}</h1>
          <p className="text-sm font-bold text-slate-400 mt-0.5">{data.serviceName || ''}・バナー{data.banners.length}枚</p>
        </div>
        <button onClick={genMore} disabled={more} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-orange-500 text-white font-black text-sm shadow hover:-translate-y-0.5 transition-all disabled:opacity-50">
          {sym(more ? 'progress_activity' : 'add')}{more ? '量産中…' : 'さらに量産'}
        </button>
      </div>

      {data.banners.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-purple-200 bg-white py-14 text-center">
          <DoyaKun mood="surprise" size={96} />
          <p className="font-black text-slate-700 mt-2">まだバナーがありません</p>
          <p className="text-sm font-bold text-slate-400 mt-1 mb-4">「さらに量産」で広告バナーを生成しましょう。</p>
          <button onClick={genMore} disabled={more} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-orange-500 text-white font-black text-sm shadow-lg disabled:opacity-50">{sym('bolt')}{more ? '量産中…' : 'バナーを量産'}</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {data.banners.map((b) => (
            <div key={b.id} className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
              <div className="bg-slate-100 grid place-items-center">
                {b.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.imageUrl} alt={b.variantLabel || ''} className="w-full h-auto" loading="lazy" />
                ) : <div className="aspect-square grid place-items-center text-slate-300">{sym('image', 32)}</div>}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">{b.size}</span>
                  {b.variantLabel && <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-orange-50 text-orange-700">{b.variantLabel}</span>}
                  {b.generation > 1 && <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">改善v{b.generation}</span>}
                </div>

                {b.feedback ? (
                  <div className="rounded-xl bg-slate-50 p-3 mb-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-lg font-black text-purple-700">{b.feedback.total}</span><span className="text-[11px] font-bold text-slate-400">/100 総合スコア</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1 text-center mb-2">
                      {([['視認', b.feedback.visibility], ['訴求', b.feedback.appeal], ['CTA', b.feedback.cta], ['媒体', b.feedback.fit], ['ブランド', b.feedback.brand]] as [string, number][]).map(([k, v]) => (
                        <div key={k}><div className="text-sm font-black text-slate-700">{v}</div><div className="text-[9px] font-bold text-slate-400">{k}</div></div>
                      ))}
                    </div>
                    {b.feedback.advice && <p className="text-[11px] font-bold text-slate-500 leading-relaxed">💡 {b.feedback.advice}</p>}
                  </div>
                ) : null}

                <div className="flex items-center gap-2 flex-wrap">
                  {!b.feedback && (
                    <button onClick={() => runFeedback(b.id)} disabled={!!busy[b.id]} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 text-white font-black text-xs hover:bg-purple-700 disabled:opacity-50">{sym(busy[b.id] === 'fb' ? 'progress_activity' : 'rate_review', 15)}{busy[b.id] === 'fb' ? '採点中…' : 'AI採点'}</button>
                  )}
                  <button onClick={() => runRefine(b.id)} disabled={!!busy[b.id]} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-black text-xs hover:bg-slate-50 disabled:opacity-50">{sym(busy[b.id] === 'refine' ? 'progress_activity' : 'autorenew', 15)}{busy[b.id] === 'refine' ? '再生成中…' : '改善再生成'}</button>
                  {b.imageUrl && <a href={b.imageUrl} target="_blank" rel="noreferrer" download className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-black text-xs hover:bg-slate-50">{sym('download', 15)}保存</a>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
