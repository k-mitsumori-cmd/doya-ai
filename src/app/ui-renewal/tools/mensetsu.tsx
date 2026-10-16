'use client'

// ドヤ面接官（見本）：企業URL → 質問セット → AI面接 → 評価レポート。API は呼ばない。
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion, Reorder } from 'framer-motion'
import { ChevronDown, GripVertical, Link2, Quote, ShieldCheck, Sparkles } from 'lucide-react'
import rs from '../renewal.module.css'
import m from './mensetsu.module.css'
import { CountUp } from '../motion'
import { mascotOf } from '../data'
import {
  Badge,
  ChipSelect,
  Field,
  Glass,
  GlowBorder,
  IdleCanvas,
  Meter,
  Panel,
  ResultHead,
  RunButton,
  RunStage,
  ServiceHero,
  Steps,
  TextInput,
  Tabs,
  Workbench,
  useRun,
  type RunStep,
} from './kit'

const STEPS: RunStep[] = [
  { label: '企業サイトを読む', log: ['ページを取得しています', '事業内容と求める人物像を抜き出しました'] },
  { label: '質問を組む', log: ['職種に合わせて主質問を5つ作成', '深掘りの質問を用意しました'] },
  { label: '面接を行う', log: ['AI面接官が一次面接を実施', '応募者の回答を記録しました'] },
  { label: '評価をまとめる', log: ['評価軸ごとに採点', '根拠となる発言を引用しました'] },
]
const FLOW = ['企業を読む', '質問をつくる', '面接する', '評価を見る']
const JOBS = ['営業', 'エンジニア', '事務', '販売'] as const
type Tab = 'q' | 'talk' | 'report'

const QUESTIONS = [
  { id: 'q1', axis: '志望動機', q: '当社を志望した理由を、これまでの経験とつなげて教えてください。', deep: ['その経験で最も苦労した点は何でしたか', '他社ではなく当社を選んだ決め手は何ですか'] },
  { id: 'q2', axis: '主体性', q: '自分から動いて状況を変えた経験があれば教えてください。', deep: ['周りの反応はどうでしたか', '次に同じ場面があれば何を変えますか'] },
  { id: 'q3', axis: '対人力', q: '意見が合わない相手と、仕事を進めた経験を教えてください。', deep: ['相手の考えをどう理解しましたか', '最終的にどう折り合いをつけましたか'] },
  { id: 'q4', axis: '学習力', q: '直近で新しく身につけたことと、その方法を教えてください。', deep: ['続けるために工夫したことはありますか'] },
  { id: 'q5', axis: '将来像', q: '入社後3年で、どんな仕事を任されていたいですか。', deep: ['そのために今できる準備は何ですか', '不安に感じることはありますか'] },
]
const ANSWERS = [
  '前職で小さな店舗の販売を担当し、お客さまの悩みを聞いて提案する仕事に手応えを感じました。御社なら、その力を広い範囲で活かせると考えました。',
  '在庫の入れ替えが遅い問題に気づき、週1回の棚卸し表を自分で作って共有しました。2か月で売れ残りが約3割減りました。',
  '先輩と仕入れ量で意見が割れた際、過去の売上を並べて話し合い、まず試験的に半分だけ変える案でまとまりました。',
  '表計算の関数を独学で学びました。毎朝15分だけ使う決まりにして、3か月続けました。',
  '3年後には小さなチームをまとめ、新人の育成も担当していたいです。',
]
const AXES = [
  { label: '志望動機', v: 82, quote: '「その力を広い範囲で活かせると考えました」' },
  { label: '主体性', v: 90, quote: '「週1回の棚卸し表を自分で作って共有しました」' },
  { label: '対人力', v: 78, quote: '「過去の売上を並べて話し合い」' },
  { label: '学習力', v: 74, quote: '「毎朝15分だけ使う決まりにして、3か月続けました」' },
  { label: '将来像', v: 68, quote: '「小さなチームをまとめ、新人の育成も」' },
]

/** レーダー（5軸）の座標 */
function radarPoints(vals: number[], r: number, cx: number, cy: number) {
  return vals.map((v, i) => {
    const a = -Math.PI / 2 + (i / vals.length) * Math.PI * 2
    return [cx + Math.cos(a) * r * (v / 100), cy + Math.sin(a) * r * (v / 100)] as const
  })
}

export default function MensetsuTool() {
  const run = useRun(STEPS)
  const [url, setUrl] = useState('https://example-company.co.jp/recruit')
  const [job, setJob] = useState<(typeof JOBS)[number]>('営業')
  const current = run.phase === 'input' ? 0 : run.phase === 'run' ? Math.min(3, run.step) : 3
  return (
    <div className={rs.tool}>
      <ServiceHero
        serviceId="mensetsu"
        catchCopy="一次面接を、AIが代わりに。"
        points={['企業サイトから質問と評価基準を作成', 'AIアバターが一次面接を実施', '評価レポートを根拠つきで残す']}
        stats={[
          { label: '1人あたりの面接時間', value: 18, unit: '分' },
          { label: '評価のばらつき', value: 35, unit: '%減' },
        ]}
      />
      <Steps steps={FLOW} current={current} />
      <Workbench
        form={
          <Panel title="面接の条件">
            <Field label="企業のURL" hint="募集ページでも可">
              <TextInput value={url} onChange={setUrl} icon={<Link2 size={15} />} ariaLabel="企業のURL" />
            </Field>
            <Field label="募集する職種">
              <ChipSelect id="mensetsu-job" options={JOBS} value={job} onChange={setJob} />
            </Field>
            <p className={m.safe}>
              <ShieldCheck size={14} />
              年齢・出身・家族構成など、差別につながる質問は自動でブロックされます。
            </p>
            <RunButton onClick={run.start} disabled={run.phase === 'run'}>
              質問と面接を用意する
            </RunButton>
          </Panel>
        }
      >
        {run.phase === 'input' && <IdleCanvas serviceId="mensetsu" title="企業の求める人物像から、質問と評価の物差しを作ります" steps={['サイトを読む', '質問をつくる', 'AIが面接する', '評価を残す']} />}
        {run.phase === 'run' && <RunStage serviceId="mensetsu" steps={STEPS} step={run.step} lines={run.lines} pct={run.pct} skeleton="rows" />}
        {run.phase === 'done' && <Result job={job} onRetry={run.reset} />}
      </Workbench>
    </div>
  )
}

function Result({ job, onRetry }: { job: string; onRetry: () => void }) {
  const [tab, setTab] = useState<Tab>('q')
  return (
    <div className={m.result}>
      <ResultHead title={`${job}職の一次面接が完了しました`} note="判定は推薦度で、最終決定は人が行います。" onRetry={onRetry} />
      <Tabs
        id="mensetsu"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'q', label: '質問セット', count: QUESTIONS.length },
          { id: 'talk', label: '面接の様子' },
          { id: 'report', label: '評価レポート' },
        ]}
      />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
          {tab === 'q' && <QuestionSet />}
          {tab === 'talk' && <Talk />}
          {tab === 'report' && <Report />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function QuestionSet() {
  const [list, setList] = useState(QUESTIONS)
  const [open, setOpen] = useState<string | null>('q1')
  return (
    <div>
      <p className={m.hint}>つまみをドラッグすると、質問の順番を入れ替えられます。</p>
      <Reorder.Group axis="y" values={list} onReorder={setList} className={m.qList}>
        {list.map((q, i) => (
          <Reorder.Item key={q.id} value={q} className={m.qItem} whileDrag={{ scale: 1.02, boxShadow: '0 18px 40px -14px rgba(80,60,255,0.45)' }}>
            <div className={m.qRow}>
              <GripVertical size={16} className={m.grip} aria-hidden="true" />
              <span className={m.qNo}>{i + 1}</span>
              <button type="button" className={m.qBtn} onClick={() => setOpen(open === q.id ? null : q.id)} aria-expanded={open === q.id}>
                <span className={m.qText}>{q.q}</span>
                <Badge tone="muted">{q.axis}</Badge>
                <ChevronDown size={16} className={m.chev} data-open={open === q.id ? '' : undefined} />
              </button>
            </div>
            <AnimatePresence initial={false}>
              {open === q.id && (
                <motion.ul className={m.deep} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  {q.deep.map((d) => (
                    <li key={d}>
                      <small>深掘り</small>
                      {d}
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </div>
  )
}

function Talk() {
  const [n, setN] = useState(1) // 表示するやり取り数（質問+回答で2つ）
  const total = QUESTIONS.length * 2
  useEffect(() => {
    if (n >= total) return
    const id = window.setTimeout(() => setN((v) => v + 1), n % 2 ? 1500 : 1900)
    return () => window.clearTimeout(id)
  }, [n, total])
  const speaking = n < total && n % 2 === 1 // 奇数個目は面接官の発話中
  const items = useMemo(() => Array.from({ length: Math.min(n, total) }, (_, i) => i), [n, total])
  return (
    <div className={m.talk}>
      <div className={m.avatarCol}>
        <div className={m.avatar} data-speaking={speaking ? '' : undefined}>
          <i /> <i /> <i />
          <img src={mascotOf('mensetsu')} alt="AI面接官" />
        </div>
        <p className={m.avatarName}>AI面接官</p>
        <p className={m.avatarState}>{n >= total ? '面接は終了しました' : speaking ? '質問しています' : '回答を聞いています'}</p>
        <button type="button" className={m.replay} onClick={() => setN(1)}>
          最初から見る
        </button>
      </div>
      <ol className={m.bubbles}>
        {items.map((i) => {
          const isQ = i % 2 === 0
          const idx = Math.floor(i / 2)
          return (
            <motion.li key={i} data-who={isQ ? 'ai' : 'me'} initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
              <small>{isQ ? `質問 ${idx + 1}` : '応募者'}</small>
              {isQ ? QUESTIONS[idx].q : ANSWERS[idx]}
            </motion.li>
          )
        })}
      </ol>
    </div>
  )
}

function Report() {
  const [go, setGo] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setGo(true), 120)
    return () => window.clearTimeout(id)
  }, [])
  const size = 220
  const c = size / 2
  const R = 78
  const full = radarPoints(AXES.map(() => 100), R, c, c)
  const pts = radarPoints(AXES.map((a) => a.v), R, c, c)
  const poly = (p: readonly (readonly [number, number])[]) => p.map((q) => q.join(',')).join(' ')
  const avg = Math.round(AXES.reduce((s, a) => s + a.v, 0) / AXES.length)
  return (
    <div className={m.report}>
      <GlowBorder>
        <Glass className={m.radarCard}>
          <svg viewBox={`0 0 ${size} ${size}`} className={m.radar} role="img" aria-label="評価軸ごとのレーダーチャート">
            <defs>
              <linearGradient id="mn-rad" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" style={{ stopColor: 'var(--k1)' }} stopOpacity="0.55" />
                <stop offset="1" style={{ stopColor: 'var(--k3)' }} stopOpacity="0.45" />
              </linearGradient>
            </defs>
            {[0.33, 0.66, 1].map((k) => (
              <polygon key={k} points={poly(full.map(([x, y]) => [c + (x - c) * k, c + (y - c) * k] as const))} className={m.radarGrid} />
            ))}
            {full.map(([x, y], i) => (
              <line key={i} x1={c} y1={c} x2={x} y2={y} className={m.radarGrid} />
            ))}
            <polygon points={poly(pts)} fill="url(#mn-rad)" className={m.radarArea} data-go={go ? '' : undefined} />
            {full.map(([x, y], i) => (
              <text key={AXES[i].label} x={c + (x - c) * 1.2} y={c + (y - c) * 1.2 + 3} textAnchor="middle" className={m.radarText}>
                {AXES[i].label}
              </text>
            ))}
          </svg>
          <div className={m.score}>
            <small>総合の推薦度</small>
            <b>
              <CountUp value={avg} />
              <em>/100</em>
            </b>
            <Badge tone="ok">次の面接へ進める目安</Badge>
          </div>
        </Glass>
      </GlowBorder>
      <div className={m.axes}>
        {AXES.map((a, i) => (
          <Glass key={a.label} className={m.axis}>
            <Meter label={a.label} value={a.v} i={i} />
            <p className={m.quote}>
              <Quote size={13} />
              {a.quote}
            </p>
          </Glass>
        ))}
        <p className={m.note}>
          <Sparkles size={13} />
          この判定は推薦度です。最終決定は人が行います。
        </p>
      </div>
    </div>
  )
}
