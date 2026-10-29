// ============================================
// 動きの決まり（画面に依らない部品）: 数字の数え上がり・動きの強さ（その日の最初だけフル）
// ============================================
// 2026-10-29 本人の指示（メイン経由）:「売上の数値がカウントアップされる」「その日最初に開いたときだけフルに、2回目以降は短く」。
// 動かすのは位置・透明度・拡大縮小だけ。動きを減らす設定では、数字は最終の値をそのまま出す。

/** 'full' = その日の最初の表示 / 'short' = 2回目以降（短く） / 'none' = 動きを減らす設定 */
export type MotionMode = 'full' | 'short' | 'none'

export interface CountSpec { n: number; decimals: number; grouped: boolean }

/** 「1,284」「24」「1.8」のような表示の数字を、数え上がりの元に分ける。数字でなければ null */
export function parseCount(text: string): CountSpec | null {
  const s = text.trim()
  if (!/^\d{1,3}(,\d{3})*(\.\d+)?$|^\d+(\.\d+)?$/.test(s)) return null
  const grouped = s.includes(',')
  const decimals = s.includes('.') ? s.split('.')[1].length : 0
  return { n: Number(s.replace(/,/g, '')), decimals, grouped }
}

/** 数え上がりの途中の値を、もとの表示と同じ形（桁区切り・小数）の文字にする */
export function formatCount(n: number, spec: Pick<CountSpec, 'decimals' | 'grouped'>): string {
  const fixed = n.toFixed(spec.decimals)
  if (!spec.grouped) return fixed
  const [i, d] = fixed.split('.')
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? `.${d}` : '')
}

/** 減速する曲線（最初は速く、最後はゆっくり止まる）。t は 0〜1 */
export function easeOutQuart(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return 1 - Math.pow(1 - x, 4)
}

/** 時間 t（0〜1）の数え上がりの値。最後は必ず目標の値ちょうどにする */
export function countValue(spec: CountSpec, t: number): number {
  if (t >= 1) return spec.n
  return spec.n * easeOutQuart(t)
}

/** 動きの強さごとの時間（ミリ秒）。数え上がり・カードの遅れ・札の遅れ */
export function motionTimes(mode: MotionMode, slow = 1): { count: number; cardStep: number; settle: number } {
  const k = Number.isFinite(slow) && slow > 0 ? slow : 1
  if (mode === 'none') return { count: 0, cardStep: 0, settle: 0 }
  if (mode === 'short') return { count: 450 * k, cardStep: 0, settle: 0 }
  return { count: 1000 * k, cardStep: 110 * k, settle: 220 * k }
}

/** その日（YYYY-MM-DD）の最初の表示か。前に見た日の記録が今日と違えば最初 */
export function isFirstOfDay(stored: string | null, today: string): boolean {
  return stored !== today
}

/** 日付の文字（利用者の端末の日付） */
export function dayKey(d: Date): string {
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
