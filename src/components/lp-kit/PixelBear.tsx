'use client'
// ドット絵のクマ。16x16 のピクセル配列から SVG の rect で描く（画像の素材は無し・有料の生成は使っていない）。
// 歩く: 2コマを CSS の steps() で切り替える。ほかの姿勢は静止。動きを減らす設定では立ち絵にする（CSS 側）。
import { memo } from 'react'
import type { BearItem } from './types'

export type BearPose = 'stand' | 'walk' | 'jump' | 'cheer' | 'sleep'

const BASE = [
  '................',
  '..oo........oo..',
  '.obbo......obbo.',
  '.oobbbbbbbbbboo.',
  '.obbbbbbbbbbbbo.',
  '.obbebbbbbbebbo.',
  '.obbbllnnllbbbo.',
  '.obbbllllllbbbo.',
  '..oooooooooooo..',
  '..ssssssssssss..',
  '.obbbbllllbbbbo.',
  '.obbbbllllbbbbo.',
  '.obbbllllllbbbo.',
  '..oooooooooooo..',
  '..obbo....obbo..',
  '..oooo....oooo..',
]

const PAL: Record<string, string> = {
  o: '#3b2a1f', b: '#b9855a', l: '#f1d9b8', s: '#0066ff', e: '#14100c', n: '#3b2a1f',
  p: '#ffffff', k: '#0a1f44', g: '#8ec5ff', y: '#ffd400',
}

const ITEMS: Record<Exclude<BearItem, 'none'>, string[]> = {
  pen: ['....k', '...k.', '..k..', '.k...', 'y....'],
  doc: ['ooooo', 'opkpo', 'opppo', 'opkpo', 'ooooo'],
  lens: ['.ooo.', 'oggo.', 'oggo.', '.ooo.', '....o'],
}

function frame(pose: BearPose, step: 0 | 1): string[] {
  const g = BASE.map((r) => r.split(''))
  const set = (x: number, y: number, c: string) => { g[y][x] = c }
  if (pose === 'walk') {
    if (step === 0) {
      g[14] = '.obbo......obbo.'.split('')
      g[15] = '.oooo......oooo.'.split('')
    } else {
      g[14] = '...obbo..obbo...'.split('')
      g[15] = '...oooo..oooo...'.split('')
    }
  }
  if (pose === 'jump') {
    g[14] = '..oooooooooooo..'.split('')
    g[15] = '................'.split('')
  }
  if (pose === 'cheer') {
    for (const y of [4, 5, 6, 7]) { set(0, y, y === 4 ? 'o' : 'b'); set(15, y, y === 4 ? 'o' : 'b') }
  }
  if (pose === 'sleep') {
    set(4, 5, 'o'); set(5, 5, 'o'); set(10, 5, 'o'); set(11, 5, 'o')
    g[5][4] = 'b'
    g[5][11] = 'b'
  }
  return g.map((r) => r.join(''))
}

function Rects({ rows, ox = 0, oy = 0 }: { rows: string[]; ox?: number; oy?: number }) {
  const out: React.ReactNode[] = []
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x]
      if (c !== '.' && PAL[c]) out.push(<rect key={`${x}-${y}`} x={x + ox} y={y + oy} width="1" height="1" fill={PAL[c]} />)
    }
  })
  return <>{out}</>
}

export const PixelBear = memo(function PixelBear({
  pose = 'stand',
  item = 'none',
  size = 96,
  className,
}: {
  pose?: BearPose
  item?: BearItem
  /** 描画の高さ(px)。16 の倍数にするとドットがにじまない */
  size?: number
  className?: string
}) {
  const w = (size / 16) * 20
  return (
    <svg
      className={`lpk-bear ${className ?? ''}`}
      data-pose={pose}
      width={w}
      height={size}
      viewBox="0 0 20 16"
      shapeRendering="crispEdges"
      role="img"
      aria-label="ドット絵のクマ"
    >
      {pose === 'walk' ? (
        <>
          <g className="lpk-bear-f a"><Rects rows={frame('walk', 0)} /></g>
          <g className="lpk-bear-f b"><Rects rows={frame('walk', 1)} /></g>
        </>
      ) : (
        <g><Rects rows={frame(pose, 0)} /></g>
      )}
      {item !== 'none' && <Rects rows={ITEMS[item]} ox={14} oy={9} />}
    </svg>
  )
})
