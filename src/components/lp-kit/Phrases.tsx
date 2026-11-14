'use client'
// 日本語の見出し。文節の配列で持ち、文節を inline-block + nowrap にして、文節の途中で折れないようにする。
// 読み上げ用に、見出し全体の文を視覚的に隠した形で1つ持たせ、分けた文節は aria-hidden にする。
import type { ElementType } from 'react'
import type { PhraseSpec } from './types'
import { cx } from './hooks'
import { useRevealOnce } from './motion'

export function PhraseHeading({
  as = 'h2',
  spec,
  className,
  mode = 'reveal',
}: {
  as?: ElementType
  spec: PhraseSpec
  className?: string
  /** load: 読み込み直後に CSS で文節が順に出る（ヒーロー）。reveal: 画面に入ったら出る。none: 動かさない */
  mode?: 'load' | 'reveal' | 'none'
}) {
  const Tag = as as ElementType
  const ref = useRevealOnce<HTMLElement>()
  const full = spec.phrases.join('')
  return (
    <Tag ref={mode === 'reveal' ? ref : undefined} className={cx('lpk-h', mode === 'load' && 'lpk-h-load', mode === 'reveal' && 'lpk-h-rv', className)}>
      <span className="lpk-sr">{full}</span>
      <span aria-hidden="true">
        {spec.phrases.map((p, i) => (
          <span key={i}>
            <span className={cx('lpk-ph', spec.mark?.includes(i) && 'lpk-mark')} style={{ ['--i' as string]: Math.min(i, 5) }}>
              {p}
            </span>
            {spec.breakPc?.includes(i) && <br className="lpk-br-pc" />}
            {spec.breakSp?.includes(i) && <br className="lpk-br-sp" />}
          </span>
        ))}
      </span>
    </Tag>
  )
}
