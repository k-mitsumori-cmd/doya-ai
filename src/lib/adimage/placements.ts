// ============================================
// ドヤ広告画像AI 媒体・配置・サイズ定義
// ============================================
// ⚠️ 媒体レギュレーションは頻繁に変わる。定数はこの1ファイルに集約し、
//    コード各所にベタ書きしないこと。
//
// ⚠️ 生成サイズは「16の倍数・3:1以内・目標以上・比率一致」を全て満たす値を
//    事前計算して固定してある。これにより書き出しは常に純粋な縮小のみとなり、
//    クロップによる文字切れが原理的に起きない。
//    （前身 /adbanner は3プリセットから fit:'cover' で切り抜いており、
//      728x90 では縦の82%が捨てられて見出しもCTAも残らなかった）
//
// gpt-image-2 の実測仕様（2026-08-06 実API検証）:
//   - 幅・高さが16の倍数なら任意サイズ可（3プリセット固定ではない）
//   - アスペクト比の上限は厳密に 3:1（1792x592=3.03:1 は400拒否）
//   実エラー: "Width and height must both be divisible by 16"
//             "The maximum supported aspect ratio is 3:1"

export type CompositionKey = 'vertical-stack' | 'hero-center' | 'split-left' | 'compact'

export interface Placement {
  key: string
  media: string
  name: string
  /** 入稿する実寸 */
  w: number
  h: number
  /** 生成に使うサイズ（16の倍数・目標以上・比率一致） */
  genW: number
  genH: number
  composition: CompositionKey
  note?: string
}

export const PLACEMENTS: Placement[] = [
  { key: 'meta.story', media: 'Meta', name: 'ストーリーズ／リール', w: 1080, h: 1920, genW: 1152, genH: 2048, composition: 'vertical-stack' },
  { key: 'meta.feed_vertical', media: 'Meta', name: 'フィード縦（4:5）', w: 1080, h: 1350, genW: 1088, genH: 1360, composition: 'hero-center' },
  { key: 'meta.feed_square', media: 'Meta', name: 'フィード正方形', w: 1080, h: 1080, genW: 1216, genH: 1216, composition: 'hero-center' },
  { key: 'meta.feed_wide', media: 'Meta', name: 'フィード横長', w: 1200, h: 628, genW: 1280, genH: 672, composition: 'split-left', note: '歪み0.32%' },
  { key: 'google.rda_square', media: 'Google', name: 'レスポンシブ スクエア', w: 1200, h: 1200, genW: 1216, genH: 1216, composition: 'hero-center' },
  { key: 'google.rda_wide', media: 'Google', name: 'レスポンシブ 横長', w: 1200, h: 628, genW: 1280, genH: 672, composition: 'split-left', note: '歪み0.32%' },
  { key: 'google.rda_vertical', media: 'Google', name: 'レスポンシブ 縦長', w: 960, h: 1200, genW: 1088, genH: 1360, composition: 'hero-center' },
  { key: 'google.gdn_rectangle', media: 'Google', name: 'GDN レクタングル', w: 300, h: 250, genW: 960, genH: 800, composition: 'compact' },
  { key: 'google.gdn_skyscraper', media: 'Google', name: 'GDN ワイドスカイスクレイパー', w: 300, h: 600, genW: 1024, genH: 2048, composition: 'vertical-stack' },
  { key: 'x.post', media: 'X', name: '画像ポスト', w: 1600, h: 900, genW: 2048, genH: 1152, composition: 'split-left' },
  { key: 'line.card', media: 'LINE', name: 'Card', w: 1200, h: 628, genW: 1280, genH: 672, composition: 'split-left', note: '歪み0.32%' },
  { key: 'line.square', media: 'LINE', name: 'Square', w: 1080, h: 1080, genW: 1216, genH: 1216, composition: 'hero-center' },
  { key: 'yahoo.yda', media: 'Yahoo!', name: 'YDA ディスプレイ', w: 1200, h: 628, genW: 1280, genH: 672, composition: 'split-left', note: '歪み0.32%' },
]

/**
 * Phase 1 で対応できない配置（3:1超過）。
 * 728x90（8.09:1）・320x100（3.20:1）は gpt-image-2 が受け付けない。
 * 現在の Google 広告はレスポンシブが主流で、1.91:1 / 1:1 / 4:5 を入稿すれば
 * リーダーボードを含む各枠へ自動でフィットするため、実務上の必要性は小さい。
 */
export const UNSUPPORTED_PLACEMENTS = [
  { name: 'Google GDN リーダーボード', size: '728×90', ratio: '8.09:1' },
  { name: 'Google GDN モバイルバナー', size: '320×100', ratio: '3.20:1' },
]

export function findPlacement(key: string): Placement | undefined {
  return PLACEMENTS.find((p) => p.key === key)
}

/** 既定の選択（迷わせないための初期値） */
export const DEFAULT_PLACEMENT_KEYS = ['meta.story', 'meta.feed_square', 'google.rda_wide']

/**
 * 選ばれた配置を「生成サイズ」でまとめる。
 * 同じ生成サイズを共有する配置は1回の生成を使い回せるため、
 * 全13配置を選んでも生成は最大7回に収まる。
 */
export interface GenGroup {
  genKey: string
  genW: number
  genH: number
  composition: CompositionKey
  placements: Placement[]
}

export function groupByGenSize(keys: string[]): GenGroup[] {
  const map = new Map<string, GenGroup>()
  for (const key of keys) {
    const p = findPlacement(key)
    if (!p) continue
    const genKey = `${p.genW}x${p.genH}`
    const existing = map.get(genKey)
    if (existing) {
      existing.placements.push(p)
    } else {
      map.set(genKey, {
        genKey,
        genW: p.genW,
        genH: p.genH,
        composition: p.composition,
        placements: [p],
      })
    }
  }
  return Array.from(map.values())
}
