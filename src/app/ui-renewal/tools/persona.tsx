'use client'

import { useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { RotateCw } from 'lucide-react'
import rs from '../renewal.module.css'
import c from './persona.module.css'
import { ChipSelect, Field, GlowBorder, GhostButton, IdleCanvas, Panel, ResultHead, RunButton, RunStage, ServiceHero, Slider, Steps, TextArea, TiltCard, Workbench, useRun, type RunStep } from './kit'

const STEPS: RunStep[] = [
  { label: '商品を読み解く', log: ['強みと価格帯を整理しました', '競合との違いを3点に絞りました'] },
  { label: '人物像を描く', log: ['年齢・職業・暮らしを組み立てました', '3つのタイプに分けました'] },
  { label: '悩みと行動を足す', log: ['検索や相談の動きを重ねました', '響く言葉を選びました'] },
  { label: '道のりをつなぐ', log: ['購入までの5つの場面をつなぎました'] },
]

const INDUSTRIES = ['小売・EC', 'IT・SaaS', '美容・健康', '飲食', '教育', '不動産'] as const

type P = {
  name: string
  age: string
  job: string
  tag: string
  char?: string
  initial: string
  grad: string
  worry: string[]
  act: string[]
  words: string[]
}
const PERSONAS: P[] = [
  {
    name: '田村 さくら',
    age: '34歳',
    job: '中小企業の総務担当',
    tag: '時間がない実務派',
    char: '/character/hello-256.webp',
    initial: '田',
    grad: 'linear-gradient(135deg,var(--k1),var(--k2))',
    worry: ['ひとりで何役もこなして手が回らない', '新しい道具を選ぶ時間がない'],
    act: ['昼休みにスマホで比較記事を読む', '同僚の口コミを一番信じる'],
    words: ['今日から使えます', '設定は5分で終わります'],
  },
  {
    name: '佐伯 健一',
    age: '45歳',
    job: '店舗オーナー',
    tag: '費用に慎重な経営者',
    initial: '佐',
    grad: 'linear-gradient(135deg,var(--k2),var(--k3))',
    worry: ['投資に見合うか判断しづらい', '失敗したときのやり直しが心配'],
    act: ['夜に料金表を何度も見比べる', '無料の見本があると動く'],
    words: ['まず無料でお試し', 'やめたい日にやめられます'],
  },
  {
    name: '森田 あかり',
    age: '28歳',
    job: 'マーケ担当',
    char: '/character/focus-256.webp',
    tag: '新しいもの好きな推進役',
    initial: '森',
    grad: 'linear-gradient(135deg,var(--k3),#ffb300)',
    worry: ['成果を数字で上司に示したい', '他社の事例が足りない'],
    act: ['SNSで事例を集めて社内に共有する', '資料請求より動画を先に見る'],
    words: ['成果がひと目でわかる', '他社の活用例つき'],
  },
]

const JOURNEY = [
  { t: '気づく', d: '日々の手間に違和感を持つ' },
  { t: '調べる', d: '比較記事と口コミを読む' },
  { t: '比べる', d: '料金と無料枠を見比べる' },
  { t: '試す', d: '見本で使い心地を確かめる' },
  { t: '続ける', d: '成果を見て社内に広める' },
]

function Avatar({ p, size = 72 }: { p: P; size?: number }) {
  return p.char ? (
    <span className={c.avatar} style={{ width: size, height: size, background: p.grad } as CSSProperties}>
      <img src={p.char} alt="" />
    </span>
  ) : (
    <span className={c.avatar} style={{ width: size, height: size, background: p.grad, fontSize: size * 0.4 } as CSSProperties}>
      {p.initial}
    </span>
  )
}

function FlipCard({ p, i }: { p: P; i: number }) {
  const [flip, setFlip] = useState(false)
  return (
    <TiltCard max={5} className={c.slot}>
      <GlowBorder className={c.glow}>
        <button type="button" className={`${c.card} ${flip ? c.flipped : ''}`} onClick={() => setFlip(!flip)} aria-pressed={flip} aria-label={`${p.name}のカードを裏返す`}>
          <span className={`${c.face} ${c.front}`}>
            <Avatar p={p} />
            <b className={c.name}>{p.name}</b>
            <small className={c.sub}>
              {p.age} / {p.job}
            </small>
            <span className={c.tag}>{p.tag}</span>
            <span className={c.turn}>
              <RotateCw size={12} /> クリックで裏返す
            </span>
          </span>
          <span className={`${c.face} ${c.back}`}>
            <b className={c.backName}>{p.name}</b>
            <span className={c.sec}>悩み</span>
            <ul>
              {p.worry.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <span className={c.sec}>行動</span>
            <ul>
              {p.act.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <span className={c.sec}>響く言葉</span>
            <span className={c.words}>
              {p.words.map((w) => (
                <em key={w}>{w}</em>
              ))}
            </span>
          </span>
        </button>
      </GlowBorder>
      <span className={c.idx} style={{ '--i': i } as CSSProperties} aria-hidden="true" />
    </TiltCard>
  )
}

export default function PersonaTool() {
  const [desc, setDesc] = useState('中小企業向けの、広告画像を自動でつくるサービス。月額9,800円から、初月無料。')
  const [industry, setIndustry] = useState<(typeof INDUSTRIES)[number]>('IT・SaaS')
  const [count, setCount] = useState(3)
  const run = useRun(STEPS)

  const form = (
    <>
      <Panel title="商品・サービス">
        <Field label="どんなものか、ひとことで">
          <TextArea value={desc} onChange={setDesc} rows={4} ariaLabel="商品の説明" />
        </Field>
      </Panel>
      <Panel title="業種">
        <ChipSelect id="persona-ind" options={INDUSTRIES} value={industry} onChange={setIndustry} />
      </Panel>
      <Panel title="人数">
        <Slider value={count} min={1} max={3} onChange={setCount} format={(v) => `${v}人`} ariaLabel="ペルソナの人数" />
      </Panel>
      <RunButton onClick={run.start} disabled={!desc.trim()}>
        ペルソナをつくる
      </RunButton>
    </>
  )

  const list = PERSONAS.slice(0, count)

  return (
    <div className={rs.tool}>
      <ServiceHero
        serviceId="persona"
        catchCopy="あなたのお客さまを、顔の見える人物にする"
        points={['悩み・行動・響く言葉まで詳しく', '購入までの道のりも一枚に', '1〜3人のタイプ別に作成']}
        stats={[
          { label: '1回でつくる人物', value: 3, unit: '人' },
          { label: '道のりの場面', value: 5, unit: 'つ' },
        ]}
      />
      <Steps steps={['商品を伝える', '人物を描く', '悩みを足す', '道のりをつなぐ']} current={run.phase === 'input' ? 0 : run.phase === 'done' ? 3 : Math.min(run.step, 3)} />
      <Workbench form={form} wide>
        {run.phase === 'input' && <IdleCanvas serviceId="persona" title="商品の説明から、買ってくれる人の姿を描きます" steps={['商品を読み解く', '人物像を描く', '悩みと行動を足す', '道のりをつなぐ']} />}
        {run.phase === 'run' && <RunStage serviceId="persona" steps={STEPS} step={run.step} lines={run.lines} pct={run.pct} skeleton="cards" />}
        {run.phase === 'done' && (
          <div className={c.done}>
            <ResultHead
              title={`${list.length}人のペルソナができました`}
              note={`${industry}向け。カードをクリックすると裏返ります`}
              onRetry={run.reset}
              actions={<GhostButton onClick={() => setCount(count === 3 ? 2 : 3)}>人数を変える</GhostButton>}
            />
            <div className={c.cards}>
              {list.map((p, i) => (
                <motion.div key={p.name} initial={{ opacity: 0, y: 30, rotateX: -20 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: i * 0.18, type: 'spring', stiffness: 200, damping: 22 }}>
                  <FlipCard p={p} i={i} />
                </motion.div>
              ))}
            </div>
            <section className={c.journey} aria-label="カスタマージャーニー">
              <p className={c.jHead}>カスタマージャーニー</p>
              <div className={c.jTrack}>
                <motion.span className={c.jLine} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.7, duration: 1.6, ease: 'easeInOut' }} />
                <ol className={c.jList}>
                  {JOURNEY.map((j, i) => (
                    <motion.li key={j.t} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 + i * 0.3 }}>
                      <span className={c.jDot}>{i + 1}</span>
                      <b>{j.t}</b>
                      <small>{j.d}</small>
                    </motion.li>
                  ))}
                </ol>
              </div>
            </section>
          </div>
        )}
      </Workbench>
    </div>
  )
}
