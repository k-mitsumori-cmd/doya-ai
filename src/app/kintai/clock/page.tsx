'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { CLOCK_TYPE_LABELS } from '@/lib/kintai/types'
import { formatMinutesJa } from '@/lib/kintai/attendance'

type ClockStatus = 'not_clocked_in' | 'working' | 'on_break' | 'clocked_out'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

// 8時間 = 480分を基準とした勤務進捗
const STANDARD_WORK_MINUTES = 480

// Character paths
const CHARS = {
  sleep: '/kintai/characters/sleep_居眠り.png',
  working: '/kintai/characters/working_作業中.png',
  ramen: '/kintai/characters/ramen_休憩.png',
  success: '/kintai/characters/success_成功.png',
  jump: '/kintai/characters/jump_大喜び.png',
  surprise: '/kintai/characters/surprise_驚き.png',
  thinking: '/kintai/characters/thinking_考え中.png',
  error: '/kintai/characters/error_泣き.png',
  hello: '/kintai/characters/hello_挨拶.png',
}

// Timeline character mini-icons per event type
const TIMELINE_CHAR: Record<string, string> = {
  clock_in: CHARS.hello,
  clock_out: CHARS.success,
  break_start: CHARS.ramen,
  break_end: CHARS.working,
}

export default function ClockPage() {
  const [now, setNow] = useState(new Date())
  const [status, setStatus] = useState<ClockStatus>('not_clocked_in')
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [confirmClockOut, setConfirmClockOut] = useState(false)
  const [hoverClockIn, setHoverClockIn] = useState(false)
  const messageTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchRecords = useCallback(async () => {
    try {
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
      const res = await fetch(`/api/kintai/clock?date=${today}`)
      const data = await res.json()
      setRecords(data.records || [])
      setStatus(data.clockStatus || 'not_clocked_in')
    } catch {
      console.error('Failed to fetch records')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  // Auto-dismiss message after 3 seconds
  useEffect(() => {
    if (message) {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current)
      messageTimerRef.current = setTimeout(() => setMessage(null), 3000)
    }
    return () => {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current)
    }
  }, [message])

  const handleClock = async (type: string) => {
    setActing(true)
    setMessage(null)
    setConfirmClockOut(false)
    try {
      const res = await fetch('/api/kintai/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || '打刻に失敗しました' })
        return
      }
      setMessage({ type: 'success', text: `${CLOCK_TYPE_LABELS[type] || type}しました` })
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
      await fetchRecords()
    } catch {
      setMessage({ type: 'error', text: '通信エラーが発生しました' })
    } finally {
      setActing(false)
    }
  }

  const handleClockOutClick = () => {
    setConfirmClockOut(true)
  }

  const handleClockOutConfirm = () => {
    handleClock('clock_out')
  }

  const handleClockOutCancel = () => {
    setConfirmClockOut(false)
  }

  const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const hour = jstNow.getHours()
  const timeStr = now.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false })
  const monthDay = `${now.getMonth() + 1}月${now.getDate()}日（${WEEKDAYS[now.getDay()]}）`

  const breakMinutes = calcBreakMinutes(records)
  const workMinutes = calcWorkMinutes(records, breakMinutes)

  // Time-based greeting
  const greeting = hour < 12 ? 'おはようございます！' : hour < 18 ? 'お疲れさまです！' : 'お疲れさまです！'

  // Real-time working duration
  const liveWorkMinutes = status === 'working' ? calcWorkMinutes(records, breakMinutes) : workMinutes
  const liveHours = Math.floor(liveWorkMinutes / 60)
  const liveMins = liveWorkMinutes % 60

  // Live break duration
  const liveBreakMinutes = status === 'on_break' ? calcLiveBreakMinutes(records) : breakMinutes
  const liveBreakH = Math.floor(liveBreakMinutes / 60)
  const liveBreakM = liveBreakMinutes % 60

  // Progress percentage for the 8-hour workday
  const progressPercent = Math.min(100, Math.round((workMinutes / STANDARD_WORK_MINUTES) * 100))

  // Overtime
  const overtimeMinutes = Math.max(0, workMinutes - STANDARD_WORK_MINUTES)

  // Status-based config
  const statusConfig = {
    not_clocked_in: {
      bg: 'background: linear-gradient(180deg, #fffbeb 0%, #fff7ed 40%, #ffffff 100%)',
      character: CHARS.sleep,
      characterAlt: '居眠り中のクマ',
      characterAnim: hoverClockIn ? 'bear-wake-up' : 'bear-gentle-float',
      characterSize: 160,
      greeting: 'おはようございます！',
      statusText: 'まだ出勤していません',
      statusSub: 'ボタンを押して勤務を始めましょう',
    },
    working: {
      bg: 'background: linear-gradient(180deg, #ecfdf5 0%, #f0fdf4 40%, #ffffff 100%)',
      character: CHARS.working,
      characterAlt: '作業中のクマ',
      characterAnim: 'bear-bob',
      characterSize: 140,
      greeting: greeting,
      statusText: `勤務中 — ${liveHours}時間${liveMins}分`,
      statusSub: '集中して頑張りましょう！',
    },
    on_break: {
      bg: 'background: linear-gradient(180deg, #fefce8 0%, #fffbeb 40%, #ffffff 100%)',
      character: CHARS.ramen,
      characterAlt: 'ラーメンを食べるクマ',
      characterAnim: 'bear-wiggle',
      characterSize: 150,
      greeting: '休憩中です',
      statusText: `休憩中 — ${liveBreakH > 0 ? liveBreakH + '時間' : ''}${liveBreakM}分`,
      statusSub: 'ゆっくり休んでリフレッシュ！',
    },
    clocked_out: {
      bg: 'background: linear-gradient(180deg, #ede9fe 0%, #e0e7ff 40%, #ffffff 100%)',
      character: CHARS.success,
      characterAlt: 'トロフィーを持つクマ',
      characterAnim: 'bear-celebrate',
      characterSize: 150,
      greeting: 'お疲れさまでした！',
      statusText: '本日の勤務は終了しました',
      statusSub: `勤務時間: ${formatMinutesJa(workMinutes)}`,
    },
  }[status]

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <style jsx>{`
          @keyframes thinkSpin {
            0%, 100% { transform: rotate(-5deg) scale(1); }
            50% { transform: rotate(5deg) scale(1.05); }
          }
          .bear-loading { animation: thinkSpin 1.5s ease-in-out infinite; }
        `}</style>
        <img
          src={CHARS.thinking}
          alt="読み込み中"
          className="bear-loading"
          style={{ width: 120, height: 120, objectFit: 'contain' }}
        />
        <p className="text-slate-500 font-bold text-sm">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen transition-colors duration-700" style={{ ...(statusConfig.bg ? { background: '' } : {}) }}>
      <style jsx>{`
        /* ===== Status Background (applied via inline style) ===== */

        /* ===== Bear Animations ===== */
        @keyframes gentleFloat {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50% { transform: translateY(-10px) rotate(1deg); }
        }
        .bear-gentle-float {
          animation: gentleFloat 3s ease-in-out infinite;
        }

        @keyframes wakeUp {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          30% { transform: translateY(-6px) rotate(3deg); }
          60% { transform: translateY(-2px) rotate(-2deg); }
        }
        .bear-wake-up {
          animation: wakeUp 0.6s ease-out;
          transform: rotate(5deg);
        }

        @keyframes bob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        .bear-bob {
          animation: bob 2s ease-in-out infinite;
        }

        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg) translateY(0); }
          15% { transform: rotate(-5deg) translateY(-3px); }
          30% { transform: rotate(4deg) translateY(0); }
          45% { transform: rotate(-3deg) translateY(-2px); }
          60% { transform: rotate(2deg) translateY(0); }
          75% { transform: rotate(-1deg); }
        }
        .bear-wiggle {
          animation: wiggle 2.5s ease-in-out infinite;
        }

        @keyframes celebrate {
          0%, 100% { transform: translateY(0) scale(1); }
          25% { transform: translateY(-12px) scale(1.05); }
          50% { transform: translateY(0) scale(1); }
          75% { transform: translateY(-8px) scale(1.03); }
        }
        .bear-celebrate {
          animation: celebrate 2s ease-in-out infinite;
        }

        @keyframes jumpBounce {
          0% { transform: scale(0.3) translateY(40px); opacity: 0; }
          40% { transform: scale(1.15) translateY(-20px); opacity: 1; }
          60% { transform: scale(0.95) translateY(5px); }
          80% { transform: scale(1.05) translateY(-4px); }
          100% { transform: scale(1) translateY(0); }
        }
        .bear-jump-in {
          animation: jumpBounce 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        /* ===== Success Overlay ===== */
        @keyframes successPop {
          0% { transform: scale(0); opacity: 0; }
          30% { transform: scale(1.2); opacity: 1; }
          50% { transform: scale(0.95); }
          65% { transform: scale(1.05); }
          80% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
        .success-overlay-inner {
          animation: successPop 2.8s ease-out forwards;
        }

        /* ===== Confetti CSS particles ===== */
        @keyframes confettiFall0 { 0% { transform: translate(0,0) rotate(0); opacity:1; } 100% { transform: translate(-60px, 120px) rotate(360deg); opacity:0; } }
        @keyframes confettiFall1 { 0% { transform: translate(0,0) rotate(0); opacity:1; } 100% { transform: translate(50px, 140px) rotate(-270deg); opacity:0; } }
        @keyframes confettiFall2 { 0% { transform: translate(0,0) rotate(0); opacity:1; } 100% { transform: translate(-40px, 110px) rotate(200deg); opacity:0; } }
        @keyframes confettiFall3 { 0% { transform: translate(0,0) rotate(0); opacity:1; } 100% { transform: translate(70px, 100px) rotate(-300deg); opacity:0; } }
        @keyframes confettiFall4 { 0% { transform: translate(0,0) rotate(0); opacity:1; } 100% { transform: translate(-80px, 90px) rotate(250deg); opacity:0; } }
        @keyframes confettiFall5 { 0% { transform: translate(0,0) rotate(0); opacity:1; } 100% { transform: translate(30px, 130px) rotate(-220deg); opacity:0; } }
        @keyframes confettiFall6 { 0% { transform: translate(0,0) rotate(0); opacity:1; } 100% { transform: translate(-20px, 150px) rotate(310deg); opacity:0; } }
        @keyframes confettiFall7 { 0% { transform: translate(0,0) rotate(0); opacity:1; } 100% { transform: translate(60px, 80px) rotate(-280deg); opacity:0; } }
        @keyframes confettiFall8 { 0% { transform: translate(0,0) rotate(0); opacity:1; } 100% { transform: translate(-50px, 160px) rotate(190deg); opacity:0; } }
        @keyframes confettiFall9 { 0% { transform: translate(0,0) rotate(0); opacity:1; } 100% { transform: translate(45px, 135px) rotate(-340deg); opacity:0; } }
        @keyframes confettiFall10 { 0% { transform: translate(0,0) rotate(0); opacity:1; } 100% { transform: translate(-70px, 70px) rotate(270deg); opacity:0; } }
        @keyframes confettiFall11 { 0% { transform: translate(0,0) rotate(0); opacity:1; } 100% { transform: translate(55px, 95px) rotate(-210deg); opacity:0; } }

        .confetti-piece { position: absolute; border-radius: 2px; }
        .confetti-0 { width:8px; height:8px; background:#f59e0b; top:40%; left:30%; animation: confettiFall0 1.8s ease-out 0.1s forwards; }
        .confetti-1 { width:6px; height:10px; background:#ef4444; top:35%; left:55%; animation: confettiFall1 1.6s ease-out 0.2s forwards; }
        .confetti-2 { width:8px; height:6px; background:#3b82f6; top:45%; left:40%; animation: confettiFall2 2s ease-out 0.15s forwards; }
        .confetti-3 { width:6px; height:8px; background:#7f19e6; top:38%; left:65%; animation: confettiFall3 1.7s ease-out 0.25s forwards; }
        .confetti-4 { width:10px; height:6px; background:#10b981; top:42%; left:25%; animation: confettiFall4 1.9s ease-out 0.1s forwards; }
        .confetti-5 { width:6px; height:6px; background:#ec4899; top:36%; left:50%; animation: confettiFall5 1.5s ease-out 0.3s forwards; border-radius:50%; }
        .confetti-6 { width:8px; height:8px; background:#f97316; top:44%; left:70%; animation: confettiFall6 2.1s ease-out 0.12s forwards; }
        .confetti-7 { width:6px; height:10px; background:#14b8a6; top:40%; left:35%; animation: confettiFall7 1.6s ease-out 0.22s forwards; }
        .confetti-8 { width:6px; height:6px; background:#8b5cf6; top:38%; left:60%; animation: confettiFall8 2s ease-out 0.18s forwards; border-radius:50%; }
        .confetti-9 { width:8px; height:6px; background:#f59e0b; top:42%; left:45%; animation: confettiFall9 1.7s ease-out 0.28s forwards; }
        .confetti-10 { width:6px; height:8px; background:#ef4444; top:35%; left:75%; animation: confettiFall10 1.8s ease-out 0.14s forwards; }
        .confetti-11 { width:8px; height:8px; background:#06b6d4; top:45%; left:20%; animation: confettiFall11 1.9s ease-out 0.24s forwards; }

        /* ===== Clocked Out confetti (persistent, lighter) ===== */
        @keyframes floatConfetti0 { 0%,100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-20px) rotate(180deg); } }
        @keyframes floatConfetti1 { 0%,100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-15px) rotate(-120deg); } }
        @keyframes floatConfetti2 { 0%,100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-25px) rotate(200deg); } }
        .float-confetti-0 { animation: floatConfetti0 4s ease-in-out infinite; }
        .float-confetti-1 { animation: floatConfetti1 5s ease-in-out infinite 0.5s; }
        .float-confetti-2 { animation: floatConfetti2 3.5s ease-in-out infinite 1s; }

        /* ===== Toast ===== */
        @keyframes toastSlide {
          0% { transform: translateY(-12px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .clock-toast {
          animation: toastSlide 0.35s cubic-bezier(0.21, 1.02, 0.73, 1);
        }

        /* ===== Fade / Slide ===== */
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        .clock-fade-in { animation: fadeIn 0.2s ease-out; }

        @keyframes slideUp {
          0% { transform: translateY(100%); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .clock-slide-up { animation: slideUp 0.35s cubic-bezier(0.21, 1.02, 0.73, 1); }

        /* ===== Progress pulse ===== */
        @keyframes progressPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .clock-progress-pulse { animation: progressPulse 2s ease-in-out infinite; }

        /* ===== Live dot ===== */
        @keyframes livePulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.7; }
        }
        .clock-live-pulse { animation: livePulse 1.5s ease-in-out infinite; }

        /* ===== Button bounce on hover ===== */
        @keyframes btnBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .btn-bounce:hover {
          animation: btnBounce 0.4s ease-in-out;
        }

        /* ===== Summary card wobble ===== */
        @keyframes hoverWobble {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-2deg); }
          75% { transform: rotate(2deg); }
        }
        .summary-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .summary-card:hover {
          animation: hoverWobble 0.4s ease-in-out;
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
        }

        /* ===== Timeline vertical line ===== */
        .timeline-line {
          position: absolute;
          left: 23px;
          top: 0;
          bottom: 0;
          width: 3px;
          background: linear-gradient(to bottom, #7f19e6, #a855f7, #c084fc);
          border-radius: 2px;
        }

        /* ===== Glow for clock-in button ===== */
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          50% { box-shadow: 0 0 0 12px rgba(16, 185, 129, 0); }
        }
        .btn-glow-green {
          animation: glowPulse 2s ease-in-out infinite;
        }
      `}</style>

      <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5 pb-20" style={parseBgStyle(statusConfig.bg)}>

        {/* ===== Success Animation Overlay ===== */}
        {showSuccess && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="relative" style={{ width: 200, height: 200 }}>
              <div className="success-overlay-inner flex items-center justify-center" style={{ width: 200, height: 200 }}>
                <img
                  src={CHARS.jump}
                  alt="大喜びのクマ"
                  className="bear-jump-in"
                  style={{ width: 160, height: 160, objectFit: 'contain' }}
                />
              </div>
              {/* Confetti particles */}
              {[...Array(12)].map((_, i) => (
                <div key={i} className={`confetti-piece confetti-${i}`} />
              ))}
            </div>
          </div>
        )}

        {/* ===== Toast Message ===== */}
        {message && (
          <div className={`clock-toast p-4 rounded-2xl text-sm font-bold flex items-center gap-3 shadow-lg ${
            message.type === 'success'
              ? 'bg-white text-emerald-700 border border-emerald-200 shadow-emerald-100'
              : 'bg-white text-red-600 border border-red-200 shadow-red-100'
          }`}>
            <img
              src={message.type === 'success' ? CHARS.jump : CHARS.error}
              alt={message.type === 'success' ? '成功' : 'エラー'}
              style={{ width: 32, height: 32, objectFit: 'contain' }}
            />
            {message.text}
          </div>
        )}

        {/* ===== Greeting ===== */}
        <div className="text-center pt-3 pb-1">
          <p className="text-base font-bold text-slate-500 tracking-wide">{statusConfig.greeting}</p>
        </div>

        {/* ===== Clock Display + Bear Character ===== */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white shadow-xl shadow-slate-200/50 p-6 sm:p-8 text-center relative overflow-hidden">
          {/* Floating confetti for clocked_out */}
          {status === 'clocked_out' && (
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
              <div className="float-confetti-0 absolute top-[10%] left-[15%] w-2 h-2 rounded-sm bg-[#7f19e6]/30" />
              <div className="float-confetti-1 absolute top-[20%] right-[20%] w-2 h-3 rounded-sm bg-amber-400/30" />
              <div className="float-confetti-2 absolute top-[15%] left-[60%] w-3 h-2 rounded-sm bg-emerald-400/30" />
              <div className="float-confetti-0 absolute top-[8%] right-[35%] w-2 h-2 rounded-full bg-rose-400/25" />
              <div className="float-confetti-1 absolute top-[25%] left-[40%] w-2 h-2 rounded-sm bg-blue-400/25" />
            </div>
          )}

          {/* Bear Character */}
          <div className="flex justify-center mb-3">
            <img
              src={statusConfig.character}
              alt={statusConfig.characterAlt}
              className={statusConfig.characterAnim}
              style={{ width: statusConfig.characterSize, height: statusConfig.characterSize, objectFit: 'contain' }}
            />
          </div>

          <p className="text-sm font-medium text-slate-400 mb-2 tracking-wider">{monthDay}</p>
          <div className="relative inline-block">
            <p className="text-7xl sm:text-8xl font-mono font-black text-slate-800 tracking-wider tabular-nums leading-none py-2">
              {timeStr}
            </p>
            {status === 'working' && (
              <div className="absolute -bottom-1 left-0 right-0 h-1.5 rounded-full overflow-hidden bg-emerald-100">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 clock-progress-pulse" />
              </div>
            )}
            {status === 'on_break' && (
              <div className="absolute -bottom-1 left-0 right-0 h-1.5 rounded-full overflow-hidden bg-amber-100">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 clock-progress-pulse" />
              </div>
            )}
          </div>
        </div>

        {/* ===== Status Card ===== */}
        <div className={`rounded-3xl border p-5 flex items-center gap-4 ${
          status === 'not_clocked_in' ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/60' :
          status === 'working' ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200/60' :
          status === 'on_break' ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200/60' :
          'bg-gradient-to-br from-violet-50 to-indigo-50 border-violet-200/60'
        }`}>
          <img
            src={statusConfig.character}
            alt=""
            style={{ width: 48, height: 48, objectFit: 'contain' }}
          />
          <div className="flex-1 min-w-0">
            <p className={`text-lg font-black ${
              status === 'not_clocked_in' ? 'text-amber-600' :
              status === 'working' ? 'text-emerald-600' :
              status === 'on_break' ? 'text-amber-600' :
              'text-violet-600'
            }`}>
              {statusConfig.statusText}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">{statusConfig.statusSub}</p>
            {status === 'working' && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-2.5 bg-white/80 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-1000 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-emerald-600 tabular-nums whitespace-nowrap">{progressPercent}%</span>
              </div>
            )}
          </div>
          {status === 'working' && (
            <div className="w-3 h-3 rounded-full bg-emerald-500 clock-live-pulse flex-shrink-0" />
          )}
          {status === 'on_break' && (
            <div className="w-3 h-3 rounded-full bg-amber-500 clock-live-pulse flex-shrink-0" />
          )}
        </div>

        {/* ===== Action Buttons ===== */}
        <div className="space-y-3">
          {status === 'not_clocked_in' && (
            <button
              onClick={() => handleClock('clock_in')}
              onMouseEnter={() => setHoverClockIn(true)}
              onMouseLeave={() => setHoverClockIn(false)}
              disabled={acting}
              className="btn-bounce btn-glow-green w-full rounded-3xl bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-500/40 active:scale-[0.97] transition-all disabled:opacity-50 p-5 flex items-center gap-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-white" style={{ fontSize: 32 }}>wb_sunny</span>
              </div>
              <div className="flex-1 text-left">
                <p className="text-xl font-black leading-tight">出勤する</p>
                <p className="text-sm font-medium text-white/80 mt-0.5">ワンタップで打刻</p>
              </div>
              <span className="material-symbols-outlined text-white/60 text-3xl flex-shrink-0">arrow_forward</span>
            </button>
          )}

          {status === 'working' && !confirmClockOut && (
            <>
              <button
                onClick={handleClockOutClick}
                disabled={acting}
                className="btn-bounce w-full rounded-3xl bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-xl shadow-rose-500/25 hover:shadow-2xl hover:shadow-rose-500/40 active:scale-[0.97] transition-all disabled:opacity-50 p-5 flex items-center gap-4"
              >
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-white" style={{ fontSize: 32 }}>nights_stay</span>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-xl font-black leading-tight">退勤する</p>
                  <p className="text-sm font-medium text-white/80 mt-0.5">お疲れさまでした</p>
                </div>
                <span className="material-symbols-outlined text-white/60 text-3xl flex-shrink-0">arrow_forward</span>
              </button>
              <button
                onClick={() => handleClock('break_start')}
                disabled={acting}
                className="btn-bounce w-full rounded-3xl bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-lg shadow-amber-400/20 hover:shadow-xl hover:shadow-amber-400/30 active:scale-[0.97] transition-all disabled:opacity-50 p-4 flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-white" style={{ fontSize: 28 }}>coffee</span>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-lg font-black leading-tight">休憩を開始</p>
                  <p className="text-xs font-medium text-white/80 mt-0.5">ちょっとひと休み</p>
                </div>
                <span className="material-symbols-outlined text-white/60 text-2xl flex-shrink-0">arrow_forward</span>
              </button>
            </>
          )}

          {/* ===== Clock Out Confirmation Dialog ===== */}
          {status === 'working' && confirmClockOut && (
            <>
              <div
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 clock-fade-in"
                onClick={handleClockOutCancel}
              />
              <div className="fixed inset-x-4 bottom-8 z-50 max-w-lg mx-auto clock-slide-up">
                <div className="bg-white rounded-3xl shadow-2xl p-6 space-y-5">
                  <div className="text-center">
                    {/* Surprise bear */}
                    <img
                      src={CHARS.surprise}
                      alt="驚きのクマ"
                      style={{ width: 100, height: 100, objectFit: 'contain', margin: '0 auto 8px' }}
                    />
                    <p className="text-xl font-black text-slate-800">本当に退勤しますか？</p>
                    <p className="text-sm text-slate-500 mt-2">
                      本日の勤務時間: <span className="font-bold text-slate-700">{formatMinutesJa(workMinutes)}</span>
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleClockOutCancel}
                      className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-600 font-bold text-base hover:bg-slate-200 active:scale-[0.98] transition-all"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleClockOutConfirm}
                      disabled={acting}
                      className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 text-white font-bold text-base hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      退勤する
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {status === 'on_break' && (
            <button
              onClick={() => handleClock('break_end')}
              disabled={acting}
              className="btn-bounce w-full rounded-3xl bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-xl shadow-amber-400/25 hover:shadow-2xl hover:shadow-amber-400/40 active:scale-[0.97] transition-all disabled:opacity-50 p-5 flex items-center gap-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-white" style={{ fontSize: 32 }}>resume</span>
              </div>
              <div className="flex-1 text-left">
                <p className="text-xl font-black leading-tight">休憩終了</p>
                <p className="text-sm font-medium text-white/80 mt-0.5">業務に戻りましょう</p>
              </div>
              <span className="material-symbols-outlined text-white/60 text-3xl flex-shrink-0">arrow_forward</span>
            </button>
          )}

          {status === 'clocked_out' && (
            <div className="w-full rounded-3xl bg-gradient-to-br from-violet-50 to-indigo-50 border-2 border-violet-200/60 p-5 flex items-center gap-4">
              <img
                src={CHARS.success}
                alt="トロフィークマ"
                style={{ width: 56, height: 56, objectFit: 'contain' }}
              />
              <div className="flex-1 text-left">
                <p className="text-lg font-black text-violet-700 leading-tight">お疲れさまでした！</p>
                <p className="text-sm font-medium text-violet-500/80 mt-0.5">ゆっくり休んでくださいね</p>
              </div>
            </div>
          )}
        </div>

        {/* ===== Summary Cards (3 cards) ===== */}
        <div className="grid grid-cols-3 gap-3">
          <SummaryMiniCard
            character={CHARS.working}
            characterAlt="作業中クマ"
            label="勤務時間"
            value={formatMinutesJa(workMinutes)}
            color="emerald"
            progress={progressPercent}
          />
          <SummaryMiniCard
            character={CHARS.ramen}
            characterAlt="ラーメンクマ"
            label="休憩時間"
            value={formatMinutesJa(breakMinutes)}
            color="amber"
            progress={breakMinutes > 0 ? Math.min(100, Math.round((breakMinutes / 60) * 100)) : 0}
          />
          <SummaryMiniCard
            character={CHARS.surprise}
            characterAlt="驚きクマ"
            label="残業"
            value={formatMinutesJa(overtimeMinutes)}
            color={overtimeMinutes > 0 ? 'orange' : 'slate'}
            progress={overtimeMinutes > 0 ? Math.min(100, Math.round((overtimeMinutes / 120) * 100)) : 0}
          />
        </div>

        {/* ===== Timeline ===== */}
        {records.length > 0 && (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white shadow-lg shadow-slate-200/30 p-5">
            <h2 className="text-sm font-bold text-slate-600 mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#7f19e6] text-lg">timeline</span>
              今日のタイムライン
            </h2>
            <div className="relative pl-4">
              {/* Vertical colorful line */}
              <div className="timeline-line" />
              <div className="space-y-5">
                {records.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-4 relative">
                    {/* Character mini-icon */}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm z-10 ${timelineBg(r.type)}`}>
                      <img
                        src={TIMELINE_CHAR[r.type] || CHARS.thinking}
                        alt=""
                        style={{ width: 32, height: 32, objectFit: 'contain' }}
                      />
                    </div>
                    {/* Info */}
                    <div className="flex-1">
                      <p className={`text-sm font-black ${timelineTextColor(r.type)}`}>
                        {CLOCK_TYPE_LABELS[r.type] || r.type}
                      </p>
                      <p className="text-xs font-mono font-bold text-slate-400 tabular-nums">
                        {new Date(r.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ===== Summary Mini Card with Character ===== */
function SummaryMiniCard({ character, characterAlt, label, value, color, progress }: {
  character: string; characterAlt: string; label: string; value: string; color: string; progress: number
}) {
  const colorMap: Record<string, { bg: string; bar: string; text: string }> = {
    emerald: { bg: 'bg-emerald-50', bar: 'bg-emerald-400', text: 'text-emerald-700' },
    amber: { bg: 'bg-amber-50', bar: 'bg-amber-400', text: 'text-amber-700' },
    orange: { bg: 'bg-orange-50', bar: 'bg-orange-400', text: 'text-orange-700' },
    slate: { bg: 'bg-slate-50', bar: 'bg-slate-300', text: 'text-slate-700' },
  }
  const c = colorMap[color] || colorMap.slate

  return (
    <div className={`summary-card ${c.bg} rounded-2xl p-3.5 text-center cursor-default`}>
      <div className="flex justify-center mb-1">
        <img
          src={character}
          alt={characterAlt}
          style={{ width: 40, height: 40, objectFit: 'contain' }}
        />
      </div>
      <p className="text-[11px] font-medium text-slate-500 mb-0.5">{label}</p>
      <p className={`text-lg font-black tabular-nums ${c.text}`}>{value}</p>
      <div className="w-full h-1.5 bg-white/80 rounded-full overflow-hidden mt-2">
        <div
          className={`h-full rounded-full ${c.bar} transition-all duration-1000 ease-out`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

/* ===== Helpers ===== */

function parseBgStyle(bg: string): React.CSSProperties {
  // Extract the CSS background value from the config string
  const match = bg.match(/background:\s*(.+)/)
  if (match) {
    return { background: match[1], minHeight: '100vh', transition: 'background 0.7s ease' }
  }
  return { minHeight: '100vh' }
}

function timelineBg(type: string) {
  switch (type) {
    case 'clock_in': return 'bg-emerald-100'
    case 'clock_out': return 'bg-rose-100'
    case 'break_start': return 'bg-amber-100'
    case 'break_end': return 'bg-blue-100'
    default: return 'bg-slate-100'
  }
}

function timelineTextColor(type: string) {
  switch (type) {
    case 'clock_in': return 'text-emerald-600'
    case 'clock_out': return 'text-rose-500'
    case 'break_start': return 'text-amber-600'
    case 'break_end': return 'text-blue-600'
    default: return 'text-slate-500'
  }
}

function calcBreakMinutes(records: any[]) {
  let total = 0
  const starts = records.filter((r) => r.type === 'break_start')
  const ends = records.filter((r) => r.type === 'break_end')
  for (let i = 0; i < Math.min(starts.length, ends.length); i++) {
    total += Math.round((new Date(ends[i].timestamp).getTime() - new Date(starts[i].timestamp).getTime()) / 60000)
  }
  return total
}

function calcLiveBreakMinutes(records: any[]) {
  // Calculate break minutes including the current ongoing break
  let total = 0
  const starts = records.filter((r) => r.type === 'break_start')
  const ends = records.filter((r) => r.type === 'break_end')
  for (let i = 0; i < starts.length; i++) {
    const endTime = i < ends.length ? new Date(ends[i].timestamp) : new Date()
    total += Math.round((endTime.getTime() - new Date(starts[i].timestamp).getTime()) / 60000)
  }
  return total
}

function calcWorkMinutes(records: any[], breakMins: number) {
  const clockIn = records.find((r) => r.type === 'clock_in')
  const clockOut = records.find((r) => r.type === 'clock_out')
  if (!clockIn) return 0
  const end = clockOut ? new Date(clockOut.timestamp) : new Date()
  return Math.max(0, Math.round((end.getTime() - new Date(clockIn.timestamp).getTime()) / 60000) - breakMins)
}
