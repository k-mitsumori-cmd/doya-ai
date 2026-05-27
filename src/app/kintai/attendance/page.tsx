'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { formatMinutesJa } from '@/lib/kintai/attendance'
import { ATTENDANCE_STATUS_LABELS } from '@/lib/kintai/types'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

/** Working days in the given month (Mon-Fri count) */
function countWorkingDays(year: number, month: number): number {
  const days = new Date(year, month, 0).getDate()
  let count = 0
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

export default function AttendancePage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    fetch(`/api/kintai/attendance?month=${monthStr}`)
      .then((r) => r.json())
      .then((d) => setData(d.attendances || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [year, month])

  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12) }
    else setMonth(month - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1) }
    else setMonth(month + 1)
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

  const attendanceMap = new Map<string, any>()
  data.forEach((a) => {
    const d = new Date(a.date).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
    attendanceMap.set(d, a)
  })

  const totalWork = data.reduce((s, a) => s + (a.workMinutes || 0), 0)
  const totalOvertime = data.reduce((s, a) => s + (a.overtimeMinutes || 0), 0)
  const totalDays = data.filter((a) => a.status === 'normal').length

  const workingDaysInMonth = useMemo(() => countWorkingDays(year, month), [year, month])
  const targetMinutes = workingDaysInMonth * 8 * 60
  const workProgress = targetMinutes > 0 ? Math.min(100, Math.round((totalWork / targetMinutes) * 100)) : 0
  const dayProgress = workingDaysInMonth > 0 ? Math.min(100, Math.round((totalDays / workingDaysInMonth) * 100)) : 0
  const overtimeWarning = totalOvertime > 45 * 60

  // Current month check for "today" navigation
  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth() + 1

  const hasData = data.length > 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5 pb-20">

        {/* ===== Header with Bear Character ===== */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/kintai/characters/present_プレゼン.png"
              alt="レポートくま"
              className="w-16 h-16 object-contain bear-header-float"
            />
            <div>
              <h1 className="text-lg font-black text-slate-800">月間レポート</h1>
              <p className="text-xs text-slate-500">勤怠データの確認と修正申請</p>
            </div>
          </div>
          <div className="relative group">
            <button
              disabled
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm text-slate-400 border border-slate-200 rounded-xl cursor-not-allowed bg-slate-50/80"
            >
              <span className="material-symbols-outlined text-base">download</span>
              CSV
            </button>
            <div className="absolute right-0 top-full mt-1 px-2.5 py-1 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
              準備中
            </div>
          </div>
        </div>

        {/* ===== Month Navigation (Google Calendar style) ===== */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-lg shadow-slate-200/30 p-4 flex items-center justify-center gap-2">
          <button onClick={prevMonth} className="w-10 h-10 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors flex items-center justify-center">
            <span className="material-symbols-outlined text-slate-600">chevron_left</span>
          </button>
          <div className="text-center min-w-[160px]">
            <p className="text-2xl font-black text-slate-800">
              {year}年 <span className="text-[#7f19e6]">{month}月</span>
            </p>
          </div>
          <button onClick={nextMonth} className="w-10 h-10 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors flex items-center justify-center">
            <span className="material-symbols-outlined text-slate-600">chevron_right</span>
          </button>
          {!isCurrentMonth && (
            <button
              onClick={() => { setYear(new Date().getFullYear()); setMonth(new Date().getMonth() + 1) }}
              className="ml-2 px-3 py-1.5 text-xs font-bold text-[#7f19e6] bg-[#7f19e6]/5 hover:bg-[#7f19e6]/10 rounded-lg transition-colors"
            >
              今月
            </button>
          )}
        </div>

        {/* ===== Summary Pills with Bear Characters ===== */}
        <div className="grid grid-cols-3 gap-3">
          {/* Days pill */}
          <SummaryPillBear
            bearSrc="/kintai/characters/thumbsup_いいね.png"
            bearAlt="出勤くま"
            label="出勤日数"
            value={`${totalDays}`}
            unit={`/ ${workingDaysInMonth}日`}
            progress={dayProgress}
            barColor="bg-[#7f19e6]"
            bgColor="bg-gradient-to-br from-purple-50 to-indigo-50"
            borderColor="border-purple-200/50"
          />
          {/* Total work pill */}
          <SummaryPillBear
            bearSrc="/kintai/characters/working_作業中.png"
            bearAlt="作業くま"
            label="労働時間"
            value={formatMinutesJa(totalWork)}
            unit=""
            progress={workProgress}
            barColor="bg-blue-500"
            bgColor="bg-gradient-to-br from-blue-50 to-cyan-50"
            borderColor="border-blue-200/50"
            sub={`目標: ${formatMinutesJa(targetMinutes)}`}
          />
          {/* Overtime pill */}
          <SummaryPillBear
            bearSrc={overtimeWarning ? '/kintai/characters/surprise_驚き.png' : '/kintai/characters/focus_集中.png'}
            bearAlt={overtimeWarning ? '驚きくま' : '集中くま'}
            label="残業時間"
            value={formatMinutesJa(totalOvertime)}
            unit=""
            progress={Math.min(100, Math.round((totalOvertime / (45 * 60)) * 100))}
            barColor={overtimeWarning ? 'bg-orange-500' : 'bg-orange-400'}
            bgColor={overtimeWarning ? 'bg-gradient-to-br from-orange-50 to-red-50' : 'bg-gradient-to-br from-orange-50 to-amber-50'}
            borderColor={overtimeWarning ? 'border-orange-300/60' : 'border-orange-200/50'}
            sub="上限目安: 45時間"
            warning={overtimeWarning}
          />
        </div>

        {/* ===== Table ===== */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <img
              src="/kintai/characters/thinking_考え中.png"
              alt="読み込み中"
              className="w-20 h-20 object-contain bear-loading-float"
            />
            <div className="w-10 h-10 rounded-full border-4 border-[#7f19e6]/20 border-t-[#7f19e6] animate-spin" />
            <p className="text-sm text-slate-500 font-medium">読み込み中...</p>
          </div>
        ) : !hasData ? (
          /* Empty state with sleeping bear */
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-lg shadow-slate-200/30 p-10 flex flex-col items-center justify-center gap-4">
            <img
              src="/kintai/characters/sleep_居眠り.png"
              alt="データなし"
              className="w-24 h-24 object-contain bear-empty-float"
            />
            <p className="text-lg font-bold text-slate-400">データがありません</p>
            <p className="text-sm text-slate-400">この月の勤怠データはまだ記録されていません</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-lg shadow-slate-200/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 sticky top-0 z-10">
                    <th className="px-3 py-3.5 text-left font-bold text-slate-500 text-xs uppercase tracking-wider w-12">日</th>
                    <th className="px-3 py-3.5 text-left font-bold text-slate-500 text-xs uppercase tracking-wider w-10">曜</th>
                    <th className="px-3 py-3.5 text-center font-bold text-slate-500 text-xs uppercase tracking-wider">出勤</th>
                    <th className="px-3 py-3.5 text-center font-bold text-slate-500 text-xs uppercase tracking-wider">退勤</th>
                    <th className="px-3 py-3.5 text-center font-bold text-slate-500 text-xs uppercase tracking-wider">休憩</th>
                    <th className="px-3 py-3.5 text-center font-bold text-slate-500 text-xs uppercase tracking-wider">勤務</th>
                    <th className="px-3 py-3.5 text-center font-bold text-slate-500 text-xs uppercase tracking-wider">残業</th>
                    <th className="px-3 py-3.5 text-center font-bold text-slate-500 text-xs uppercase tracking-wider">状態</th>
                    <th className="px-3 py-3.5 text-center font-bold text-slate-500 text-xs uppercase tracking-wider w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1
                    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const d = new Date(year, month - 1, day)
                    const dow = d.getDay()
                    const isToday = dateStr === today
                    const isFuture = dateStr > today
                    const isWeekend = dow === 0 || dow === 6
                    const att = attendanceMap.get(dateStr)

                    const workHoursPct = att?.workMinutes ? Math.min(100, Math.round((att.workMinutes / 480) * 100)) : 0
                    const overtimePct = att?.overtimeMinutes && att?.workMinutes
                      ? Math.round((att.overtimeMinutes / att.workMinutes) * 100)
                      : 0

                    const dayTextColor = dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-slate-700'

                    return (
                      <tr
                        key={day}
                        className={[
                          'border-b border-slate-100/80 transition-colors hover:bg-slate-50/60',
                          isToday ? 'att-today-row' : '',
                          isWeekend && !isToday ? 'bg-slate-50/50' : '',
                          isFuture && !isWeekend ? 'opacity-40' : '',
                        ].join(' ')}
                      >
                        {/* Day number */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            {isToday && <div className="w-1 h-6 rounded-full bg-[#7f19e6]" />}
                            <span className={`font-black text-sm ${isToday ? 'text-[#7f19e6]' : dayTextColor}`}>
                              {day}
                            </span>
                          </div>
                        </td>
                        {/* Day of week */}
                        <td className={`px-3 py-3 font-bold text-xs ${isToday ? 'text-[#7f19e6]' : dayTextColor}`}>
                          {WEEKDAYS[dow]}
                        </td>
                        {/* Clock in */}
                        <td className="px-3 py-3 text-center">
                          {att?.clockIn ? (
                            <span className="font-mono font-bold text-slate-700 text-xs">
                              {new Date(att.clockIn).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })}
                            </span>
                          ) : isWeekend && !att ? (
                            <span className="text-[10px] text-slate-300 font-medium">休日</span>
                          ) : isFuture ? (
                            <span className="inline-block w-10 border-b border-dashed border-slate-200" />
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        {/* Clock out */}
                        <td className="px-3 py-3 text-center">
                          {att?.clockOut ? (
                            <span className="font-mono font-bold text-slate-700 text-xs">
                              {new Date(att.clockOut).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })}
                            </span>
                          ) : isWeekend && !att ? (
                            <span className="text-[10px] text-slate-300 font-medium">休日</span>
                          ) : isFuture ? (
                            <span className="inline-block w-10 border-b border-dashed border-slate-200" />
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        {/* Break */}
                        <td className="px-3 py-3 text-center text-xs text-slate-600">
                          {att?.breakMinutes ? (
                            <span className="font-medium">{att.breakMinutes}分</span>
                          ) : isWeekend && !att ? '' : isFuture ? '' : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        {/* Work hours with colored bar */}
                        <td className="px-3 py-3 text-center">
                          {att?.workMinutes ? (
                            <div className="flex items-center gap-2 justify-center">
                              <span className="font-mono font-bold text-slate-700 text-xs whitespace-nowrap">
                                {formatMinutesJa(att.workMinutes)}
                              </span>
                              <div className="w-14 h-2 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                {/* Normal hours portion */}
                                <div className="h-full flex">
                                  <div
                                    className="h-full bg-emerald-400 rounded-l-full"
                                    style={{ width: `${Math.min(100, workHoursPct - overtimePct)}%` }}
                                  />
                                  {overtimePct > 0 && (
                                    <div
                                      className="h-full bg-orange-400 rounded-r-full"
                                      style={{ width: `${overtimePct}%` }}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : isFuture ? '' : isWeekend && !att ? '' : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        {/* Overtime */}
                        <td className={`px-3 py-3 text-center font-mono font-bold text-xs ${att?.overtimeMinutes > 0 ? 'text-orange-600' : 'text-slate-300'}`}>
                          {att?.overtimeMinutes ? formatMinutesJa(att.overtimeMinutes) : isFuture ? '' : isWeekend && !att ? '' : '-'}
                        </td>
                        {/* Status badge */}
                        <td className="px-3 py-3 text-center">
                          {att?.status ? (
                            <StatusPill status={att.status} />
                          ) : isWeekend && !att ? (
                            <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-400">休日</span>
                          ) : null}
                        </td>
                        {/* Edit button */}
                        <td className="px-3 py-3 text-center">
                          {!isFuture && att && (
                            <Link
                              href={`/kintai/requests/new?type=clock_fix&date=${dateStr}`}
                              className="inline-flex items-center gap-0.5 px-2.5 py-1.5 text-xs font-bold text-[#7f19e6] bg-[#7f19e6]/5 hover:bg-[#7f19e6]/10 rounded-xl transition-colors"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                              修正
                            </Link>
                          )}
                          {isFuture && !isWeekend && (
                            <span className="inline-block w-full" />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Scroll hint */}
            {daysInMonth > 28 && (
              <div className="flex justify-center py-3 border-t border-slate-100">
                <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                  <span className="material-symbols-outlined text-xs">swipe_up</span>
                  スクロールして全日程を表示
                </span>
              </div>
            )}
          </div>
        )}

        {/* ===== CSS ===== */}
      </div>
    </div>
  )
}

/* ===== Summary Pill with Bear ===== */
function SummaryPillBear({ bearSrc, bearAlt, label, value, unit, progress, barColor, bgColor, borderColor, sub, warning }: {
  bearSrc: string; bearAlt: string; label: string; value: string; unit: string; progress: number; barColor: string; bgColor: string; borderColor: string; sub?: string; warning?: boolean
}) {
  return (
    <div className={`${bgColor} rounded-2xl border ${borderColor} p-4 space-y-2 summary-pill-card`}>
      <div className="flex items-center gap-2">
        <img
          src={bearSrc}
          alt={bearAlt}
          className="w-10 h-10 object-contain summary-pill-bear"
        />
        <p className="text-[11px] font-bold text-slate-500">{label}</p>
        {warning && (
          <span className="ml-auto text-[10px] font-black text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded-full">注意</span>
        )}
      </div>
      <p className="text-xl font-black text-slate-800">
        {value}
        {unit && <span className="text-xs font-bold text-slate-400 ml-1">{unit}</span>}
      </p>
      <div className="w-full h-2 bg-white/80 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-700 ease-out`}
          style={{ width: `${progress}%` }}
        />
      </div>
      {sub && <p className="text-[10px] text-slate-400 font-medium">{sub}</p>}
    </div>
  )
}

/* ===== Status Pill Badge ===== */
function StatusPill({ status }: { status: string }) {
  const config: Record<string, { bg: string; textColor: string; icon: string }> = {
    normal: { bg: 'bg-emerald-100', textColor: 'text-emerald-700', icon: 'check_circle' },
    absent: { bg: 'bg-red-100', textColor: 'text-red-700', icon: 'cancel' },
    holiday: { bg: 'bg-slate-100', textColor: 'text-slate-500', icon: 'event_busy' },
    paid_leave: { bg: 'bg-blue-100', textColor: 'text-blue-700', icon: 'beach_access' },
    special_leave: { bg: 'bg-purple-100', textColor: 'text-purple-700', icon: 'auto_awesome' },
  }
  const c = config[status] || { bg: 'bg-slate-100', textColor: 'text-slate-600', icon: 'help' }

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] px-2.5 py-1 rounded-full font-bold ${c.bg} ${c.textColor}`}>
      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{c.icon}</span>
      {ATTENDANCE_STATUS_LABELS[status] || status}
    </span>
  )
}
