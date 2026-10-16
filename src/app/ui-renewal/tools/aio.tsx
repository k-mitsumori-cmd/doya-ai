'use client'

import { useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, MessageSquare, Plus, Tag, X } from 'lucide-react'
import rs from '../renewal.module.css'
import c from './aio.module.css'
import {
  Badge,
  Bars,
  Burst,
  Glass,
  GhostButton,
  IdleCanvas,
  Meter,
  Panel,
  ResultHead,
  RunButton,
  RunStage,
  ServiceHero,
  Sparkline,
  StatTile,
  Steps,
  TextInput,
  Typewriter,
  useRun,
  type RunStep,
} from './kit'

const STEPS: RunStep[] = [
  { label: '質問を投げる', log: ['4つのAIに同じ質問を送りました', '各質問を5回ずつ繰り返しました'] },
  { label: '回答を集める', log: ['回答文を保存しました', '引用元のドメインを抜き出しました'] },
  { label: '言及を数える', log: ['ブランド名の出現を数えました', '競合の言及も同じ基準で数えました'] },
  { label: '改善案を作る', log: ['引用されやすい形を調べました', '次の一手を4つ選びました'] },
]

const INITIAL_Q = ['中小企業向けの広告画像作成ツールのおすすめは', 'AIで広告バナーを自動で作れるサービスは', '広告画像の作成を外注せずに済ませる方法']
const SUGGEST = ['SNS広告の画像を安く作るには', 'バナー制作の比較と選び方']

const AIS = [
  { name: 'ChatGPT', v: 64 },
  { name: 'Gemini', v: 48 },
  { name: 'Claude', v: 57 },
  { name: 'Perplexity', v: 72 },
]
const TREND = [28, 31, 30, 38, 42, 41, 49, 55, 58, 63]
const COMP = [
  { label: '自社', value: 34, hi: true },
  { label: 'A社', value: 29 },
  { label: 'B社', value: 22 },
  { label: 'C社', value: 15 },
]

const ACTIONS = [
  '比較記事に自社の料金と強みを表にして載せる',
  '公式サイトの説明文を、AIが引用しやすい一文に直す',
  '業界メディアでの掲載事例を2本増やす',
  'よくある質問ページにQ&Aを10件追加する',
]

function Answer({ brand }: { brand: string }) {
  const parts = [
    '中小企業が広告画像を手早く用意するなら、',
    brand,
    'は、URLを貼るだけで媒体ごとのサイズを一度に作れる点が評価されています。',
    '一方でA社はテンプレートが豊富で、',
    brand,
    'は文字の自動検査があるため、入稿前の手戻りが少ない傾向です。',
  ]
  return (
    <p className={c.answer}>
      {parts.map((t, i) =>
        t === brand ? (
          <mark key={i} className={c.mark}>
            {t}
          </mark>
        ) : (
          <span key={i}>{t}</span>
        ),
      )}
    </p>
  )
}

export default function AIOTool() {
  const [brand, setBrand] = useState('ドヤ広告')
  const [qs, setQs] = useState<string[]>(INITIAL_Q)
  const [draft, setDraft] = useState('')
  const [done, setDone] = useState<boolean[]>(ACTIONS.map(() => false))
  const [burst, setBurst] = useState<number | null>(null)
  const run = useRun(STEPS)

  const add = (t: string) => {
    const v = t.trim()
    if (!v || qs.includes(v)) return
    setQs([...qs, v])
    setDraft('')
  }
  const toggle = (i: number) => {
    setDone((d) => d.map((x, j) => (j === i ? !x : x)))
    if (!done[i]) {
      setBurst(i)
      window.setTimeout(() => setBurst(null), 800)
    }
  }
  const left = suggestLeft(qs)

  return (
    <div className={rs.tool}>
      <ServiceHero
        serviceId="aio"
        catchCopy="AIの答えに、あなたの名前は出ていますか"
        points={['4つのAIでの言及率を定点観測', '競合との差がひと目でわかる', '次にやることまで提案']}
        stats={[
          { label: '言及率', value: 63, unit: '%' },
          { label: '見ているAI', value: 4, unit: '種' },
        ]}
      />
      <Steps steps={['質問を決める', '4つのAIに聞く', '言及を数える', '改善案を見る']} current={run.phase === 'input' ? 0 : run.phase === 'done' ? 3 : Math.min(run.step, 3)} />

      <div className={c.setup}>
        <Panel title="ブランド名">
          <TextInput value={brand} onChange={setBrand} icon={<Tag size={16} strokeWidth={1.75} />} ariaLabel="ブランド名" />
        </Panel>
        <Panel title={`監視する質問（${qs.length}件）`}>
          <ul className={c.qList}>
            <AnimatePresence initial={false}>
              {qs.map((q) => (
                <motion.li key={q} layout initial={{ opacity: 0, height: 0, x: -16 }} animate={{ opacity: 1, height: 'auto', x: 0 }} exit={{ opacity: 0, height: 0, x: 24 }} transition={{ duration: 0.28 }}>
                  <div className={c.q}>
                    <MessageSquare size={14} />
                    <span>{q}</span>
                    <button type="button" onClick={() => setQs(qs.filter((x) => x !== q))} aria-label="この質問を削除">
                      <X size={14} />
                    </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <form
            className={c.add}
            onSubmit={(e) => {
              e.preventDefault()
              add(draft)
            }}
          >
            <TextInput value={draft} onChange={setDraft} placeholder="質問を足す" ariaLabel="質問を追加" />
            <button type="submit" className={c.addBtn} aria-label="追加">
              <Plus size={16} />
            </button>
          </form>
          {left.length > 0 && (
            <div className={c.sug}>
              {left.map((s) => (
                <button key={s} type="button" onClick={() => add(s)}>
                  <Plus size={11} /> {s}
                </button>
              ))}
            </div>
          )}
        </Panel>
        <div className={c.runRow}>
          <RunButton onClick={run.start} disabled={!brand.trim() || qs.length === 0}>
            AIでの見え方を調べる
          </RunButton>
        </div>
      </div>

      {run.phase === 'input' && <IdleCanvas serviceId="aio" title="4つのAIに質問を投げて、あなたの名前が出る割合を測ります" steps={['質問を投げる', '回答を集める', '言及を数える', '改善案を作る']} />}
      {run.phase === 'run' && <RunStage serviceId="aio" steps={STEPS} step={run.step} lines={run.lines} pct={run.pct} skeleton="rows" />}
      {run.phase === 'done' && (
        <div className={c.dash}>
          <ResultHead title="調査が終わりました" note={`「${brand}」の見え方（見本の数字）`} onRetry={run.reset} />
          <div className={c.tiles}>
            <StatTile label="言及率" value={63} unit="%" delta="先月より +8pt" />
            <StatTile label="Share of Voice" value={34} unit="%" delta="競合で1位" />
            <StatTile label="引用されたドメイン数" value={18} unit="件" delta="+4件" />
          </div>
          <div className={c.row2}>
            <Glass className={c.card}>
              <p className={c.cap}>言及率の推移（10週）</p>
              <div className={c.spark}>
                <Sparkline data={TREND} height={96} />
              </div>
            </Glass>
            <Glass className={c.card}>
              <p className={c.cap}>AIごとの言及率</p>
              <div className={c.meters}>
                {AIS.map((a, i) => (
                  <Meter key={a.name} label={a.name} value={a.v} suffix="%" i={i} />
                ))}
              </div>
            </Glass>
            <Glass className={c.card}>
              <p className={c.cap}>競合との比較（Share of Voice）</p>
              <Bars data={COMP.map((x) => ({ ...x, label: x.hi ? brand : x.label }))} unit="%" max={40} />
            </Glass>
          </div>
          <div className={c.row3}>
            <Glass className={c.card}>
              <p className={c.cap}>
                AIの回答の見本 <Badge tone="muted">Perplexity</Badge>
              </p>
              <p className={c.qq}>{qs[0] ?? INITIAL_Q[0]}</p>
              <Answer brand={brand} />
              <p className={c.note}>
                <Typewriter text="引用元：比較メディア2件、公式サイト、事例記事" speed={30} />
              </p>
            </Glass>
            <Glass className={c.card}>
              <p className={c.cap}>
                改善アクション <Badge tone="ok">{done.filter(Boolean).length} / {ACTIONS.length}</Badge>
              </p>
              <ul className={c.acts}>
                {ACTIONS.map((a, i) => (
                  <li key={a} data-done={done[i] ? '' : undefined}>
                    <button type="button" role="checkbox" aria-checked={done[i]} onClick={() => toggle(i)}>
                      <span className={c.box} style={{ '--i': i } as CSSProperties}>
                        {done[i] && <Check size={12} strokeWidth={3.4} />}
                        {burst === i && <Burst />}
                      </span>
                      <span className={c.txt}>{a}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <GhostButton onClick={() => setDone(ACTIONS.map(() => false))}>チェックをはずす</GhostButton>
            </Glass>
          </div>
        </div>
      )}
    </div>
  )
}

function suggestLeft(qs: string[]) {
  return SUGGEST.filter((s) => !qs.includes(s))
}
