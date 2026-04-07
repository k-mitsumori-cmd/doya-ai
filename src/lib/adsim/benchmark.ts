// ============================================
// ドヤ広告シミュレーションAI - 業界平均ベンチマーク
// ============================================
// 業種 × 媒体別の CPM / CTR / CPC / CVR の参考値。
// 数値は業界レポート（WordStream, Databox, LANCERS, Ahrefs等）を基にした推定値であり、
// 実際の広告運用結果を保証するものではない。実運用時は自社実績値で上書きすることを推奨。

export type MediaId = 'google' | 'meta' | 'line' | 'x' | 'tiktok' | 'yahoo'

export interface MediaBenchmark {
  cpm: number   // 円（1000imp あたり）
  ctr: number   // 小数（0.01 = 1%）
  cpc: number   // 円
  cvr: number   // 小数（0.02 = 2%）
}

export interface IndustryBenchmark {
  id: string
  name: string
  media: Record<MediaId, MediaBenchmark>
}

// ----------------------------------------
// 媒体マスタ
// ----------------------------------------
export const MEDIA_OPTIONS: { id: MediaId; name: string; mvp: boolean }[] = [
  { id: 'google', name: 'Google広告', mvp: true },
  { id: 'meta', name: 'Meta広告（FB/IG）', mvp: true },
  { id: 'line', name: 'LINE広告', mvp: true },
  { id: 'x', name: 'X広告', mvp: true },
  { id: 'tiktok', name: 'TikTok広告', mvp: true },
  { id: 'yahoo', name: 'Yahoo!広告', mvp: true },
]

// ----------------------------------------
// ヘルパー: 媒体別の係数
// ----------------------------------------
// 業種ごとに個別値を打ち込むと肥大化するため、
// Google を基準にして媒体別係数を適用して算出する。
type Modifier = { cpm: number; ctr: number; cpc: number; cvr: number }

const MEDIA_MODIFIERS: Record<MediaId, Modifier> = {
  google:  { cpm: 1.0, ctr: 1.0,  cpc: 1.0,  cvr: 1.0  },
  meta:    { cpm: 0.8, ctr: 0.45, cpc: 0.85, cvr: 0.85 },
  line:    { cpm: 0.6, ctr: 0.35, cpc: 0.75, cvr: 0.80 },
  x:       { cpm: 0.7, ctr: 0.38, cpc: 0.90, cvr: 0.65 },
  tiktok:  { cpm: 0.55, ctr: 0.55, cpc: 0.65, cvr: 0.70 },
  yahoo:   { cpm: 0.85, ctr: 0.85, cpc: 0.80, cvr: 0.90 },
}

function expand(
  id: string,
  name: string,
  google: MediaBenchmark
): IndustryBenchmark {
  const media: Partial<Record<MediaId, MediaBenchmark>> = {}
  for (const [mid, mod] of Object.entries(MEDIA_MODIFIERS)) {
    media[mid as MediaId] = {
      cpm: Math.round(google.cpm * mod.cpm),
      ctr: Number((google.ctr * mod.ctr).toFixed(4)),
      cpc: Math.round(google.cpc * mod.cpc),
      cvr: Number((google.cvr * mod.cvr).toFixed(4)),
    }
  }
  return { id, name, media: media as Record<MediaId, MediaBenchmark> }
}

// ----------------------------------------
// 業界平均（Google広告を基準に30業種）
// ----------------------------------------
export const INDUSTRY_BENCHMARKS: IndustryBenchmark[] = [
  expand('ec',            'EC・通販',            { cpm: 800,  ctr: 0.032, cpc: 65,  cvr: 0.022 }),
  expand('saas',          'SaaS・BtoB',         { cpm: 1400, ctr: 0.028, cpc: 180, cvr: 0.035 }),
  expand('realestate',    '不動産',              { cpm: 1200, ctr: 0.025, cpc: 220, cvr: 0.012 }),
  expand('beauty',        '美容・コスメ',         { cpm: 700,  ctr: 0.030, cpc: 70,  cvr: 0.020 }),
  expand('education',     '教育・スクール',        { cpm: 1100, ctr: 0.027, cpc: 150, cvr: 0.025 }),
  expand('finance',       '金融・保険',           { cpm: 1800, ctr: 0.022, cpc: 280, cvr: 0.015 }),
  expand('healthcare',    '医療・ヘルスケア',      { cpm: 1300, ctr: 0.024, cpc: 200, cvr: 0.018 }),
  expand('restaurant',    '飲食・レストラン',      { cpm: 600,  ctr: 0.028, cpc: 80,  cvr: 0.015 }),
  expand('travel',        '旅行・宿泊',           { cpm: 900,  ctr: 0.030, cpc: 120, cvr: 0.020 }),
  expand('automotive',    '自動車',              { cpm: 1100, ctr: 0.020, cpc: 240, cvr: 0.010 }),
  expand('legal',         '法律・士業',           { cpm: 1500, ctr: 0.022, cpc: 380, cvr: 0.028 }),
  expand('hr',            '人材・採用',           { cpm: 1000, ctr: 0.025, cpc: 220, cvr: 0.030 }),
  expand('fitness',       'フィットネス',          { cpm: 650,  ctr: 0.029, cpc: 90,  cvr: 0.020 }),
  expand('apparel',       'アパレル',             { cpm: 750,  ctr: 0.028, cpc: 75,  cvr: 0.018 }),
  expand('homeservice',   'リフォーム・住宅',      { cpm: 1200, ctr: 0.023, cpc: 260, cvr: 0.012 }),
  expand('gaming',        'ゲーム・エンタメ',      { cpm: 500,  ctr: 0.035, cpc: 50,  cvr: 0.025 }),
  expand('btoc_service',  'BtoCサービス業',       { cpm: 800,  ctr: 0.026, cpc: 110, cvr: 0.020 }),
  expand('btob_manufacturing', 'BtoB製造業',    { cpm: 1600, ctr: 0.020, cpc: 320, cvr: 0.022 }),
  expand('nonprofit',     'NPO・団体',           { cpm: 700,  ctr: 0.030, cpc: 90,  cvr: 0.018 }),
  expand('pet',           'ペット・動物',         { cpm: 650,  ctr: 0.031, cpc: 70,  cvr: 0.019 }),
  expand('wedding',       'ウェディング',         { cpm: 850,  ctr: 0.026, cpc: 180, cvr: 0.014 }),
  expand('funeral',       '葬儀・終活',           { cpm: 900,  ctr: 0.021, cpc: 260, cvr: 0.016 }),
  expand('childcare',     '子育て・育児',         { cpm: 750,  ctr: 0.030, cpc: 95,  cvr: 0.022 }),
  expand('subscription',  'サブスクリプション',    { cpm: 900,  ctr: 0.028, cpc: 140, cvr: 0.025 }),
  expand('logistics',     '物流・配送',           { cpm: 1000, ctr: 0.022, cpc: 160, cvr: 0.018 }),
  expand('construction',  '建設・建築',           { cpm: 1100, ctr: 0.021, cpc: 240, cvr: 0.014 }),
  expand('media',         'メディア・出版',       { cpm: 550,  ctr: 0.032, cpc: 55,  cvr: 0.015 }),
  expand('agriculture',   '農業・食品生産',       { cpm: 700,  ctr: 0.026, cpc: 100, cvr: 0.018 }),
  expand('crypto',        '暗号資産・投資',       { cpm: 1700, ctr: 0.024, cpc: 300, cvr: 0.012 }),
  expand('other',         'その他',              { cpm: 1000, ctr: 0.028, cpc: 120, cvr: 0.020 }),
]

export function getBenchmark(industryId: string): IndustryBenchmark {
  return (
    INDUSTRY_BENCHMARKS.find((b) => b.id === industryId) ||
    INDUSTRY_BENCHMARKS.find((b) => b.id === 'other')!
  )
}
