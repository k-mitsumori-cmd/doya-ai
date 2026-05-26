'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatMinutesJa } from '@/lib/kintai/attendance'
import { REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS } from '@/lib/kintai/types'

// Standard 8-hour workday
const STANDARD_WORK_MINUTES = 480

export default function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())
  const router = useRouter()

  useEffect(() => {
    fetch('/api/kintai/dashboard')
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-4 border-[#7f19e6]/20 border-t-[#7f19e6] animate-spin" />
      </div>
    )
  }

  const { employee, clockStatus, todayAttendance, monthlySummary, recentRequests } = data || {}

  const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const hour = jstNow.getHours()
  const greeting = hour < 6 ? 'お疲れさまです' : hour < 12 ? 'おはようございます' : hour < 18 ? 'お疲れさまです' : 'お疲れさまです'

  const timeStr = now.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false })
  const dateStr = now.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  // Compute real-time working duration for 'working' status
  const liveWorkMinutes = useMemo(() => {
    if (clockStatus !== 'working' || !todayAttendance?.clockIn) return todayAttendance?.workMinutes || 0
    const clockIn = new Date(todayAttendance.clockIn).getTime()
    const elapsed = Math.round((now.getTime() - clockIn) / 60000)
    const breakMins = todayAttendance.breakMinutes || 0
    return Math.max(0, elapsed - breakMins)
  }, [clockStatus, todayAttendance, now])

  const liveHours = Math.floor(liveWorkMinutes / 60)
  const liveMins = liveWorkMinutes % 60

  // Clock-in and clock-out times for timeline visualization
  const clockInTime = todayAttendance?.clockIn ? new Date(todayAttendance.clockIn) : null
  const clockOutTime = todayAttendance?.clockOut ? new Date(todayAttendance.clockOut) : null

  // Hero status config
  const heroConfig = getHeroConfig(clockStatus, liveHours, liveMins, todayAttendance?.workMinutes || 0)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5 pb-20">

        {/* ===== Hero Status Card (Google "At a Glance" style) ===== */}
        <div className={`rounded-3xl ${heroConfig.bg} border ${heroConfig.border} p-6 shadow-lg ${heroConfig.shadow} relative overflow-hidden`}>
          {/* Decorative background shapes */}
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/10 translate-y-1/2 -translate-x-1/4" />

          <div className="relative z-10">
            {/* Date & Time */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className={`text-sm font-medium ${heroConfig.subText}`}>{dateStr}</p>
                <h1 className={`text-2xl font-black ${heroConfig.headText} mt-1`}>
                  {greeting}、{employee?.name || 'ゲスト'}さん
                </h1>
              </div>
              <div className={`text-right px-3 py-1.5 rounded-2xl ${heroConfig.timeBg}`}>
                <p className={`text-2xl font-mono font-black tabular-nums ${heroConfig.timeText}`}>{timeStr}</p>
              </div>
            </div>

            {/* Status + Action */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <span className="text-3xl">{heroConfig.emoji}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`text-lg font-black ${heroConfig.headText}`}>{heroConfig.statusText}</p>
                    {(clockStatus === 'working' || clockStatus === 'on_break') && (
                      <div className={`w-2.5 h-2.5 rounded-full ${heroConfig.pulseColor} dash-live-pulse`} />
                    )}
                  </div>
                  <p className={`text-sm ${heroConfig.subText} mt-0.5`}>{heroConfig.statusSub}</p>
                </div>
              </div>
              <button
                onClick={() => router.push(clockStatus === 'clocked_out' ? '/kintai/attendance' : '/kintai/clock')}
                className={`px-5 py-3 rounded-2xl ${heroConfig.btnBg} text-white font-bold text-sm hover:shadow-xl active:scale-[0.97] transition-all flex items-center gap-2 flex-shrink-0 shadow-lg`}
              >
                <span className="material-symbols-outlined text-xl">{heroConfig.btnIcon}</span>
                {heroConfig.btnLabel}
              </button>
            </div>

            {/* Progress bar when working */}
            {clockStatus === 'working' && (
              <div className="mt-4">
                <div className="w-full h-2.5 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-white/80 transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min(100, Math.round(liveWorkMinutes / STANDARD_WORK_MINUTES * 100))}%` }}
                  />
                </div>
                <p className={`text-xs font-bold ${heroConfig.subText} mt-1.5 tabular-nums`}>
                  {liveHours}h {liveMins}m / 8h ({Math.min(100, Math.round(liveWorkMinutes / STANDARD_WORK_MINUTES * 100))}%)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ===== Quick Actions (Google-style icon shortcuts) ===== */}
        <div className="grid grid-cols-3 gap-3">
          <QuickAction
            href="/kintai/clock"
            icon="fingerprint"
            label="打刻"
            gradient="from-[#7f19e6] to-[#6311c4]"
            iconBg="bg-white/20"
            textColor="text-white"
          />
          <QuickAction
            href="/kintai/requests/new"
            icon="edit_note"
            label="申請"
            gradient="from-blue-500 to-blue-600"
            iconBg="bg-white/20"
            textColor="text-white"
          />
          <QuickAction
            href="/kintai/attendance"
            icon="calendar_month"
            label="勤怠確認"
            gradient="from-emerald-500 to-green-600"
            iconBg="bg-white/20"
            textColor="text-white"
          />
        </div>

        {/* ===== Today's Attendance Card ===== */}
        {todayAttendance && (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-lg shadow-slate-200/30 p-5">
            <h2 className="text-sm font-bold text-slate-600 mb-4 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#7f19e6]/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#7f19e6] text-base">today</span>
              </div>
              今日の勤怠
            </h2>

            {/* Visual timeline bar (8:00 - 20:00) */}
            <DayTimelineBar clockIn={clockInTime} clockOut={clockOutTime} isWorking={clockStatus === 'working'} now={now} />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <StatChip
                icon="login"
                label="出勤"
                value={todayAttendance.clockIn ? new Date(todayAttendance.clockIn).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '-'}
                color="emerald"
              />
              <StatChip
                icon="logout"
                label="退勤"
                value={todayAttendance.clockOut ? new Date(todayAttendance.clockOut).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '-'}
                color="rose"
              />
              <StatChip
                icon="schedule"
                label="勤務時間"
                value={clockStatus === 'working' ? `${liveHours}h ${liveMins}m` : formatMinutesJa(todayAttendance.workMinutes)}
                color="blue"
              />
              <StatChip
                icon="more_time"
                label="残業"
                value={formatMinutesJa(todayAttendance.overtimeMinutes)}
                color={todayAttendance.overtimeMinutes > 0 ? 'orange' : 'slate'}
              />
            </div>
          </div>
        )}

        {/* ===== Monthly Summary (2x2 colorful grid) ===== */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-lg shadow-slate-200/30 p-5">
          <h2 className="text-sm font-bold text-slate-600 mb-4 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#7f19e6]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#7f19e6] text-base">analytics</span>
            </div>
            今月の実績
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <MonthlyStat
              emoji="📅"
              icon="calendar_month"
              label="出勤日数"
              value={`${monthlySummary?.totalWorkDays || 0}`}
              unit="日"
              sub="今月の出勤"
              color="blue"
            />
            <MonthlyStat
              emoji="⏱️"
              icon="schedule"
              label="労働時間"
              value={formatMinutesJa(monthlySummary?.totalWorkMinutes || 0)}
              unit=""
              sub={monthlySummary?.totalWorkDays ? `1日平均 ${formatMinutesJa(Math.round((monthlySummary?.totalWorkMinutes || 0) / monthlySummary.totalWorkDays))}` : '-'}
              color="emerald"
            />
            <MonthlyStat
              emoji="🔥"
              icon="more_time"
              label="残業時間"
              value={formatMinutesJa(monthlySummary?.totalOvertimeMinutes || 0)}
              unit=""
              sub={monthlySummary?.totalOvertimeMinutes > 0 ? '所定外労働' : '残業なし'}
              color={monthlySummary?.totalOvertimeMinutes > 0 ? 'orange' : 'slate'}
            />
            <MonthlyStat
              emoji={monthlySummary?.totalLateCount > 0 ? '⚠️' : '✅'}
              icon="warning"
              label="遅刻回数"
              value={`${monthlySummary?.totalLateCount || 0}`}
              unit="回"
              sub={monthlySummary?.totalLateCount === 0 ? 'パーフェクト！' : '改善しましょう'}
              color={monthlySummary?.totalLateCount > 0 ? 'red' : 'emerald'}
            />
          </div>
        </div>

        {/* ===== Recent Requests (Activity Feed) ===== */}
        {recentRequests?.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-lg shadow-slate-200/30 p-5">
            <h2 className="text-sm font-bold text-slate-600 mb-4 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#7f19e6]/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#7f19e6] text-base">description</span>
              </div>
              最近の申請
            </h2>
            <div className="space-y-1">
              {recentRequests.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between py-3 px-3 rounded-2xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <RequestAvatar status={r.status} />
                    <div>
                      <span className="text-sm font-bold text-slate-700">
                        {REQUEST_TYPE_LABELS[r.type] || r.type}
                      </span>
                      {r.targetDate && (
                        <span className="text-xs text-slate-400 ml-2">
                          対象: {new Date(r.targetDate).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      <p className="text-xs text-slate-400 mt-0.5">
                        申請日: {new Date(r.submittedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <RequestPill status={r.status} />
                </div>
              ))}
            </div>
            <Link href="/kintai/requests" className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#7f19e6] hover:text-[#6311c4] transition-colors">
              すべての申請を見る
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
        )}

        {/* ===== Helpful tip ===== */}
        <div className="bg-gradient-to-r from-[#7f19e6]/5 to-blue-500/5 rounded-3xl border border-[#7f19e6]/10 p-5 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#7f19e6]/10 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[#7f19e6] text-lg">lightbulb</span>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-700">ヒント</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              出退勤の打刻は「打刻」ボタンまたはサイドメニューの「打刻」から行えます。打刻の修正や休暇申請は「申請」から行ってください。
            </p>
          </div>
        </div>

        <style jsx>{`
          @keyframes livePulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.4); opacity: 0.6; }
          }
          .dash-live-pulse {
            animation: livePulse 1.5s ease-in-out infinite;
          }
        `}</style>
      </div>
    </div>
  )
}

/* ===== Hero Config ===== */
function getHeroConfig(clockStatus: string, liveHours: number, liveMins: number, workMinutes: number) {
  const configs: Record<string, any> = {
    not_clocked_in: {
      bg: 'bg-gradient-to-br from-amber-100 via-orange-50 to-yellow-50',
      border: 'border-amber-200/50',
      shadow: 'shadow-amber-200/20',
      headText: 'text-amber-900',
      subText: 'text-amber-700/70',
      timeText: 'text-amber-700',
      timeBg: 'bg-white/50',
      emoji: '☀️',
      statusText: 'まだ出勤していません',
      statusSub: '打刻画面から出勤してください',
      pulseColor: '',
      btnBg: 'bg-gradient-to-r from-emerald-500 to-green-600',
      btnIcon: 'wb_sunny',
      btnLabel: '出勤する',
    },
    working: {
      bg: 'bg-gradient-to-br from-emerald-100 via-green-50 to-teal-50',
      border: 'border-emerald-200/50',
      shadow: 'shadow-emerald-200/20',
      headText: 'text-emerald-900',
      subText: 'text-emerald-700/70',
      timeText: 'text-emerald-700',
      timeBg: 'bg-white/50',
      emoji: '💼',
      statusText: `勤務中 — ${liveHours}時間${liveMins}分経過`,
      statusSub: 'リアルタイムで更新中',
      pulseColor: 'bg-emerald-500',
      btnBg: 'bg-gradient-to-r from-[#7f19e6] to-[#5b0fb3]',
      btnIcon: 'fingerprint',
      btnLabel: '打刻画面へ',
    },
    on_break: {
      bg: 'bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-50',
      border: 'border-amber-200/50',
      shadow: 'shadow-amber-200/20',
      headText: 'text-amber-900',
      subText: 'text-amber-700/70',
      timeText: 'text-amber-700',
      timeBg: 'bg-white/50',
      emoji: '☕',
      statusText: '休憩中',
      statusSub: 'ゆっくり休んでリフレッシュ！',
      pulseColor: 'bg-amber-500',
      btnBg: 'bg-gradient-to-r from-amber-500 to-orange-600',
      btnIcon: 'fingerprint',
      btnLabel: '打刻画面へ',
    },
    clocked_out: {
      bg: 'bg-gradient-to-br from-blue-100 via-indigo-50 to-purple-50',
      border: 'border-blue-200/50',
      shadow: 'shadow-blue-200/20',
      headText: 'text-blue-900',
      subText: 'text-blue-700/70',
      timeText: 'text-blue-700',
      timeBg: 'bg-white/50',
      emoji: '🌙',
      statusText: 'お疲れさまでした！',
      statusSub: `本日の勤務時間: ${formatMinutesJa(workMinutes)}`,
      pulseColor: '',
      btnBg: 'bg-gradient-to-r from-blue-500 to-indigo-600',
      btnIcon: 'calendar_month',
      btnLabel: '勤怠を確認',
    },
  }
  return configs[clockStatus] || configs.not_clocked_in
}

/* ===== Day Timeline Bar ===== */
function DayTimelineBar({ clockIn, clockOut, isWorking, now }: { clockIn: Date | null; clockOut: Date | null; isWorking: boolean; now: Date }) {
  const START_HOUR = 8
  const END_HOUR = 20
  const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60

  const toPercent = (date: Date) => {
    const h = date.getHours()
    const m = date.getMinutes()
    const mins = (h - START_HOUR) * 60 + m
    return Math.max(0, Math.min(100, (mins / TOTAL_MINUTES) * 100))
  }

  const startPct = clockIn ? toPercent(new Date(clockIn)) : 0
  const endPct = clockOut ? toPercent(new Date(clockOut)) : isWorking ? toPercent(now) : startPct

  const hours = []
  for (let h = START_HOUR; h <= END_HOUR; h += 2) {
    hours.push(h)
  }

  return (
    <div className="relative">
      <div className="flex justify-between text-[10px] font-medium text-slate-400 mb-1.5">
        {hours.map((h) => (
          <span key={h}>{h}:00</span>
        ))}
      </div>
      <div className="relative w-full h-5 bg-slate-100 rounded-full overflow-hidden">
        {clockIn && (
          <div
            className={`absolute top-0 h-full rounded-full ${isWorking ? 'bg-gradient-to-r from-emerald-400 to-green-500' : 'bg-gradient-to-r from-[#7f19e6] to-[#9b4dff]'}`}
            style={{ left: `${startPct}%`, width: `${Math.max(1, endPct - startPct)}%` }}
          />
        )}
      </div>
    </div>
  )
}

/* ===== Quick Action ===== */
function QuickAction({ href, icon, label, gradient, iconBg, textColor }: {
  href: string; icon: string; label: string; gradient: string; iconBg: string; textColor: string
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-gradient-to-br ${gradient} ${textColor} font-bold text-sm shadow-lg hover:shadow-xl active:scale-[0.97] transition-all`}
    >
      <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center`}>
        <span className="material-symbols-outlined text-2xl">{icon}</span>
      </div>
      {label}
    </Link>
  )
}

/* ===== Stat Chip ===== */
function StatChip({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  const colorMap: Record<string, { bg: string; iconBg: string; iconColor: string; valueColor: string }> = {
    emerald: { bg: 'bg-emerald-50', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', valueColor: 'text-emerald-700' },
    rose: { bg: 'bg-rose-50', iconBg: 'bg-rose-100', iconColor: 'text-rose-600', valueColor: 'text-rose-700' },
    blue: { bg: 'bg-blue-50', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', valueColor: 'text-blue-700' },
    orange: { bg: 'bg-orange-50', iconBg: 'bg-orange-100', iconColor: 'text-orange-600', valueColor: 'text-orange-700' },
    slate: { bg: 'bg-slate-50', iconBg: 'bg-slate-100', iconColor: 'text-slate-400', valueColor: 'text-slate-600' },
  }
  const c = colorMap[color] || colorMap.slate

  return (
    <div className={`${c.bg} rounded-2xl p-3 text-center`}>
      <div className={`w-8 h-8 rounded-lg ${c.iconBg} flex items-center justify-center mx-auto mb-1.5`}>
        <span className={`material-symbols-outlined text-base ${c.iconColor}`}>{icon}</span>
      </div>
      <p className="text-[11px] font-medium text-slate-500 mb-0.5">{label}</p>
      <p className={`text-lg font-black tabular-nums ${c.valueColor}`}>{value}</p>
    </div>
  )
}

/* ===== Monthly Stat Card ===== */
function MonthlyStat({ emoji, icon, label, value, unit, sub, color }: {
  emoji: string; icon: string; label: string; value: string; unit: string; sub: string; color: string
}) {
  const colorMap: Record<string, { bg: string; accent: string; valueColor: string }> = {
    blue: { bg: 'bg-blue-50', accent: 'text-blue-600', valueColor: 'text-blue-700' },
    emerald: { bg: 'bg-emerald-50', accent: 'text-emerald-600', valueColor: 'text-emerald-700' },
    orange: { bg: 'bg-orange-50', accent: 'text-orange-600', valueColor: 'text-orange-700' },
    red: { bg: 'bg-red-50', accent: 'text-red-600', valueColor: 'text-red-700' },
    slate: { bg: 'bg-slate-50', accent: 'text-slate-500', valueColor: 'text-slate-700' },
  }
  const c = colorMap[color] || colorMap.slate

  return (
    <div className={`${c.bg} rounded-2xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{emoji}</span>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className={`text-2xl font-black tabular-nums ${c.valueColor}`}>
        {value}<span className="text-base font-bold ml-0.5">{unit}</span>
      </p>
      <p className="text-[11px] text-slate-400 mt-1">{sub}</p>
    </div>
  )
}

/* ===== Request Avatar ===== */
function RequestAvatar({ status }: { status: string }) {
  const map: Record<string, { icon: string; bg: string; color: string }> = {
    pending: { icon: 'hourglass_top', bg: 'bg-amber-100', color: 'text-amber-600' },
    approved: { icon: 'check_circle', bg: 'bg-emerald-100', color: 'text-emerald-600' },
    rejected: { icon: 'cancel', bg: 'bg-red-100', color: 'text-red-600' },
    withdrawn: { icon: 'undo', bg: 'bg-slate-100', color: 'text-slate-400' },
  }
  const s = map[status] || map.pending
  return (
    <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
      <span className={`material-symbols-outlined text-lg ${s.color}`}>{s.icon}</span>
    </div>
  )
}

/* ===== Request Pill ===== */
function RequestPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
    withdrawn: 'bg-slate-100 text-slate-500 border-slate-200',
  }
  return (
    <span className={`text-xs px-3 py-1.5 rounded-full font-bold border ${colors[status] || 'bg-slate-100 border-slate-200'}`}>
      {REQUEST_STATUS_LABELS[status] || status}
    </span>
  )
}
