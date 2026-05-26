'use client'

import Link from 'next/link'

const FEATURES = [
  {
    title: '打刻管理',
    description: 'PC・スマホからワンクリックで出退勤打刻。リアルタイムに勤務状況を把握。',
    character: '/kintai/characters/working_作業中.png',
    characterAlt: 'クマが作業中',
  },
  {
    title: '勤怠集計',
    description: '日次・月次の勤務時間を自動集計。残業・深夜・休日出勤も正確に計算。',
    character: '/kintai/characters/point_解説.png',
    characterAlt: 'クマが解説中',
  },
  {
    title: '申請承認',
    description: '打刻修正・休暇・残業申請をオンラインで完結。承認フローも柔軟に設定。',
    character: '/kintai/characters/thumbsup_いいね.png',
    characterAlt: 'クマがいいね',
  },
  {
    title: 'シフト管理',
    description: 'シフトの作成・共有・変更をスムーズに。従業員の希望も簡単に反映。',
    character: '/kintai/characters/thinking_考え中.png',
    characterAlt: 'クマが考え中',
    comingSoon: true,
  },
]

export default function KintaiLandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/30 to-purple-100/40 overflow-hidden relative">
      <style jsx>{`
        /* ===== Floating / Bouncing Bear ===== */
        @keyframes bearFloat {
          0%, 100% { transform: translateY(0px) rotate(-2deg); }
          50% { transform: translateY(-14px) rotate(2deg); }
        }
        .bear-float {
          animation: bearFloat 3s ease-in-out infinite;
        }

        /* ===== Typing cursor blink ===== */
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .typing-cursor {
          display: inline-block;
          width: 3px;
          height: 1.1em;
          background: #7f19e6;
          margin-left: 4px;
          vertical-align: text-bottom;
          animation: blink 0.8s step-end infinite;
        }

        /* ===== Typing text reveal ===== */
        @keyframes typeReveal {
          from { max-width: 0; }
          to { max-width: 600px; }
        }
        .typing-text {
          display: inline-block;
          overflow: hidden;
          white-space: nowrap;
          animation: typeReveal 2s steps(20, end) forwards;
          max-width: 0;
        }

        /* ===== Button pulse glow ===== */
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(127, 25, 230, 0.4); }
          50% { box-shadow: 0 0 0 14px rgba(127, 25, 230, 0); }
        }
        .btn-pulse {
          animation: pulseGlow 2.5s ease-in-out infinite;
        }

        /* ===== Card hover ===== */
        .feature-card {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .feature-card:hover {
          transform: translateY(-6px) scale(1.02);
          box-shadow: 0 20px 40px rgba(127, 25, 230, 0.12);
        }

        /* ===== Card character peek ===== */
        .card-character {
          position: absolute;
          bottom: -6px;
          right: -6px;
          width: 60px;
          height: 60px;
          object-fit: contain;
          opacity: 0.85;
          transition: transform 0.3s ease, opacity 0.3s ease;
        }
        .feature-card:hover .card-character {
          transform: scale(1.15) rotate(-5deg);
          opacity: 1;
        }

        /* ===== Floating background dots ===== */
        @keyframes drift1 {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(30px, -20px); }
          50% { transform: translate(-10px, -40px); }
          75% { transform: translate(-30px, -10px); }
        }
        @keyframes drift2 {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-20px, 30px); }
          50% { transform: translate(25px, 15px); }
          75% { transform: translate(10px, -25px); }
        }
        @keyframes drift3 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(-15px, -30px); }
          66% { transform: translate(20px, 10px); }
        }
        .dot-drift-1 { animation: drift1 12s ease-in-out infinite; }
        .dot-drift-2 { animation: drift2 15s ease-in-out infinite; }
        .dot-drift-3 { animation: drift3 10s ease-in-out infinite; }

        /* ===== Fade in up stagger ===== */
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }
        .animate-delay-1 { animation-delay: 0.1s; opacity: 0; }
        .animate-delay-2 { animation-delay: 0.2s; opacity: 0; }
        .animate-delay-3 { animation-delay: 0.3s; opacity: 0; }
        .animate-delay-4 { animation-delay: 0.4s; opacity: 0; }
        .animate-delay-5 { animation-delay: 0.5s; opacity: 0; }

        /* ===== Footer bear wave ===== */
        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(14deg); }
          75% { transform: rotate(-14deg); }
        }
        .bear-wave {
          animation: wave 2s ease-in-out infinite;
          transform-origin: bottom center;
        }

        /* ===== Hero bear bounce on load ===== */
        @keyframes bounceIn {
          0% { transform: scale(0.3) translateY(40px); opacity: 0; }
          50% { transform: scale(1.08) translateY(-10px); opacity: 1; }
          70% { transform: scale(0.95) translateY(4px); }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .bear-bounce-in {
          animation: bounceIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          opacity: 0;
        }
      `}</style>

      {/* ===== Floating Background Dots ===== */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="dot-drift-1 absolute top-[15%] left-[10%] w-4 h-4 rounded-full bg-[#7f19e6]/10" />
        <div className="dot-drift-2 absolute top-[25%] right-[15%] w-6 h-6 rounded-full bg-amber-300/20" />
        <div className="dot-drift-3 absolute top-[50%] left-[5%] w-3 h-3 rounded-full bg-emerald-400/15" />
        <div className="dot-drift-1 absolute top-[60%] right-[8%] w-5 h-5 rounded-full bg-[#7f19e6]/10" />
        <div className="dot-drift-2 absolute top-[35%] left-[50%] w-3 h-3 rounded-full bg-rose-300/15" />
        <div className="dot-drift-3 absolute top-[75%] left-[30%] w-4 h-4 rounded-full bg-blue-300/15" />
        <div className="dot-drift-1 absolute top-[80%] right-[25%] w-5 h-5 rounded-full bg-amber-400/10" />
        <div className="dot-drift-2 absolute top-[10%] left-[60%] w-3 h-3 rounded-full bg-[#7f19e6]/5" />
      </div>

      {/* ===== Header ===== */}
      <header className="relative z-10 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
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

      {/* ===== Hero ===== */}
      <section className="relative z-10 px-6 pt-12 pb-16 text-center max-w-4xl mx-auto">
        <div className="flex items-center justify-center gap-6 mb-6 flex-wrap">
          {/* Bear character */}
          <div className="bear-bounce-in" style={{ animationDelay: '0.2s' }}>
            <img
              src="/kintai/characters/hello_挨拶.png"
              alt="挨拶するクマ"
              className="bear-float"
              style={{ width: 150, height: 150, objectFit: 'contain' }}
            />
          </div>
          {/* Title */}
          <div className="animate-fade-in-up">
            <h1 className="text-5xl md:text-7xl font-black tracking-tight">
              <span className="text-[#7f19e6]">ドヤ勤怠</span>
            </h1>
          </div>
        </div>

        {/* Subtitle with typing effect */}
        <div className="animate-fade-in-up animate-delay-2 mb-4">
          <p className="text-lg md:text-2xl text-slate-600 font-medium">
            <span className="typing-text">シンプルで使いやすい クラウド勤怠管理</span>
            <span className="typing-cursor" />
          </p>
        </div>

        <p className="text-slate-500 max-w-xl mx-auto mb-10 animate-fade-in-up animate-delay-3">
          中小企業のための勤怠管理システム。打刻・集計・申請承認をオールインワンで。
          面倒な初期設定は不要、すぐに使い始められます。
        </p>

        {/* CTA Button with pulse glow */}
        <div className="animate-fade-in-up animate-delay-4">
          <Link
            href="/kintai/dashboard"
            className="btn-pulse inline-flex items-center gap-2 px-10 py-5 bg-gradient-to-r from-[#7f19e6] to-[#5b0fb3] text-white font-bold text-lg rounded-2xl hover:shadow-xl hover:shadow-[#7f19e6]/30 transition-all hover:-translate-y-1 active:scale-[0.97]"
          >
            <span className="material-symbols-outlined">rocket_launch</span>
            無料で始める
          </Link>
        </div>
      </section>

      {/* ===== Features ===== */}
      <section className="relative z-10 px-6 pb-24 max-w-5xl mx-auto">
        <div className="grid sm:grid-cols-2 gap-6">
          {FEATURES.map((feature, i) => (
            <div
              key={feature.title}
              className={`feature-card relative bg-white rounded-2xl border border-slate-200 p-6 overflow-hidden animate-fade-in-up animate-delay-${i + 1}`}
            >
              {feature.comingSoon && (
                <span className="absolute top-4 right-4 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full tracking-wider z-10">
                  準備中
                </span>
              )}
              <div className="w-12 h-12 rounded-xl bg-[#7f19e6]/10 flex items-center justify-center text-[#7f19e6] mb-4">
                <span className="material-symbols-outlined text-2xl">
                  {i === 0 ? 'schedule' : i === 1 ? 'bar_chart' : i === 2 ? 'task_alt' : 'calendar_month'}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed pr-12">{feature.description}</p>
              {/* Character peeking from corner */}
              <img
                src={feature.character}
                alt={feature.characterAlt}
                className="card-character"
              />
            </div>
          ))}
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="relative z-10 px-6 py-10 border-t border-slate-200/60 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <img
            src="/kintai/characters/hello_挨拶.png"
            alt="手を振るクマ"
            className="bear-wave"
            style={{ width: 48, height: 48, objectFit: 'contain' }}
          />
          <span className="text-sm text-slate-400 font-medium">またね！</span>
        </div>
        <p className="text-xs text-slate-400">
          &copy; {new Date().getFullYear()} ドヤAI. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
