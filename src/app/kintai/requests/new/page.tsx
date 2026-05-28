'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CLOCK_TYPE_LABELS } from '@/lib/kintai/types'

const REQUEST_TYPES = [
  { key: 'clock_fix', label: '打刻修正', icon: 'edit_clock', desc: '打刻の追加・修正を申請します', disabled: false, bear: '/kintai/characters/working_作業中.png' },
  { key: 'leave', label: '休暇', icon: 'event_busy', desc: '有給休暇・特別休暇を申請します', disabled: false, bear: '/kintai/characters/ramen_休憩.png' },
  { key: 'overtime', label: '残業', icon: 'more_time', desc: '残業の事前申請をします', disabled: false, bear: '/kintai/characters/focus_集中.png' },
  { key: 'holiday_work', label: '休日出勤', icon: 'work_history', desc: '休日出勤を申請します', disabled: false, bear: '/kintai/characters/surprise_驚き.png' },
]

export default function NewRequestPage() {
  return (
    <Suspense fallback={
      <div className="p-4 lg:p-6 max-w-2xl mx-auto flex flex-col items-center justify-center py-20 gap-4">
        <img
          src="/kintai/characters/thinking_考え中.png"
          alt="読み込み中"
          style={{ width: 80, height: 80, objectFit: 'contain' }}
        />
        <div className="w-10 h-10 rounded-full border-4 border-[#7f19e6]/20 border-t-[#7f19e6] animate-spin" />
        <p className="text-sm text-slate-400 font-medium">読み込み中...</p>
      </div>
    }>
      <NewRequestContent />
    </Suspense>
  )
}

function NewRequestContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState(1)
  const [type, setType] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // clock_fix form
  const [fixDate, setFixDate] = useState('')
  const [fixClockType, setFixClockType] = useState('clock_in')
  const [fixTime, setFixTime] = useState('')
  const [reason, setReason] = useState('')

  // leave form
  const [leaveStart, setLeaveStart] = useState('')
  const [leaveEnd, setLeaveEnd] = useState('')
  const [leaveType, setLeaveType] = useState('paid')

  // overtime form
  const [otDate, setOtDate] = useState('')
  const [otHours, setOtHours] = useState('')
  const [otMinutes, setOtMinutes] = useState('')

  // holiday_work form
  const [hwDate, setHwDate] = useState('')
  const [hwStart, setHwStart] = useState('09:00')
  const [hwEnd, setHwEnd] = useState('18:00')

  // original clock times for clock_fix display
  const [origClockIn, setOrigClockIn] = useState<string | null>(null)
  const [origClockOut, setOrigClockOut] = useState<string | null>(null)

  useEffect(() => {
    const t = searchParams.get('type')
    const d = searchParams.get('date')
    if (t) { setType(t); setStep(2) }
    if (d) setFixDate(d)
  }, [searchParams])

  useEffect(() => {
    if (fixDate && type === 'clock_fix') {
      fetch(`/api/kintai/clock?date=${fixDate}`)
        .then(r => r.json())
        .then(d => {
          const recs = d.records || []
          const cin = recs.find((r: any) => r.type === 'clock_in')
          const cout = recs.find((r: any) => r.type === 'clock_out')
          setOrigClockIn(cin ? new Date(cin.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : null)
          setOrigClockOut(cout ? new Date(cout.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : null)
        })
        .catch(() => {})
    }
  }, [fixDate, type])

  const selectType = (key: string) => {
    setType(key)
    setStep(2)
  }

  const goBack = () => {
    if (step === 1) {
      router.back()
    } else {
      setStep(1)
      setType('')
      setError('')
    }
  }

  const previewText = (): string => {
    if (type === 'clock_fix' && fixDate && fixTime && fixClockType) {
      // fixDate is YYYY-MM-DD from date input; parse as JST
      const [, mm, dd] = fixDate.split('-')
      const dateStr = `${parseInt(mm)}月${parseInt(dd)}日`
      const clockLabel = CLOCK_TYPE_LABELS[fixClockType] || fixClockType
      return `${dateStr}の${clockLabel}時刻を ${fixTime} に修正します`
    }
    return ''
  }

  const handleSubmit = async () => {
    setError('')

    // 必須フィールドを先に検証
    const details: any = {}
    if (type === 'clock_fix') {
      if (!fixDate) { setError('対象日を入力してください'); return }
      if (!fixTime) { setError('修正後時刻を入力してください'); return }
      details.date = fixDate
      details.clockType = fixClockType
      details.correctedTime = fixTime
    } else if (type === 'leave') {
      if (!leaveStart) { setError('開始日を入力してください'); return }
      if (!leaveEnd) { setError('終了日を入力してください'); return }
      details.startDate = leaveStart
      details.endDate = leaveEnd
      details.leaveType = leaveType
    } else if (type === 'overtime') {
      if (!otDate) { setError('対象日を入力してください'); return }
      if (!otHours && !otMinutes) { setError('時間または分を入力してください'); return }
      details.date = otDate
      details.hours = parseInt(otHours || '0')
      details.minutes = parseInt(otMinutes || '0')
    } else if (type === 'holiday_work') {
      if (!hwDate) { setError('対象日を入力してください'); return }
      if (!hwStart || !hwEnd) { setError('開始時刻と終了時刻を入力してください'); return }
      details.date = hwDate
      details.startTime = hwStart
      details.endTime = hwEnd
    }

    if (!reason.trim()) { setError('理由を入力してください'); return }
    setSubmitting(true)

    try {
      const res = await fetch('/api/kintai/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, details, reason }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || '申請に失敗しました')
        return
      }

      setSubmitted(true)
      setTimeout(() => {
        router.push('/kintai/requests')
      }, 2000)
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setSubmitting(false)
    }
  }

  // Success screen
  if (submitted) {
    return (
      <>
        <div className="p-4 lg:p-6 max-w-2xl mx-auto flex flex-col items-center justify-center py-20 space-y-5">
          <img src="/kintai/characters/jump_大喜び.png" alt="成功！" width={140} height={140} className="bear-jump" />
          <h2 className="text-2xl font-bold text-slate-800 fade-in-scale">申請が完了しました！</h2>
          <p className="text-sm text-slate-500 fade-in-scale" style={{ animationDelay: '0.2s' }}>承認されるまでしばらくお待ちください</p>
          <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-[#7f19e6] animate-spin mt-4" />
          <p className="text-xs text-slate-400">申請一覧に戻ります...</p>
        </div>
      </>
    )
  }

  const preview = previewText()

  return (
    <>

      <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
        {/* Header with back button */}
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-800">
              {step === 1 ? '申請の種類を選択' : '申請内容を入力'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {step === 1 ? '申請したい内容の種類を選んでください' : '必要な情報を入力して申請してください'}
            </p>
          </div>
        </div>

        {/* Step indicator with bear */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <img
              src={step === 1 ? '/kintai/characters/thinking_考え中.png' : '/kintai/characters/point_解説.png'}
              alt=""
              width={36}
              height={36}
              className="bear-wiggle"
            />
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
            step === 1 ? 'bg-[#7f19e6] text-white' : 'bg-[#7f19e6]/10 text-[#7f19e6]'
          }`}>
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
            種類を選択
          </div>
          <div className="w-6 h-px bg-slate-300" />
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
            step === 2 ? 'bg-[#7f19e6] text-white' : 'bg-slate-100 text-slate-400'
          }`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              step === 2 ? 'bg-white/20' : 'bg-slate-200'
            }`}>2</span>
            詳細を入力
          </div>
        </div>

        {/* Step 1: Type selection */}
        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {REQUEST_TYPES.map((t) => (
              <div
                key={t.key}
                role="button"
                tabIndex={t.disabled ? -1 : 0}
                onClick={() => !t.disabled && selectType(t.key)}
                onKeyDown={(e) => { if (!t.disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectType(t.key) } }}
                className={`relative text-left transition-all rounded-xl border select-none ${
                  t.disabled
                    ? 'border-slate-200 bg-slate-50 cursor-not-allowed p-4'
                    : 'border-slate-200 bg-white hover:border-[#7f19e6] hover:shadow-md hover:shadow-[#7f19e6]/10 active:scale-[0.98] cursor-pointer p-5'
                }`}
              >
                {t.disabled && (
                  <span className="absolute top-2 right-2 text-[10px] font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
                    準備中
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <img
                    src={t.bear}
                    alt=""
                    width={48}
                    height={48}
                    className={t.disabled ? 'opacity-30' : ''}
                    style={{ pointerEvents: 'none' }}
                  />
                  <div style={{ pointerEvents: 'none' }}>
                    <p className={`font-bold ${t.disabled ? 'text-slate-400 text-sm' : 'text-slate-800'}`}>{t.label}</p>
                    <p className={`text-xs mt-1 ${t.disabled ? 'text-slate-300' : 'text-slate-500'}`}>{t.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 2: clock_fix form */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 fade-in-up">
            <div>
              <h2 className="font-bold text-slate-700 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#7f19e6]">
                  {type === 'clock_fix' ? 'edit_clock' : type === 'leave' ? 'event_busy' : type === 'overtime' ? 'more_time' : 'work_history'}
                </span>
                {type === 'clock_fix' ? '打刻修正申請' : type === 'leave' ? '休暇申請' : type === 'overtime' ? '残業申請' : '休日出勤申請'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {type === 'clock_fix' ? '打刻の修正が必要な場合は、対象の日時と理由を入力してください' :
                 type === 'leave' ? '休暇を取得する日程と理由を入力してください' :
                 type === 'overtime' ? '残業の予定日時と理由を入力してください' :
                 '休日出勤の日程と理由を入力してください'}
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                {error}
              </div>
            )}

            {type === 'clock_fix' && (<div className="space-y-4">
            {(origClockIn || origClockOut) && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">history</span>
                  現在の打刻記録
                </p>
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-slate-400 text-xs">出勤</span>
                    <p className="font-mono font-bold text-slate-700">{origClockIn || '-'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">退勤</span>
                    <p className="font-mono font-bold text-slate-700">{origClockOut || '-'}</p>
                  </div>
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-base text-slate-400">calendar_today</span>
                対象日 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={fixDate}
                onChange={(e) => setFixDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/30 focus:border-[#7f19e6] bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-base text-slate-400">swap_horiz</span>
                打刻種別
              </label>
              <select
                value={fixClockType}
                onChange={(e) => setFixClockType(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/30 focus:border-[#7f19e6] bg-white"
              >
                {Object.entries(CLOCK_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-base text-slate-400">schedule</span>
                修正後時刻
              </label>
              <input
                type="time"
                required
                value={fixTime}
                onChange={(e) => setFixTime(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/30 focus:border-[#7f19e6] bg-white"
              />
            </div>
            </div>)}

            {/* ===== Leave form ===== */}
            {type === 'leave' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">休暇種別</label>
                  <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white">
                    <option value="paid">有給休暇</option>
                    <option value="special">特別休暇</option>
                    <option value="unpaid">欠勤</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">開始日 <span className="text-red-500">*</span></label>
                    <input type="date" required value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">終了日 <span className="text-red-500">*</span></label>
                    <input type="date" required value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white" />
                  </div>
                </div>
              </div>
            )}

            {/* ===== Overtime form ===== */}
            {type === 'overtime' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">対象日 <span className="text-red-500">*</span></label>
                  <input type="date" required value={otDate} onChange={(e) => setOtDate(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">時間 <span className="text-red-500">*</span></label>
                    <input type="number" required min="0" max="24" value={otHours} onChange={(e) => setOtHours(e.target.value)} placeholder="1" className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">分</label>
                    <input type="number" min="0" max="59" value={otMinutes} onChange={(e) => setOtMinutes(e.target.value)} placeholder="30" className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white" />
                  </div>
                </div>
              </div>
            )}

            {/* ===== Holiday work form ===== */}
            {type === 'holiday_work' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">対象日 <span className="text-red-500">*</span></label>
                  <input type="date" required value={hwDate} onChange={(e) => setHwDate(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">開始時刻</label>
                    <input type="time" required value={hwStart} onChange={(e) => setHwStart(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">終了時刻 <span className="text-red-500">*</span></label>
                    <input type="time" required value={hwEnd} onChange={(e) => setHwEnd(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white" />
                  </div>
                </div>
              </div>
            )}

            {/* Preview of change */}
            {preview && (
              <div className="p-3 rounded-xl bg-[#7f19e6]/5 border border-[#7f19e6]/10 flex items-start gap-2">
                <span className="material-symbols-outlined text-[#7f19e6] text-base mt-0.5">info</span>
                <div>
                  <p className="text-xs font-medium text-[#7f19e6]">変更内容のプレビュー</p>
                  <p className="text-sm text-slate-700 mt-0.5">{preview}</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-base text-slate-400">edit_note</span>
                理由 <span className="text-red-500 text-xs ml-0.5">*必須</span>
              </label>
              <textarea
                value={reason}
                required
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder={type === 'clock_fix' ? '例: 打刻を忘れたため' : type === 'leave' ? '例: 私用のため' : type === 'overtime' ? '例: プロジェクト納期対応のため' : '例: イベント対応のため'}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/30 focus:border-[#7f19e6] resize-none bg-white"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3.5 bg-[#7f19e6] text-white font-bold rounded-xl hover:bg-[#6a14c2] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm shadow-[#7f19e6]/20"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  送信中...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">send</span>
                  申請内容を確認して提出
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
