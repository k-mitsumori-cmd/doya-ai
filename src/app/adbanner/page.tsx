'use client'

import Link from 'next/link'
import { DoyaKun, BgDots, sym } from '@/components/shodan/ui'

const FEATURES = [
  { icon: 'auto_awesome', mood: 'point' as const, title: 'URLから広告バナーを量産', desc: 'サービスURLやブランドカラー・媒体を指定するだけで、広告特化バナーを一括生成。' },
  { icon: 'rate_review', mood: 'thinking' as const, title: 'AIが自動で採点・改善提案', desc: '視認性・訴求・CTA・媒体適合・ブランド整合を100点満点で採点し、直し方を提案。' },
  { icon: 'autorenew', mood: 'working' as const, title: 'ワンクリックで再生成', desc: '改善提案を反映して作り直し。キャンペーン単位で作り続けて改善できます。' },
  { icon: 'verified', mood: 'thumbsup' as const, title: 'ロゴは原寸で正確に', desc: 'AIにロゴを描かせず、アップロードした実ロゴを高精度で合成します。' },
]

export default function AdBannerLanding() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-white via-purple-50/40 to-orange-100/40">
      <BgDots />
      <header className="relative z-10 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <span className="inline-flex items-center gap-2 font-black text-lg">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-orange-500 text-white shadow-lg">📣</span>
          <span className="text-slate-900">ドヤ広告バナーAI</span>
        </span>
        <Link href="/adbanner/dashboard" className="px-5 py-2 text-sm font-bold text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-50 transition-colors">はじめる</Link>
      </header>

      <section className="relative z-10 px-6 pt-10 pb-14 text-center max-w-3xl mx-auto">
        <div className="flex justify-center mb-4 animate-fade-in-up"><DoyaKun mood="present" size={150} /></div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 animate-fade-in-up">
          広告バナー、<span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-orange-500">量産</span>して改善。
        </h1>
        <p className="text-lg md:text-xl text-slate-600 font-bold mt-4 animate-fade-in-up">URL・ブランドから広告特化バナーを一括生成 → AIが採点 → 直して再生成。</p>
        <p className="text-slate-500 max-w-xl mx-auto mt-3 mb-8 animate-fade-in-up">作って終わりじゃない。成果の出るクリエイティブを作り続けるための運用型ツール。</p>
        <Link href="/adbanner/dashboard/new" className="inline-flex items-center gap-2 px-9 py-4 bg-gradient-to-r from-purple-600 to-orange-500 text-white font-black text-lg rounded-2xl shadow-lg shadow-purple-500/30 hover:-translate-y-1 active:scale-[0.97] transition-all animate-fade-in-up">
          {sym('bolt')}無料でバナーを作る
        </Link>
        <p className="text-xs font-bold text-slate-400 mt-3">ログイン不要でお試し（ゲスト3枚/日）</p>
      </section>

      <section className="relative z-10 px-6 pb-20 max-w-5xl mx-auto">
        <div className="grid sm:grid-cols-2 gap-5">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="relative bg-white rounded-3xl border border-purple-100 p-6 pr-28 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden animate-fade-in-up" style={{ animationDelay: `${0.05 * i}s` }}>
              <div className="w-12 h-12 rounded-2xl bg-orange-50 grid place-items-center text-orange-500 mb-3"><span className="material-symbols-outlined text-2xl">{f.icon}</span></div>
              <h3 className="text-lg font-black text-slate-900 mb-1.5">{f.title}</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">{f.desc}</p>
              <DoyaKun mood={f.mood} size={84} className="!absolute -bottom-2 -right-1 opacity-90" />
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
