'use client'

// 経営エージェント（見本）：ホームの依頼から、計画 → 複数のAIを同時に実行 → 承認 → まとめ。
// 見本のため生成・送信・DB操作は行わない。進み方はタイマーで再現する。
// 外に影響する操作は必ず承認を待つ／依頼者の権限の範囲で動く／すべて記録する、を画面で見せる。
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, StopCircle, Eye, FileText, Lock, Send, ShieldCheck, Sparkles, X } from 'lucide-react'
import rs from '../renewal.module.css'
import a from './agent.module.css'
import { Badge, Burst, Glass, GlowBorder, Sheet, StatTile, Toggle, Typewriter, useFlash } from './kit'
import { CountUp, Ring } from '../motion'
import { mascotOf } from '../data'
import { getServiceById } from '@/lib/services'
import { pickScenario, type AgentTask, type Preview } from './agentScenarios'

type Phase = 'think' | 'plan' | 'run' | 'done' | 'stopped'
type Status = 'wait' | 'run' | 'done' | 'approve' | 'approved' | 'skipped' | 'stopped'
type TaskState = { status: Status; p: number }

const FINISHED: Status[] = ['done', 'approved', 'skipped', 'stopped']
const nameOf = (id: string) => getServiceById(id)?.name ?? id

export default function AgentRun({ request, onOpen }: { request: string; onOpen: (serviceId: string) => void }) {
  const sc = useMemo(() => pickScenario(request), [request])
  const [phase, setPhase] = useState<Phase>('think')
  const [thought, setThought] = useState(0)
  const [tasks, setTasks] = useState<Record<string, TaskState>>(() => Object.fromEntries(sc.tasks.map((t) => [t.id, { status: 'wait', p: 0 }])))
  const [feed, setFeed] = useState<{ t: number; text: string; tone?: 'ok' | 'warn' }[]>([])
  const [detail, setDetail] = useState<AgentTask | null>(null)
  const [weekly, setWeekly] = useState(false)
  const [flash, setFlash] = useFlash()
  const startAt = useRef(Date.now())
  const waves = useMemo(() => Array.from(new Set(sc.tasks.map((t) => t.wave))).sort((x, y) => x - y), [sc])

  const log = (text: string, tone?: 'ok' | 'warn') => setFeed((f) => [...f, { t: Math.round((Date.now() - startAt.current) / 1000), text, tone }])

  // 依頼が変わったら最初から
  useEffect(() => {
    setPhase('think')
    setThought(0)
    setTasks(Object.fromEntries(sc.tasks.map((t) => [t.id, { status: 'wait', p: 0 }])))
    setFeed([])
    startAt.current = Date.now()
  }, [sc])

  // 考える → 計画
  useEffect(() => {
    if (phase !== 'think') return
    if (thought >= sc.thinking.length) {
      const id = window.setTimeout(() => {
        setPhase('plan')
        log(`計画：${sc.tasks.length}つの作業を ${waves.length}段階で進めます`)
      }, 500)
      return () => window.clearTimeout(id)
    }
    const id = window.setTimeout(() => setThought((n) => n + 1), thought === 0 ? 500 : 900)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, thought, sc])

  // 計画 → 実行
  useEffect(() => {
    if (phase !== 'plan') return
    const id = window.setTimeout(() => setPhase('run'), 1600)
    return () => window.clearTimeout(id)
  }, [phase])

  // 実行：段階ごとに、その段階の作業を同時に進める。
  // 次の状態は ref から計算して、記録は更新関数の外で足す（StrictMode の二重実行で記録が重複しないように）
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks
  useEffect(() => {
    if (phase !== 'run') return
    const id = window.setInterval(() => {
      const prev = tasksRef.current
      const current = waves.find((w) => sc.tasks.some((t) => t.wave === w && (prev[t.id].status === 'wait' || prev[t.id].status === 'run')))
      if (current === undefined) return
      const next = { ...prev }
      const notes: [string, 'ok' | 'warn' | undefined][] = []
      for (const t of sc.tasks) {
        if (t.wave !== current) continue
        const st = prev[t.id]
        if (st.status === 'wait') {
          next[t.id] = { status: 'run', p: 0 }
          notes.push([`${nameOf(t.serviceId)}：${t.title}を開始`, undefined])
        } else if (st.status === 'run') {
          const p = Math.min(1, st.p + 120 / t.ms)
          if (p >= 1) {
            next[t.id] = { status: t.approval ? 'approve' : 'done', p: 1 }
            notes.push(t.approval ? [`承認待ち：${t.approval.title}`, 'warn'] : [`${nameOf(t.serviceId)}：${t.title}が完了`, 'ok'])
          } else next[t.id] = { status: 'run', p }
        }
      }
      tasksRef.current = next
      setTasks(next)
      notes.forEach(([text, tone]) => log(text, tone))
    }, 120)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sc, waves])

  // すべて終わったらまとめへ
  useEffect(() => {
    if (phase !== 'run') return
    if (sc.tasks.every((t) => FINISHED.includes(tasks[t.id].status))) {
      const id = window.setTimeout(() => {
        setPhase('done')
        log('すべての作業が終わりました', 'ok')
      }, 600)
      return () => window.clearTimeout(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, phase, sc])

  const decide = (t: AgentTask, ok: boolean) => {
    setTasks((prev) => ({ ...prev, [t.id]: { status: ok ? 'approved' : 'skipped', p: 1 } }))
    log(ok ? `あなたが承認：${t.approval?.title}` : `取りやめ：${t.approval?.title}`, ok ? 'ok' : undefined)
    setDetail(null)
  }
  const stop = () => {
    setTasks((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, FINISHED.includes(v.status) ? v : { ...v, status: 'stopped' as Status }])))
    setPhase('stopped')
    log('あなたが停止しました。動いていた作業はすべて止めました', 'warn')
  }

  const list = sc.tasks.map((t) => ({ t, st: tasks[t.id] }))
  const running = list.filter((x) => x.st.status === 'run').length
  const waiting = list.filter((x) => x.st.status === 'approve').length
  const finished = list.filter((x) => FINISHED.includes(x.st.status)).length
  // 承認待ちは「あなたの番」なので 100% にはしない
  const pct = Math.round((list.reduce((s, x) => s + (FINISHED.includes(x.st.status) ? 1 : x.st.status === 'approve' ? 0.9 : x.st.p), 0) / list.length) * 100)
  const skipped = list.filter((x) => x.st.status === 'skipped' && x.t.approval)
  const active = phase === 'think' || phase === 'plan' || phase === 'run'

  return (
    <div className={`${rs.tool} ${a.wrap}`}>
      {/* 依頼と、エージェントの受け答え */}
      <div className={a.ask}>
        <span className={a.me} aria-hidden="true">
          ミ
        </span>
        <p className={a.bubble}>{request}</p>
      </div>

      <div className={a.head}>
        <span className={a.logo}>
          <Sparkles size={18} strokeWidth={2} />
        </span>
        <div>
          <p className={a.agentName}>ドヤAIエージェント</p>
          <h1 className={a.goal}>{sc.goal}</h1>
        </div>
        <div className={a.headRight}>
          <span className={a.state} data-phase={phase}>
            <i />
            {{ think: '考えています', plan: '計画を立てました', run: `${running}つのAIが作業中`, done: '完了', stopped: '停止しました' }[phase]}
          </span>
          {active && (
            <button type="button" className={a.stop} onClick={stop}>
              <StopCircle size={15} strokeWidth={2} />
              止める
            </button>
          )}
        </div>
      </div>

      <div className={a.body}>
        <div className={a.main}>
          {/* 考え */}
          <Glass className={a.think}>
            <p className={a.cap}>考えたこと</p>
            <ol>
              {sc.thinking.slice(0, thought + 1).map((line, i) => (
                <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <span className={a.thinkIcon}>{i < thought || phase !== 'think' ? <Check size={12} strokeWidth={3} /> : <i className={a.dots} />}</span>
                  <span className={a.thinkText}>{i === thought && phase === 'think' ? <Typewriter text={line} speed={22} /> : line}</span>
                </motion.li>
              ))}
            </ol>
          </Glass>

          {/* 計画：段階ごとに、同時に走る作業を並べる */}
          <AnimatePresence>
            {phase !== 'think' && (
              <motion.div className={a.plan} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <p className={a.cap}>計画</p>
                <div className={a.waves}>
                  {waves.map((w, wi) => {
                    const items = sc.tasks.filter((t) => t.wave === w)
                    return (
                      <div key={w} className={a.wave} style={{ '--i': wi } as CSSProperties}>
                        <p className={a.waveHead}>
                          段階 {wi + 1}
                          <small>{items.length > 1 ? `${items.length}つを同時に` : '1つ'}</small>
                        </p>
                        {items.map((t) => (
                          <span key={t.id} className={a.planItem} data-status={tasks[t.id].status}>
                            <img src={mascotOf(t.serviceId)} alt="" />
                            {t.title}
                            {t.approval && <Lock size={11} strokeWidth={2.4} aria-label="承認が必要" />}
                          </span>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 作業カード */}
          {phase !== 'think' && (
            <div className={a.grid}>
              {list.map(({ t, st }, i) => (
                <TaskCard key={t.id} task={t} st={st} index={i} onApprove={() => decide(t, true)} onSkip={() => decide(t, false)} onDetail={() => setDetail(t)} onOpen={() => onOpen(t.serviceId)} />
              ))}
            </div>
          )}

          {/* まとめ */}
          <AnimatePresence>
            {phase === 'done' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 26 }}>
                <GlowBorder className={a.summaryWrap}>
                  <div className={a.summary}>
                    <Burst />
                    <p className={a.cap}>まとめ</p>
                    <h2 className={a.sumHead}>{sc.summary.headline}</h2>
                    <ul className={a.points}>
                      {sc.summary.points
                        .filter((p) => !skipped.some((x) => x.t.summaryKey && p.includes(x.t.summaryKey)))
                        .map((p) => (
                          <li key={p}>
                            <Check size={14} strokeWidth={3} />
                            {p}
                          </li>
                        ))}
                      {skipped.map((x) => (
                        <li key={x.t.id} className={a.pointSkip}>
                          <X size={14} strokeWidth={3} />
                          取りやめ：{x.t.approval?.title}（何も送っていません）
                        </li>
                      ))}
                    </ul>
                    <div className={a.impact}>
                      {sc.summary.impact.map((m) => (
                        <StatTile key={m.label} label={m.label} value={m.value} unit={m.unit} decimals={m.decimals} />
                      ))}
                    </div>
                    <p className={a.cap}>次にやること</p>
                    <ol className={a.next}>
                      {sc.summary.next.map((n, i) => (
                        <li key={n}>
                          <span>{i + 1}</span>
                          {n}
                        </li>
                      ))}
                    </ol>
                    <div className={a.sumActions}>
                      <button type="button" className={rs.btnPrimary} onClick={() => setFlash('Slackに共有しました（見本）')}>
                        <span>チームに共有</span>
                        <span className={rs.arw}>
                          <Send size={14} strokeWidth={2} />
                        </span>
                      </button>
                      <Toggle on={weekly} onChange={(v) => {
                        setWeekly(v)
                        if (v) setFlash('毎週月曜の朝に、同じ作業を任せます（見本）')
                      }} label="毎週この作業を任せる" />
                    </div>
                  </div>
                </GlowBorder>
              </motion.div>
            )}
          </AnimatePresence>

          {phase === 'stopped' && (
            <Glass className={a.stopped}>
              <StopCircle size={18} />
              作業を止めました。終わっていた分の結果は残っています。外に出る操作は行っていません。
            </Glass>
          )}
        </div>

        {/* 右：実行のようす */}
        <aside className={a.side}>
          <Glass className={a.meter}>
            <Ring value={pct} size={92} stroke={8} color="var(--k2)">
              <b className={rs.num}>{pct}</b>
              <small>%</small>
            </Ring>
            <dl>
              <div>
                <dt>作業中</dt>
                <dd>{running}</dd>
              </div>
              <div>
                <dt>承認待ち</dt>
                <dd data-warn={waiting > 0 ? '' : undefined}>{waiting}</dd>
              </div>
              <div>
                <dt>完了</dt>
                <dd>
                  {finished}/{list.length}
                </dd>
              </div>
            </dl>
          </Glass>

          <Glass className={a.safe}>
            <p className={a.safeHead}>
              <ShieldCheck size={16} strokeWidth={2} />
              安全のための約束
            </p>
            <ul>
              <li>
                <Lock size={13} />
                メール送信・公開・承認など外に出る操作は、必ずあなたの承認後に行います
              </li>
              <li>
                <Eye size={13} />
                あなたが見られるデータの範囲でだけ動きます
              </li>
              <li>
                <FileText size={13} />
                すべての操作を記録しています
              </li>
            </ul>
          </Glass>

          <Glass className={a.feed}>
            <p className={a.cap}>記録</p>
            <ul>
              <AnimatePresence initial={false}>
                {[...feed].reverse().slice(0, 14).map((f) => (
                  <motion.li key={`${f.t}-${f.text}`} layout initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} data-tone={f.tone}>
                    <time>{`${String(Math.floor(f.t / 60)).padStart(2, '0')}:${String(f.t % 60).padStart(2, '0')}`}</time>
                    {f.text}
                  </motion.li>
                ))}
              </AnimatePresence>
              {feed.length === 0 && <li className={a.feedEmpty}>まだ記録はありません</li>}
            </ul>
          </Glass>
        </aside>
      </div>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.approval?.title ?? ''}>
        {detail && (
          <div className={a.sheet}>
            <p>{detail.approval?.body}</p>
            <PreviewView pv={detail.result} />
            <div className={a.sheetActions}>
              <button type="button" className={rs.btnPrimary} onClick={() => decide(detail, true)}>
                <span>{detail.approval?.action}</span>
                <span className={rs.arw}>
                  <Check size={14} strokeWidth={2.4} />
                </span>
              </button>
              <button type="button" className={rs.btnGhost} onClick={() => decide(detail, false)}>
                やめる
              </button>
            </div>
          </div>
        )}
      </Sheet>
      {flash}
    </div>
  )
}

function TaskCard({
  task: t,
  st,
  index,
  onApprove,
  onSkip,
  onDetail,
  onOpen,
}: {
  task: AgentTask
  st: TaskState
  index: number
  onApprove: () => void
  onSkip: () => void
  onDetail: () => void
  onOpen: () => void
}) {
  const logIdx = Math.min(t.logs.length - 1, Math.floor(st.p * t.logs.length))
  const label = { wait: '待機', run: '作業中', done: '完了', approve: '承認待ち', approved: '承認済み', skipped: '取りやめ', stopped: '停止' }[st.status]
  const tone = ({ wait: 'muted', run: 'grad', done: 'ok', approve: 'warn', approved: 'ok', skipped: 'muted', stopped: 'muted' } as const)[st.status]
  return (
    <motion.article
      className={a.card}
      data-status={st.status}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 260, damping: 26 }}
      layout
      data-spot
    >
      <header className={a.cardHead}>
        <span className={a.cardMascot}>
          <img src={mascotOf(t.serviceId)} alt="" />
          {st.status === 'run' && <i className={a.pulse} aria-hidden="true" />}
        </span>
        <div>
          <p className={a.cardSvc}>{nameOf(t.serviceId)}</p>
          <p className={a.cardTitle}>{t.title}</p>
        </div>
        <Badge tone={tone}>{label}</Badge>
      </header>
      <code className={a.tool}>{t.tool}</code>

      {(st.status === 'run' || st.status === 'wait') && (
        <div className={a.progress}>
          <span className={a.bar}>
            <span style={{ transform: `scaleX(${st.p})` }} />
          </span>
          <AnimatePresence mode="wait">
            <motion.p key={st.status === 'wait' ? 'w' : logIdx} className={a.logLine} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
              {st.status === 'wait' ? '前の段階が終わるのを待っています' : t.logs[logIdx]}
            </motion.p>
          </AnimatePresence>
        </div>
      )}

      {(st.status === 'done' || st.status === 'approve' || st.status === 'approved' || st.status === 'skipped') && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={a.result}>
          <PreviewView pv={t.result} />
        </motion.div>
      )}

      {st.status === 'approve' && t.approval && (
        <div className={a.approval}>
          <p>
            <Lock size={13} strokeWidth={2.4} />
            {t.approval.title}
          </p>
          <div>
            <button type="button" className={a.approveBtn} onClick={onApprove}>
              <Check size={14} strokeWidth={2.6} />
              {t.approval.action}
            </button>
            <button type="button" className={a.textBtn} onClick={onDetail}>
              内容を見る
            </button>
            <button type="button" className={a.textBtn} onClick={onSkip}>
              <X size={13} />
              やめる
            </button>
          </div>
        </div>
      )}

      {(st.status === 'done' || st.status === 'approved') && (
        <button type="button" className={a.open} onClick={onOpen}>
          {nameOf(t.serviceId)}で開く
          <ArrowRight size={13} strokeWidth={2.2} />
        </button>
      )}
    </motion.article>
  )
}

function PreviewView({ pv }: { pv: Preview }) {
  if (pv.kind === 'images')
    return (
      <div className={a.pvImages}>
        <div>
          {pv.srcs.map((src, i) => (
            <motion.img key={src} src={src} alt="" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }} />
          ))}
        </div>
        <small>{pv.caption}</small>
      </div>
    )
  if (pv.kind === 'rows')
    return (
      <table className={a.pvTable}>
        <thead>
          <tr>
            {pv.head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pv.rows.map((r) => (
            <tr key={r[0]}>
              {r.map((c, i) => (
                <td key={i}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  if (pv.kind === 'stats')
    return (
      <div className={a.pvStats}>
        {pv.items.map((it) => (
          <div key={it.label}>
            <small>{it.label}</small>
            <b>
              <CountUp value={it.value} decimals={it.decimals ?? 0} duration={1000} />
              <em>{it.unit}</em>
            </b>
          </div>
        ))}
      </div>
    )
  if (pv.kind === 'money')
    return (
      <div className={a.pvMoney}>
        <small>{pv.label}</small>
        <b>
          ¥<CountUp value={pv.value} duration={1200} />
        </b>
        <em>{pv.note}</em>
      </div>
    )
  return (
    <ul className={a.pvLines}>
      {pv.lines.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ul>
  )
}
