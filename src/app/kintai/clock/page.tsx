'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { CLOCK_TYPE_LABELS } from '@/lib/kintai/types'
import { formatMinutesJa } from '@/lib/kintai/attendance'

type ClockStatus = 'not_clocked_in' | 'working' | 'on_break' | 'clocked_out'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

// 8時間 = 480分を基準とした勤務進捗
const STANDARD_WORK_MINUTES = 480

export default function ClockPage() {
  const [now, setNow] = useState(new Date())
  const [status, setStatus] = useState<ClockStatus>('not_clocked_in')
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [confirmClockOut, setConfirmClockOut] = useState(false)
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
      // Show animated success indicator
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
  const greeting = hour < 12 ? 'おはようございます' : hour < 18 ? 'お疲れさまです' : 'お疲れさまです'

  // Real-time working duration
  const liveWorkMinutes = status === 'working' ? calcWorkMinutes(records, breakMinutes) : workMinutes
  const liveHours = Math.floor(liveWorkMinutes / 60)
  const liveMins = liveWorkMinutes % 60

  // Progress percentage for the 8-hour workday
  const progressPercent = Math.min(100, Math.round((workMinutes / STANDARD_WORK_MINUTES) * 100))

  // Status-based theme configuration
  const theme = {
    not_clocked_in: {
      bg: 'bg-gradient-to-b from-amber-50 via-orange-50/40 to-white',
      statusIcon: '☀️',
      statusText: 'まだ出勤していません',
      statusSub: 'ボタンを押して勤務を始めましょう',
      cardBg: 'bg-gradient-to-br from-amber-50 to-orange-50',
      cardBorder: 'border-amber-200/60',
      accentColor: 'text-amber-600',
    },
    working: {
      bg: 'bg-gradient-to-b from-emerald-50 via-green-50/40 to-white',
      statusIcon: '💼',
      statusText: `勤務中 — ${liveHours}時間${liveMins}分経過`,
      statusSub: '集中して頑張りましょう！',
      cardBg: 'bg-gradient-to-br from-emerald-50 to-green-50',
      cardBorder: 'border-emerald-200/60',
      accentColor: 'text-emerald-600',
    },
    on_break: {
      bg: 'bg-gradient-to-b from-amber-50 via-yellow-50/40 to-white',
      statusIcon: '☕',
      statusText: '休憩中',
      statusSub: 'ゆっくり休んでリフレッシュ！',
      cardBg: 'bg-gradient-to-br from-amber-50 to-yellow-50',
      cardBorder: 'border-amber-200/60',
      accentColor: 'text-amber-600',
    },
    clocked_out: {
      bg: 'bg-gradient-to-b from-blue-50 via-indigo-50/40 to-white',
      statusIcon: '🌙',
      statusText: 'お疲れさまでした！',
      statusSub: `本日の勤務時間: ${formatMinutesJa(workMinutes)}`,
      cardBg: 'bg-gradient-to-br from-blue-50 to-indigo-50',
      cardBorder: 'border-blue-200/60',
      accentColor: 'text-blue-600',
    },
  }[status]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-4 border-[#7f19e6]/20 border-t-[#7f19e6] animate-spin" />
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${theme.bg} transition-colors duration-700`}>
      <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5 pb-20">

        {/* ===== Success Animation Overlay ===== */}
        {showSuccess && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="clock-success-overlay">
              <div className="clock-success-check">
                <span className="material-symbols-outlined text-white" style={{ fontSize: 48 }}>check</span>
              </div>
              {/* Confetti particles */}
              {[...Array(12)].map((_, i) => (
                <div key={i} className={`clock-confetti clock-confetti-${i}`} />
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
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              message.type === 'success' ? 'bg-emerald-100' : 'bg-red-100'
            }`}>
              <span className="material-symbols-outlined text-lg">
                {message.type === 'success' ? 'check_circle' : 'error'}
              </span>
            </div>
            {message.text}
          </div>
        )}

        {/* ===== Greeting ===== */}
        <div className="text-center pt-3 pb-1">
          <p className="text-base font-bold text-slate-500 tracking-wide">{greeting}</p>
        </div>

        {/* ===== Clock Display ===== */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white shadow-xl shadow-slate-200/50 p-6 sm:p-8 text-center">
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
        <div className={`${theme.cardBg} rounded-3xl border ${theme.cardBorder} p-5 flex items-center gap-4`}>
          <span className="text-4xl flex-shrink-0">{theme.statusIcon}</span>
          <div className="flex-1 min-w-0">
            <p className={`text-lg font-black ${theme.accentColor}`}>{theme.statusText}</p>
            <p className="text-sm text-slate-500 mt-0.5">{theme.statusSub}</p>
            {status === 'working' && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-2 bg-white/80 rounded-full overflow-hidden">
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
              disabled={acting}
              className="clock-action-btn w-full rounded-3xl bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-500/40 active:scale-[0.97] transition-all disabled:opacity-50 p-5 flex items-center gap-4"
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
                className="clock-action-btn w-full rounded-3xl bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-xl shadow-rose-500/25 hover:shadow-2xl hover:shadow-rose-500/40 active:scale-[0.97] transition-all disabled:opacity-50 p-5 flex items-center gap-4"
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
                className="clock-action-btn w-full rounded-3xl bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-lg shadow-amber-400/20 hover:shadow-xl hover:shadow-amber-400/30 active:scale-[0.97] transition-all disabled:opacity-50 p-4 flex items-center gap-4"
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

          {/* ===== Clock Out Confirmation Overlay ===== */}
          {status === 'working' && confirmClockOut && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 clock-fade-in"
                onClick={handleClockOutCancel}
              />
              {/* Dialog */}
              <div className="fixed inset-x-4 bottom-8 z-50 max-w-lg mx-auto clock-slide-up">
                <div className="bg-white rounded-3xl shadow-2xl p-6 space-y-5">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-3">
                      <span className="material-symbols-outlined text-rose-500" style={{ fontSize: 36 }}>logout</span>
                    </div>
                    <p className="text-xl font-black text-slate-800">退勤しますか？</p>
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
              className="clock-action-btn w-full rounded-3xl bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-xl shadow-amber-400/25 hover:shadow-2xl hover:shadow-amber-400/40 active:scale-[0.97] transition-all disabled:opacity-50 p-5 flex items-center gap-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-white" style={{ fontSize: 32 }}>resume</span>
              </div>
              <div className="flex-1 text-left">
                <p className="text-xl font-black leading-tight">業務に戻る</p>
                <p className="text-sm font-medium text-white/80 mt-0.5">休憩を終了して再開</p>
              </div>
              <span className="material-symbols-outlined text-white/60 text-3xl flex-shrink-0">arrow_forward</span>
            </button>
          )}

          {status === 'clocked_out' && (
            <div className="w-full rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200/60 p-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-blue-600" style={{ fontSize: 32 }}>celebration</span>
              </div>
              <div className="flex-1 text-left">
                <p className="text-lg font-black text-blue-700 leading-tight">本日の勤務は終了しました</p>
                <p className="text-sm font-medium text-blue-500/80 mt-0.5">ゆっくり休んでくださいね</p>
              </div>
            </div>
          )}
        </div>

        {/* ===== Summary Cards (3 cards in a row) ===== */}
        <div className="grid grid-cols-3 gap-3">
          <SummaryMiniCard
            icon="schedule"
            label="勤務時間"
            value={formatMinutesJa(workMinutes)}
            color="emerald"
            progress={progressPercent}
          />
          <SummaryMiniCard
            icon="coffee"
            label="休憩時間"
            value={formatMinutesJa(breakMinutes)}
            color="amber"
            progress={breakMinutes > 0 ? Math.min(100, Math.round((breakMinutes / 60) * 100)) : 0}
          />
          <SummaryMiniCard
            icon="more_time"
            label="残業"
            value={formatMinutesJa(Math.max(0, workMinutes - STANDARD_WORK_MINUTES))}
            color={workMinutes > STANDARD_WORK_MINUTES ? 'orange' : 'slate'}
            progress={workMinutes > STANDARD_WORK_MINUTES ? Math.min(100, Math.round(((workMinutes - STANDARD_WORK_MINUTES) / 120) * 100)) : 0}
          />
        </div>

        {/* ===== Timeline ===== */}
        {records.length > 0 && (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white shadow-lg shadow-slate-200/30 p-5">
            <h2 className="text-sm font-bold text-slate-600 mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#7f19e6] text-lg">timeline</span>
              今日のタイムライン
            </h2>
            <div className="relative">
              {/* Horizontal timeline dots */}
              <div className="flex items-center gap-0 overflow-x-auto pb-2">
                {records.map((r: any, i: number) => (
                  <div key={r.id} className="flex items-center">
                    <div className="flex flex-col items-center">
                      {/* Dot */}
                      <div className={`w-10 h-10 rounded-2xl ${timelineBg(r.type)} flex items-center justify-center shadow-sm`}>
                        <span className={`material-symbols-outlined text-lg ${timelineIconColor(r.type)}`}>
                          {typeIcon(r.type)}
                        </span>
                      </div>
                      {/* Time label */}
                      <p className="text-[11px] font-mono font-bold text-slate-500 mt-2 tabular-nums">
                        {new Date(r.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {/* Type label */}
                      <p className={`text-[10px] font-bold mt-0.5 ${timelineTextColor(r.type)}`}>
                        {CLOCK_TYPE_LABELS[r.type] || r.type}
                      </p>
                    </div>
                    {/* Connector line */}
                    {i < records.length - 1 && (
                      <div className="w-8 sm:w-12 h-0.5 bg-slate-200 mx-1 mt-[-28px]" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== CSS Animations ===== */}
        <style jsx>{`
          @keyframes successPop {
            0% { transform: scale(0); opacity: 0; }
            30% { transform: scale(1.3); opacity: 1; }
            50% { transform: scale(0.95); }
            65% { transform: scale(1.05); }
            80% { transform: scale(1); opacity: 1; }
            100% { transform: scale(1); opacity: 0; }
          }
          .clock-success-overlay {
            position: relative;
            width: 120px;
            height: 120px;
          }
          .clock-success-check {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: linear-gradient(135deg, #10b981, #059669);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 20px 60px rgba(16, 185, 129, 0.5);
            animation: successPop 2.8s ease-out forwards;
          }
          @keyframes confettiBurst {
            0% { transform: translate(0, 0) scale(1); opacity: 1; }
            100% { opacity: 0; }
          }
          .clock-confetti {
            position: absolute;
            width: 8px;
            height: 8px;
            border-radius: 2px;
            animation: confettiBurst 1.5s ease-out forwards;
          }
          .clock-confetti-0 { background: #f59e0b; top: 50%; left: 50%; animation-delay: 0.1s; transform: translate(-80px, -80px); }
          .clock-confetti-1 { background: #ef4444; top: 50%; left: 50%; animation-delay: 0.15s; transform: translate(70px, -70px); }
          .clock-confetti-2 { background: #3b82f6; top: 50%; left: 50%; animation-delay: 0.2s; transform: translate(-60px, 60px); }
          .clock-confetti-3 { background: #8b5cf6; top: 50%; left: 50%; animation-delay: 0.25s; transform: translate(80px, 50px); }
          .clock-confetti-4 { background: #10b981; top: 50%; left: 50%; animation-delay: 0.1s; transform: translate(-40px, -90px); }
          .clock-confetti-5 { background: #f97316; top: 50%; left: 50%; animation-delay: 0.2s; transform: translate(50px, -90px); }
          .clock-confetti-6 { background: #ec4899; top: 50%; left: 50%; animation-delay: 0.15s; transform: translate(-90px, 20px); }
          .clock-confetti-7 { background: #14b8a6; top: 50%; left: 50%; animation-delay: 0.25s; transform: translate(90px, -10px); }
          .clock-confetti-8 { background: #f59e0b; top: 50%; left: 50%; animation-delay: 0.3s; transform: translate(-20px, 80px); width: 6px; height: 6px; border-radius: 50%; }
          .clock-confetti-9 { background: #ef4444; top: 50%; left: 50%; animation-delay: 0.2s; transform: translate(30px, 85px); width: 6px; height: 6px; border-radius: 50%; }
          .clock-confetti-10 { background: #7f19e6; top: 50%; left: 50%; animation-delay: 0.15s; transform: translate(-70px, -30px); width: 6px; height: 6px; border-radius: 50%; }
          .clock-confetti-11 { background: #06b6d4; top: 50%; left: 50%; animation-delay: 0.25s; transform: translate(65px, 30px); width: 6px; height: 6px; border-radius: 50%; }

          @keyframes toastSlide {
            0% { transform: translateY(-12px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
          .clock-toast {
            animation: toastSlide 0.35s cubic-bezier(0.21, 1.02, 0.73, 1);
          }

          @keyframes fadeIn {
            0% { opacity: 0; }
            100% { opacity: 1; }
          }
          .clock-fade-in {
            animation: fadeIn 0.2s ease-out;
          }

          @keyframes slideUp {
            0% { transform: translateY(100%); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
          .clock-slide-up {
            animation: slideUp 0.35s cubic-bezier(0.21, 1.02, 0.73, 1);
          }

          @keyframes progressPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
          .clock-progress-pulse {
            animation: progressPulse 2s ease-in-out infinite;
          }

          @keyframes livePulse {
            0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 currentColor; }
            50% { transform: scale(1.3); opacity: 0.8; box-shadow: 0 0 0 6px transparent; }
          }
          .clock-live-pulse {
            animation: livePulse 1.5s ease-in-out infinite;
          }
        `}</style>
      </div>
    </div>
  )
}

/* ===== Summary Mini Card ===== */
function SummaryMiniCard({ icon, label, value, color, progress }: {
  icon: string; label: string; value: string; color: string; progress: number
}) {
  const colorMap: Record<string, { bg: string; bar: string; text: string; iconColor: string }> = {
    emerald: { bg: 'bg-emerald-50', bar: 'bg-emerald-400', text: 'text-emerald-700', iconColor: 'text-emerald-500' },
    amber: { bg: 'bg-amber-50', bar: 'bg-amber-400', text: 'text-amber-700', iconColor: 'text-amber-500' },
    orange: { bg: 'bg-orange-50', bar: 'bg-orange-400', text: 'text-orange-700', iconColor: 'text-orange-500' },
    slate: { bg: 'bg-slate-50', bar: 'bg-slate-300', text: 'text-slate-700', iconColor: 'text-slate-400' },
  }
  const c = colorMap[color] || colorMap.slate

  return (
    <div className={`${c.bg} rounded-2xl p-3.5 text-center`}>
      <div className="flex items-center justify-center gap-1 mb-1.5">
        <span className={`material-symbols-outlined text-sm ${c.iconColor}`}>{icon}</span>
        <p className="text-[11px] font-medium text-slate-500">{label}</p>
      </div>
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

/* ===== Timeline helpers ===== */
function timelineBg(type: string) {
  switch (type) {
    case 'clock_in': return 'bg-emerald-100'
    case 'clock_out': return 'bg-rose-100'
    case 'break_start': return 'bg-amber-100'
    case 'break_end': return 'bg-blue-100'
    default: return 'bg-slate-100'
  }
}

function timelineIconColor(type: string) {
  switch (type) {
    case 'clock_in': return 'text-emerald-600'
    case 'clock_out': return 'text-rose-600'
    case 'break_start': return 'text-amber-600'
    case 'break_end': return 'text-blue-600'
    default: return 'text-slate-500'
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

function typeIcon(type: string) {
  switch (type) {
    case 'clock_in': return 'login'
    case 'clock_out': return 'logout'
    case 'break_start': return 'coffee'
    case 'break_end': return 'resume'
    default: return 'schedule'
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

function calcWorkMinutes(records: any[], breakMins: number) {
  const clockIn = records.find((r) => r.type === 'clock_in')
  const clockOut = records.find((r) => r.type === 'clock_out')
  if (!clockIn) return 0
  const end = clockOut ? new Date(clockOut.timestamp) : new Date()
  return Math.max(0, Math.round((end.getTime() - new Date(clockIn.timestamp).getTime()) / 60000) - breakMins)
}
