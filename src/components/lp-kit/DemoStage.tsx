'use client'
// 段2「実演の舞台」。製品の画面をコードで再現し、入力→構成→点検→完成を1つの物語として自動で進める。
// - 初期状態（HTML・JS 前・動きを減らす設定）は「完成」の画面。JS が動くと、画面に入った間だけ 0 から進める。
// - 画面の外では止める。段階の札を押すと、その段階の頭から進む（一時停止も可）。
// - 枠の高さは固定（段階が変わっても動かない）。
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Pause, Play } from 'lucide-react'
import type { DemoTab } from './types'
import { cx, useInView, useMotion } from './hooks'
import { BorderBeam } from './motion'

const TICK = 50

export function DemoStage({
  title,
  tabs,
  duration,
  hold,
  render,
}: {
  title: string
  tabs: DemoTab[]
  duration: number
  hold: number
  render: (t: number, tab: number) => ReactNode
}) {
  const { ok } = useMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const inView = useInView(rootRef, { margin: '80px' })
  const [t, setT] = useState(duration) // 完成の状態から始める
  const [paused, setPaused] = useState(false)
  const [boot, setBoot] = useState(false)

  // 動いてよくなったら、0 に戻して最初から進める（このとき1フレームだけ遷移を切って、完成から消える動きを見せない）
  useLayoutEffect(() => {
    if (!ok) {
      setT(duration)
      return
    }
    setBoot(true)
    setT(0)
    const r1 = requestAnimationFrame(() => requestAnimationFrame(() => setBoot(false)))
    return () => cancelAnimationFrame(r1)
  }, [ok, duration])

  useEffect(() => {
    if (!ok || !inView || paused) return
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const dt = now - last
      last = now
      setT((p) => {
        const n = p + dt
        return n > duration + hold ? 0 : n
      })
    }, TICK)
    return () => window.clearInterval(id)
  }, [ok, inView, paused, duration, hold])

  // 「操作の流れを見る」を押したら、最初から再生する
  useEffect(() => {
    const on = () => {
      setPaused(false)
      if (ok) setT(0)
    }
    window.addEventListener('lpk:replay', on)
    return () => window.removeEventListener('lpk:replay', on)
  }, [ok])

  const tab = (() => {
    let idx = 0
    tabs.forEach((x, i) => {
      if (t >= x.from) idx = i
    })
    return idx
  })()

  const pick = (i: number) => {
    if (ok) {
      setT(tabs[i].from)
    } else {
      // 動かさない設定では、その段階が終わった時点の画面を出す
      setT(i === tabs.length - 1 ? duration : tabs[i + 1].from - 1)
    }
  }

  return (
    <div ref={rootRef} className={cx('lpk-stage', boot && 'boot')}>
      <div className="lpk-tabs" role="tablist" aria-label="実演の段階" style={{ ['--i' as string]: tab, ['--n' as string]: tabs.length }}>
        <span className="lpk-tabs-ind" aria-hidden="true" />
        {tabs.map((x, i) => (
          <button key={x.id} role="tab" type="button" aria-selected={i === tab} className={cx('lpk-tab lpk-press', i === tab && 'on')} onClick={() => pick(i)}>
            <span className="lpk-tab-n">{i + 1}</span>
            {x.label}
          </button>
        ))}
      </div>

      <BorderBeam active={inView}>
        <div className="lpk-win" data-demo-t={Math.round(t)}>
          <div className="lpk-win-bar">
            <span className="lpk-dots" aria-hidden="true"><i /><i /><i /></span>
            <span className="lpk-win-title">{title}</span>
            {ok && (
              <button type="button" className="lpk-pause lpk-press" onClick={() => setPaused((v) => !v)} aria-pressed={paused}>
                {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
                {paused ? '再生' : '一時停止'}
              </button>
            )}
          </div>
          <div className="lpk-demo">{render(t, tab)}</div>
        </div>
      </BorderBeam>
    </div>
  )
}
