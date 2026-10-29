// ============================================
// 入力欄の中の例の文を、タイプライターのように1文字ずつ打ち、少し止まって消し、次の例を打つ（画面に依らない部品）
// ============================================
// 2026-10-29 本人の指示（メイン経由）。1コマ = 約55ms。打つのは1コマに1文字、止まるのは約1.8秒、消すのは1コマに2文字、次の前に少し空ける。
// 動きを減らす設定・入力欄を押したあとは、この動きを使わず、1つの例を静止して出す。

export const TYPE_HOLD = 32 // 打ち終わってから止まるコマ数（約1.8秒）
export const TYPE_GAP = 6 // 消し終わってから次を打つまでのコマ数
export const ERASE_PER_STEP = 2

export interface TypedFrame { text: string; index: number; phase: 'type' | 'hold' | 'erase' | 'gap' }

/** 1つの例の1周ぶんのコマ数 */
export function cycleLength(example: string): number {
  const n = Array.from(example).length
  return n + TYPE_HOLD + Math.ceil(n / ERASE_PER_STEP) + TYPE_GAP
}

/** コマ番号 step（0 から）のときの、入力欄に出す文字。examples は1つ以上 */
export function typewriterAt(examples: readonly string[], step: number): TypedFrame {
  if (examples.length === 0) return { text: '', index: 0, phase: 'gap' }
  const total = examples.reduce((a, e) => a + cycleLength(e), 0)
  let s = ((Math.floor(step) % total) + total) % total
  for (let i = 0; i < examples.length; i++) {
    const chars = Array.from(examples[i])
    const n = chars.length
    const len = cycleLength(examples[i])
    if (s < len) {
      if (s < n) return { text: chars.slice(0, s + 1).join(''), index: i, phase: 'type' }
      s -= n
      if (s < TYPE_HOLD) return { text: chars.join(''), index: i, phase: 'hold' }
      s -= TYPE_HOLD
      const eraseSteps = Math.ceil(n / ERASE_PER_STEP)
      if (s < eraseSteps) return { text: chars.slice(0, Math.max(0, n - (s + 1) * ERASE_PER_STEP)).join(''), index: i, phase: 'erase' }
      return { text: '', index: i, phase: 'gap' }
    }
    s -= len
  }
  return { text: '', index: 0, phase: 'gap' }
}

/** 入力欄に出す例（部署をまたぐ）。送ると、その依頼として AI が受け取る言葉 */
export const TYPEWRITER_EXAMPLES: readonly string[] = [
  '来週の商談の準備をまとめて進めたい',
  '20万円の支出を登録したい',
  '採用の面接の日程を組みたい',
  '新商品のバナーを3案作りたい',
  '今月の売上と入金をまとめて確かめたい',
  '展示会の準備をひとつずつ進めたい',
  '取引先に出す見積書を作りたい',
  '検索で読まれる記事を1本書きたい',
]
