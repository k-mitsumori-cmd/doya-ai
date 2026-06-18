'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import toast from 'react-hot-toast'
import { BgDots, DoyaKun, sym } from '@/components/aio/ui'

const FEATURES = [
  { icon: 'visibility', title: 'AIにどう見られているか可視化', desc: 'ChatGPT・Gemini・Claude・Perplexityにブランドがどれだけ言及・引用されるかを測定します。' },
  { icon: 'leaderboard', title: 'Share of Voice（競合比較）', desc: '同じ質問群で競合より自社がどれだけ登場するか。AI上での占有率を定点観測します。' },
  { icon: 'link', title: '引用元・感情を分析', desc: 'AIが根拠にしているサイト（引用元ドメイン）と、ブランドへの論調（ポジ/ネガ）を見える化。' },
  { icon: 'tips_and_updates', title: 'AEOの打ち手まで提案', desc: 'AIに引用されるための改善アクション（掲載獲得・サイトのAI可読化・比較コンテンツ）を提案します。' },
]

export default function AioEntryPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<'loading' | 'ready'>('loading')
  const [authed, setAuthed] = useState(false)
  const [latestSlug, setLatestSlug] = useState<string | null>(null)
  const [serviceUrl, setServiceUrl] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch('/api/aio/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setAuthed(!!d?.authenticated)
        // memberships は作成順(昇順)なので末尾が最新ワークスペース
        const ms = d?.memberships as { slug: string }[] | undefined
        if (d?.authenticated && ms?.length) {
          // 既存ユーザーは「URL AI調査」を最初の画面に。入力欄のある /scan へ直行（ダッシュボードはサイドバーから）
          router.replace(`/aio/${encodeURIComponent(ms[ms.length - 1].slug)}/scan`)
          return // 遷移中はローディング表示のまま（入口フォームをちらつかせない）
        }
        setPhase('ready')
      })
      .catch(() => setPhase('ready'))
  }, [router])

  // サービスURLだけで開始（裏でサービス名導出・ワークスペース・ブランド設定・監視プロンプトを自動用意）
  const start = async () => {
    if (!serviceUrl.trim()) { toast.error('URLを入力してください'); return }
    if (!authed) { signIn('google', { callbackUrl: '/aio' }); return }
    setCreating(true)
    try {
      const res = await fetch('/api/aio/quick-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: serviceUrl }),
      })
      const d = await res.json()
      if (res.status === 401) { signIn('google', { callbackUrl: '/aio' }); return }
      if (!res.ok) throw new Error(d.error || '開始に失敗しました')
      // ?scan=1 でダッシュボード側が自動でスキャンを実行する
      router.replace(`/aio/${encodeURIComponent(d.slug)}?scan=1`)
    } catch (e: any) {
      toast.error(e.message)
      setCreating(false)
    }
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-b from-white to-purple-50">
        <div className="text-center"><DoyaKun mood="thinking" size={88} /><p className="mt-3 text-slate-400 font-bold">読み込み中…</p></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-white via-purple-50/40 to-fuchsia-100/40">
      <BgDots />
      <header className="relative z-10 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <span className="inline-flex items-center gap-2 font-black text-lg">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white shadow-lg shadow-purple-500/25">🔍</span>
          <span className="text-slate-900">ドヤAIO</span>
        </span>
        {authed ? (
          latestSlug && (
            <Link href={`/aio/${encodeURIComponent(latestSlug)}`}
              className="px-5 py-2 text-sm font-bold text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-50 transition-colors">前回の分析を見る</Link>
          )
        ) : (
          <button onClick={() => signIn('google', { callbackUrl: '/aio' })}
            className="px-5 py-2 text-sm font-bold text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-50 transition-colors">ログイン</button>
        )}
      </header>

      <section className="relative z-10 px-6 pt-10 pb-14 text-center max-w-3xl mx-auto">
        <div className="flex justify-center mb-4 animate-fade-in-up"><DoyaKun mood="point" size={132} /></div>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 animate-fade-in-up">
          URLを入れるだけで<br className="sm:hidden" /><span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-fuchsia-600">AIでの現状</span>がわかる
        </h1>
        <p className="text-base md:text-lg text-slate-600 font-bold mt-4 animate-fade-in-up">
          ChatGPT・Gemini・Claude・Perplexityでの言及・引用・順位を測定。サービス名も質問もAIが自動判定。
        </p>

        {/* URL入力 → スキャン（常に表示） */}
        <div className="mt-8 max-w-xl mx-auto animate-fade-in-up">
          <div className="bg-white rounded-2xl shadow-xl shadow-purple-500/10 border border-purple-100 p-4 sm:p-5">
            <label className="block text-left text-sm font-black text-slate-700 mb-2">分析したいサービスのURL</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={serviceUrl} onChange={(e) => setServiceUrl(e.target.value)} placeholder="例: https://doya-ai.surisuta.jp"
                inputMode="url" autoFocus
                onKeyDown={(e) => e.key === 'Enter' && start()}
                className="flex-1 rounded-xl border-2 border-slate-200 focus:border-purple-600 outline-none px-4 py-3 font-bold transition-colors" />
              <button onClick={start} disabled={creating}
                className="shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black shadow-lg shadow-purple-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 active:scale-[0.97]">
                {sym(creating ? 'hourglass_top' : 'search')}{creating ? '判定中…' : '調べる'}
              </button>
            </div>
            <p className="text-left text-[11px] font-bold text-slate-400 mt-2">
              {authed ? 'URLを入れて「調べる」を押すと、AIが自動でセットアップしてスキャンします。' : 'Googleアカウントでログインすると無料で診断できます。'}
            </p>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-6 pb-20 max-w-5xl mx-auto">
        <div className="grid sm:grid-cols-2 gap-5">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="relative bg-white rounded-3xl border border-purple-100 p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all animate-fade-in-up" style={{ animationDelay: `${0.05 * i}s` }}>
              <div className="w-12 h-12 rounded-2xl bg-purple-50 grid place-items-center text-purple-600 mb-3">
                <span className="material-symbols-outlined text-2xl">{f.icon}</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1.5">{f.title}</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 px-6 py-10 border-t border-purple-100/60 text-center">
        <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} ドヤAI. All rights reserved.</p>
      </footer>
    </div>
  )
}
