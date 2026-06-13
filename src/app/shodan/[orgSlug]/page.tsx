'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { shodanGet, shodanSend } from '@/lib/shodan/client'
import { DoyaKun, sym } from '@/components/shodan/ui'
import toast from 'react-hot-toast'

type Item = { id: string; targetUrl: string; targetName: string | null; status: string; createdAt: string; updatedAt: string }

const STATUS: Record<string, { label: string; cls: string }> = {
  processing: { label: '調査中', cls: 'bg-amber-100 text-amber-700' },
  researched: { label: '作成中', cls: 'bg-sky-100 text-sky-700' },
  done: { label: '完了', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { label: '失敗', cls: 'bg-rose-100 text-rose-700' },
}

export default function ShodanListPage() {
  const params = useParams<{ orgSlug: string }>()
  const orgSlug = decodeURIComponent(String(params.orgSlug))
  const [items, setItems] = useState<Item[] | null>(null)
  const [hasProfile, setHasProfile] = useState<boolean | null>(null)

  const load = () => {
    shodanGet<{ items: Item[] }>('/api/shodan/preparations', orgSlug).then((d) => setItems(d.items)).catch((e) => { toast.error(e.message); setItems([]) })
    shodanGet<{ profile: any }>('/api/shodan/company-profile', orgSlug).then((d) => setHasProfile(!!d.profile)).catch(() => setHasProfile(null))
  }
  useEffect(load, [orgSlug])

  // 調査中(processing)の案件がある間だけ自動更新（完了で停止。researchedは操作待ちの安定状態なので除外）
  useEffect(() => {
    if (!items?.some((x) => x.status === 'processing')) return
    const t = setInterval(() => {
      shodanGet<{ items: Item[] }>('/api/shodan/preparations', orgSlug).then((d) => setItems(d.items)).catch(() => {})
    }, 5000)
    return () => clearInterval(t)
  }, [items, orgSlug])

  const remove = async (id: string) => {
    if (!confirm('この商談準備を削除しますか？')) return
    try {
      await shodanSend(`/api/shodan/preparations/${id}`, orgSlug, 'DELETE')
      setItems((prev) => (prev || []).filter((x) => x.id !== id))
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white px-6 py-6 mb-6 shadow-lg shadow-purple-500/20">
        <div className="relative z-10 pr-28">
          <h1 className="text-2xl font-black">商談準備一覧</h1>
          <p className="text-sm font-bold text-white/80 mt-1">今、ドヤれる商談を、URL1本で。</p>
          <Link href={`/shodan/${encodeURIComponent(orgSlug)}/new`}
            className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl bg-white text-purple-700 font-black text-sm shadow hover:-translate-y-0.5 transition-all">
            {sym('add')}新規作成
          </Link>
        </div>
        <DoyaKun mood="present" size={120} className="!absolute bottom-0 right-3" />
      </div>

      {hasProfile === false && (
        <Link href={`/shodan/${encodeURIComponent(orgSlug)}/settings`}
          className="relative flex items-center gap-3 mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 pr-24 hover:bg-amber-100/70 transition-colors overflow-hidden">
          <div>
            <div className="flex items-center gap-1.5 text-amber-800 font-black text-sm">{sym('lightbulb')}まず「自社情報」を登録しましょう</div>
            <p className="text-xs font-bold text-amber-700/80 mt-1">自社URLを入れるだけでAIが自動入力。提案資料の精度が大きく上がります。</p>
          </div>
          <DoyaKun mood="point" size={64} className="!absolute -bottom-1 right-3" float={false} />
        </Link>
      )}

      {items === null ? (
        <div className="py-20 text-center"><DoyaKun mood="thinking" size={72} /><p className="mt-2 text-slate-400 font-bold">読み込み中…</p></div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-purple-200 bg-white py-12 px-6 text-center">
          <div className="flex justify-center"><DoyaKun mood="hello" size={110} /></div>
          <p className="font-black text-slate-800 mt-2 text-lg">ようこそ！3ステップで商談準備が完成します</p>
          <p className="text-sm font-bold text-slate-400 mt-1 mb-6">むずかしい設定は不要。URLを入れるだけ。</p>
          <div className="grid sm:grid-cols-3 gap-3 max-w-2xl mx-auto mb-7 text-left">
            {[
              { n: 1, icon: 'business_center', title: '自社情報を登録', desc: '自社URLからAIが自動入力。提案精度UP', href: `/shodan/${encodeURIComponent(orgSlug)}/settings` },
              { n: 2, icon: 'language', title: '商談先のURLを入力', desc: 'AIが企業を深掘り調査', href: `/shodan/${encodeURIComponent(orgSlug)}/new` },
              { n: 3, icon: 'slideshow', title: '提案資料・スライド完成', desc: 'そのまま商談で使える', href: null },
            ].map((s) => {
              const inner = (
                <>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="grid place-items-center w-6 h-6 rounded-lg bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white text-xs font-black">{s.n}</span>
                    <span className="material-symbols-outlined text-purple-500" style={{ fontSize: 20 }}>{s.icon}</span>
                  </div>
                  <div className="font-black text-slate-800 text-sm">{s.title}</div>
                  <div className="text-xs font-bold text-slate-400 mt-0.5">{s.desc}</div>
                </>
              )
              return s.href ? (
                <Link key={s.n} href={s.href} className="rounded-2xl border border-purple-100 bg-purple-50/40 p-4 hover:border-purple-300 hover:shadow-md transition-all">{inner}</Link>
              ) : (
                <div key={s.n} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">{inner}</div>
              )
            })}
          </div>
          <Link href={`/shodan/${encodeURIComponent(orgSlug)}/new`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-sm shadow-lg shadow-purple-500/25 hover:-translate-y-0.5 transition-all">
            {sym('bolt')}最初の商談準備をつくる
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const st = STATUS[it.status] || STATUS.processing
            return (
              <div key={it.id} className="group flex items-center gap-4 rounded-2xl bg-white border border-slate-200 px-5 py-4 hover:shadow-md hover:border-purple-200 transition-all">
                <Link href={`/shodan/${encodeURIComponent(orgSlug)}/p/${it.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 truncate">{it.targetName || it.targetUrl}</span>
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-400 truncate mt-0.5">{it.targetUrl}</div>
                </Link>
                <span className="text-xs font-bold text-slate-400 hidden md:block">{new Date(it.createdAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                <button onClick={() => remove(it.id)} className="text-slate-300 hover:text-rose-500 transition-colors" title="削除">{sym('delete')}</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
