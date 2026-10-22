// ============================================
// ds/chart-math — グラフの純粋な計算（UI 品質 A-1・A-2）
// ============================================
// 目盛り・積み上げ・割合・しきい値の色・レーダーの頂点・数え上げの途中の値を計算する。
// ⚠️ React や DOM を使わない。テストは chart-math.test.ts（npm run test:syscheck でビルドの中で流れる）

/** グラフで使う色の名前。値はトークン（tokens.module.css） */
export type ChartTone =
  | 'blue' | 'blueDeep' | 'sky' | 'navy' | 'pink' | 'yellow' | 'cyan' | 'muted'
  | 'good' | 'fair' | 'poor'
  | 'positive' | 'neutral' | 'negative'

/** 色の名前 → CSS の色。トークンが無い場所でも出るよう、既定の値を添える */
export const TONE_COLOR: Record<ChartTone, string> = {
  blue: 'var(--blue, #0066ff)',
  blueDeep: 'var(--blue-deep, #0047d6)',
  sky: 'var(--sky, #009bff)',
  navy: 'var(--navy, #0a0f3c)',
  pink: 'var(--pink, #ff1e72)',
  yellow: 'var(--yellow, #ffd400)',
  cyan: 'var(--cyan, #00e0ff)',
  muted: 'var(--line-strong, #c6cde0)',
  // 意味のある色（良い・普通・要改善）
  good: 'var(--good, #12b76a)',
  fair: 'var(--fair, #f5a400)',
  poor: 'var(--poor, #e5254d)',
  // ポジティブ・ニュートラル・ネガティブ
  positive: 'var(--good, #12b76a)',
  neutral: 'var(--line-strong, #c6cde0)',
  negative: 'var(--poor, #e5254d)',
}

/** 意味のある色の、既定の読み上げ文字（色だけで伝えないため） */
export const TONE_TEXT: Partial<Record<ChartTone, string>> = {
  good: '良い', fair: '普通', poor: '要改善',
  positive: 'ポジティブ', neutral: 'ニュートラル', negative: 'ネガティブ',
}

/** 系列の色の順番（ブランドの青から。6色以上） */
export const SERIES_TONES: ChartTone[] = ['blue', 'pink', 'sky', 'yellow', 'navy', 'cyan', 'blueDeep', 'muted']

/** 系列の線の種類（色だけで区別しないため、線の形も変える） */
export const SERIES_DASH: (string | undefined)[] = [undefined, '6 4', '2 4', '10 3 2 3', '1 3', '12 4']

/** i 番目の系列の色。tone の指定があればそれを使う */
export function seriesColor(i: number, tone?: ChartTone | string): string {
  if (tone) return (TONE_COLOR as Record<string, string>)[tone] ?? tone
  return TONE_COLOR[SERIES_TONES[i % SERIES_TONES.length]]
}

/** 「1, 2, 2.5, 5」×10^k のきりのよい刻み */
export function niceStep(rough: number): number {
  if (!Number.isFinite(rough) || rough <= 0) return 1
  const exp = Math.floor(Math.log10(rough))
  const base = Math.pow(10, exp)
  const f = rough / base
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * base
}

function roundTo(n: number, step: number): number {
  // 0.1 + 0.2 のような端数を消す
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 2)
  const v = Number(n.toFixed(decimals))
  return Object.is(v, -0) ? 0 : v
}

/**
 * 目盛り。min〜max を含む、きりのよい範囲と目盛りの値を返す。
 * fixed を渡すと、その範囲をそのまま使い、目盛りだけきりよく刻む（例: 0〜100 に固定）
 */
export function niceTicks(min: number, max: number, count = 5, fixed?: readonly [number, number]): { min: number; max: number; step: number; ticks: number[] } {
  if (fixed) {
    const [lo, hi] = fixed[0] <= fixed[1] ? fixed : [fixed[1], fixed[0]]
    const span = hi - lo || 1
    const step = niceStep(span / Math.max(1, count - 1))
    const ticks: number[] = []
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) ticks.push(roundTo(v, step))
    return { min: lo, max: hi === lo ? lo + 1 : hi, step, ticks }
  }
  let lo = Math.min(min, max), hi = Math.max(min, max)
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) { lo = 0; hi = 1 }
  if (lo === hi) {
    if (lo === 0) hi = 1
    else if (lo > 0) lo = 0
    else hi = 0
  }
  const step = niceStep((hi - lo) / Math.max(1, count - 1))
  const nMin = roundTo(Math.floor(lo / step) * step, step)
  const nMax = roundTo(Math.ceil(hi / step) * step, step)
  const ticks: number[] = []
  for (let v = nMin; v <= nMax + step * 1e-9; v += step) ticks.push(roundTo(v, step))
  return { min: nMin, max: nMax, step, ticks }
}

/** 値の範囲 [min, max] の中での位置（0〜1）。範囲の外は 0〜1 に収める */
export function ratioIn(v: number, min: number, max: number): number {
  const span = max - min || 1
  return Math.max(0, Math.min(1, (v - min) / span))
}

/** 縦軸の目盛りの短い表記（12000 → 1.2万、350000000 → 3.5億） */
export function formatCompactJa(n: number): string {
  const a = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  const short = (x: number) => (Math.round(x * 10) / 10).toLocaleString('ja-JP', { maximumFractionDigits: 1 })
  if (a >= 1e8) return `${sign}${short(a / 1e8)}億`
  if (a >= 1e4) return `${sign}${short(a / 1e4)}万`
  return `${sign}${(Math.round(a * 100) / 100).toLocaleString('ja-JP', { maximumFractionDigits: 2 })}`
}

/**
 * 積み上げ。系列ごとの値を、正は 0 から上へ、負は 0 から下へ積む。
 * 戻り値 [系列][項目] = [下端, 上端]
 */
export function stackValues(series: readonly (readonly number[])[]): [number, number][][] {
  const n = Math.max(0, ...series.map((s) => s.length))
  const pos = new Array<number>(n).fill(0)
  const neg = new Array<number>(n).fill(0)
  return series.map((s) => Array.from({ length: n }, (_, i) => {
    const v = Number.isFinite(s[i]) ? s[i] : 0
    if (v >= 0) { const a = pos[i]; pos[i] += v; return [a, pos[i]] as [number, number] }
    const a = neg[i]; neg[i] += v; return [neg[i], a] as [number, number]
  }))
}

/** 項目ごとの合計の範囲（積み上げの縦軸に使う） */
export function stackExtent(series: readonly (readonly number[])[]): [number, number] {
  const st = stackValues(series)
  let lo = 0, hi = 0
  for (const s of st) for (const [a, b] of s) { lo = Math.min(lo, a); hi = Math.max(hi, b) }
  return [lo, hi]
}

/**
 * 100% の割合。負の値は 0 として扱う。
 * percents は描く幅（合計 100）、labels は表示用の整数（最大剰余法で合計を必ず 100 にする）。合計が 0 なら全部 0
 */
export function percentStack(values: readonly number[]): { percents: number[]; labels: number[]; total: number } {
  const vs = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0))
  const total = vs.reduce((a, b) => a + b, 0)
  if (total <= 0) return { percents: vs.map(() => 0), labels: vs.map(() => 0), total: 0 }
  const percents = vs.map((v) => (v / total) * 100)
  const floors = percents.map((p) => Math.floor(p))
  let rest = 100 - floors.reduce((a, b) => a + b, 0)
  const order = percents.map((p, i) => [p - Math.floor(p), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1])
  const labels = floors.slice()
  for (const [, i] of order) { if (rest <= 0) break; labels[i] += 1; rest -= 1 }
  return { percents, labels, total }
}

/** Bars の棒の長さ（%）。basis='max' は一番大きい値を 100、'total' は合計を 100 とする */
export function barPercents(values: readonly number[], basis: 'max' | 'total' = 'max'): number[] {
  const vs = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0))
  const denom = basis === 'total' ? vs.reduce((a, b) => a + b, 0) : Math.max(0, ...vs)
  if (denom <= 0) return vs.map(() => 0)
  return vs.map((v) => (v / denom) * 100)
}

export type Threshold = { at: number; tone: ChartTone | string; label?: string }

/**
 * しきい値で色を決める。at 以上の中で、一番大きい at のものを使う。どれにも届かなければ一番小さい at のもの。
 * 例: [{at:0,tone:'poor'},{at:0.5,tone:'fair'},{at:0.8,tone:'good'}]
 */
export function thresholdFor(value: number, thresholds: readonly Threshold[]): Threshold | undefined {
  if (!thresholds.length) return undefined
  const sorted = thresholds.slice().sort((a, b) => a.at - b.at)
  let hit = sorted[0]
  for (const t of sorted) if (value >= t.at) hit = t
  return hit
}

/** レーダーの頂点。最初の軸を真上に置き、時計回りに並べる */
export function radarPoints(values: readonly number[], max: number, r: number, cx: number, cy: number): [number, number][] {
  const n = values.length
  const m = max > 0 ? max : 1
  return values.map((v, i) => {
    const a = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2
    const k = Math.max(0, Math.min(1, (Number.isFinite(v) ? v : 0) / m))
    return [roundTo(cx + Math.cos(a) * r * k, 0.01), roundTo(cy + Math.sin(a) * r * k, 0.01)]
  })
}

/** 数え上げの途中の値。t は 0〜1（範囲の外は収める）。最後は必ず to になる */
export function countFrame(from: number, to: number, t: number): number {
  if (!(t < 1)) return to
  if (!(t > 0)) return from
  const e = 1 - Math.pow(2, -10 * t)
  return from + (to - from) * e
}

/** 数え上げの表示。小数を持つ値は、その桁数まで出す */
export function formatCount(n: number, finalValue: number): string {
  const s = String(finalValue)
  const decimals = Number.isInteger(finalValue) ? 0 : Math.min(4, (s.split('.')[1] ?? '').length)
  return n.toLocaleString('ja-JP', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

/** 横軸の文字を間引くときの間隔。幅に入る数だけ出す */
export function labelEvery(count: number, width: number, minGap = 44): number {
  if (count <= 1 || width <= 0) return 1
  const fit = Math.max(1, Math.floor(width / minGap))
  return Math.max(1, Math.ceil(count / fit))
}
