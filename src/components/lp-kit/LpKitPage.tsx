'use client'
// ドヤAI LP 共通の型（9段）を組み立てる。サービスごとの設定（content）と画面の再現（visuals）を渡す。
import { useState, type CSSProperties } from 'react'
import type { LpKitContent, LpKitVisuals } from './types'
import { MotionContext, cx, useMotionState } from './hooks'
import { FaqSection, FeaturesSection, FinalCta, Footer, Header, Hero, ShowcaseSection, StageSection, StatementSection, StatsSection, StepsSection } from './sections'
import './lp-kit.css'

// JS が動いたときだけ、出現の「最初の状態」を CSS で適用する（JS が動かなければ全部見える）
// （ページ全体を包む div に付ける。className が固定の要素なので、React が上書きしない）
const JS_FLAG = `document.currentScript.parentElement.classList.add('lpk-js')`

export function LpKitPage({ content, visuals, accent = '#ffd400', heroVariant }: { content: LpKitContent; visuals: LpKitVisuals; accent?: string; heroVariant?: 'a' | 'b' }) {
  const [still, setStill] = useState(false)
  const motion = useMotionState(still)
  return (
    <MotionContext.Provider value={motion}>
      <div className={cx('lpk', still && 'lpk-still')} style={{ ['--accent' as string]: accent } as CSSProperties}>
        <div className="lpk-in" suppressHydrationWarning>
          <script dangerouslySetInnerHTML={{ __html: JS_FLAG }} />
          <Header c={content} />
          <main>
            <Hero c={content} v={visuals} variant={heroVariant} />
            <StageSection c={content} v={visuals} />
            <StatsSection c={content} />
            <ShowcaseSection c={content} v={visuals} />
            <FeaturesSection c={content} v={visuals} />
            <StatementSection c={content} />
            <StepsSection c={content} />
            <FaqSection c={content} />
            <FinalCta c={content} />
          </main>
          <Footer c={content} still={still} onToggleStill={() => setStill((v) => !v)} />
        </div>
      </div>
    </MotionContext.Provider>
  )
}
