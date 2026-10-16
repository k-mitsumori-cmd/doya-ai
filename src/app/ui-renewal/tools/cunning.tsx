'use client'

// ドヤカンニング：相手の質問を文字起こしし、回答案をバネで出すAIカンペ
// 見本のため音声は取り込まない。会議の進行はタイマーで再現する。
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Mic, RotateCcw, Sparkles } from 'lucide-react'
import rs from '../renewal.module.css'
import {
  Badge,
  ChipMulti,
  ChipSelect,
  Field,
  GhostButton,
  GlowBorder,
  IdleCanvas,
  Panel,
  ResultHead,
  RunButton,
  RunStage,
  ServiceHero,
  Steps,
  Typewriter,
  Workbench,
  useRun,
  type RunStep,
} from './kit'
import { getServiceById } from '@/lib/services'
import css from './cunning.module.css'

const STEPS: RunStep[] = [
  { label: 'ナレッジを読み込む', log: ['選んだ資料を読み込みました', '想定される質問を整理しました'] },
  { label: '音声の準備', log: ['会議タブの音声を受け取る準備をしました（見本）'] },
  { label: '会議を始める', log: ['文字起こしを開始します'] },
]

type Purpose = '商談' | '面接'
type Turn = { says: string; question: string; points: string[]; script: string }

const SCRIPTS: Record<Purpose, Turn[]> = {
  商談: [
    {
      says: 'ご説明ありがとうございます。ところで、導入までにどのくらいの期間がかかりますか。',
      question: '導入期間',
      points: ['最短で2週間', '初期設定は当社が代行', 'データ移行は内容により別途ご相談'],
      script: '最短で2週間です。初期設定は私どもで代行しますので、お客さまのご負担は少なく済みます。データの移行は件数を伺ってから、期間をお伝えします。',
    },
    {
      says: '他社の似たサービスと比べて、いちばんの強みはどこでしょうか。',
      question: '他社との違い',
      points: ['現場の人が迷わない画面', '導入後の伴走サポートが無料', '5名からの小さな規模に対応'],
      script: '一番は、現場の方が迷わず使える画面です。導入後の伴走サポートも料金に含まれていますので、小さな規模でも安心して始められます。',
    },
    {
      says: '社内のルールで、セキュリティの確認が必要です。どのような対策をされていますか。',
      question: 'セキュリティ',
      points: ['通信とデータは暗号化', '権限をメンバーごとに設定', '資料は別途ご提出できる'],
      script: '通信とデータはすべて暗号化しています。メンバーごとに見られる範囲も設定できます。確認用の資料をお送りしますので、社内でご検討ください。',
    },
  ],
  面接: [
    {
      says: '本日はありがとうございます。まず、これまでの経験と志望動機を教えてください。',
      question: '経験と志望動機',
      points: ['直近の実績を数字で1つ', '御社の事業との接点', '入社後にやりたいこと'],
      script: '前職では、営業チームの成約率を半年で1.3倍にしました。お客さまの課題から入る御社の姿勢に共感し、同じやり方で貢献したいと考えています。',
    },
    {
      says: 'チームで意見が割れたとき、どのように進めましたか。',
      question: 'チームでの進め方',
      points: ['まず相手の意図を聞く', '共通のゴールに戻す', '結果と学びを一言で'],
      script: 'まず、それぞれの意図を聞き取り、共通のゴールを確認しました。そのうえで小さく試して比べる形に変え、全員が納得して進められました。',
    },
    {
      says: '最後に、何か質問はありますか。',
      question: '逆質問',
      points: ['入社後の最初の3か月の過ごし方', '評価の基準', 'チームの雰囲気'],
      script: '入社後の最初の3か月は、どのような役割を期待されていますか。また、評価はどのような基準で行われるか教えてください。',
    },
  ],
}

const KNOW: Record<Purpose, string[]> = {
  商談: ['製品資料', '料金表', '導入事例', 'よくある質問', 'セキュリティ資料'],
  面接: ['応募先の企業情報', '募集要項', '職務経歴書', '自己PRメモ'],
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

function Meeting({ purpose, onRetry }: { purpose: Purpose; onRetry: () => void }) {
  const turns = SCRIPTS[purpose]
  const [round, setRound] = useState(0)
  const [turn, setTurn] = useState(0)
  const [typed, setTyped] = useState(false)
  const [detected, setDetected] = useState(0) // 質問を検知した数
  const [sec, setSec] = useState(0)
  const [ended, setEnded] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  // 経過時間
  useEffect(() => {
    if (ended) return
    const id = window.setInterval(() => setSec((v) => v + 1), 1000)
    return () => window.clearInterval(id)
  }, [ended, round])

  // 質問を検知 → 回答案 → 次の質問
  useEffect(() => {
    if (!typed) return
    const a = window.setTimeout(() => setDetected(turn + 1), 500)
    const b = window.setTimeout(() => {
      if (turn + 1 < turns.length) {
        setTurn(turn + 1)
        setTyped(false)
      } else setEnded(true)
    }, 5600)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [typed, turn, turns.length])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [turn, typed, detected])

  const replay = () => {
    setRound((r) => r + 1)
    setTurn(0)
    setTyped(false)
    setDetected(0)
    setSec(0)
    setEnded(false)
  }

  const answers = turns.slice(0, detected).map((t, i) => ({ t, i })).reverse()

  return (
    <div className={css.meet}>
      <ResultHead
        title="会議中の画面です"
        note="相手の話を文字にして、質問が来たら回答案を出します。"
        onRetry={onRetry}
        actions={
          ended ? (
            <GhostButton onClick={replay} icon={<RotateCcw size={14} />}>
              もう一度見る
            </GhostButton>
          ) : undefined
        }
      />

      <div className={css.bar}>
        <span className={css.rec} data-off={ended ? '' : undefined}>
          <i />
          {ended ? '終了' : '録音中'}
        </span>
        <span className={css.timer}>{mmss(sec)}</span>
        <span className={css.levels} aria-hidden="true" data-off={ended ? '' : undefined}>
          {Array.from({ length: 28 }, (_, i) => (
            <i key={i} style={{ '--d': `${0.5 + ((i * 37) % 11) / 10}s`, '--o': `${-((i * 53) % 17) / 10}s` } as CSSProperties} />
          ))}
        </span>
        <Badge tone="grad">{purpose}</Badge>
      </div>

      <div className={css.cols}>
        <section className={css.trans} aria-label="相手の話">
          <p className={css.paneTitle}>
            <Mic size={13} strokeWidth={2.4} />
            相手の話
          </p>
          <div className={css.log} ref={logRef} aria-live="polite">
            {turns.slice(0, turn + 1).map((t, i) => {
              const live = i === turn
              return (
                <div key={`${round}-${i}`} className={css.line} data-live={live && !typed ? '' : undefined}>
                  <small>{mmss(i * 9 + 3)}</small>
                  <p>
                    {live ? <Typewriter key={`${round}-${i}`} text={t.says} speed={42} onDone={() => void window.setTimeout(() => setTyped(true), 0)} /> : t.says}
                  </p>
                  <AnimatePresence>
                    {detected > i && (
                      <motion.span
                        className={css.detect}
                        initial={{ opacity: 0, scale: 0.7, x: -8 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                      >
                        <Sparkles size={11} strokeWidth={2.6} />
                        質問を検知：{t.question}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
            {!ended && !typed && (
              <p className={css.listening}>
                <i />
                <i />
                <i />
                聞き取り中
              </p>
            )}
          </div>
        </section>

        <section className={css.ans} aria-label="回答案" aria-live="polite">
          <p className={css.paneTitle}>
            <Sparkles size={13} strokeWidth={2.4} />
            回答案
          </p>
          {answers.length === 0 && <p className={css.wait}>質問を検知すると、ここに回答案が出ます。</p>}
          <AnimatePresence initial={false}>
            {answers.map(({ t, i }, idx) => (
              <motion.div
                key={`${round}-${i}`}
                layout
                className={css.card}
                data-old={idx > 0 ? '' : undefined}
                initial={{ opacity: 0, x: 60, scale: 0.92 }}
                animate={{ opacity: idx > 0 ? 0.6 : 1, x: 0, scale: idx > 0 ? 0.97 : 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              >
                <GlowBorder on={idx === 0}>
                  <div className={css.cardIn}>
                    <p className={css.cQ}>
                      <Badge tone="pink">質問 {i + 1}</Badge>
                      {t.question}
                    </p>
                    <ul className={css.points}>
                      {t.points.map((p, j) => (
                        <motion.li key={p} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + j * 0.15 }}>
                          <Check size={12} strokeWidth={3.2} />
                          {p}
                        </motion.li>
                      ))}
                    </ul>
                    <div className={css.say}>
                      <small>話すスクリプト</small>
                      <p>{t.script}</p>
                    </div>
                  </div>
                </GlowBorder>
              </motion.div>
            ))}
          </AnimatePresence>
        </section>
      </div>
    </div>
  )
}

export default function CunningTool() {
  const svc = getServiceById('cunning')
  const [purpose, setPurpose] = useState<Purpose>('商談')
  const [know, setKnow] = useState<string[]>(['製品資料', '料金表'])
  const run = useRun(STEPS)
  const cur = run.phase === 'input' ? 0 : run.phase === 'run' ? 1 : 3

  const changePurpose = (p: Purpose) => {
    setPurpose(p)
    setKnow(KNOW[p].slice(0, 2))
  }

  return (
    <div className={rs.tool}>
      <ServiceHero
        serviceId="cunning"
        catchCopy={`${svc?.shortName ?? 'カンニング'}が、答えをそっと横に`}
        points={['相手の質問をその場で文字に', '資料にもとづく回答案を表示', '話すスクリプトまで用意']}
        stats={[
          { label: '回答案が出るまで', value: 2, unit: '秒' },
          { label: '準備する質問', value: 30, unit: '件' },
        ]}
      />
      <Steps steps={['用途を選ぶ', '準備する', '会議を始める', '回答を見る']} current={cur} />
      <Workbench
        form={
          <Panel title="会議の設定">
            <Field label="用途">
              <ChipSelect id="cunning-purpose" options={['商談', '面接'] as const} value={purpose} onChange={changePurpose} />
            </Field>
            <Field label="回答のもとにするナレッジ" hint="複数選べます">
              <ChipMulti options={KNOW[purpose]} value={know} onChange={setKnow} />
            </Field>
            <RunButton onClick={run.start} disabled={run.phase === 'run' || know.length === 0} icon={<Mic size={15} strokeWidth={2} />}>
              会議を始める
            </RunButton>
          </Panel>
        }
        wide
      >
        {run.phase === 'input' && (
          <IdleCanvas serviceId="cunning" title="相手の質問を聞き取り、資料から答えを組み立てます" steps={['音声を聞き取る', '質問を見つける', '資料から答える', '話し方まで示す']} />
        )}
        {run.phase === 'run' && <RunStage serviceId="cunning" steps={STEPS} step={run.step} lines={run.lines} pct={run.pct} skeleton="rows" />}
        {run.phase === 'done' && <Meeting key={purpose} purpose={purpose} onRetry={run.reset} />}
      </Workbench>
    </div>
  )
}
