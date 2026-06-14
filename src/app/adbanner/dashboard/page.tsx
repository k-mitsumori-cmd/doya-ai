'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DoyaKun, sym } from '@/components/shodan/ui'
import { MEDIA_LABEL, type AdMedia } from '@/lib/adbanner/types'
import toast from 'react-hot-toast'

type Campaign = { id: string; name: string; sourceUrl: string | null; serviceName: string | null; media: string | null; createdAt: string; _count: { banners: number } }

export default function AdBannerDashboard() {
  const [items, setItems] = useState<Campaign[] | null>(null)

  useEffect(() => {
    fetch('/api/adbanner/campaigns', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setItems(d.success ? d.data : []))
      .catch(() => setItems([]))
  }, [])

  const remove = async (id: string) => {
    if (!confirm('このキャンペーンを削除しますか？')) return
    try {
      const r = await fetch(`/api/adbanner/campaigns/${id}`, { method: 'DELETE' })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || '削除に失敗しました')
      setItems((p) => (p || []).filter((x) => x.id !== id))
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-600 to-orange-500 text-white px-6 py-6 mb-6 shadow-lg shadow-purple-500/20">
        <div className="relative z-10 pr-28">
          <h1 className="text-2xl font-black">キャンペーン一覧</h1>
          <p className="text-sm font-bold text-white/85 mt-1">URL・ブランドから広告バナーを量産。</p>
          <Link href="/adbanner/dashboard/new" className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl bg-white text-purple-700 font-black text-sm shadow hover:-translate-y-0.5 transition-all">{sym('add')}新規キャンペーン</Link>
        </div>
        <DoyaKun mood="present" size={120} className="!absolute bottom-0 right-3" />
      </div>

      {items === null ? (
        <div className="py-20 text-center"><DoyaKun mood="thinking" size={72} /><p className="mt-2 text-slate-400 font-bold">読み込み中…</p></div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-purple-200 bg-white py-14 text-center">
          <div className="flex justify-center"><DoyaKun mood="hello" size={110} /></div>
          <p className="font-black text-slate-800 mt-2 text-lg">最初のキャンペーンを作りましょう</p>
          <p className="text-sm font-bold text-slate-400 mt-1 mb-5">URLやサービス名を入れるだけで、広告バナーを一括生成します。</p>
          <Link href="/adbanner/dashboard/new" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-orange-500 text-white font-black text-sm shadow-lg hover:-translate-y-0.5 transition-all">{sym('bolt')}新規キャンペーン</Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((c) => (
            <div key={c.id} className="group flex items-center gap-3 rounded-2xl bg-white border border-slate-200 px-5 py-4 hover:shadow-md hover:border-purple-200 transition-all">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-orange-500 grid place-items-center text-white shrink-0">{sym('campaign')}</div>
              <Link href={`/adbanner/dashboard/${c.id}`} className="flex-1 min-w-0">
                <div className="font-black text-slate-900 truncate">{c.name}</div>
                <div className="text-xs font-bold text-slate-400 truncate mt-0.5">{c.media ? MEDIA_LABEL[c.media as AdMedia] || c.media : ''}・バナー{c._count.banners}枚</div>
              </Link>
              <button onClick={() => remove(c.id)} className="text-slate-300 hover:text-rose-500 transition-colors" title="削除">{sym('delete')}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
