// ============================================
// ドヤ見積もりAI 相場マスタ（自社の一次情報）
// ============================================
// ⚠️ この数字の出所は、ドヤマーケAIのメディアで公開している施策別の相場記事。
//    つまり自社が調査・公開した一次情報であり、AIの内部知識の推測ではない。
//    金額に根拠を持たせるための土台なので、更新するときは必ず出典記事も直すこと。
//
// ⚠️ ここに無いカテゴリは「相場不明」として扱い、勝手に金額を作らない。
//    見積書は取引の意思表示であり、根拠のない数字を印字させてはいけない。

export interface MarketPrice {
  key: string
  /** 品目名の候補（マッチング用のキーワードも兼ねる） */
  keywords: string[]
  category: string
  itemName: string
  unit: string
  min: number
  max: number
  /** 月額など継続課金なら true */
  recurring: boolean
  note: string
  source: string
}

const SRC = 'ドヤマーケAI 相場調査（自社メディア公開データ）'

export const MARKET_PRICES: MarketPrice[] = [
  // --- SEO ---
  { key: 'seo_consulting', keywords: ['SEO', 'SEO対策', 'SEOコンサル', '検索順位'], category: 'SEO',
    itemName: 'SEOコンサルティング', unit: '月', min: 150000, max: 500000, recurring: true,
    note: '内部改善の設計・KW戦略・効果検証を含む一般的な月額レンジ', source: SRC },
  { key: 'seo_article', keywords: ['記事', '記事制作', 'コンテンツ制作', 'SEO記事', 'ライティング'], category: 'SEO',
    itemName: 'SEO記事制作', unit: '本', min: 30000, max: 80000, recurring: false,
    note: '5,000字前後・構成/執筆/入稿込みのレンジ', source: SRC },
  { key: 'seo_audit', keywords: ['サイト診断', 'テクニカル', '内部施策', 'サイト監査'], category: 'SEO',
    itemName: 'サイト内部診断（テクニカルSEO）', unit: '式', min: 200000, max: 800000, recurring: false,
    note: 'クロール・indexation・表示速度の一括診断と改善指示書', source: SRC },
  { key: 'llmo', keywords: ['LLMO', 'AEO', 'AI検索', '生成AI対策'], category: 'SEO',
    itemName: 'LLMO/AEO対策', unit: '月', min: 150000, max: 500000, recurring: true,
    note: '生成AI上での言及・引用獲得を狙う施策。市場が新しく幅が大きい', source: SRC },

  // --- 広告運用 ---
  { key: 'ad_ops_fee', keywords: ['広告運用', 'リスティング', '運用手数料', 'Google広告', 'Meta広告'], category: '広告',
    itemName: '広告運用代行手数料', unit: '月', min: 50000, max: 300000, recurring: true,
    note: '広告費の20%が慣例。最低手数料5万円前後が下限', source: SRC },
  { key: 'ad_creative', keywords: ['バナー', 'クリエイティブ', '広告画像', 'バナー制作'], category: '広告',
    itemName: '広告クリエイティブ制作', unit: '本', min: 10000, max: 50000, recurring: false,
    note: 'サイズ展開は別途。1案あたりのレンジ', source: SRC },
  { key: 'lp_production', keywords: ['LP', 'ランディングページ', 'LP制作'], category: '広告',
    itemName: 'ランディングページ制作', unit: '式', min: 300000, max: 1000000, recurring: false,
    note: '構成・デザイン・コーディング込み', source: SRC },

  // --- サイト制作 ---
  { key: 'site_build', keywords: ['サイト制作', 'ホームページ', 'コーポレートサイト', 'Web制作', 'リニューアル'], category: '制作',
    itemName: 'コーポレートサイト制作', unit: '式', min: 300000, max: 5000000, recurring: false,
    note: 'ページ数と要件で大きく変動。小規模30万〜／中規模100〜300万', source: SRC },
  { key: 'site_maintenance', keywords: ['保守', '運用保守', 'サーバー保守', 'メンテナンス'], category: '制作',
    itemName: 'サイト保守運用', unit: '月', min: 20000, max: 100000, recurring: true,
    note: '軽微修正・監視・バックアップを含む', source: SRC },
  { key: 'ec_build', keywords: ['EC', 'ECサイト', 'ネットショップ', '通販'], category: '制作',
    itemName: 'ECサイト構築', unit: '式', min: 500000, max: 5000000, recurring: false,
    note: 'ASP利用か独自構築かで大きく変わる', source: SRC },

  // --- SNS ---
  { key: 'sns_ops', keywords: ['SNS運用', 'Instagram', 'X運用', 'SNS'], category: 'SNS',
    itemName: 'SNS運用代行', unit: '月', min: 100000, max: 500000, recurring: true,
    note: '投稿本数・アカウント数で変動', source: SRC },
  { key: 'movie_production', keywords: ['動画', '動画制作', '撮影', 'ショート動画'], category: 'SNS',
    itemName: '動画制作', unit: '本', min: 100000, max: 1000000, recurring: false,
    note: '撮影ありは50万〜。編集のみなら10万前後', source: SRC },

  // --- 開発・ツール ---
  { key: 'saas_seat', keywords: ['SaaS', 'ライセンス', 'アカウント', '利用料', 'ID'], category: 'ツール',
    itemName: 'SaaS利用料', unit: 'ID/月', min: 1000, max: 30000, recurring: true,
    note: 'ビジネス向けSaaSの1ID月額レンジ', source: SRC },
  { key: 'system_dev', keywords: ['システム開発', '受託開発', 'アプリ開発', '業務システム'], category: '開発',
    itemName: 'システム開発', unit: '人月', min: 800000, max: 1500000, recurring: false,
    note: '国内SIの一般的な人月単価', source: SRC },
  { key: 'initial_setup', keywords: ['初期費用', '導入支援', 'セットアップ', 'オンボーディング'], category: '共通',
    itemName: '初期導入費用', unit: '式', min: 100000, max: 500000, recurring: false,
    note: '設定代行・データ移行・研修を含む', source: SRC },

  // --- コンサル ---
  { key: 'consulting', keywords: ['コンサル', 'コンサルティング', '顧問', 'アドバイザリー'], category: 'コンサル',
    itemName: 'マーケティングコンサルティング', unit: '月', min: 200000, max: 1000000, recurring: true,
    note: '関与度（月次/週次）で変動', source: SRC },
  { key: 'training', keywords: ['研修', 'トレーニング', '勉強会', 'ワークショップ'], category: 'コンサル',
    itemName: '研修・ワークショップ', unit: '回', min: 100000, max: 500000, recurring: false,
    note: '半日〜1日・講師1名のレンジ', source: SRC },
]

/** 品目名から相場を引く。確信が持てないものは null（勝手に埋めない） */
export function lookupMarket(itemName: string, category?: string): MarketPrice | null {
  const norm = itemName.replace(/\s/g, '').toLowerCase()
  let best: { p: MarketPrice; score: number } | null = null
  for (const p of MARKET_PRICES) {
    let score = 0
    for (const kw of p.keywords) {
      const k = kw.replace(/\s/g, '').toLowerCase()
      if (norm.includes(k)) score = Math.max(score, k.length)
    }
    if (category && p.category === category) score += 0.5
    if (score > 0 && (!best || score > best.score)) best = { p, score }
  }
  // 1文字の一致で相場を当てにいくのは危険なので下限を設ける
  return best && best.score >= 2 ? best.p : null
}

/** プロンプトに載せる相場表（AIが根拠として参照する） */
export function marketTableForPrompt(): string {
  return MARKET_PRICES.map(
    (p) => `- ${p.itemName}（${p.category}）: ${p.min.toLocaleString()}〜${p.max.toLocaleString()}円 / ${p.unit}${p.recurring ? '（継続）' : ''} — ${p.note}`
  ).join('\n')
}
