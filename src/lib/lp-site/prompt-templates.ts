// ============================================
// LP生成用プロンプトテンプレート
// LPアーカイブ（https://rdlp.jp/lp-archive/）の学習データを基に
// 様々な職種・業種に対応したプロンプトパターンを定義
// ============================================

import { ProductInfo, LpSection, LpType, Tone } from './types'

/**
 * 業種カテゴリ
 */
export type IndustryCategory =
  | 'saas' // SaaS・ソフトウェア
  | 'ec' // EC・通販
  | 'service' // サービス
  | 'recruit' // 採用・求人
  | 'education' // 教育・スクール
  | 'healthcare' // 医療・健康
  | 'beauty' // 美容・コスメ
  | 'food' // 食品・飲食
  | 'finance' // 金融・保険
  | 'real-estate' // 不動産
  | 'construction' // 建設・工事
  | 'manufacturing' // 製造業
  | 'retail' // 小売
  | 'hospitality' // ホスピタリティ
  | 'entertainment' // エンターテイメント
  | 'non-profit' // 非営利

/**
 * 職種カテゴリ
 */
export type JobCategory =
  | 'developer' // 開発者・エンジニア
  | 'designer' // デザイナー
  | 'marketer' // マーケター
  | 'sales' // 営業
  | 'consultant' // コンサルタント
  | 'teacher' // 教師・講師
  | 'doctor' // 医師
  | 'lawyer' // 弁護士
  | 'accountant' // 会計士
  | 'engineer' // 技術者
  | 'manager' // マネージャー
  | 'entrepreneur' // 起業家
  | 'freelancer' // フリーランス
  | 'student' // 学生

/**
 * 業種別の特徴的なセクション構成
 */
export const industrySectionPatterns: Record<IndustryCategory, string[]> = {
  saas: [
    'hero',
    'stats',
    'problem',
    'solution',
    'features',
    'benefit',
    'case_study',
    'trust',
    'pricing',
    'faq',
    'testimonial',
    'cta',
  ],
  ec: [
    'hero',
    'visual_appeal',
    'problem',
    'benefit',
    'mechanism',
    'usage',
    'testimonial',
    'comparison',
    'pricing',
    'guarantee',
    'trust',
    'cta',
  ],
  service: [
    'hero',
    'stats',
    'problem',
    'solution',
    'benefit',
    'usage',
    'case_study',
    'trust',
    'process',
    'pricing',
    'faq',
    'cta',
  ],
  recruit: [
    'hero',
    'problem',
    'solution',
    'benefit',
    'process',
    'testimonial',
    'trust',
    'faq',
    'cta',
  ],
  education: [
    'hero',
    'stats',
    'problem',
    'solution',
    'features',
    'benefit',
    'usage',
    'testimonial',
    'pricing',
    'trust',
    'faq',
    'cta',
  ],
  healthcare: [
    'hero',
    'stats',
    'problem',
    'solution',
    'mechanism',
    'benefit',
    'case_study',
    'trust',
    'process',
    'pricing',
    'faq',
    'cta',
  ],
  beauty: [
    'hero',
    'visual_appeal',
    'problem',
    'benefit',
    'mechanism',
    'usage',
    'testimonial',
    'comparison',
    'pricing',
    'guarantee',
    'trust',
    'cta',
  ],
  food: [
    'hero',
    'visual_appeal',
    'problem',
    'benefit',
    'mechanism',
    'usage',
    'testimonial',
    'comparison',
    'pricing',
    'guarantee',
    'trust',
    'cta',
  ],
  finance: [
    'hero',
    'stats',
    'problem',
    'solution',
    'benefit',
    'case_study',
    'trust',
    'process',
    'pricing',
    'faq',
    'testimonial',
    'cta',
  ],
  'real-estate': [
    'hero',
    'visual_appeal',
    'problem',
    'solution',
    'benefit',
    'usage',
    'case_study',
    'trust',
    'process',
    'pricing',
    'faq',
    'cta',
  ],
  construction: [
    'hero',
    'stats',
    'problem',
    'solution',
    'features',
    'case_study',
    'trust',
    'process',
    'pricing',
    'guarantee',
    'faq',
    'cta',
  ],
  manufacturing: [
    'hero',
    'stats',
    'problem',
    'solution',
    'features',
    'benefit',
    'case_study',
    'trust',
    'process',
    'pricing',
    'faq',
    'cta',
  ],
  retail: [
    'hero',
    'visual_appeal',
    'problem',
    'benefit',
    'usage',
    'testimonial',
    'comparison',
    'pricing',
    'guarantee',
    'trust',
    'faq',
    'cta',
  ],
  hospitality: [
    'hero',
    'visual_appeal',
    'problem',
    'benefit',
    'usage',
    'testimonial',
    'comparison',
    'pricing',
    'guarantee',
    'trust',
    'faq',
    'cta',
  ],
  entertainment: [
    'hero',
    'visual_appeal',
    'problem',
    'benefit',
    'usage',
    'testimonial',
    'pricing',
    'guarantee',
    'trust',
    'faq',
    'cta',
  ],
  'non-profit': [
    'hero',
    'stats',
    'problem',
    'solution',
    'benefit',
    'usage',
    'testimonial',
    'trust',
    'process',
    'faq',
    'cta',
  ],
}

/**
 * 業種別の訴求ポイント
 */
export const industryAppeals: Record<IndustryCategory, string[]> = {
  saas: [
    '業務効率化',
    'コスト削減',
    '自動化',
    'データ分析',
    'セキュリティ',
    'スケーラビリティ',
    '導入実績',
    'ROI',
  ],
  ec: [
    '品質',
    '価格',
    '配送速度',
    '返品保証',
    '商品ラインナップ',
    '顧客満足度',
    'レビュー',
    '特典・キャンペーン',
  ],
  service: [
    '専門性',
    '実績',
    'スピード',
    'アフターサポート',
    'カスタマイズ',
    '価格',
    '信頼性',
    '対応力',
  ],
  recruit: [
    '働きがい',
    '成長機会',
    '待遇',
    '福利厚生',
    'ワークライフバランス',
    '企業文化',
    'キャリアパス',
    'やりがい',
  ],
  education: [
    '学習効果',
    '実績',
    'カリキュラム',
    '講師',
    'サポート',
    '就職実績',
    '価格',
    '環境',
  ],
  healthcare: [
    '効果',
    '安全性',
    '専門性',
    '実績',
    'アフターケア',
    '信頼性',
    '価格',
    'アクセス',
  ],
  beauty: [
    '効果',
    '品質',
    '成分',
    '使いやすさ',
    '口コミ',
    '価格',
    '特典',
    'ブランド力',
  ],
  food: [
    '品質',
    '新鮮さ',
    '美味しさ',
    '安全性',
    '産地',
    '価格',
    '配送',
    '特典',
  ],
  finance: [
    '信頼性',
    '実績',
    '手数料',
    '利回り',
    'リスク',
    'サポート',
    '安全性',
    '実績',
  ],
  'real-estate': [
    '立地',
    '価格',
    '間取り',
    '設備',
    '投資価値',
    '利便性',
    'サポート',
    '実績',
  ],
  construction: [
    '品質',
    '実績',
    '価格',
    '工期',
    'アフターサポート',
    '保証',
    '技術力',
    '信頼性',
  ],
  manufacturing: [
    '品質',
    '技術力',
    'コスト',
    '納期',
    'カスタマイズ',
    '実績',
    'サポート',
    '信頼性',
  ],
  retail: [
    '商品ラインナップ',
    '価格',
    '品質',
    'サービス',
    '立地',
    '在庫',
    '特典',
    '顧客満足度',
  ],
  hospitality: [
    'サービス',
    '雰囲気',
    '価格',
    '立地',
    '設備',
    '実績',
    '口コミ',
    '特典',
  ],
  entertainment: [
    '体験',
    '雰囲気',
    '価格',
    'アクセス',
    '設備',
    '実績',
    '口コミ',
    '特典',
  ],
  'non-profit': [
    '社会的意義',
    '活動実績',
    '透明性',
    '貢献度',
    '信頼性',
    'サポート',
    '活動内容',
    '成果',
  ],
}

/**
 * 職種別の訴求ポイント
 */
export const jobAppeals: Record<JobCategory, string[]> = {
  developer: [
    '技術力',
    '成長機会',
    '最新技術',
    '開発環境',
    'チーム',
    '待遇',
    '裁量',
    'キャリア',
  ],
  designer: [
    'クリエイティビティ',
    '作品制作',
    'スキル向上',
    'チーム',
    '環境',
    '待遇',
    '裁量',
    'キャリア',
  ],
  marketer: [
    '成果',
    'データ分析',
    '最新手法',
    '予算',
    'チーム',
    '待遇',
    '裁量',
    'キャリア',
  ],
  sales: [
    '報酬',
    '成果',
    '営業支援',
    '顧客',
    'チーム',
    '待遇',
    '裁量',
    'キャリア',
  ],
  consultant: [
    '専門性',
    '案件',
    '成長',
    '報酬',
    'チーム',
    '待遇',
    '裁量',
    'キャリア',
  ],
  teacher: [
    '教育理念',
    '生徒',
    '成長',
    '環境',
    'チーム',
    '待遇',
    '裁量',
    'キャリア',
  ],
  doctor: [
    '専門性',
    '医療環境',
    '成長',
    '患者',
    'チーム',
    '待遇',
    '裁量',
    'キャリア',
  ],
  lawyer: [
    '専門性',
    '案件',
    '成長',
    '報酬',
    'チーム',
    '待遇',
    '裁量',
    'キャリア',
  ],
  accountant: [
    '専門性',
    '案件',
    '成長',
    '報酬',
    'チーム',
    '待遇',
    '裁量',
    'キャリア',
  ],
  engineer: [
    '技術力',
    '成長',
    '最新技術',
    '環境',
    'チーム',
    '待遇',
    '裁量',
    'キャリア',
  ],
  manager: [
    'リーダーシップ',
    '成長',
    '成果',
    'チーム',
    '環境',
    '待遇',
    '裁量',
    'キャリア',
  ],
  entrepreneur: [
    'ビジョン',
    '成長',
    '機会',
    '支援',
    'チーム',
    '環境',
    '裁量',
    '成果',
  ],
  freelancer: [
    '自由',
    '報酬',
    '案件',
    '成長',
    '環境',
    '裁量',
    'スキル',
    'キャリア',
  ],
  student: [
    '学習',
    '成長',
    '機会',
    '環境',
    'サポート',
    '将来',
    'スキル',
    'キャリア',
  ],
}

/**
 * 業種を推定
 */
export function detectIndustry(productInfo: ProductInfo): IndustryCategory {
  const name = productInfo.product_name.toLowerCase()
  const target = productInfo.target.toLowerCase()
  const problem = productInfo.problem.toLowerCase()

  // キーワードベースの推定
  if (name.includes('saas') || name.includes('システム') || name.includes('ソフト')) {
    return 'saas'
  }
  if (name.includes('スクール') || name.includes('教育') || name.includes('学習')) {
    return 'education'
  }
  if (name.includes('美容') || name.includes('コスメ') || name.includes('化粧品')) {
    return 'beauty'
  }
  if (name.includes('医療') || name.includes('健康') || name.includes('病院')) {
    return 'healthcare'
  }
  if (name.includes('採用') || name.includes('求人') || name.includes('キャリア')) {
    return 'recruit'
  }
  if (name.includes('金融') || name.includes('保険') || name.includes('投資')) {
    return 'finance'
  }
  if (name.includes('不動産') || name.includes('賃貸') || name.includes('マンション')) {
    return 'real-estate'
  }
  if (name.includes('食品') || name.includes('飲食') || name.includes('レストラン')) {
    return 'food'
  }

  // LPタイプから推定
  if (productInfo.lp_type === 'saas') return 'saas'
  if (productInfo.lp_type === 'ec') return 'ec'
  if (productInfo.lp_type === 'service') return 'service'
  if (productInfo.lp_type === 'recruit') return 'recruit'

  return 'service' // デフォルト
}

/**
 * 業種別のプロンプトテンプレートを取得
 */
export function getIndustryPrompt(
  industry: IndustryCategory,
  productInfo: ProductInfo
): string {
  const appeals = industryAppeals[industry].join('、')
  const sectionPattern = industrySectionPatterns[industry].join(' → ')

  return `
【${industry}業種向けLP構成ガイド】

業種カテゴリ: ${industry}
推奨セクション構成: ${sectionPattern}
主要訴求ポイント: ${appeals}

この業種で効果的なLP構成:
1. ターゲットの課題を明確に提示
2. ${appeals}を中心に訴求
3. 信頼性を示す実績・事例を含める
4. 明確な行動喚起を含める

参考デザインパターン（LPアーカイブより）:
- プロフェッショナルで信頼感のあるデザイン
- 明確なビジュアルヒエラルキー
- コンバージョン最適化されたレイアウト
- モダンで洗練されたデザイン
`
}

/**
 * LPアーカイブの学習データに基づいたプロンプト強化（構造生成用）
 */
export function enhancePromptWithArchive(
  basePrompt: string,
  productInfo: ProductInfo
): string {
  const industry = detectIndustry(productInfo)
  const industryGuide = getIndustryPrompt(industry, productInfo)

  return `${basePrompt}

${industryGuide}

【LPアーカイブ学習データに基づく推奨事項】
- 長めのLP（8-12セクション）で詳しい情報を伝える構成
- 実績数値、導入事例、お客様の声などの信頼性を高めるセクションを含める
- 各セクションで明確な目的を持たせる
- ビジュアルとテキストが調和したデザイン
- コンバージョン最適化されたレイアウト
- モダンで洗練されたデザインスタイル
`
}

/**
 * 画像生成プロンプト用の業種別デザインガイドを取得
 */
export function getIndustryImageDesignGuide(
  industry: IndustryCategory,
  productInfo: ProductInfo
): string {
  const appeals = industryAppeals[industry].join('、')

  const designGuidelines: Record<IndustryCategory, string> = {
    saas: `- クリーンでプロフェッショナルなデザイン
- データやグラフ、ダッシュボードなどのビジュアル要素
- ビジネス向けの落ち着いた配色（ブルー、グレー、ホワイト）
- 技術的で信頼感のあるデザイン`,
    ec: `- 商品を際立たせるビジュアル重視のデザイン
- 高品質な商品写真、ライフスタイルシーン
- 明るく親しみやすい配色
- 購買意欲を高めるデザイン`,
    service: `- サービスを明確に伝えるデザイン
- 使用シーン、導入事例のビジュアル
- 信頼感のある落ち着いた配色
- 専門性と親しみやすさのバランス`,
    recruit: `- 活気と成長を感じさせるデザイン
- チームワーク、職場環境のビジュアル
- エネルギッシュで前向きな配色
- 働きがいを伝えるデザイン`,
    education: `- 学習と成長を感じさせるデザイン
- 学習シーン、成功事例のビジュアル
- 明るく前向きな配色
- 未来への希望を感じさせるデザイン`,
    healthcare: `- 安心感と信頼感のあるデザイン
- 医療環境、健康な生活のビジュアル
- クリーンで安心感のある配色（ホワイト、グリーン、ブルー）
- 専門性と親しみやすさのバランス`,
    beauty: `- 美しさと上質感を感じさせるデザイン
- 商品、ビフォーアフター、ライフスタイルのビジュアル
- エレガントで洗練された配色（パステル、ゴールド、ホワイト）
- 高級感と親しみやすさのバランス`,
    food: `- 食欲をそそるデザイン
- 美味しそうな商品写真、食卓のビジュアル
- 温かみのある配色（オレンジ、レッド、イエロー）
- 品質と美味しさを伝えるデザイン`,
    finance: `- 信頼感と安定感のあるデザイン
- グラフ、データ、ビジネスシーンのビジュアル
- 落ち着いた信頼感のある配色（ブルー、ゴールド、ホワイト）
- 専門性と信頼性を強調`,
    'real-estate': `- 夢と希望を感じさせるデザイン
- 物件、ライフスタイル、街並みのビジュアル
- 明るく親しみやすい配色
- 理想の生活を感じさせるデザイン`,
    construction: `- 堅実さと信頼感のあるデザイン
- 施工事例、プロセス、完成イメージのビジュアル
- 落ち着いた信頼感のある配色
- 品質と実績を強調`,
    manufacturing: `- 技術力と信頼感のあるデザイン
- 製品、工程、技術のビジュアル
- プロフェッショナルな配色
- 品質と技術力を強調`,
    retail: `- 親しみやすさと活気のあるデザイン
- 商品、ショップ、ライフスタイルのビジュアル
- 明るく親しみやすい配色
- 購買意欲を高めるデザイン`,
    hospitality: `- 心地よさと特別感のあるデザイン
- 空間、サービス、体験のビジュアル
- 上質で落ち着いた配色
- リラックスと特別感を感じさせるデザイン`,
    entertainment: `- 楽しさと興奮を感じさせるデザイン
- イベント、体験、楽しさのビジュアル
- エネルギッシュでカラフルな配色
- 楽しさとワクワク感を伝えるデザイン`,
    'non-profit': `- 社会性と共感性を感じさせるデザイン
- 活動、貢献、成果のビジュアル
- 信頼感と温かみのある配色
- 社会的意義を伝えるデザイン`,
  }

  return `
【${industry}業種向けデザインガイド】
${designGuidelines[industry]}

主要訴求ポイント: ${appeals}

LPアーカイブ（https://rdlp.jp/lp-archive/）の学習データに基づく推奨事項:
- プロフェッショナルで信頼感のあるデザイン
- 明確なビジュアルヒエラルキー
- コンバージョン最適化されたレイアウト
- モダンで洗練されたデザイン
- テキストとビジュアルが調和したデザイン
`
}

/**
 * 画像生成プロンプトにLPアーカイブの学習データを組み込む
 */
export function enhanceImagePromptWithArchive(
  basePrompt: string,
  productInfo: ProductInfo
): string {
  const industry = detectIndustry(productInfo)
  const designGuide = getIndustryImageDesignGuide(industry, productInfo)

  return `${basePrompt}

${designGuide}`
}

