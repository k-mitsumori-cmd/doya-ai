// ============================================
// 見本テンプレートの配色を画像そのものから抜き出す
// ============================================
// ⚠️ なぜ必要か（2026-09-02）:
//    見本の作風は Gemini が読み取った60〜120字の文章だけで渡していた。
//    「鮮烈な赤のベタ塗り背景」のような言葉では色が特定できず、
//    さらにプロンプト上部の「配色: #0066ff を基調にする」（サイトから取った
//    ブランド色）と正面から食い違うため、見本の色がほとんど反映されなかった。
//    実際の色を16進で渡せば、言葉のゆらぎが無くなる。
//
// ⚠️ 追加のAPIは使わない。sharp でローカルに数えるだけなので費用は発生しない。
import sharp from 'sharp'

/** 明るさ。白飛び・黒つぶれを外すのに使う */
function luminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')
}

/**
 * 画像から代表的な色を取り出す。
 * @returns 面積の大きい順。取れなければ空配列（呼び出し側は文章だけで進める）
 */
export async function extractRefPalette(imageUrl: string, max = 4): Promise<string[]> {
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) return []
    // ⚠️ 小さく潰してから数える。原寸で数えても結果は変わらず時間だけかかる
    const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(64, 64, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // 24bit を 4bit×3 に丸めて数える（近い色をひとまとめにする）
    const bins = new Map<number, { n: number; r: number; g: number; b: number }>()
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
      const cur = bins.get(key)
      if (cur) {
        cur.n++
        cur.r += r
        cur.g += g
        cur.b += b
      } else {
        bins.set(key, { n: 1, r, g, b })
      }
    }

    const sorted = [...bins.values()].sort((a, b) => b.n - a.n)
    const out: string[] = []
    for (const c of sorted) {
      const r = Math.round(c.r / c.n)
      const g = Math.round(c.g / c.n)
      const b = Math.round(c.b / c.n)
      const l = luminance(r, g, b)
      // ⚠️ ほぼ白・ほぼ黒は落とす。どの見本でも上位に来てしまい、
      //    作風の違いが出なくなる（背景の白が常に1位になる）
      if (l > 0.94 || l < 0.06) continue
      out.push(toHex(r, g, b))
      if (out.length >= max) break
    }
    return out
  } catch {
    // ⚠️ 配色が取れなくても生成は続ける。文章の作風だけで進む
    return []
  }
}
