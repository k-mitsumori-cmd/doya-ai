'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const [phase, setPhase] = useState<'loading' | 'guest' | 'onboard'>('loading')
  const [serviceUrl, setServiceUrl] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch('/api/aio/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.authenticated) { setPhase('guest'); return }
        if (d?.onboarded && d?.memberships?.[0]?.slug) {
          router.replace(`/aio/${encodeURIComponent(d.memberships[0].slug)}`)
        } else {
          setPhase('onboard')
        }
      })
      .catch(() => setPhase('guest'))
  }, [router])

  // サービスURLだけで開始（裏でサービス名導出・ワークスペース・ブランド設定・監視プロンプトを自動用意）
  const start = async () => {
    if (!serviceUrl.trim()) { toast.error('URLを入力してください'); return }
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

  if (phase === 'onboard') {
    return (
      <div className="min-h-screen relative bg-gradient-to-b from-white via-purple-50/40 to-fuchsia-100/40 grid place-items-center p-6">
        <BgDots />
        <div className="relative z-10 bg-white rounded-3xl shadow-xl shadow-purple-500/10 p-8 w-full max-w-md border border-purple-100">
          <div className="text-center mb-6">
            <div className="flex justify-center"><DoyaKun mood="point" size={110} /></div>
            <h2 className="text-2xl font-black text-slate-900 mt-2">URLを入れるだけ</h2>
            <p className="text-slate-500 font-bold text-sm mt-1">サービスのURLを入力すると、AIがサービス名・監視する質問まで全部自動で判定して診断します</p>
          </div>
          <label className="block text-sm font-black text-slate-700 mb-1">サービスURL <span className="text-purple-600">*</span></label>
          <input value={serviceUrl} onChange={(e) => setServiceUrl(e.target.value)} placeholder="例: https://doya-ai.surisuta.jp"
            inputMode="url" autoFocus
            onKeyDown={(e) => e.key === 'Enter' && start()}
            className="w-full rounded-xl border-2 border-slate-200 focus:border-purple-600 outline-none px-4 py-3 font-bold mb-2 transition-colors" />
          <p className="text-xs font-bold text-slate-400 mb-5">AIでの言及率・競合比較・引用元を自動で測定します。</p>
          <button onClick={start} disabled={creating}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-lg shadow-lg shadow-purple-500/30 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 active:scale-[0.98]">
            {creating ? '準備中…（URLからサービスを判定中…）' : '🔍 AIでの現状を調べる'}
          </button>
          <p className="text-[11px] font-bold text-slate-400 text-center mt-3">サービス名も監視する質問もAIが自動で判定。あとから編集もできます。</p>
        </div>
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
        <button onClick={() => signIn('google', { callbackUrl: '/aio' })}
          className="px-5 py-2 text-sm font-bold text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-50 transition-colors">ログイン</button>
      </header>

      <section className="relative z-10 px-6 pt-10 pb-14 text-center max-w-3xl mx-auto">
        <div className="flex justify-center mb-4 animate-fade-in-up"><DoyaKun mood="point" size={150} /></div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 animate-fade-in-up">
          AIは、あなたを<span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-fuchsia-600">推してる</span>？
        </h1>
        <p className="text-lg md:text-xl text-slate-600 font-bold mt-4 animate-fade-in-up">
          ChatGPT・Gemini・Claude・Perplexityでの言及・引用・順位を定点観測。
        </p>
        <p className="text-slate-500 max-w-xl mx-auto mt-3 mb-8 animate-fade-in-up">
          検索の次は「AIに選ばれる」競争。あなたのブランドがAIにどう見られているかを今すぐ可視化。
        </p>
        <button onClick={() => signIn('google', { callbackUrl: '/aio' })}
          className="inline-flex items-center gap-2 px-9 py-4 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-lg rounded-2xl shadow-lg shadow-purple-500/30 hover:shadow-xl hover:-translate-y-1 active:scale-[0.97] transition-all animate-fade-in-up">
          {sym('rocket_launch')}無料ではじめる
        </button>
        <p className="text-xs font-bold text-slate-400 mt-3">Googleアカウントでかんたんログイン</p>
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
