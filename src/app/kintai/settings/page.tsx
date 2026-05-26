'use client'

import { useEffect, useState, useMemo } from 'react'

function computeSchedulePreview(workStart: string, workEnd: string, breakMinutes: number): string {
  if (!workStart || !workEnd) return ''
  const [sh, sm] = workStart.split(':').map(Number)
  const [eh, em] = workEnd.split(':').map(Number)
  const totalMinutes = (eh * 60 + em) - (sh * 60 + sm)
  if (totalMinutes <= 0) return ''
  const workMinutes = totalMinutes - breakMinutes
  if (workMinutes <= 0) return ''

  const halfWork = Math.floor(workMinutes / 2)
  const breakStartMin = sh * 60 + sm + halfWork
  const breakEndMin = breakStartMin + breakMinutes
  const bsH = String(Math.floor(breakStartMin / 60)).padStart(2, '0')
  const bsM = String(breakStartMin % 60).padStart(2, '0')
  const beH = String(Math.floor(breakEndMin / 60)).padStart(2, '0')
  const beM = String(breakEndMin % 60).padStart(2, '0')

  const workH = Math.floor(workMinutes / 60)
  const workM = workMinutes % 60

  return `${workStart} - ${bsH}:${bsM} 勤務 → ${bsH}:${bsM} - ${beH}:${beM} 休憩 → ${beH}:${beM} - ${workEnd} 勤務 = ${workH}時間${workM > 0 ? `${workM}分` : ''}`
}

export default function SettingsPage() {
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ name: '', workStart: '09:00', workEnd: '18:00', breakMinutes: 60, overtimeCalcMethod: 'daily', flexEnabled: false, coreStart: '', coreEnd: '' })
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchRules = () => {
    setLoading(true)
    fetch('/api/kintai/work-rules')
      .then(r => r.json())
      .then(d => setRules(d.rules || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchRules() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', workStart: '09:00', workEnd: '18:00', breakMinutes: 60, overtimeCalcMethod: 'daily', flexEnabled: false, coreStart: '', coreEnd: '' })
    setShowForm(true)
  }

  const openEdit = (rule: any) => {
    setEditing(rule)
    setForm({
      name: rule.name, workStart: rule.workStart, workEnd: rule.workEnd,
      breakMinutes: rule.breakMinutes, overtimeCalcMethod: rule.overtimeCalcMethod,
      flexEnabled: rule.flexEnabled, coreStart: rule.coreStart || '', coreEnd: rule.coreEnd || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { alert('ルール名を入力してください'); return }
    setSaving(true)
    try {
      const url = editing ? `/api/kintai/work-rules/${editing.id}` : '/api/kintai/work-rules'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) { const d = await res.json(); alert(d.error || '保存に失敗しました'); return }
      setShowForm(false)
      fetchRules()
    } catch { alert('通信エラー') } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!showDeleteConfirm) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/kintai/work-rules/${showDeleteConfirm.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); alert(d.error || '削除に失敗しました'); return }
      setShowDeleteConfirm(null)
      fetchRules()
    } catch { alert('通信エラー') } finally { setDeleting(false) }
  }

  const OT_LABELS: Record<string, string> = { daily: '日次', weekly: '週次', monthly: '月次' }

  const preview = useMemo(() => computeSchedulePreview(form.workStart, form.workEnd, form.breakMinutes), [form.workStart, form.workEnd, form.breakMinutes])

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
      `}</style>

      <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <img src="/kintai/characters/focus_集中.png" alt="くまさん" width={80} height={80} className="bear-float" />
            <div>
              <h1 className="text-xl font-bold text-slate-800">就業ルール設定</h1>
              <p className="text-xs text-slate-500">勤務時間やフレックスを設定しよう</p>
            </div>
          </div>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-[#7f19e6] text-white text-sm font-bold rounded-lg hover:bg-[#6a14c2] transition-colors shadow-sm shadow-[#7f19e6]/20">
            <span className="material-symbols-outlined text-lg">add</span>ルールを追加
          </button>
        </div>

        {/* Explanation with bear */}
        <div className="flex items-center gap-3 bg-[#7f19e6]/5 border border-[#7f19e6]/10 rounded-xl px-4 py-3">
          <img src="/kintai/characters/point_解説.png" alt="" width={40} height={40} className="bear-wiggle shrink-0" />
          <p className="text-sm text-slate-600">就業ルールは従業員に割り当てて使用します。複数のルールを作成して、異なる勤務形態に対応できます。</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <img src="/kintai/characters/thinking_考え中.png" alt="読み込み中..." width={80} height={80} className="bear-spin" />
            <p className="text-sm text-slate-500 font-medium">読み込み中...</p>
          </div>
        ) : rules.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center fade-in-up">
            <img src="/kintai/characters/thinking_考え中.png" alt="" width={120} height={120} className="bear-float mb-4" />
            <h3 className="text-lg font-bold text-slate-700 mb-1">就業ルールがありません</h3>
            <p className="text-sm text-slate-400 mb-6">ルールを作成して従業員に割り当てましょう。</p>
            <button onClick={openCreate} className="flex items-center gap-1.5 px-5 py-2.5 bg-[#7f19e6] text-white text-sm font-bold rounded-lg hover:bg-[#6a14c2] transition-colors">
              <span className="material-symbols-outlined text-lg">add</span>最初のルールを作成
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rules.map((rule) => {
              const [sh, sm] = (rule.workStart || '09:00').split(':').map(Number)
              const [eh, em] = (rule.workEnd || '18:00').split(':').map(Number)
              const totalMin = (eh * 60 + em) - (sh * 60 + sm)
              const workMin = totalMin - (rule.breakMinutes || 0)
              const workH = Math.floor(workMin / 60)
              const workM = workMin % 60
              const barStart = sh * 60 + sm
              const barEnd = eh * 60 + em
              const rangeStart = 6 * 60
              const rangeEnd = 22 * 60
              const rangeTotal = rangeEnd - rangeStart
              const barLeftPct = Math.max(0, ((barStart - rangeStart) / rangeTotal) * 100)
              const barWidthPct = Math.min(100 - barLeftPct, ((barEnd - barStart) / rangeTotal) * 100)

              return (
                <div key={rule.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-800">{rule.name}</h3>
                      {rule.flexEnabled && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-[#7f19e6]/10 text-[#7f19e6] rounded-full font-bold">
                          <span className="material-symbols-outlined text-xs">sync</span>
                          フレックス
                        </span>
                      )}
                    </div>
                    <div className="flex gap-0.5 ml-2 shrink-0">
                      <button onClick={() => openEdit(rule)} className="p-1.5 text-slate-400 hover:text-[#7f19e6] hover:bg-purple-50 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-lg">edit</span>
                      </button>
                      <button onClick={() => setShowDeleteConfirm(rule)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-sm">
                    {/* Work time */}
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-[#7f19e6]">schedule</span>
                      <span className="text-slate-700 font-medium">{rule.workStart} 〜 {rule.workEnd}</span>
                      <span className="text-xs text-slate-400">({workH > 0 ? `${workH}時間` : ''}{workM > 0 ? `${workM}分` : ''}勤務)</span>
                    </div>

                    {/* Visual hours bar */}
                    <div className="relative h-6 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="absolute top-0 bottom-0 bg-[#7f19e6]/20 rounded-full"
                        style={{ left: `${barLeftPct}%`, width: `${barWidthPct}%` }}
                      >
                        <div className="absolute inset-0 bg-[#7f19e6]/30 rounded-full" />
                      </div>
                      <span className="absolute text-[10px] font-bold text-[#7f19e6] top-1/2 -translate-y-1/2" style={{ left: `${barLeftPct}%`, transform: 'translate(-50%, -50%)' }}>{rule.workStart}</span>
                      <span className="absolute text-[10px] font-bold text-[#7f19e6] top-1/2 -translate-y-1/2" style={{ left: `${barLeftPct + barWidthPct}%`, transform: 'translate(-50%, -50%)' }}>{rule.workEnd}</span>
                    </div>

                    {/* Break */}
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-amber-500">coffee</span>
                      <span className="text-slate-600">休憩 {rule.breakMinutes}分</span>
                    </div>

                    {/* Overtime calc */}
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-orange-500">calculate</span>
                      <span className="text-slate-600">残業計算: {OT_LABELS[rule.overtimeCalcMethod] || rule.overtimeCalcMethod}</span>
                    </div>

                    {/* Flex core times */}
                    {rule.flexEnabled && (rule.coreStart || rule.coreEnd) && (
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-[#7f19e6]">sync</span>
                        <span className="text-slate-600">コアタイム: {rule.coreStart || '-'} 〜 {rule.coreEnd || '-'}</span>
                      </div>
                    )}

                    {/* Employee count */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100 mt-1">
                      <span className="material-symbols-outlined text-base text-slate-400">group</span>
                      <span className="text-slate-500 text-xs">
                        使用中: <span className="font-bold text-slate-700">{rule._count?.employees || 0}</span>名
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
            <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md mx-4 space-y-5 max-h-[90vh] overflow-y-auto fade-in-up" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src="/kintai/characters/focus_集中.png" alt="" width={40} height={40} className="bear-wiggle" />
                  <h2 className="text-lg font-bold text-slate-800">{editing ? 'ルールを編集' : 'ルールを追加'}</h2>
                </div>
                <button onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ルール名 <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/30 focus:border-[#7f19e6]" placeholder="例: 標準 (9:00-18:00)" />
              </div>

              {/* Section: Work Time */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                  <span className="material-symbols-outlined text-base text-[#7f19e6]">schedule</span>勤務時間設定
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">始業</label>
                    <input type="time" value={form.workStart} onChange={(e) => setForm({ ...form, workStart: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/30 focus:border-[#7f19e6]" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">終業</label>
                    <input type="time" value={form.workEnd} onChange={(e) => setForm({ ...form, workEnd: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/30 focus:border-[#7f19e6]" /></div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">休憩 (分)</label>
                  <input type="number" value={form.breakMinutes} onChange={(e) => setForm({ ...form, breakMinutes: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/30 focus:border-[#7f19e6]" />
                </div>
              </div>

              {/* Section: Overtime & Flex */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                  <span className="material-symbols-outlined text-base text-[#7f19e6]">more_time</span>残業・フレックス設定
                </h3>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">残業計算方法</label>
                  <select value={form.overtimeCalcMethod} onChange={(e) => setForm({ ...form, overtimeCalcMethod: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/30 focus:border-[#7f19e6] bg-white">
                    <option value="daily">日次</option><option value="weekly">週次</option><option value="monthly">月次</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.flexEnabled} onChange={(e) => setForm({ ...form, flexEnabled: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-[#7f19e6] focus:ring-[#7f19e6]" />
                  <span className="text-sm font-medium text-slate-700">フレックスタイム制</span>
                </label>
                {form.flexEnabled && (
                  <div className="grid grid-cols-2 gap-3 bg-[#7f19e6]/5 rounded-lg p-3">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">コア開始</label>
                      <input type="time" value={form.coreStart} onChange={(e) => setForm({ ...form, coreStart: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/30 focus:border-[#7f19e6] bg-white" /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">コア終了</label>
                      <input type="time" value={form.coreEnd} onChange={(e) => setForm({ ...form, coreEnd: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/30 focus:border-[#7f19e6] bg-white" /></div>
                  </div>
                )}
              </div>

              {/* Schedule preview */}
              {preview && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">preview</span>スケジュールプレビュー
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">{preview}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors">キャンセル</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-[#7f19e6] text-white font-bold rounded-xl hover:bg-[#6a14c2] transition-colors disabled:opacity-50">
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirmation dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)}>
            <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4 fade-in-up" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <img src="/kintai/characters/surprise_驚き.png" alt="" width={56} height={56} className="bear-wiggle" />
                <h2 className="text-lg font-bold text-slate-800">ルールを削除</h2>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-slate-600">
                  <span className="font-bold text-slate-800">「{showDeleteConfirm.name}」</span>を削除しますか？
                </p>
                {(showDeleteConfirm._count?.employees || 0) > 0 && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <span className="material-symbols-outlined text-amber-600 text-base mt-0.5">info</span>
                    <p className="text-xs text-amber-700">このルールは<span className="font-bold">{showDeleteConfirm._count.employees}名</span>の従業員に適用されています。</p>
                  </div>
                )}
                <p className="text-xs text-slate-400">この操作は元に戻せません。</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors">キャンセル</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50">
                  {deleting ? '削除中...' : '削除する'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
