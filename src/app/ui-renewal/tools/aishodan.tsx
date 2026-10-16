'use client'

// ドヤAI商談：商談URLの発行 → AIと見込み客のチャットが自動再生 → 商談後レポート
// 見本のため生成APIは呼ばない。チャットはタイマーで再生する。
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Copy, Globe, HelpCircle, Link2, Play, RotateCcw, User } from 'lucide-react'
import rs from '../renewal.module.css'
import { Ring } from '../motion'
import {
  Badge,
  Field,
  Glass,
  IdleCanvas,
  Meter,
  Panel,
  ResultHead,
  RunButton,
  RunStage,
  ServiceHero,
  Stagger,
  StaggerItem,
  Steps,
  TextInput,
  Workbench,
  useFlash,
  useRun,
  type RunStep,
} from './kit'
import { getServiceById } from '@/lib/services'
import css from './aishodan.module.css'

const STEPS: RunStep[] = [
  { label: 'サイトを読み取る', log: ['トップと料金ページを読み込みました', '提供内容と対象のお客さまを整理しました'] },
  { label: '商材ナレッジを作る', log: ['よくある質問を12件まとめました', '導入事例の要点を抜き出しました'] },
  { label: '商談シナリオを組む', log: ['会社説明から次のアクションまでの流れを作りました'] },
  { label: '商談URLを発行する', log: ['商談ページを公開用に整えました', '商談URLを発行しました'] },
]

const FLOW = ['会社説明', 'ヒアリング', '質疑', '次アクション'] as const

type Msg = { who: 'ai' | 'guest'; stage: number; text: string }
const CHAT: Msg[] = [
  { who: 'ai', stage: 0, text: 'はじめまして。サンプル商事の商談AIです。本日は15分ほど、サービスのご紹介とご状況のお伺いをいたします。' },
  { who: 'ai', stage: 0, text: '当社は、小さなお店でも使える予約と顧客管理のサービスを提供しています。ご不明点は途中でいつでもご質問ください。' },
  { who: 'ai', stage: 1, text: 'まず、いまの予約はどのように受けていらっしゃいますか。' },
  { who: 'guest', stage: 1, text: '電話とLINEが中心です。ダブルブッキングが月に数回あって困っています。' },
  { who: 'ai', stage: 1, text: 'ありがとうございます。スタッフの方は何名で、導入のご予定時期はありますか。' },
  { who: 'guest', stage: 1, text: '5名です。できれば来月中に始めたいです。' },
  { who: 'guest', stage: 2, text: 'ほかの予約システムからデータは移せますか。あと、月額はいくらになりますか。' },
  { who: 'ai', stage: 2, text: '予約と顧客の一覧はCSVで取り込めます。料金は5名規模ですと月額の目安をお出しできますので、見積もりをお送りします。' },
  { who: 'guest', stage: 2, text: '電子カルテとの連携はありますか。' },
  { who: 'ai', stage: 2, text: 'こちらは資料に記載がなく、正確にお答えできません。担当者から折り返しご案内します。' },
  { who: 'ai', stage: 3, text: '最後に、次の一歩を選べます。担当者との30分の個別相談を、来週の空き枠からご予約いただけます。' },
  { who: 'guest', stage: 3, text: '水曜の午前でお願いします。' },
]

const HEARING = [
  { k: '現状の課題', v: 'ダブルブッキングが月に数回' },
  { k: '規模', v: 'スタッフ5名' },
  { k: '導入時期', v: '来月中を希望' },
  { k: '予算感', v: '月額の目安を確認中' },
]
const UNANSWERED = ['電子カルテとの連携はありますか', '他社からのデータ移行の費用は別ですか']

const DISPLAY_URL = 'doya.example/s/k7Qx29'

function QrArt() {
  const cells = useMemo(() => {
    const n = 9
    let seed = 20261016
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    const eye = (r: number, c: number) => (r < 3 && c < 3) || (r < 3 && c > n - 4) || (r > n - 4 && c < 3)
    return Array.from({ length: n * n }, (_, i) => {
      const r = Math.floor(i / n)
      const c = i % n
      return { on: eye(r, c) || rnd() > 0.5, eye: eye(r, c) }
    })
  }, [])
  return (
    <span className={css.qr} aria-hidden="true">
      {cells.map((c, i) => (
        <i key={i} data-on={c.on ? '' : undefined} data-eye={c.eye ? '' : undefined} style={{ '--i': i } as CSSProperties} />
      ))}
    </span>
  )
}

function Result({ onRetry, flash }: { onRetry: () => void; flash: (m: string) => void }) {
  const [shown, setShown] = useState(0) // 表示済みの通数
  const [typing, setTyping] = useState<Msg['who'] | null>(null)
  const [round, setRound] = useState(0)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(CHAT.length)
      return
    }
    setShown(0)
    setTyping(null)
    const ids: number[] = []
    let at = 900
    CHAT.forEach((m, i) => {
      ids.push(window.setTimeout(() => setTyping(m.who), at))
      at += m.who === 'ai' ? 1100 : 900
      ids.push(
        window.setTimeout(() => {
          setShown(i + 1)
          setTyping(null)
        }, at),
      )
      at += 350
    })
    return () => ids.forEach((t) => window.clearTimeout(t))
  }, [round])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [shown, typing])

  const nowStage = CHAT[Math.min(Math.max(shown - 1, 0), CHAT.length - 1)].stage
  const finished = shown >= CHAT.length
  const fit = finished ? 82 : Math.round((shown / CHAT.length) * 82)

  const copy = useCallback(() => {
    try {
      void navigator.clipboard?.writeText(`https://${DISPLAY_URL}`)
    } catch {
      /* 見本のため失敗しても何もしない */
    }
    flash('商談URLをコピーしました')
  }, [flash])

  return (
    <div className={css.result}>
      <ResultHead title="商談URLを発行しました" note="このURLを開いた見込み客に、AIが24時間いつでも一次商談を行います。" onRetry={onRetry} />

      <Glass className={css.urlCard}>
        <QrArt />
        <div className={css.urlBody}>
          <p className={css.urlLabel}>
            <Link2 size={13} strokeWidth={2.4} />
            商談URL
            <Badge tone="ok">公開中</Badge>
          </p>
          <p className={css.urlText}>https://{DISPLAY_URL}</p>
          <p className={css.urlSub}>メールやLINEで送るだけ。見込み客はログイン不要で始められます。</p>
        </div>
        <button type="button" className={css.copyBtn} onClick={copy}>
          <Copy size={14} strokeWidth={2.4} />
          コピー
        </button>
      </Glass>

      <div className={css.grid}>
        <Glass className={css.chatCard}>
          <div className={css.chatHead}>
            <p className={css.cardTitle}>商談の様子</p>
            <button
              type="button"
              className={css.replay}
              onClick={() => setRound((r) => r + 1)}
              aria-label="もう一度再生する"
            >
              {finished ? <RotateCcw size={13} strokeWidth={2.4} /> : <Play size={13} strokeWidth={2.4} />}
              {finished ? 'もう一度' : '再生中'}
            </button>
          </div>
          <ol className={css.flow} style={{ '--p': nowStage / (FLOW.length - 1) } as CSSProperties}>
            {FLOW.map((f, i) => (
              <li key={f} data-state={i < nowStage ? 'done' : i === nowStage ? 'now' : 'wait'}>
                <span>{i + 1}</span>
                {f}
              </li>
            ))}
          </ol>
          <div className={css.chat} ref={logRef} aria-live="polite">
            <AnimatePresence initial={false}>
              {CHAT.slice(0, shown).map((m, i) => (
                <motion.div
                  key={`${round}-${i}`}
                  className={css.msg}
                  data-who={m.who}
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                >
                  <span className={css.avatar}>{m.who === 'ai' ? <Bot size={14} strokeWidth={2.2} /> : <User size={14} strokeWidth={2.2} />}</span>
                  <p>{m.text}</p>
                </motion.div>
              ))}
              {typing && (
                <motion.div
                  key="typing"
                  className={css.msg}
                  data-who={typing}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <span className={css.avatar}>{typing === 'ai' ? <Bot size={14} strokeWidth={2.2} /> : <User size={14} strokeWidth={2.2} />}</span>
                  <p className={css.dots} aria-label="入力中">
                    <i />
                    <i />
                    <i />
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Glass>

        <Stagger className={css.report}>
          <StaggerItem>
            <Glass className={css.fitCard}>
              <Ring value={fit} size={96} stroke={9} color="var(--k2)">
                <b className={rs.num}>{fit}</b>
                <small>%</small>
              </Ring>
              <div>
                <p className={css.cardTitle}>理想顧客との適合度</p>
                <p className={css.cardNote}>規模と課題が、狙っているお客さま像に近い見込み客です。</p>
                <Meter label="課題の一致" value={90} suffix="%" i={0} />
                <Meter label="導入の近さ" value={76} suffix="%" i={1} />
              </div>
            </Glass>
          </StaggerItem>
          <StaggerItem>
            <Glass className={css.listCard}>
              <p className={css.cardTitle}>ヒアリング結果</p>
              <dl className={css.hearing}>
                {HEARING.map((h) => (
                  <div key={h.k}>
                    <dt>{h.k}</dt>
                    <dd>{h.v}</dd>
                  </div>
                ))}
              </dl>
            </Glass>
          </StaggerItem>
          <StaggerItem>
            <Glass className={css.listCard}>
              <p className={css.cardTitle}>
                答えられなかった質問
                <Badge tone="warn">{UNANSWERED.length}件</Badge>
              </p>
              <ul className={css.unans}>
                {UNANSWERED.map((q) => (
                  <li key={q}>
                    <HelpCircle size={14} strokeWidth={2.2} />
                    {q}
                  </li>
                ))}
              </ul>
              <p className={css.cardNote}>ナレッジに追記すると、次の商談から答えられます。</p>
            </Glass>
          </StaggerItem>
        </Stagger>
      </div>
    </div>
  )
}

export default function AiShodanTool() {
  const svc = getServiceById('aishodan')
  const [url, setUrl] = useState('https://sample-shoji.example.jp')
  const run = useRun(STEPS)
  const [flashNode, flash] = useFlash()
  const cur = run.phase === 'input' ? 0 : run.phase === 'run' ? 1 + Math.min(run.step, 1) : 3

  return (
    <div className={rs.tool}>
      <ServiceHero
        serviceId="aishodan"
        catchCopy={`${svc?.shortName ?? 'AI商談'}が、一次商談を代わりに`}
        points={['サービスURLを入れるだけで準備', '発行したURLを開くと商談が始まる', '商談後にレポートが届く']}
        stats={[
          { label: '商談の準備', value: 5, unit: '分' },
          { label: '対応できる時間', value: 24, unit: '時間' },
        ]}
      />
      <Steps steps={['URLを入れる', 'ナレッジを作る', '商談を行う', 'レポートを見る']} current={cur} />
      <Workbench
        form={
          <Panel title="自社サービスの情報">
            <Field label="自社サービスのURL" hint="トップページでかまいません">
              <TextInput value={url} onChange={setUrl} icon={<Globe size={16} strokeWidth={1.75} />} ariaLabel="自社サービスのURL" />
            </Field>
            <RunButton onClick={run.start} disabled={run.phase === 'run' || !url.trim()}>
              商談の準備をする
            </RunButton>
          </Panel>
        }
      >
        {run.phase === 'input' && (
          <IdleCanvas
            serviceId="aishodan"
            title="サイトを読み取り、商談の台本まで用意します"
            steps={['サイトを読む', 'ナレッジを作る', 'シナリオを組む', '商談URLを発行']}
          />
        )}
        {run.phase === 'run' && <RunStage serviceId="aishodan" steps={STEPS} step={run.step} lines={run.lines} pct={run.pct} skeleton="cards" />}
        {run.phase === 'done' && <Result onRetry={run.reset} flash={flash} />}
      </Workbench>
      {flashNode}
    </div>
  )
}
