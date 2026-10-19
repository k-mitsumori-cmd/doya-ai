// プロマネの新しい見た目（UI 品質の直し）で使う画像と、数字の札の表示。useUiNext() / isUiNext() が真のときだけ使う。
// ⚠️ キービジュアルは、シロクマの版（public/ui-renewal/mascots/promane.webp）ができたら差し替える。それまでは LP の見本の絵
export const PROMANE_UI_NEXT_ART = {
  hero: '/promane/hero.webp',
  empty: '/promane/empty-projects.webp',
} as const

/** 数字の札に出す金額。1万円以上は「576万」のように万の単位にし、375px の2列でもはみ出さないようにする（単位の「円」は unit で出す） */
export function manYen(n: number): string {
  const v = Number.isFinite(n) ? n : 0
  if (Math.abs(v) < 10000) return v.toLocaleString('ja-JP')
  return `${(v / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}万`
}
