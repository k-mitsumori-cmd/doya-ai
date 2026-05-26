'use client'

import { useEffect, useState, useMemo } from 'react'
import { formatMinutesJa } from '@/lib/kintai/attendance'
import { ATTENDANCE_STATUS_LABELS } from '@/lib/kintai/types'

function getStatusInfo(att: any): { label: string; color: string; bgColor: string; circleColor: string } {
  if (!att?.clockIn) return { label: '未出勤', color: 'text-red-600', bgColor: 'bg-red-100', circleColor: '#ef4444' }
  if (att.clockOut) return { label: '退勤済', color: 'text-blue-600', bgColor: 'bg-blue-100', circleColor: '#2563eb' }
  return { label: '出勤中', color: 'text-green-600', bgColor: 'bg-green-100', circleColor: '#16a34a' }
}

export default function AdminAttendancePage() {
  const [date, setDate] = useState(new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }))
  const [employees, setEmployees] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [deptFilter, setDeptFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/kintai/departments')
      .then(r => r.json())
      .then(d => setDepartments(d.departments || []))
      .catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/kintai/attendance/admin?date=${date}`)
      .then(r => r.json())
      .then(d => setEmployees(d.employees || []))
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false))
  }, [date])

  const prevDay = () => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toLocaleDateString('sv-SE')) }
  const nextDay = () => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toLocaleDateString('sv-SE')) }
  const goToday = () => setDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }))

  const isToday = date === new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

  const filtered = deptFilter ? employees.filter(e => e.departmentId === deptFilter) : employees

  const dateObj = new Date(date + 'T00:00:00+09:00')
  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
  const dayOfWeek = dateObj.getDay()
  const dateLabel = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日（${WEEKDAYS[dayOfWeek]}）`

  const stats = useMemo(() => {
    const working = filtered.filter(e => e.attendance?.clockIn && !e.attendance?.clockOut).length
    const notClocked = filtered.filter(e => !e.attendance?.clockIn).length
    const clockedOut = filtered.filter(e => e.attendance?.clockOut).length
    return { working, notClocked, clockedOut }
  }, [filtered])

  const totals = useMemo(() => {
    let totalWorkMin = 0
    let totalOtMin = 0
    let totalBreakMin = 0
    filtered.forEach(e => {
      const att = e.attendance
      if (att?.workMinutes) totalWorkMin += att.workMinutes
      if (att?.overtimeMinutes) totalOtMin += att.overtimeMinutes
      if (att?.breakMinutes) totalBreakMin += att.breakMinutes
    })
    return { totalWorkMin, totalOtMin, totalBreakMin }
  }, [filtered])

  return (
    <>
      <style jsx>{`
        @keyframes bearFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes bearBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes bearWiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-5deg); }
          75% { transform: rotate(5deg); }
        }
        @keyframes bearSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .bear-float { animation: bearFloat 3s ease-in-out infinite; }
        .bear-bounce { animation: bearBounce 2s ease-in-out infinite; }
        .bear-wiggle { animation: bearWiggle 2s ease-in-out infinite; }
        .bear-spin { animation: bearSpin 2s linear infinite; }
        .fade-in-up { animation: fadeInUp 0.4s ease-out both; }
        .fade-in-up-1 { animation: fadeInUp 0.4s ease-out 0.05s both; }
        .fade-in-up-2 { animation: fadeInUp 0.4s ease-out 0.1s both; }
        .fade-in-up-3 { animation: fadeInUp 0.4s ease-out 0.15s both; }
      `}</style>

      <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <img src="/kintai/characters/present_プレゼン.png" alt="くまさん" width={80} height={80} className="bear-float" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">部署勤怠管理</h1>
            <p className="text-xs text-slate-500">チームの出勤状況をチェック</p>
          </div>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1">
            <button onClick={prevDay} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><span className="material-symbols-outlined">chevron_left</span></button>
            <button
              onClick={goToday}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                isToday
                  ? 'bg-[#7f19e6] text-white border-[#7f19e6]'
                  : 'bg-white text-[#7f19e6] border-[#7f19e6]/30 hover:bg-[#7f19e6]/5'
              }`}
            >
              今日
            </button>
            <button onClick={nextDay} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><span className="material-symbols-outlined">chevron_right</span></button>
          </div>
          <span className={`text-sm font-bold min-w-[180px] text-center ${dayOfWeek === 0 ? 'text-red-600' : dayOfWeek === 6 ? 'text-blue-600' : 'text-slate-700'}`}>{dateLabel}</span>
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/30 focus:border-[#7f19e6] bg-white">
            <option value="">すべての部署</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        {/* Summary stats with bears */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-3 fade-in-up-1">
              <img src="/kintai/characters/working_作業中.png" alt="" width={44} height={44} className="bear-bounce" />
              <div>
                <p className="text-xl font-bold text-slate-800">{stats.working}<span className="text-sm font-normal text-slate-500 ml-0.5">名</span></p>
                <p className="text-xs text-green-600 font-medium">出勤中</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-3 fade-in-up-2">
              <img src="/kintai/characters/sleep_居眠り.png" alt="" width={44} height={44} className="bear-float" style={{ animationDelay: '0.3s' }} />
              <div>
                <p className="text-xl font-bold text-slate-800">{stats.notClocked}<span className="text-sm font-normal text-slate-500 ml-0.5">名</span></p>
                <p className="text-xs text-red-500 font-medium">未出勤</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-3 fade-in-up-3">
              <img src="/kintai/characters/success_成功.png" alt="" width={44} height={44} className="bear-bounce" style={{ animationDelay: '0.6s' }} />
              <div>
                <p className="text-xl font-bold text-slate-800">{stats.clockedOut}<span className="text-sm font-normal text-slate-500 ml-0.5">名</span></p>
                <p className="text-xs text-blue-600 font-medium">退勤済</p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <img src="/kintai/characters/thinking_考え中.png" alt="読み込み中..." width={80} height={80} className="bear-spin" />
            <p className="text-sm text-slate-500 font-medium">読み込み中...</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">氏名</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">部署</th>
                  <th className="px-4 py-2.5 text-center font-medium text-slate-600">出勤</th>
                  <th className="px-4 py-2.5 text-center font-medium text-slate-600">退勤</th>
                  <th className="px-4 py-2.5 text-center font-medium text-slate-600">休憩</th>
                  <th className="px-4 py-2.5 text-center font-medium text-slate-600">勤務</th>
                  <th className="px-4 py-2.5 text-center font-medium text-slate-600">残業</th>
                  <th className="px-4 py-2.5 text-center font-medium text-slate-600">状態</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <img src="/kintai/characters/thinking_考え中.png" alt="" width={80} height={80} className="bear-wiggle" />
                        <p className="text-slate-400 font-medium">データがありません</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {filtered.map((emp: any, idx: number) => {
                      const att = emp.attendance
                      const statusInfo = getStatusInfo(att)
                      const hasOvertime = att?.overtimeMinutes > 0

                      return (
                        <tr key={emp.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/50' : ''} ${hasOvertime ? 'border-l-[3px] border-l-orange-400' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                style={{ backgroundColor: statusInfo.circleColor }}
                              >
                                {emp.name.charAt(0)}
                              </div>
                              <span className="font-medium text-slate-800">{emp.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{emp.departmentName || <span className="text-slate-300">-</span>}</td>
                          <td className="px-4 py-3 text-center">
                            {att?.clockIn ? (
                              <span className="font-medium text-slate-700">{new Date(att.clockIn).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {att?.clockOut ? (
                              <span className="font-medium text-slate-700">{new Date(att.clockOut).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {att?.breakMinutes ? (
                              <span className="text-slate-600">{att.breakMinutes}分</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {att?.workMinutes ? (
                              <span className="font-medium text-slate-700">{formatMinutesJa(att.workMinutes)}</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className={`px-4 py-3 text-center font-medium ${hasOvertime ? 'text-orange-600' : ''}`}>
                            {att?.overtimeMinutes ? (
                              formatMinutesJa(att.overtimeMinutes)
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {att?.status ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                att.status === 'normal'
                                  ? (att.clockOut ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-700')
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {att.clockOut ? '退勤済' : att.clockIn ? '出勤中' : (ATTENDANCE_STATUS_LABELS[att.status] || att.status)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600">
                                未出勤
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}

                    {/* Totals row */}
                    {filtered.length > 0 && (
                      <tr className="bg-slate-50 border-t-2 border-slate-200 font-medium">
                        <td className="px-4 py-3 text-slate-700" colSpan={2}>
                          <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-base text-slate-400">functions</span>
                            合計 ({filtered.length}名)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500" colSpan={2}></td>
                        <td className="px-4 py-3 text-center text-slate-600">
                          {totals.totalBreakMin > 0 ? `${totals.totalBreakMin}分` : '-'}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-700 font-bold">
                          {totals.totalWorkMin > 0 ? formatMinutesJa(totals.totalWorkMin) : '-'}
                        </td>
                        <td className={`px-4 py-3 text-center font-bold ${totals.totalOtMin > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                          {totals.totalOtMin > 0 ? formatMinutesJa(totals.totalOtMin) : '-'}
                        </td>
                        <td className="px-4 py-3"></td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
