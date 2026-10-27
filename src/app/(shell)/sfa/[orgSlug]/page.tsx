'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { sfaJson, sfaValidRows, isSfaClientTask, type SfaClientTask } from '@/lib/sfa/client-response'
import { useSfaClientMutations, useSfaDraftSnapshot } from '@/lib/sfa/use-client-mutations'
import MutationRecovery from '@/components/sfa/MutationRecovery'
import SfaLoadError from '@/components/sfa/SfaLoadError'
import SfaEmpty from '@/components/sfa/SfaEmpty'
import { jstDateKey } from '@/lib/sfa/task-date'
import { isSfaSummary, summaryYen, type SfaSummary } from '@/lib/sfa/summary'
import { Button, Card, EmptyState, ErrorNotice, FirstSteps, StatTile, ToolHero } from '@/components/ds'
import { Stagger, StaggerItem } from '@/components/ds/motion'
import { useOneButton } from '@/components/one-button/context'
import { OneButtonBar } from '@/components/one-button/OneButtonBar'
import { CheckCircle2, Circle, Kanban, Building2, Users, ChevronRight, TrendingUp } from 'lucide-react'

type Task = SfaClientTask

const STALE_DAYS = 14
const yen = summaryYen

export default function SfaDashboard() {
  const orgSlug = (useParams().orgSlug as string) || ''
  return <SfaDashboardContent key={orgSlug} orgSlug={orgSlug} />
}

/** 円の金額（文字列の整数）を、数え上げに使える数にする。大きすぎるときは数え上げずに文字で出す */
function yenValue(amount: string): number | string {
  const n = Number(amount)
  return Number.isSafeInteger(n) ? n : yen(amount)
}

function SfaDashboardContent({ orgSlug }: { orgSlug: string }) {
  const mutations = useSfaClientMutations(orgSlug, () => { loadTasks(); setRetry(n => n + 1) })
  const ready = mutations.allowed
  const oneButton = useOneButton()
  const base = `/sfa/${orgSlug}`
  const [summary, setSummary] = useState<SfaSummary | null>(null)
  const [summaryError, setSummaryError] = useState('')
  // 新しい見た目のとき、失敗の種類（ログイン切れ・権限なし・上限・通信）で案内を変えるために、投げられたエラーを持つ
  const [summaryFailure, setSummaryFailure] = useState<unknown>(null)
  const [taskFailure, setTaskFailure] = useState<unknown>(null)
  const taskInput = useRef<HTMLInputElement>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const [taskError, setTaskError] = useState('')
  const [tasksLoaded, setTasksLoaded] = useState(false)
  const [hasMoreTasks, setHasMoreTasks] = useState(false)
  const alive = useRef(true)
  const taskSequence = useRef(0)
  const taskRequest = useRef<AbortController | null>(null)
  useEffect(() => { alive.current = true; return () => { alive.current = false; taskRequest.current?.abort() } }, [])
  useEffect(() => {
    if (!ready || !mutations.active()) return
    let active = true
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    setSummaryLoading(true)
    setSummaryError('')
    sfaJson('/api/sfa/summary', orgSlug, { signal: controller.signal })
      .then(d => {
        if (!isSfaSummary(d.summary)) throw new Error('営業状況を取得できませんでした。')
        if (active && mutations.active()) setSummary(d.summary)
      }).catch((e) => { if (active && mutations.active()) { setSummaryFailure(e); setSummaryError('営業状況を取得できませんでした。再試行してください。') } })
      .finally(() => { clearTimeout(timer); if (active && mutations.active()) setSummaryLoading(false) })
    return () => { active = false; controller.abort(); clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, orgSlug, retry, mutations.key])
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTask, setNewTask] = useState('')
  const [busy, setBusy] = useState(false)
  const draft = useSfaDraftSnapshot(newTask)
  useEffect(() => { setBusy(false); setTasks([]); setTasksLoaded(false); setSummary(null) }, [mutations.key])

  const loadTasks = useCallback(() => {
    if (!ready || !mutations.active()) return
    const sequence = ++taskSequence.current
    taskRequest.current?.abort()
    const controller = new AbortController()
    taskRequest.current = controller
    const timer = setTimeout(() => controller.abort(), 15000)
    setTaskError('')
    sfaJson('/api/sfa/tasks', orgSlug, { signal: controller.signal }).then(d => {
      const valid = sfaValidRows(d.tasks, isSfaClientTask)
      if (!valid || typeof d.hasMore !== 'boolean') throw new Error('タスク取得失敗')
      if (alive.current && mutations.active() && sequence === taskSequence.current) { setTasks(valid.rows); setHasMoreTasks(d.hasMore === true); setTasksLoaded(true) }
    }).catch((e) => { if (alive.current && mutations.active() && sequence === taskSequence.current) { setTaskFailure(e); setTaskError('タスクを取得できませんでした。再試行してください。') } }).finally(() => clearTimeout(timer))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, orgSlug, mutations.key])

  useEffect(() => {
    if (!ready || !mutations.active()) return
    loadTasks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, orgSlug, loadTasks, mutations.key])

  const staleCount = summary?.staleCount || 0
  const openTaskCount = summary?.openTaskCount

  // ドヤくん（公式マスコット）のひとこと — 状況に応じて表情(mood)と台詞が変化
  const doya: { mood: 'hello' | 'thinking' | 'point' | 'success' | 'thumbsup'; message: string } = (() => {
    if (summaryError) return { mood: 'thinking', message: '営業状況の取得に失敗しました。再試行してください。' }
    if (!summary || summaryLoading) return { mood: 'thinking', message: '営業状況を確認しています。' }
    if (summary.totalCount === 0) return { mood: 'hello', message: 'まずは「商談」を登録してみよう！カンバンで案件を見える化できるよ' }
    if (staleCount > 0) return { mood: 'thinking', message: `${staleCount}件の商談が${STALE_DAYS}日以上動いてないみたい…フォローのチャンスだよ！` }
    if (summary.openTaskCount > 0) return { mood: 'point', message: `未完了タスクが${summary.openTaskCount}件あるよ。下のリストから片付けていこう！` }
    if (BigInt(summary.wonTotal) > 0n) return { mood: 'success', message: `受注合計 ${yen(summary.wonTotal)}！この調子で行こう〜` }
    return { mood: 'thumbsup', message: `パイプラインは確度加重で ${yen(summary.weighted)}。いい感じだよ！` }
  })()

  const addTask = async () => {
    if (!newTask.trim() || !mutations.active() || mutations.creationBlocked('task')) return
    const revision = draft.current.revision
    setBusy(true)
    const row = await mutations.create('task', 'dashboard:create', { title: newTask })
    if (!mutations.active()) return
    setBusy(false)
    if (!row) return
    if (draft.current.revision === revision) setNewTask('')
    setRetry(n => n + 1)
    loadTasks()
  }

  const toggleTask = async (t: Task) => {
    const result = await mutations.mutateTask(t, { status: t.status === 'done' ? 'open' : 'done' })
    if (!result || !mutations.active()) return
    taskRequest.current?.abort()
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, ...(result.task as Task) } : x))
    setRetry(n => n + 1)
  }

  const fmtDue = (s: string | null) => {
    const dueDay = jstDateKey(s)
    const today = jstDateKey(new Date())
    if (!dueDay || !today) return null
    const label = `${Number(dueDay.slice(5, 7))}/${Number(dueDay.slice(8, 10))}`
    if (dueDay < today) return { label: `${label}（期限切れ）`, cls: 'text-red-500' }
    if (dueDay === today) return { label: `${label}（今日）`, cls: 'text-amber-600' }
    return { label, cls: 'text-slate-400' }
  }

  // 新しい見た目（UI 品質 §5.1）: ToolHero・StatTile・空状態・lucide のアイコン。ページの見出しは h2（h1 は枠の ToolFrame）
  const quick = [
    { href: `${base}/deals`, icon: Kanban, title: '商談パイプライン', sub: 'カンバンで案件を管理' },
    { href: `${base}/accounts`, icon: Building2, title: '取引先を登録', sub: '会社を一元管理・CSVで書き出し' },
    { href: `${base}/members`, icon: Users, title: 'メンバー招待・権限', sub: 'チームで営業管理' },
  ]
  return (
    <div className="mx-auto grid max-w-5xl gap-6 p-4 sm:p-6">
      <MutationRecovery mutations={mutations} />
      {oneButton && (
        <OneButtonBar
          eyebrow="営業管理"
          cta="今日の商談を進めるなら、押してね"
          label="商談パイプラインを開く"
          scope="商談の一覧を、段階ごとのカンバンで開きます。カードを動かして、案件の進み具合を更新できます。"
          href={`${base}/deals`}
        />
      )}
      <ToolHero
        title="今日の営業状況を、ひと目で。"
        lead={doya.message}
        // 帯（これ1つで全部進む）が同じボタンを出すときは、ここには出さない（同じボタンが2つ並ばないように）
        action={oneButton ? undefined : <Button href={`${base}/deals`} icon="Kanban">商談パイプラインを開く</Button>}
        tool="sfa"
        artAlt=""
      />
      <FirstSteps
        id="sfa"
        steps={[
          { title: '取引先を登録する', body: '会社名を入れるだけ。CSV からまとめて入れることもできます。' },
          { title: '商談を追加する', body: '金額と取引先を入れて、パイプラインに載せます。' },
          { title: 'カードを動かして進める', body: 'ドラッグでステージを動かすと、確度加重の金額が自動で計算されます。' },
        ]}
      />

      <section className="grid gap-3" aria-labelledby="sfa-summary-title">
        <h2 id="sfa-summary-title" className="text-base font-bold text-slate-900">売上サマリー</h2>
        {summaryError && (summary
          ? <ErrorNotice what="営業状況を取得できませんでした。" how="以下は前回取得したときの値です。" onRetry={() => setRetry(n => n + 1)} retryLabel="再試行" />
          : <SfaLoadError error={summaryFailure} what="営業状況" onRetry={() => setRetry(n => n + 1)} orgSlug={orgSlug} />)}
        {summary && summary.totalCount === 0 && !summaryError ? (
          <Card>
            <EmptyState
              title="まだ商談がありません"
              description="最初の商談を登録すると、パイプラインと売上の集計がここに出ます。"
              art="/sfa/empty-deals.webp"
              action={<Button href={`${base}/deals`} icon="Plus">最初の商談を登録する</Button>}
            />
          </Card>
        ) : (
          <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StaggerItem index={0}><StatTile label="進行中パイプライン" value={summary ? yenValue(summary.openTotal) : '—'} unit={summary && typeof yenValue(summary.openTotal) === 'number' ? '円' : undefined} icon="LineChart" href={`${base}/deals`} /></StaggerItem>
            <StaggerItem index={1}><StatTile label="確度加重" value={summary ? yenValue(summary.weighted) : '—'} unit={summary && typeof yenValue(summary.weighted) === 'number' ? '円' : undefined} icon="Target" href={`${base}/deals`} /></StaggerItem>
            <StaggerItem index={2}><StatTile label="受注合計" value={summary ? yenValue(summary.wonTotal) : '—'} unit={summary && typeof yenValue(summary.wonTotal) === 'number' ? '円' : undefined} icon="BadgeJapaneseYen" href={`${base}/deals`} /></StaggerItem>
            <StaggerItem index={3}><StatTile label="進行中の商談" value={summary ? summary.openCount : '—'} unit={summary ? '件' : undefined} icon="Briefcase" href={`${base}/deals`} sub={staleCount > 0 ? <span className="text-red-600">{STALE_DAYS}日以上動いていない商談 {staleCount}件</span> : undefined} /></StaggerItem>
          </Stagger>
        )}
        {summaryLoading && !summary && <p role="status" className="text-sm text-slate-500">集計を取得しています…</p>}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="タスク" icon="ListChecks" meta={`未完了 ${openTaskCount ?? '—'}件`}>
          <div className="mb-3 flex gap-2">
            <input
              ref={taskInput}
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && addTask()}
              placeholder="例: A社に見積を送る"
              aria-label="新しいタスク"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#0066ff] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066ff]/30"
            />
            <button type="button" onClick={addTask} disabled={busy || mutations.creationBlocked('task') || !ready} className="min-h-11 shrink-0 whitespace-nowrap rounded-xl bg-[#0066ff] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0052cc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066ff] focus-visible:ring-offset-2 disabled:opacity-50">
              追加
            </button>
          </div>
          {hasMoreTasks && <Link href={`${base}/tasks`} className="mb-2 block text-sm text-[#0066ff] underline">最初の{tasks.length}件を表示中。すべてのタスクを見る</Link>}
          {tasksLoaded && !taskError && tasks.length === 0 && (
            <SfaEmpty
              bare
              title="まだタスクがありません"
              description="上の欄にやることを入れて「追加」を押すと、ここに並びます。"
              action={<Button onClick={() => taskInput.current?.focus()} icon="Plus">タスクを入力する</Button>}
              legacy={null}
            />
          )}
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {taskError && <SfaLoadError error={taskFailure} what="タスク" onRetry={loadTasks} orgSlug={orgSlug} />}
            {!tasksLoaded && !taskError && <p role="status" className="text-sm text-slate-500">タスクを取得しています…</p>}
            {tasks.map((t) => {
              const due = fmtDue(t.dueDate)
              const done = t.status === 'done'
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTask(t)}
                  disabled={mutations.blocked('task:' + t.id)}
                  aria-busy={mutations.blocked('task:' + t.id)}
                  aria-pressed={done}
                  className="flex min-h-11 w-full items-center gap-2.5 rounded-xl p-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066ff]"
                >
                  {done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#0066ff]" aria-hidden /> : <Circle className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />}
                  <span className={`min-w-0 flex-1 truncate text-sm ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{t.title}</span>
                  {due && !done && <span className={`shrink-0 whitespace-nowrap text-xs font-bold tabular-nums ${due.cls}`}>{due.label}</span>}
                </button>
              )
            })}
          </div>
        </Card>

        <Card title="クイックアクション" icon="Sparkles">
          <div className="grid gap-1">
            {quick.map(({ href, icon: Icon, title, sub }) => (
              <Link key={href} href={href} className="group flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066ff]">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#0066ff]/10 text-[#0066ff]"><Icon className="h-5 w-5" aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900">{title}</span>
                  <span className="block text-xs text-slate-500">{sub}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
