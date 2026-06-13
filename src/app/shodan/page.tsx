'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import toast from 'react-hot-toast'
import { BgDots, DoyaKun, sym } from '@/components/shodan/ui'

const FEATURES = [
  { icon: 'travel_explore', mood: 'focus' as const, title: 'URLだけで深掘り調査', desc: '商談先のURLを入れるだけ。従業員数・マーケ状況・オウンドメディア・更新頻度まで自動で調べます。' },
  { icon: 'psychology', mood: 'thinking' as const, title: '課題仮説をAIが立案', desc: '現状分析（はっきりめ）から、刺さる課題仮説と解決策の柱まで整理します。' },
  { icon: 'description', mood: 'present' as const, title: '提案資料まで一括生成', desc: '自社情報をもとに、そのまま使える提案書（Markdown）を自動作成。コピー＆保存OK。' },
  { icon: 'groups', mood: 'thumbsup' as const, title: 'チームで共有', desc: 'メンバー招待・組織スコープで、商談準備の型をチームに展開できます。' },
]

export default function ShodanEntryPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<'loading' | 'guest' | 'onboard'>('loading')
  const [orgName, setOrgName] = useState('')
  const [memberName, setMemberName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch('/api/shodan/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.authenticated) { setPhase('guest'); return }
        if (d?.onboarded && d?.memberships?.[0]?.slug) {
          router.replace(`/shodan/${encodeURIComponent(d.memberships[0].slug)}`)
        } else {
          setPhase('onboard')
        }
      })
      .catch(() => setPhase('guest'))
  }, [router])

  const create = async () => {
    if (!orgName.trim() || !memberName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/shodan/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName, memberName }),
      })
      const d = await res.json()
      if (res.status === 401) { signIn('google', { callbackUrl: '/shodan' }); return }
      if (!res.ok) throw new Error(d.error || '作成に失敗しました')
      router.replace(`/shodan/${encodeURIComponent(d.organization.slug)}`)
    } catch (e: any) {
      toast.error(e.message)
      setCreating(false)
    }
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-b from-white to-purple-50">
        <div className="text-center">
          <DoyaKun mood="thinking" size={88} />
          <p className="mt-3 text-slate-400 font-bold">読み込み中…</p>
        </div>
      </div>
    )
  }

  if (phase === 'onboard') {
    return (
      <div className="min-h-screen relative bg-gradient-to-b from-white via-purple-50/40 to-fuchsia-100/40 grid place-items-center p-6">
        <BgDots />
        <div className="relative z-10 bg-white rounded-3xl shadow-xl shadow-purple-500/10 p-8 w-full max-w-md border border-purple-100">
          <div className="text-center mb-6">
            <div className="flex justify-center"><DoyaKun mood="hello" size={110} /></div>
            <h2 className="text-2xl font-black text-slate-900 mt-2">ようこそ！</h2>
            <p className="text-slate-500 font-bold text-sm mt-1">組織を作成するとすぐに使い始められます</p>
          </div>
          <label className="block text-sm font-black text-slate-700 mb-1">組織名（会社名）</label>
          <input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="例: 株式会社スリスタ"
            className="w-full rounded-xl border-2 border-slate-200 focus:border-purple-400 outline-none px-4 py-3 font-bold mb-3 transition-colors" />
          <label className="block text-sm font-black text-slate-700 mb-1">あなたの氏名</label>
          <input value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="例: 三森 律稀"
            className="w-full rounded-xl border-2 border-slate-200 focus:border-purple-400 outline-none px-4 py-3 font-bold mb-5 transition-colors" />
          <button onClick={create} disabled={creating}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-lg shadow-lg shadow-purple-500/30 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 active:scale-[0.98]">
            {creating ? '作成中…' : '🚀 組織を作成して始める'}
          </button>
        </div>
      </div>
    )
  }

  // guest（未ログイン）= ランディング
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-white via-purple-50/40 to-fuchsia-100/40">
      <BgDots />

      <header className="relative z-10 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <span className="inline-flex items-center gap-2 font-black text-lg">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white shadow-lg shadow-purple-500/25">🎯</span>
          <span className="text-slate-900">ドヤ商談準備</span>
        </span>
        <button onClick={() => signIn('google', { callbackUrl: '/shodan' })}
          className="px-5 py-2 text-sm font-bold text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-50 transition-colors">
          ログイン
        </button>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 pt-10 pb-14 text-center max-w-3xl mx-auto">
        <div className="flex justify-center mb-4 animate-fade-in-up"><DoyaKun mood="point" size={150} /></div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 animate-fade-in-up">
          商談準備、<span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-fuchsia-600">URL1本</span>で。
        </h1>
        <p className="text-lg md:text-xl text-slate-600 font-bold mt-4 animate-fade-in-up">
          リサーチ → 課題仮説 → 解決策 → 提案資料まで、AIが一気に。
        </p>
        <p className="text-slate-500 max-w-xl mx-auto mt-3 mb-8 animate-fade-in-up">
          アポ前の調べもの・資料づくりはもう手作業しない。今、ドヤれる商談を、5分で。
        </p>
        <button onClick={() => signIn('google', { callbackUrl: '/shodan' })}
          className="inline-flex items-center gap-2 px-9 py-4 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-lg rounded-2xl shadow-lg shadow-purple-500/30 hover:shadow-xl hover:-translate-y-1 active:scale-[0.97] transition-all animate-fade-in-up">
          {sym('rocket_launch')}無料ではじめる
        </button>
        <p className="text-xs font-bold text-slate-400 mt-3">Googleアカウントでかんたんログイン</p>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 pb-20 max-w-5xl mx-auto">
        <div className="grid sm:grid-cols-2 gap-5">
          {FEATURES.map((f, i) => (
            <div key={f.title}
              className="relative bg-white rounded-3xl border border-purple-100 p-6 pr-28 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden animate-fade-in-up"
              style={{ animationDelay: `${0.05 * i}s` }}>
              <div className="w-12 h-12 rounded-2xl bg-purple-50 grid place-items-center text-purple-600 mb-3">
                <span className="material-symbols-outlined text-2xl">{f.icon}</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1.5">{f.title}</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">{f.desc}</p>
              <DoyaKun mood={f.mood} size={84} className="!absolute -bottom-2 -right-1 opacity-90" />
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 px-6 py-10 border-t border-purple-100/60 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <DoyaKun mood="thumbsup" size={44} float={false} />
          <span className="text-sm text-slate-400 font-bold">いっしょにドヤろう！</span>
        </div>
        <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} ドヤAI. All rights reserved.</p>
      </footer>
    </div>
  )
}
