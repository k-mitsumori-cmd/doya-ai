'use client'

import { useState, type CSSProperties, type DragEvent } from 'react'
import { motion } from 'framer-motion'
import { FileAudio, UploadCloud } from 'lucide-react'
import rs from '../renewal.module.css'
import c from './interview.module.css'
import { ChipSelect, Field, GhostButton, IdleCanvas, Panel, ResultHead, RunButton, RunStage, ServiceHero, Steps, Typewriter, Workbench, useFlash, useRun, type RunStep } from './kit'

const STEPS: RunStep[] = [
  { label: '音声を文字にする', log: ['話者を2人に分けました', '雑音と言い淀みを取り除きました'] },
  { label: '要点を拾う', log: ['印象的な発言を4か所見つけました', '話の流れを3つの章に分けました'] },
  { label: '記事を書く', log: ['見出しとリード文を作りました', '発言を引用として組み込みました'] },
  { label: '校正する', log: ['表記ゆれを直しました', '事実関係の確認箇所に印をつけました'] },
]

const STYLES = ['です・ます調', 'だ・である調', '対談形式', 'ストーリー調'] as const
const FILE_NAME = '取材_店主インタビュー_0412.m4a'

type Turn = { who: 'i' | 'g'; name: string; text: string; q?: number }
const TURNS: Turn[] = [
  { who: 'i', name: '聞き手', text: 'お店を始めたきっかけを教えてください。' },
  { who: 'g', name: '店主', text: '会社員のころ、毎朝通っていた喫茶店が閉店してしまって。あの朝の時間を残したいと思ったんです。', q: 1 },
  { who: 'i', name: '聞き手', text: '開店して一番むずかしかったことは何ですか。' },
  { who: 'g', name: '店主', text: '最初の3か月はお客さまが1日5人でした。それでも豆の焙煎だけは毎朝続けました。', q: 2 },
  { who: 'i', name: '聞き手', text: '転機になったのは？' },
  { who: 'g', name: '店主', text: '常連さんが「ここは家の延長だね」と言ってくれた日です。あの一言で迷いが消えました。', q: 3 },
]

const QUOTES: Record<number, string> = {
  1: '毎朝通っていた喫茶店が閉店してしまった。あの朝の時間を残したい',
  2: '最初の3か月はお客さまが1日5人。それでも豆の焙煎だけは毎朝続けた',
  3: 'ここは家の延長だね、という常連さんの一言で迷いが消えた',
}

const TITLE = '閉店した喫茶店の朝を、もう一度。店主が焙煎を続けた理由'
const LEAD = '会社員から喫茶店の店主へ。1日5人のお客さまから始まった小さな店が、地域の「家の延長」になるまでを聞きました。'

export default function InterviewTool() {
  const [file, setFile] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const [style, setStyle] = useState<(typeof STYLES)[number]>('です・ます調')
  const [hot, setHot] = useState<number | null>(null)
  const [leadGo, setLeadGo] = useState(false)
  const [flash, say] = useFlash()
  const run = useRun(STEPS)

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    setFile(e.dataTransfer.files?.[0]?.name ?? FILE_NAME)
  }

  const form = (
    <>
      <Panel title="取材の音声">
        <button
          type="button"
          className={`${c.drop} ${over ? c.dropOver : ''} ${file ? c.dropHas : ''}`}
          onClick={() => setFile(FILE_NAME)}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <span className={c.dropIcon}>{file ? <FileAudio size={22} /> : <UploadCloud size={22} />}</span>
          {file ? (
            <>
              <b>{file}</b>
              <small>42分 / 38MB（見本）</small>
            </>
          ) : (
            <>
              <b>{over ? 'ここで離してください' : '音声をここにドロップ'}</b>
              <small>クリックで見本ファイルが入ります</small>
            </>
          )}
          {file && (
            <span className={c.mini} aria-hidden="true">
              {Array.from({ length: 28 }, (_, i) => (
                <i key={i} style={{ height: `${20 + ((i * 37) % 70)}%` }} />
              ))}
            </span>
          )}
        </button>
      </Panel>
      <Panel title="記事の文体">
        <Field label="読み手に合わせて選びます">
          <ChipSelect id="interview-style" options={STYLES} value={style} onChange={setStyle} />
        </Field>
      </Panel>
      <RunButton
        onClick={() => {
          setLeadGo(false)
          setHot(null)
          run.start()
        }}
        disabled={!file}
      >
        記事にする
      </RunButton>
    </>
  )

  return (
    <div className={rs.tool}>
      <ServiceHero
        serviceId="interview"
        catchCopy="取材の音声から、そのまま載せられる記事へ"
        points={['話者ごとに文字起こし', '引用と発言がひも付く', '文体を選んで一気に執筆']}
        stats={[
          { label: '42分の取材が', value: 6, unit: '分で記事' },
          { label: '引用の根拠', value: 3, unit: '件' },
        ]}
      />
      <Steps steps={['音声を入れる', '文字にする', '記事を書く', '校正する']} current={run.phase === 'input' ? 0 : run.phase === 'done' ? 3 : Math.min(run.step, 3)} />
      <Workbench form={form} wide>
        {run.phase === 'input' && <IdleCanvas serviceId="interview" title="取材音声から、文字起こしと記事を同時につくります" steps={['音声を文字にする', '要点を拾う', '記事を書く', '校正する']} />}
        {run.phase === 'run' && (
          <div className={c.runWrap}>
            <div className={c.wave} aria-hidden="true">
              {Array.from({ length: 44 }, (_, i) => (
                <i key={i} style={{ '--i': i } as CSSProperties} />
              ))}
            </div>
            <RunStage serviceId="interview" steps={STEPS} step={run.step} lines={run.lines} pct={run.pct} skeleton="doc" />
          </div>
        )}
        {run.phase === 'done' && (
          <div className={c.done}>
            <ResultHead
              title="記事ができました"
              note={`文体は「${style}」。引用にカーソルを当てると、元の発言が光ります`}
              onRetry={run.reset}
              actions={<GhostButton onClick={() => say('記事をコピーしました（見本）')}>記事をコピー</GhostButton>}
            />
            <div className={c.cols}>
              <section className={c.talk} aria-label="文字起こし">
                <p className={c.colHead}>文字起こし</p>
                <div className={c.bubbles}>
                  {TURNS.map((t, i) => (
                    <motion.div
                      key={i}
                      className={`${c.bubble} ${t.who === 'g' ? c.bubbleG : ''} ${t.q && hot === t.q ? c.bubbleHot : ''}`}
                      initial={{ opacity: 0, y: 14, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.25 + i * 0.5, type: 'spring', stiffness: 260, damping: 24 }}
                    >
                      <small>{t.name}</small>
                      <p>{t.text}</p>
                    </motion.div>
                  ))}
                </div>
              </section>
              <article className={c.paper}>
                <p className={c.colHead}>記事</p>
                <h2 className={c.title}>
                  <Typewriter text={TITLE} speed={34} onDone={() => window.setTimeout(() => setLeadGo(true), 0)} />
                </h2>
                <p className={c.lead}>{leadGo && <Typewriter text={LEAD} speed={16} />}</p>
                {leadGo && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 0.6 }}>
                    <h3 className={c.h3}>朝の時間を残したかった</h3>
                    <blockquote className={c.quote} data-on={hot === 1 ? '' : undefined} onMouseEnter={() => setHot(1)} onMouseLeave={() => setHot(null)} tabIndex={0} onFocus={() => setHot(1)} onBlur={() => setHot(null)}>
                      {QUOTES[1]}
                    </blockquote>
                    <h3 className={c.h3}>最初の3か月</h3>
                    <blockquote className={c.quote} data-on={hot === 2 ? '' : undefined} onMouseEnter={() => setHot(2)} onMouseLeave={() => setHot(null)} tabIndex={0} onFocus={() => setHot(2)} onBlur={() => setHot(null)}>
                      {QUOTES[2]}
                    </blockquote>
                    <h3 className={c.h3}>家の延長になった日</h3>
                    <blockquote className={c.quote} data-on={hot === 3 ? '' : undefined} onMouseEnter={() => setHot(3)} onMouseLeave={() => setHot(null)} tabIndex={0} onFocus={() => setHot(3)} onBlur={() => setHot(null)}>
                      {QUOTES[3]}
                    </blockquote>
                  </motion.div>
                )}
              </article>
            </div>
          </div>
        )}
      </Workbench>
      {flash}
    </div>
  )
}
