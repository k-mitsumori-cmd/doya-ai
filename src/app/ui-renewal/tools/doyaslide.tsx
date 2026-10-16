'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, Reorder, motion } from 'framer-motion'
import { GripVertical, Maximize2, Send, X } from 'lucide-react'
import rs from '../renewal.module.css'
import s from './doyaslide.module.css'
import { GALLERY } from '../data'
import { Field, GhostButton, IdleCanvas, Panel, ResultHead, RunButton, RunStage, ServiceHero, Slider, Steps, TextInput, Workbench, useRun } from './kit'

const STEPS = [
  { label: '構成を考える', log: ['テーマから話の流れを組み立て中', '各スライドの見出しを決めました'] },
  { label: '文章を整える', log: ['1枚ごとの言葉を短く整理', '数字を入れる場所を決めました'] },
  { label: '絵を描く', log: ['テイストに合わせて配色を決定', 'スライドを1枚ずつ描いています'] },
  { label: '仕上げる', log: ['文字の大きさをそろえました', '全体の流れを確認しました'] },
]

const TASTES = GALLERY.filter((g) => g.group === 'taste')
const TITLES = ['表紙', 'いまの課題', '原因は3つ', '解決の考え方', '進め方', '期待できる効果', '費用と期間', '次の一歩', 'よくある質問', 'まとめ', '補足資料', 'お問い合わせ']

type Slide = { id: string; title: string; src: string; ver: number }

export default function DoyaSlideTool() {
  const run = useRun(STEPS)
  const [theme, setTheme] = useState('新規事業の提案資料')
  const [taste, setTaste] = useState(TASTES[4].id)
  const [count, setCount] = useState(6)
  const [slides, setSlides] = useState<Slide[]>([])
  const [sel, setSel] = useState(0)
  const [full, setFull] = useState(false)
  const [chat, setChat] = useState<{ id: number; who: 'me' | 'ai'; text: string }[]>([])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const tasteSrc = TASTES.find((t) => t.id === taste)?.src ?? TASTES[0].src

  const start = () => {
    const alt = TASTES.filter((t) => t.id !== taste)
    setSlides(
      Array.from({ length: count }, (_, i) => ({
        id: `s${i}`,
        title: TITLES[i % TITLES.length],
        src: i === 0 ? tasteSrc : alt[(i * 3) % alt.length].src,
        ver: 0,
      })),
    )
    setSel(0)
    setChat([])
    run.start()
  }

  const move = useCallback(
    (d: number) => setSel((v) => Math.max(0, Math.min(slides.length - 1, v + d))),
    [slides.length],
  )
  useEffect(() => {
    if (run.phase !== 'done') return
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') move(1)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') move(-1)
      if (e.key === 'Escape') setFull(false)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [run.phase, move])

  const send = () => {
    const text = msg.trim()
    if (!text || busy) return
    const id = Date.now()
    setMsg('')
    setBusy(true)
    setChat((c) => [...c, { id, who: 'me', text }])
    timers.current.push(
      window.setTimeout(() => setChat((c) => [...c, { id: id + 1, who: 'ai', text: `${sel + 1}枚目を直しています。少しお待ちください。` }]), 500),
      window.setTimeout(() => {
        setSlides((list) => list.map((sl, i) => (i === sel ? { ...sl, ver: sl.ver + 1 } : sl)))
        setChat((c) => [...c, { id: id + 2, who: 'ai', text: '直しました。ほかに気になる所はありますか。' }])
        setBusy(false)
      }, 2300),
    )
  }

  const cur = slides[sel]
  const stepIdx = run.phase === 'input' ? 0 : run.phase === 'run' ? Math.min(run.step + 1, 3) : 3

  return (
    <div className={rs.tool}>
      <ServiceHero
        serviceId="doyaslide"
        catchCopy="テーマを入れると、スライドが並ぶ"
        points={['好きなテイストを画像で選ぶ', 'ドラッグで順番を入れ替え', 'チャットで1枚ずつ修正']}
        stats={[
          { label: '1デッキの作成時間', value: 4, unit: '分' },
          { label: '選べるテイスト', value: 20, unit: '種類' },
        ]}
      />
      <Steps steps={['テーマを決める', '構成を考える', 'スライドを描く', '直して使う']} current={stepIdx} />
      <Workbench
        wide
        form={
          <Panel title="スライドの条件">
            <Field label="テーマ">
              <TextInput value={theme} onChange={setTheme} ariaLabel="テーマ" />
            </Field>
            <Field label="テイスト" hint="見た目の雰囲気">
              <div className={s.tastes}>
                {TASTES.map((t) => (
                  <button key={t.id} type="button" className={s.taste} data-on={t.id === taste ? '' : undefined} onClick={() => setTaste(t.id)} aria-label={t.title} aria-pressed={t.id === taste}>
                    <img src={t.src} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
              <small className={s.tasteName}>{TASTES.find((t) => t.id === taste)?.title}</small>
            </Field>
            <Field label="枚数">
              <Slider value={count} min={3} max={12} onChange={setCount} format={(v) => `${v}枚`} ariaLabel="枚数" />
            </Field>
            <RunButton onClick={start} disabled={run.phase === 'run' || !theme.trim()}>
              スライドを作る
            </RunButton>
          </Panel>
        }
      >
        {run.phase === 'input' && <IdleCanvas serviceId="doyaslide" title="テーマから、1枚ずつ絵のあるスライドを作ります" steps={['構成を考える', '文章を整える', '絵を描く']} />}
        {run.phase === 'run' && <RunStage serviceId="doyaslide" steps={STEPS} step={run.step} lines={run.lines} pct={run.pct} skeleton="cards" />}
        {run.phase === 'done' && cur && (
          <div className={s.result}>
            <ResultHead
              title={`${slides.length}枚のスライドができました`}
              note="左右キーで移動、ドラッグで並べ替えできます"
              onRetry={run.reset}
              actions={
                <GhostButton onClick={() => setFull(true)} icon={<Maximize2 size={14} />}>
                  全画面で見る
                </GhostButton>
              }
            />
            <div className={s.deck}>
              <Reorder.Group axis="y" values={slides} onReorder={(next) => {
                const curId = cur.id
                setSlides(next)
                setSel(next.findIndex((n) => n.id === curId))
              }} className={s.thumbs} as="ol">
                {slides.map((sl, i) => (
                  <Reorder.Item key={sl.id} value={sl} as="li" className={s.thumb} data-on={i === sel ? '' : undefined} whileDrag={{ scale: 1.06, zIndex: 5, boxShadow: '0 16px 30px -10px rgba(60,40,160,.5)' }}>
                    <button type="button" onClick={() => setSel(i)} aria-label={`${i + 1}枚目 ${sl.title}`}>
                      <span className={s.thumbNo}>{i + 1}</span>
                      <img src={sl.src} alt="" draggable={false} />
                      <GripVertical size={12} className={s.grip} />
                    </button>
                  </Reorder.Item>
                ))}
              </Reorder.Group>

              <div className={s.stageCol}>
                <div className={s.stage}>
                  <AnimatePresence mode="popLayout">
                    <motion.div key={`${cur.id}-${cur.ver}`} className={s.slide} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
                      <img src={cur.src} alt={cur.title} />
                      <span className={s.slideTitle}>{cur.title}</span>
                    </motion.div>
                  </AnimatePresence>
                  {busy && <span className={s.shimmer} aria-hidden="true" />}
                  <span className={s.pager}>
                    {sel + 1} / {slides.length}
                  </span>
                </div>

                <div className={s.chat}>
                  <p className={s.chatTitle}>チャットで修正</p>
                  <ul className={s.bubbles} aria-live="polite">
                    <AnimatePresence initial={false}>
                      {chat.map((c) => (
                        <motion.li key={c.id} data-who={c.who} initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }}>
                          {c.text}
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                  <form
                    className={s.chatForm}
                    onSubmit={(e) => {
                      e.preventDefault()
                      send()
                    }}
                  >
                    <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="例：見出しをもっと大きくして" aria-label="修正の指示" />
                    <button type="submit" disabled={busy || !msg.trim()} aria-label="送る">
                      <Send size={15} strokeWidth={2.2} />
                    </button>
                  </form>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {full && (
                <motion.div className={s.full} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => move(1)}>
                  <button type="button" className={s.fullClose} aria-label="閉じる" onClick={(e) => { e.stopPropagation(); setFull(false) }}>
                    <X size={18} />
                  </button>
                  <AnimatePresence mode="wait">
                    <motion.img key={cur.id + cur.ver} src={cur.src} alt={cur.title} className={s.fullImg} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }} />
                  </AnimatePresence>
                  <span className={s.fullPager} style={{ '--p': (sel + 1) / slides.length } as CSSProperties}>
                    {sel + 1} / {slides.length}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </Workbench>
    </div>
  )
}
