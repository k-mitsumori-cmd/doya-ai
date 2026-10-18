'use client'
import HrPeriodCreationRecovery from '@/components/hr/HrPeriodCreationRecovery'
import { useHrOrganizationRequest } from '@/components/hr/HrOrganizationScope'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Plus, ChevronRight } from 'lucide-react'
import HrAuthenticatedScope from '@/components/hr/HrAuthenticatedScope'
import { loadHrEvaluationPeriodList, HrEvaluationPeriodListReadError, type HrEvaluationPeriodListRow } from '@/lib/hr/evaluation-period-list-client'
import { useHrPeriodCreation, findHrPeriodCreationOrganization } from '@/lib/hr/use-evaluation-period-creation'
import { useHrPageLifetime } from '@/lib/hr/use-page-lifetime'

export default function EvaluationsPage() {
  return <HrAuthenticatedScope callbackUrl="/hr/evaluations" resourceLabel="評価期間">{actor => <ScopedEvaluationsPage actor={actor} />}</HrAuthenticatedScope>
}
function ScopedEvaluationsPage({ actor }: { actor: string }) {
  const organizationScope = useHrOrganizationRequest()
  const lifetime = useHrPageLifetime()
  const [periods, setPeriods] = useState<HrEvaluationPeriodListRow[]>([])
  const [organizationId, setOrganizationId] = useState('')
  const [canCreatePeriods, setCanCreatePeriods] = useState(false)
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(''), [loginRequired, setLoginRequired] = useState(false)
  const [hint, setHint] = useState<{ ready: boolean; organizationId?: string; error: string }>({ ready: false, error: '' })
  const [revision, setRevision] = useState(0)
  const loadedSnapshot = useRef<{ organizationId: string; revision: number } | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newPeriod, setNewPeriod] = useState({ name: '', startDate: '', endDate: '' })
  useEffect(() => {
    const refresh = () => {
      try {
        const selected = findHrPeriodCreationOrganization(actor, organizationScope.organizationId)
        setHint(old => old.ready && old.organizationId === selected && !old.error ? old : { ready: true, organizationId: selected, error: '' })
      } catch { setHint({ ready: true, error: '前回の作成操作を1件に特定できず、結果を安全に確認できません。操作記録は保持しています。下の案内から、各操作の結果を確認してください。記録を読み取れない場合は、ブラウザの保存設定をご確認ください。' }) }
    }
    const changed = (event: StorageEvent) => { if (event.key === null || event.key.startsWith('hr-period-create-intent:v1:')) refresh() }
    refresh(); window.addEventListener('storage', changed); window.addEventListener('focus', refresh); window.addEventListener('hr-period-creation-reconciled', refresh)
    return () => { window.removeEventListener('storage', changed); window.removeEventListener('focus', refresh); window.removeEventListener('hr-period-creation-reconciled', refresh) }
  }, [actor])
  const scopeError = hint.error || (organizationId && hint.organizationId && organizationId !== hint.organizationId ? '別の組織に未確認の作成操作があります。現在の入力と操作記録を保持しています。組織を確認してから再取得してください。' : '')
  const expectedOrganization = organizationId || hint.organizationId || organizationScope.organizationId
  const creation = useHrPeriodCreation('authenticated', actor, expectedOrganization ?? '')
  const creating = creation.busy
  useEffect(() => {
    if (!hint.ready || scopeError) return
    // A complete initial read already pins every packet to its server organization.
    // Recording that identity must not discard the list and fetch it again.
    if (expectedOrganization && loadedSnapshot.current?.organizationId === expectedOrganization && loadedSnapshot.current.revision === revision) return
    const controller = new AbortController(); let live = true
    setLoading(true); setLoadError(''); setLoginRequired(false)
    void loadHrEvaluationPeriodList(controller.signal, expectedOrganization, organizationScope.request).then(data => {
      if (!live || controller.signal.aborted) return
      loadedSnapshot.current = { organizationId: data.organizationId, revision }
      setOrganizationId(data.organizationId); setPeriods(data.rows); setCanCreatePeriods(data.canCreatePeriods); setLoading(false)
    }).catch(error => {
      if (!live || controller.signal.aborted) return
      setLoadError(error instanceof Error ? error.message : '評価期間を取得できませんでした。')
      setLoginRequired(error instanceof HrEvaluationPeriodListReadError && error.status === 401)
    }).finally(() => { if (live && !controller.signal.aborted) setLoading(false) })
    return () => { live = false; controller.abort() }
  }, [hint.ready, expectedOrganization, scopeError, revision])
  // Move to result confirmation as soon as this scope persists an intent. Keep the private draft untouched.
  useEffect(() => { if (creation.intent) setShowCreateModal(false) }, [creation.intent?.operationId])
  const blocked = loading || Boolean(loadError) || Boolean(scopeError) || !canCreatePeriods || !creation.ready || Boolean(creation.intent) || creating
  const fetchPeriods = () => setRevision(value => value + 1)
  async function handleCreatePeriod() {
    if (blocked) return
    await creation.create({ ...newPeriod })
  }
  async function acknowledgeCreation() {
    const result = creation.result
    if (!result || result.state === 'not_received' || scopeError) return
    if (!await creation.acknowledge() || !creation.isCurrent() || !lifetime.live()) return
    if (result.state === 'created') lifetime.router.push('/hr/evaluations/period/' + encodeURIComponent(result.period.id))
    else { setShowCreateModal(false); fetchPeriods() }
  }

  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    DRAFT: { label: '準備中', color: 'bg-slate-100 text-slate-600' },
    OPEN: { label: '進行中', color: 'bg-emerald-100 text-emerald-700' },
    IN_REVIEW: { label: 'レビュー中', color: 'bg-amber-100 text-amber-700' },
    CLOSED: { label: '終了', color: 'bg-blue-100 text-blue-700' },
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900">評価管理</h1>
            <p className="text-sm text-slate-500 mt-1">MBO評価の期間を管理</p>
          </div>
          {canCreatePeriods && (
            <button
            onClick={() => { if (!blocked) setShowCreateModal(true) }}
            disabled={blocked}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full text-base font-bold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus aria-hidden="true" className="w-5 h-5 shrink-0" />
            評価期間を作成
            </button>
          )}
        </div>

        {scopeError && <div role="alert" className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-6">{scopeError}</div>}
        {hint.error && organizationScope.organizationId && <HrPeriodCreationRecovery onReconciled={() => { setRevision(value => value + 1); window.dispatchEvent(new Event('hr-period-creation-reconciled')) }} />}
        {creation.message && !creation.intent && <p role="alert">{creation.message}</p>}
        {creation.intent && <section aria-label="評価期間の作成結果確認" className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-lg font-bold">前回の評価期間作成の結果を確認してください</h2>
          <p role="status" className="mt-2">{creating ? '操作結果を確認しています。' : creation.message || '新しく作成せず、前回の作成結果を確認してください。'}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" disabled={creating || Boolean(scopeError)} onClick={() => void creation.recover()} className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-50">作成結果を確認する</button>
            {creation.result?.state === 'not_received' && <>
              {creation.canRetry && <button type="button" disabled={creating || creation.loginRequired || creation.accessDenied || Boolean(scopeError)} onClick={() => void creation.retry()} className="rounded-xl border px-5 py-3 font-bold">同じ内容で作成を再開する</button>}
              <button type="button" disabled={creating || creation.loginRequired || creation.accessDenied || Boolean(scopeError)} onClick={() => void creation.recover(true)} className="rounded-xl border px-5 py-3 font-bold">未受付の操作を終了する</button>
            </>}
            {creation.result && creation.result.state !== 'not_received' && <button type="button" disabled={creating || creation.loginRequired || creation.accessDenied || Boolean(scopeError)} onClick={() => void acknowledgeCreation()} className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-50">{creation.result.state === 'created' ? '作成した評価期間を開く' : '結果を確認して一覧に戻る'}</button>}
            {creation.loginRequired && <Link href="/auth/signin?callbackUrl=%2Fhr%2Fevaluations">ログインする</Link>}
          </div>
        </section>}
        {/* Periods List */}
        {scopeError ? null : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-40 bg-white rounded-3xl shadow-md animate-pulse" />
            ))}
          </div>
        ) : loadError ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
            <h2 className="text-lg font-black text-rose-800">評価期間を取得できませんでした</h2>
            <p className="mt-2 text-sm font-bold text-rose-700">{loadError} 登録済みの評価期間は変更されていません。</p>
            {loginRequired && <Link href="/auth/signin?callbackUrl=%2Fhr%2Fevaluations">ログインする</Link>}
            <button type="button" onClick={() => void fetchPeriods()} className="mt-4 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700">
              再試行する
            </button>
          </div>
        ) : periods.length > 0 ? (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.08 },
              },
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {periods.map((period) => {
              const total = period.evaluationCount
              const completed = period.completedEvaluations
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0
              const st = Object.prototype.hasOwnProperty.call(STATUS_MAP, period.status) ? STATUS_MAP[period.status] : { label: '状態未確認', color: 'bg-slate-100 text-slate-600' }
              return (
                <motion.div
                  key={period.id}
                  variants={{
                    hidden: { opacity: 0, y: 20, scale: 0.95 },
                    visible: { opacity: 1, y: 0, scale: 1 },
                  }}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  <Link
                    href={`/hr/evaluations/period/${period.id}`}
                    className="block bg-white rounded-3xl shadow-md p-6 hover:shadow-lg transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-bold text-slate-900">{period.name}</h3>
                      <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">
                      {period.startDate && !isNaN(new Date(period.startDate).getTime())
                        ? new Date(period.startDate).toLocaleDateString('ja-JP')
                        : '未設定'}
                      {' 〜 '}
                      {period.endDate && !isNaN(new Date(period.endDate).getTime())
                        ? new Date(period.endDate).toLocaleDateString('ja-JP')
                        : '未設定'}
                    </p>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">進捗</span>
                      <span className="text-base font-black text-blue-600">{pct}%</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1.2, ease: 'easeOut' }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-slate-500">
                        {completed}/{total}件完了
                      </p>
                      <ChevronRight aria-hidden="true" className="w-5 h-5 text-slate-400" />
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        ) : (
          <div className="bg-white rounded-3xl shadow-lg p-6 sm:p-12 text-center">
            <motion.img
              src="/hr/characters/point_%E8%A7%A3%E8%AA%AC.png"
              alt="白くまキャラクター"
              className="w-40 mx-auto mb-4"
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            />
            <h3 className="text-2xl font-black text-slate-900 mb-2">{canCreatePeriods ? '評価をはじめてみましょう！' : '評価期間はまだありません'}</h3>
            <p className="text-base text-slate-500 mb-6 max-w-md mx-auto">
              {canCreatePeriods
                ? 'MBO（目標管理制度）に基づいた人事評価をオンラインでかんたんに管理できます。'
                : '管理者が評価期間を作成すると、ここに表示されます。'}
            </p>
            {canCreatePeriods && <>
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="flex items-start gap-3 text-left max-w-md w-full bg-blue-50 rounded-2xl p-4">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 text-xs font-black shrink-0 mt-0.5">1</span>
                <div>
                  <span className="text-sm font-bold text-slate-900">評価期間を作成する</span>
                  <p className="text-xs text-slate-500 mt-0.5">上期（4-9月）や下期（10-3月）など、評価の対象期間を設定します</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-left max-w-md w-full bg-red-50 rounded-2xl p-4">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-500 text-xs font-black shrink-0 mt-0.5">2</span>
                <div>
                  <span className="text-sm font-bold text-slate-900">従業員に評価シートを割り当て</span>
                  <p className="text-xs text-slate-500 mt-0.5">対象の従業員を選んで、目標設定用の評価シートを配布します</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-left max-w-md w-full bg-emerald-50 rounded-2xl p-4">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 text-xs font-black shrink-0 mt-0.5">3</span>
                <div>
                  <span className="text-sm font-bold text-slate-900">自己評価 → 上司評価 → 最終評価</span>
                  <p className="text-xs text-slate-500 mt-0.5">3ステップで評価を進行。進捗はダッシュボードで確認できます</p>
                </div>
              </div>
            </div>
            <motion.button
              onClick={() => { if (!blocked) setShowCreateModal(true) }}
              disabled={blocked}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-blue-600 text-white rounded-full text-base font-bold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:bg-blue-700 transition-all"
            >
              <Plus aria-hidden="true" className="w-5 h-5 shrink-0" />
              評価期間を作成
            </motion.button>
            </>}
          </div>
        )}

        {/* FAB */}
        {canCreatePeriods && (
          <button
          onClick={() => { if (!blocked) setShowCreateModal(true) }}
          disabled={blocked}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl shadow-blue-500/30 flex items-center justify-center hover:bg-blue-700 hover:shadow-2xl transition-all z-40 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="評価期間を作成"
        >
          <Plus aria-hidden="true" className="w-7 h-7" />
          </button>
        )}

        {/* Create Modal */}
        {canCreatePeriods && showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={() => { if (!creating && !creation.intent) setShowCreateModal(false) }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md mx-4"
            >
              <h2 className="text-lg font-bold text-slate-900 mb-4">評価期間を作成</h2>
              <fieldset disabled={blocked} className="space-y-4">
                {/* Presets */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">プリセットから選択</label>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const y = new Date().getFullYear()
                      return [
                        { label: `上期（${y}年4月〜9月）`, name: `${y}年度 上期評価`, start: `${y}-04-01`, end: `${y}-09-30` },
                        { label: `下期（${y}年10月〜${y+1}年3月）`, name: `${y}年度 下期評価`, start: `${y}-10-01`, end: `${y+1}-03-31` },
                        { label: '四半期（Q1）', name: `${y}年度 Q1評価`, start: `${y}-04-01`, end: `${y}-06-30` },
                      ]
                    })().map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setNewPeriod({ name: preset.name, startDate: preset.start, endDate: preset.end })}
                        className="px-3 py-1.5 text-xs font-bold rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">期間名</label>
                  <input
                    type="text"
                    value={newPeriod.name}
                    onChange={(e) => setNewPeriod({ ...newPeriod, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="2026年度 上期評価"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">開始日</label>
                    <input
                      type="date"
                      value={newPeriod.startDate}
                      onChange={(e) => setNewPeriod({ ...newPeriod, startDate: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">終了日</label>
                    <input
                      type="date"
                      value={newPeriod.endDate}
                      onChange={(e) => setNewPeriod({ ...newPeriod, endDate: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              </fieldset>
              {creation.message && <p role="alert" className="mt-3 text-sm text-rose-700">{creation.message}</p>}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => { if (!creating && !creation.intent) setShowCreateModal(false) }}
                  disabled={creating || Boolean(creation.intent)}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleCreatePeriod}
                  disabled={blocked || !newPeriod.name.trim() || !newPeriod.startDate || !newPeriod.endDate}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-bold shadow-md hover:shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  {creating ? '作成中...' : '作成'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
