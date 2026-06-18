'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DoyaKun, sym } from '@/components/aio/ui'
import toast from 'react-hot-toast'

const EXAMPLES = ['https://doya-ai.surisuta.jp', 'https://example.co.jp']

export default function AioScanPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)

  const start = async () => {
    if (!url.trim()) { toast.error('URLを入力してください'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/aio/quick-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '調査の開始に失敗しました')
      // 返ったワークスペース（同一URLは継続／別URLは新規）へ。?scan=1 で自動スキャン＋派手な進捗表示
      router.push(`/aio/${encodeURIComponent(d.slug)}?scan=1`)
    } catch (e: any) {
      toast.error(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-center mt-4 mb-6">
        <div className="flex justify-center"><DoyaKun mood="point" size={104} /></div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 mt-3">URL AI調査</h1>
        <p className="text-slate-500 font-bold mt-2">調べたいサービスのURLを入れるだけ。AIがサービス名も監視する質問も自動で判定して、AIでの現状を診断します。</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-purple-500/10 border border-purple-100 p-5">
        <label className="block text-sm font-black text-slate-700 mb-2">サービスのURL <span className="text-purple-600">*</span></label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="例: https://doya-ai.surisuta.jp"
            inputMode="url" autoFocus
            onKeyDown={(e) => e.key === 'Enter' && start()}
            className="flex-1 rounded-xl border-2 border-slate-200 focus:border-purple-600 outline-none px-4 py-3 font-bold transition-colors" />
          <button onClick={start} disabled={busy}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black shadow-lg shadow-purple-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 active:scale-[0.97]">
            {sym(busy ? 'hourglass_top' : 'rocket_launch')}{busy ? '準備中…' : '調査を開始'}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-xs font-bold text-slate-400">例:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => setUrl(ex)} className="text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-full px-3 py-1.5 transition-colors">{ex}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
        {[['visibility', '言及率'], ['leaderboard', 'SoV'], ['link', '引用元'], ['tips_and_updates', '改善案']].map(([icon, label]) => (
          <div key={label} className="bg-white rounded-xl border border-purple-100 p-3 text-center">
            <span className="material-symbols-outlined text-purple-600 text-2xl">{icon}</span>
            <p className="text-xs font-black text-slate-600 mt-1">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
