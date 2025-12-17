/**
 * カテゴリ別のサンプル入力データ
 * ワンボタンでサンプルデータを入力してお試しできる機能用
 */

export interface SampleInput {
  category: string
  size: string
  keyword: string
  purpose?: string
  tone?: string
  label: string
  description: string
}

export const SAMPLE_INPUTS: SampleInput[] = [
  // 通信向け
  {
    category: 'telecom',
    size: '1080x1080',
    keyword: '月額990円〜 乗り換えで最大2万円キャッシュバック',
    purpose: 'cv',
    tone: 'deal',
    label: '格安SIM乗り換えキャンペーン',
    description: 'キャッシュバック訴求で乗り換えを促進',
  },
  {
    category: 'telecom',
    size: '1200x628',
    keyword: '今なら工事費無料！光回線が月額3,980円',
    purpose: 'ctr',
    tone: 'urgent',
    label: '光回線キャンペーン',
    description: '工事費無料と価格訴求で興味喚起',
  },

  // マーケティング
  {
    category: 'marketing',
    size: '1080x1080',
    keyword: '【無料ウェビナー】売上3倍のマーケ戦略を公開',
    purpose: 'cv',
    tone: 'trust',
    label: 'ウェビナー集客バナー',
    description: '具体的な数字で信頼感を演出',
  },
  {
    category: 'marketing',
    size: '1200x628',
    keyword: 'MA導入で工数80%削減 事例集を無料ダウンロード',
    purpose: 'cv',
    tone: 'trust',
    label: '資料ダウンロード訴求',
    description: '導入効果を数字で訴求',
  },

  // EC向け
  {
    category: 'ec',
    size: '1080x1080',
    keyword: '決算セール MAX70%OFF 本日限り！',
    purpose: 'ctr',
    tone: 'urgent',
    label: 'セール告知バナー',
    description: '限定感と割引率で購買意欲を刺激',
  },
  {
    category: 'ec',
    size: '1080x1920',
    keyword: '新作スニーカー入荷 数量限定 先着100名様',
    purpose: 'awareness',
    tone: 'deal',
    label: '新商品告知（ストーリーズ）',
    description: '新作の限定感を演出',
  },

  // 採用向け
  {
    category: 'recruit',
    size: '1080x1080',
    keyword: 'エンジニア積極採用中 リモートOK 年収600万〜',
    purpose: 'cv',
    tone: 'friendly',
    label: 'エンジニア採用バナー',
    description: '条件を明示して応募を促進',
  },
  {
    category: 'recruit',
    size: '1200x628',
    keyword: '新卒採用 説明会予約受付中 参加特典あり',
    purpose: 'cv',
    tone: 'trust',
    label: '新卒説明会募集',
    description: '特典で参加を促進',
  },

  // 美容・コスメ
  {
    category: 'beauty',
    size: '1080x1080',
    keyword: '美肌の秘密 92%が効果を実感 初回50%OFF',
    purpose: 'cv',
    tone: 'luxury',
    label: 'スキンケア商品訴求',
    description: '効果実感の数字と割引で訴求',
  },
  {
    category: 'beauty',
    size: '1080x1920',
    keyword: '夏の新作コレクション 限定カラー登場',
    purpose: 'awareness',
    tone: 'luxury',
    label: 'コスメ新作告知',
    description: '限定感とトレンド訴求',
  },

  // 飲食・フード
  {
    category: 'food',
    size: '1080x1080',
    keyword: '今だけ配送料無料！人気メニューを自宅で',
    purpose: 'cv',
    tone: 'deal',
    label: 'デリバリー訴求',
    description: '配送料無料で注文を促進',
  },
  {
    category: 'food',
    size: '300x250',
    keyword: 'ランチタイム限定 500円引きクーポン',
    purpose: 'ctr',
    tone: 'friendly',
    label: 'クーポン訴求（ディスプレイ）',
    description: 'お得感で来店を促進',
  },

  // 教育・学習
  {
    category: 'education',
    size: '1080x1080',
    keyword: '1日15分で資格取得 合格率98% 無料体験実施中',
    purpose: 'cv',
    tone: 'trust',
    label: 'オンライン講座訴求',
    description: '合格率と手軽さをアピール',
  },

  // 金融・保険
  {
    category: 'finance',
    size: '1200x628',
    keyword: '老後の不安を解消 無料相談受付中 FP資格者が対応',
    purpose: 'cv',
    tone: 'trust',
    label: '保険相談訴求',
    description: '専門家対応で信頼感を演出',
  },

  // 旅行・観光
  {
    category: 'travel',
    size: '1080x1080',
    keyword: '沖縄3日間 29,800円〜 早割30日前まで',
    purpose: 'cv',
    tone: 'deal',
    label: 'ツアー訴求',
    description: '価格と早割で予約を促進',
  },

  // 不動産
  {
    category: 'realestate',
    size: '1200x628',
    keyword: '新築マンション 内見予約受付中 駅徒歩3分',
    purpose: 'cv',
    tone: 'trust',
    label: 'マンション内見訴求',
    description: '立地の良さをアピール',
  },
]

/**
 * カテゴリに基づいてサンプルを取得
 */
export function getSamplesByCategory(category: string): SampleInput[] {
  return SAMPLE_INPUTS.filter(sample => sample.category === category)
}

/**
 * ランダムなサンプルを取得
 */
export function getRandomSample(): SampleInput {
  return SAMPLE_INPUTS[Math.floor(Math.random() * SAMPLE_INPUTS.length)]
}

/**
 * カテゴリとサイズに最も適したサンプルを取得
 */
export function getBestMatchSample(category: string, size: string): SampleInput | null {
  // 完全一致を優先
  const exactMatch = SAMPLE_INPUTS.find(s => s.category === category && s.size === size)
  if (exactMatch) return exactMatch

  // カテゴリ一致を次に優先
  const categoryMatch = SAMPLE_INPUTS.find(s => s.category === category)
  if (categoryMatch) return categoryMatch

  return null
}

