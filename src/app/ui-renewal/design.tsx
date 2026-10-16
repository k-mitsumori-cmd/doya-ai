'use client'

// デザイン案の切り替え（アプリ画面と LP で共通）
// 選んだ案は閲覧者ごとの好みとして保存する。保存できない環境でも既定の案で表示する。
import { useEffect, useState, type CSSProperties } from 'react'
import { MousePointer2 } from 'lucide-react'
import s from './renewal.module.css'

export type Design = 'clear' | 'aurora' | 'midnight' | 'pop'

export const DESIGNS: { id: Design; label: string; note: string; swatch: string }[] = [
  { id: 'clear', label: 'クリア', note: '清潔な青と細い線', swatch: 'linear-gradient(135deg, #ffffff 0 50%, #0066ff 50%)' },
  { id: 'aurora', label: 'オーロラ', note: '流れる色とすりガラス', swatch: 'linear-gradient(135deg, #00b4ff, #7b5cff 50%, #ff1e72)' },
  { id: 'midnight', label: 'ミッドナイト', note: '暗い面に発光', swatch: 'radial-gradient(circle at 70% 30%, #00e0ff, #0066ff 35%, #05060c 70%)' },
  { id: 'pop', label: 'ポップ', note: '太い線とずらした影', swatch: 'linear-gradient(135deg, #ffd400 0 50%, #ff1e72 50%)' },
]

// v3: クリアを既定に決めた時点で、以前の選択は持ち越さない
const KEY = 'doya-ui-renewal-design-v3'
const CURSOR_KEY = 'doya-ui-renewal-cursor'

function read(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {}
}

export function useDesign() {
  const [design, setDesignState] = useState<Design>('clear')
  const [cursorOn, setCursorOnState] = useState(true)
  useEffect(() => {
    const saved = read(KEY)
    if (DESIGNS.some((d) => d.id === saved)) setDesignState(saved as Design)
    if (read(CURSOR_KEY) === 'off') setCursorOnState(false)
  }, [])
  const setDesign = (d: Design) => {
    setDesignState(d)
    write(KEY, d)
  }
  const setCursorOn = (on: boolean) => {
    setCursorOnState(on)
    write(CURSOR_KEY, on ? 'on' : 'off')
  }
  return { design, setDesign, cursorOn, setCursorOn }
}

/** 画面の隅に置く「デザイン案」の切り替え */
export function DesignDock({
  design,
  onChange,
  cursorOn,
  onCursor,
}: {
  design: Design
  onChange: (d: Design) => void
  cursorOn: boolean
  onCursor: (on: boolean) => void
}) {
  const current = DESIGNS.find((d) => d.id === design)!
  return (
    <div className={s.dock} role="group" aria-label="デザイン案">
      <span className={s.dockLabel}>
        デザイン案<b>{current.label}</b>
      </span>
      <div className={s.dockSwatches}>
        {DESIGNS.map((d, i) => (
          <button
            key={d.id}
            type="button"
            className={s.dockSwatch}
            style={{ '--sw': d.swatch, '--i': i } as CSSProperties}
            aria-pressed={design === d.id}
            aria-label={`${d.label}：${d.note}`}
            data-cursor={d.label}
            onClick={() => onChange(d.id)}
          >
            <span />
          </button>
        ))}
      </div>
      <button
        type="button"
        className={s.dockCursor}
        aria-pressed={cursorOn}
        onClick={() => onCursor(!cursorOn)}
        data-cursor={cursorOn ? '演出を止める' : '演出をつける'}
        aria-label="カーソルの演出"
      >
        <MousePointer2 size={15} strokeWidth={2} />
      </button>
    </div>
  )
}
