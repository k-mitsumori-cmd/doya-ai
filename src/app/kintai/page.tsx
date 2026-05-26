'use client'

import Link from 'next/link'
import { Clock, CalendarDays, FileCheck, CalendarClock } from 'lucide-react'

const FEATURES = [
  {
    icon: <Clock size={28} />,
    title: '打刻管理',
    description: 'PC・スマホからワンクリックで出退勤打刻。リアルタイムに勤務状況を把握。',
  },
  {
    icon: <CalendarDays size={28} />,
    title: '勤怠集計',
    description: '日次・月次の勤務時間を自動集計。残業・深夜・休日出勤も正確に計算。',
  },
  {
    icon: <FileCheck size={28} />,
    title: '申請承認',
    description: '打刻修正・休暇・残業申請をオンラインで完結。承認フローも柔軟に設定。',
  },
  {
    icon: <CalendarClock size={28} />,
    title: 'シフト管理',
    description: 'シフトの作成・共有・変更をスムーズに。従業員の希望も簡単に反映。',
    comingSoon: true,
  },
]

export default function KintaiLandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-purple-50">
      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.5s ease-out forwards;
        }
        .animate-delay-1 { animation-delay: 0.1s; opacity: 0; }
        .animate-delay-2 { animation-delay: 0.2s; opacity: 0; }
        .animate-delay-3 { animation-delay: 0.3s; opacity: 0; }
        .animate-delay-4 { animation-delay: 0.4s; opacity: 0; }
      `}</style>

      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7f19e6] to-[#5b0fb3] flex items-center justify-center text-white shadow-lg shadow-[#7f19e6]/20">
            <span className="material-symbols-outlined text-xl">schedule</span>
          </div>
          <span className="font-bold text-slate-900 text-lg">ドヤ勤怠</span>
        </div>
        <Link
          href="/auth/signin?callbackUrl=/kintai/dashboard"
          className="px-5 py-2 text-sm font-semibold text-[#7f19e6] border border-[#7f19e6]/30 rounded-xl hover:bg-[#7f19e6]/5 transition-colors"
        >
          ログイン
        </Link>
      </header>

      {/* Hero */}
      <section className="px-6 pt-16 pb-20 text-center max-w-4xl mx-auto animate-fade-in-up">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4">
          <span className="text-[#7f19e6]">ドヤ勤怠</span>
        </h1>
        <p className="text-lg md:text-2xl text-slate-600 font-medium mb-8">
          シンプルで使いやすい<br className="sm:hidden" /> クラウド勤怠管理
        </p>
        <p className="text-slate-500 max-w-xl mx-auto mb-10">
          中小企業のための勤怠管理システム。打刻・集計・申請承認をオールインワンで。
          面倒な初期設定は不要、すぐに使い始められます。
        </p>
        <Link
          href="/kintai/dashboard"
          className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#7f19e6] to-[#5b0fb3] text-white font-bold text-lg rounded-2xl hover:shadow-xl hover:shadow-[#7f19e6]/20 transition-all hover:-translate-y-0.5"
        >
          <span className="material-symbols-outlined">rocket_launch</span>
          無料で始める
        </Link>
      </section>

      {/* Features */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
        <div className="grid sm:grid-cols-2 gap-6">
          {FEATURES.map((feature, i) => (
            <div
              key={feature.title}
              className={`relative bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg hover:border-[#7f19e6]/20 transition-all animate-fade-in-up animate-delay-${i + 1}`}
            >
              {feature.comingSoon && (
                <span className="absolute top-4 right-4 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                  Coming Soon
                </span>
              )}
              <div className="w-12 h-12 rounded-xl bg-[#7f19e6]/10 flex items-center justify-center text-[#7f19e6] mb-4">
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-slate-200 text-center">
        <p className="text-xs text-slate-400">
          &copy; {new Date().getFullYear()} ドヤAI. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
