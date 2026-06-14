'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { shodanGet, shodanSend } from '@/lib/shodan/client'
import { DoyaKun, sym } from '@/components/shodan/ui'
import type { ProposalSlide } from '@/lib/shodan/types'
import toast from 'react-hot-toast'

type SlideImage = { title: string; imageUrl: string; role?: string }
type Prep = { id: string; targetName: string | null; slidesJson: ProposalSlide[] | null; slideImages: SlideImage[] | null }

export default function ShodanSlidesEditPage() {
  const params = useParams<{ orgSlug: string; id: string }>()
  const orgSlug = decodeURIComponent(String(params.orgSlug))
  const id = String(params.id)
  const [prep, setPrep] = useState<Prep | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [instr, setInstr] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState<Record<number, boolean>>({})
  const [active, setActive] = useState(0)

  useEffect(() => {
    shodanGet<{ item: Prep }>(`/api/shodan/preparations/${id}`, orgSlug)
      .then((d) => setPrep(d.item)).catch(() => setNotFound(true))
  }, [orgSlug, id])

  const regenerate = async (index: number) => {
    setBusy((b) => ({ ...b, [index]: true }))
    try {
      const d = await shodanSend<{ success: boolean; data: { index: number; image: SlideImage } }>(
        `/api/shodan/preparations/${id}/slides/regenerate`, orgSlug, 'POST', { index, instruction: instr[index] }
      )
      setPrep((prev) => {
        if (!prev?.slideImages) return prev
        const imgs = prev.slideImages.slice(); imgs[index] = d.data.image
        return { ...prev, slideImages: imgs }
      })
      toast.success('スライドを再生成しました')
    } catch (e: any) { toast.error(e.message || '再生成に失敗') } finally { setBusy((b) => ({ ...b, [index]: false })) }
  }

  if (notFound) return <div className="p-10 text-center"><DoyaKun mood="error" size={96} /><p className="text-slate-500 font-bold mt-3">見つかりませんでした。<Link href={`/shodan/${encodeURIComponent(orgSlug)}/p/${id}`} className="text-purple-600 underline ml-1">戻る</Link></p></div>
  if (!prep) return <div className="p-10 text-center"><DoyaKun mood="thinking" size={88} /><p className="mt-2 text-slate-400 font-bold">読み込み中…</p></div>

  const slides = prep.slideImages || []

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-400 mb-3">
        <Link href={`/shodan/${encodeURIComponent(orgSlug)}/p/${id}`} className="hover:text-purple-600 flex items-center gap-1">{sym('arrow_back', 16)}商談準備へ戻る</Link>
      </div>
      <div className="flex items-center gap-3 mb-5">
        <DoyaKun mood="present" size={52} float={false} />
        <div>
          <h1 className="text-2xl font-black text-slate-900">提案スライドの編集</h1>
          <p className="text-sm font-bold text-slate-400 mt-0.5">{prep.targetName || ''}・各スライドに指示を入れて再生成できます。</p>
        </div>
      </div>

      {slides.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-purple-200 bg-white py-14 text-center">
          <DoyaKun mood="surprise" size={96} />
          <p className="font-black text-slate-700 mt-2">スライド画像がまだありません</p>
          <Link href={`/shodan/${encodeURIComponent(orgSlug)}/p/${id}`} className="inline-block mt-3 text-purple-600 font-bold underline">商談準備ページで「提案資料を作成する」</Link>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-5">
          {/* メインプレビュー */}
          <div className="flex-1 min-w-0">
            {slides[active]?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={slides[active]!.imageUrl as string} alt={slides[active]?.title} className="w-full rounded-2xl border border-slate-200 shadow-md" />
            ) : (
              <div className="w-full aspect-video rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50 grid place-items-center text-center px-4">
                <div><DoyaKun mood="error" size={56} float={false} /><p className="text-sm font-bold text-rose-600 mt-1">このスライドは生成に失敗しました。<br />下の指示を入れて再生成してください。</p></div>
              </div>
            )}
            <div className="mt-3 rounded-2xl bg-white border border-slate-200 p-4">
              <p className="font-black text-slate-800 text-sm mb-2">スライド{active + 1}：{slides[active]?.title}</p>
              <label className="block text-xs font-black text-slate-500 mb-1">修正の指示（例: もっと数字を大きく／背景を明るく／CTAを強調）</label>
              <textarea value={instr[active] || ''} onChange={(e) => setInstr((s) => ({ ...s, [active]: e.target.value }))} rows={2}
                className="w-full rounded-xl border-2 border-slate-200 focus:border-purple-400 outline-none px-3 py-2 font-bold text-sm resize-y" placeholder="この指示で作り直します" />
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => regenerate(active)} disabled={busy[active]} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-sm disabled:opacity-60">{sym(busy[active] ? 'progress_activity' : 'autorenew', 16)}{busy[active] ? '再生成中…' : 'この指示で再生成'}</button>
                {slides[active]?.imageUrl && <a href={slides[active]!.imageUrl as string} target="_blank" rel="noreferrer" download className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50">{sym('download', 16)}保存</a>}
              </div>
            </div>
          </div>
          {/* サムネイル一覧 */}
          <div className="lg:w-56 shrink-0">
            <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
              {slides.map((s, i) => (
                <button key={i} onClick={() => setActive(i)} className={`relative rounded-lg overflow-hidden border-2 transition-all ${i === active ? 'border-purple-500 ring-2 ring-purple-200' : 'border-slate-200 hover:border-purple-300'}`}>
                  {s.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.imageUrl} alt={s.title} className="w-full aspect-video object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full aspect-video bg-rose-50 grid place-items-center text-rose-400"><span className="material-symbols-outlined" style={{ fontSize: 18 }}>image_not_supported</span></div>
                  )}
                  <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-black px-1.5 rounded">{i + 1}</span>
                  {busy[i] && <span className="absolute inset-0 grid place-items-center bg-white/70"><span className="material-symbols-outlined animate-spin text-purple-600">progress_activity</span></span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
