// ============================================
// 会話の動きの間合い（実際の処理に合わせる。動きを減らす設定のときは短くする）
// ============================================
export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

/** 1つの作業の間合い。0.2〜0.5 秒。動きを減らす設定のときは、画面の描き直しを待つだけの短さ */
export function paceMs(): number {
  return reducedMotion() ? 60 : 320
}

export const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))

/** 画面が描き直されるのを待つ（値を入れたあとに、画面の今の値を読むため） */
export function nextFrames(n = 2): Promise<void> {
  return new Promise((resolve) => {
    const step = (i: number) => (i <= 0 ? resolve() : window.requestAnimationFrame(() => step(i - 1)))
    step(n)
  })
}
