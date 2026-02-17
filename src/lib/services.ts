// ============================================
// ドヤAIポータル サービス定義
// ============================================
// 新しいサービスを追加する場合は SERVICES 配列に追加するだけでOK
// 1つのアカウントで全サービス利用可能（サービスごとにプラン管理）

export type ServiceStatus = 'active' | 'beta' | 'coming_soon' | 'maintenance'
export type ServiceCategory = 'text' | 'image' | 'video' | 'web' | 'other'

export interface ServicePricing {
  name: string
  limit: string
  dailyLimit: number  // 1日の上限回数（-1 = 無制限）
  price: number       // 月額（円）
  stripePriceId?: string
}

export interface Service {
  // 基本情報
  id: string
  name: string
  shortName?: string  // 短縮名（タブ表示用）
  description: string
  longDescription?: string
  
  // デザイン
  icon: string
  color: string
  gradient: string
  bgGradient?: string
  
  // ナビゲーション
  href: string
  dashboardHref: string
  pricingHref: string
  guideHref: string
  
  // 機能説明
  features: string[]
  useCases?: string[]
  
  // 料金
  pricing: {
    free: ServicePricing
    pro: ServicePricing
    enterprise?: ServicePricing
  }
  
  // 状態
  status: ServiceStatus
  category: ServiceCategory
  order: number
  
  // 追加設定
  requiresAuth: boolean
  isNew?: boolean
  badge?: string
}

// ============================================
// サービス一覧
// ============================================

export const SERVICES: Service[] = [
  // ----------------------------------------
  // カンタンマーケAI（マーケティング業務AIエージェント）
  // ----------------------------------------
  {
    id: 'kantan',
    name: 'カンタンマーケAI',
    shortName: 'マーケ',
    description: 'マーケティング業務をAIエージェントで劇的効率化',
    longDescription: 'LP構成案、バナーコピー、広告文、メルマガ、競合分析…マーケ業務を丸ごとチャット形式のAIエージェントがサポート。プロンプト不要で誰でもプロ品質のアウトプット。',
    icon: '🚀',
    color: 'emerald',
    gradient: 'from-emerald-500 to-teal-500',
    bgGradient: 'from-emerald-50 to-teal-50',
    href: '/kantan',
    dashboardHref: '/kantan/dashboard',
    pricingHref: '/kantan/pricing',
    guideHref: '/kantan/guide',
    features: [
      'LP構成案を10分で作成',
      'バナーコピー40案を1分で生成',
      '広告データ分析',
      'メルマガ・記事作成',
      'ペルソナ・競合分析',
      'チャット形式でブラッシュアップ',
    ],
    useCases: [
      'LP構成案に4時間かかっている',
      'バナーコピーのアイデアが出ない',
      '広告分析に時間がかかりすぎる',
      'マーケターが足りていない',
      'AIを活用しきれていない',
    ],
    pricing: {
      free: { 
        name: '無料プラン', 
        limit: '1日3回まで', 
        dailyLimit: 3,
        price: 0 
      },
      pro: { 
        name: 'プロプラン', 
        limit: '1日100回まで', 
        dailyLimit: 100,
        price: 4980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_KANTAN_PRO_PRICE_ID,
      },
    },
    status: 'active',
    category: 'text',
    order: 1,
    requiresAuth: false,  // ゲストも一部利用可
    isNew: true,
  },
  
  // ----------------------------------------
  // ドヤバナーAI（画像生成）
  // ----------------------------------------
  {
    id: 'banner',
    name: 'ドヤバナーAI',
    shortName: 'バナー',
    description: 'プロ品質のバナーを自動生成',
    longDescription: 'AIがあなたのビジネスに最適なバナーをA/B/Cの3案で提案。デザイン知識不要で、効果的な広告を素早く作成。',
    icon: '🎨',
    color: 'purple',
    gradient: 'from-purple-500 to-pink-500',
    bgGradient: 'from-purple-50 to-pink-50',
    href: '/banner',
    dashboardHref: '/banner/dashboard',
    pricingHref: '/banner/pricing',
    guideHref: '/banner/guide',
    features: [
      'A/B/C 3案同時生成',
      '10種類の業界テンプレート',
      '6種類のサイズプリセット',
      'ブランドカラー設定',
      '高品質PNG出力',
    ],
    useCases: [
      '広告バナーを素早く作りたい',
      'A/Bテスト用に複数案が欲しい',
      'デザイナーに依頼する時間がない',
      'SNS広告を運用している',
    ],
    pricing: {
      free: { 
        name: '無料プラン', 
        limit: '1日3回まで', 
        dailyLimit: 3,
        price: 0 
      },
      pro: { 
        name: 'プロプラン', 
        limit: '1日30枚まで', 
        dailyLimit: 30,
        price: 9980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_BANNER_PRO_PRICE_ID,
      },
      enterprise: {
        name: 'エンタープライズ',
        limit: '1日200枚まで',
        dailyLimit: 200,
        price: 49800,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_BANNER_ENTERPRISE_PRICE_ID,
      },
    },
    status: 'active',
    category: 'image',
    order: 2,
    requiresAuth: false,  // ゲストも1日1回まで利用可
    isNew: true,
  },

  // ----------------------------------------
  // ドヤロゴ（ロゴ生成）
  // ----------------------------------------
  {
    id: 'logo',
    name: 'ドヤロゴ',
    shortName: 'ロゴ',
    description: '日本っぽくてイケてるロゴをA/B/Cで自動生成',
    longDescription:
      'サービス名と内容だけで、日本市場で信頼されやすいロゴを3パターン（王道/攻め/ミニマル）で生成。ロゴキット・パレット・ガイドラインまで一括出力します。',
    icon: '🏷️',
    color: 'indigo',
    gradient: 'from-indigo-500 to-sky-500',
    bgGradient: 'from-indigo-50 to-sky-50',
    href: '/logo',
    dashboardHref: '/logo',
    pricingHref: '/logo',
    guideHref: '/logo',
    features: [
      'A/B/C 3パターン同時生成',
      '横長/正方形（SNSアイコン）対応',
      'SVG/PNG/JPEG出力',
      'カラーパレット自動生成',
      'ガイドライン/生成理由/ロゴキットZIP',
      'ダークモード/モノクロ/反転版も自動生成',
    ],
    pricing: {
      free: {
        name: '無料プラン',
        limit: '（暫定）',
        dailyLimit: 1,
        price: 0,
      },
      pro: {
        name: 'プロプラン',
        limit: '（暫定）',
        dailyLimit: -1,
        price: 0,
      },
    },
    status: 'active',
    category: 'image',
    order: 3,
    requiresAuth: false,
    isNew: true,
  },

  // ----------------------------------------
  // ドヤ記事作成（SEO/LLMO 長文記事生成）
  // ----------------------------------------
  {
    id: 'seo',
    name: 'ドヤ記事作成',
    shortName: 'SEO',
    description: 'SEO + LLMOに強い長文記事を安定生成',
    longDescription:
      'アウトライン→分割生成→整合性チェック→統合のパイプラインで、5万字〜6万字でも崩れにくい記事生成を目指します。',
    icon: '🧠',
    color: 'slate',
    gradient: 'from-slate-700 to-slate-900',
    bgGradient: 'from-slate-50 to-gray-50',
    href: '/seo',
    dashboardHref: '/seo',
    pricingHref: '/seo',
    guideHref: '/seo',
    features: [
      '参考URL解析→要点化（丸写し禁止）',
      'アウトライン作成（検索意図クラスタ）',
      'セクション分割生成（整合性チェック付き）',
      '監査（二重チェック）と自動修正',
      'バナー/図解画像生成・リンクチェック',
    ],
    pricing: {
      free: { name: '無料プラン', limit: '（暫定）', dailyLimit: 0, price: 0 },
      pro: { name: 'プロプラン', limit: '（暫定）', dailyLimit: -1, price: 0 },
    },
    status: 'active',
    category: 'text',
    order: 4,
    requiresAuth: false,
    isNew: true,
  },

  // ----------------------------------------
  // ドヤインタビューAI（インタビュー記事生成）
  // ----------------------------------------
  {
    id: 'interview',
    name: 'ドヤインタビュー',
    shortName: 'インタビュー',
    description: 'インタビュー音声からプロ品質の記事を自動生成',
    longDescription:
      '音声・動画・PDF等の取材素材をアップロードするだけで、AIが文字起こし→構成→執筆→校正まで一気通貫で記事を生成。編集者の"中間工程"をAIが代行します。',
    icon: '🎙️',
    color: 'orange',
    gradient: 'from-orange-500 to-amber-500',
    bgGradient: 'from-orange-50 to-amber-50',
    href: '/interview',
    dashboardHref: '/interview',
    pricingHref: '/interview/pricing',
    guideHref: '/interview',
    features: [
      '音声/動画を自動文字起こし（話者分離対応）',
      '10種類の執筆スキル（Q&A/ストーリー/プレスリリース等）',
      'AI記事ドラフト生成（リアルタイムストリーミング）',
      '校正・校閲（誤字脱字・表記揺れ修正）',
      'プラットフォーム別タイトル提案',
      '5GB超の大容量ファイル対応',
    ],
    useCases: [
      'インタビュー音声の文字起こしに時間がかかる',
      '取材後の記事化に数日かかっている',
      'ライターのリソースが足りない',
      '記事の品質にばらつきがある',
    ],
    pricing: {
      free: {
        name: '無料プラン',
        limit: '1日3回まで',
        dailyLimit: 3,
        price: 0,
      },
      pro: {
        name: 'プロプラン',
        limit: '1日30回まで',
        dailyLimit: 30,
        price: 9980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_INTERVIEW_PRO_PRICE_ID,
      },
    },
    status: 'active',
    category: 'text',
    order: 5,
    requiresAuth: false,
    isNew: true,
  },

  // ----------------------------------------
  // ドヤ診断AI（ビジネス診断ダッシュボード）
  // ----------------------------------------
  {
    id: 'shindan',
    name: 'ドヤWeb診断AI',
    shortName: '診断',
    description: 'Webサイトを7軸で競合分析',
    longDescription:
      'WebサイトのURLを入力するだけで、SEO・コンテンツ・CTA設計など7つの観点からAIが分析し、競合と比較した改善点を洗い出します。PDF書き出しにも対応。',
    icon: '📊',
    color: 'teal',
    gradient: 'from-teal-500 to-cyan-500',
    bgGradient: 'from-teal-50 to-cyan-50',
    href: '/shindan',
    dashboardHref: '/shindan',
    pricingHref: '/shindan',
    guideHref: '/shindan',
    features: [
      '7軸レーダーチャートでWebサイトを可視化',
      '競合サイト自動発見・比較分析',
      'SEO・コンテンツ・CTA設計の改善ポイント抽出',
      '具体的なアクション提案（コスト・効果・期間付き）',
      'ボトルネック自動検出',
      'PDF書き出し対応',
    ],
    useCases: [
      '自社サイトのSEO対策状況を把握したい',
      '競合サイトとの差を可視化したい',
      'コンバージョン率を改善したい',
      'Webサイトリニューアルの方向性を知りたい',
    ],
    pricing: {
      free: {
        name: '無料プラン',
        limit: '1日3回まで',
        dailyLimit: 3,
        price: 0,
      },
      pro: {
        name: 'プロプラン',
        limit: '1日20回まで',
        dailyLimit: 20,
        price: 9980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_SHINDAN_PRO_PRICE_ID,
      },
    },
    status: 'active',
    category: 'other',
    order: 6,
    requiresAuth: false,
    isNew: true,
  },

  // ----------------------------------------
  // LP作成AI（近日公開）
  // ----------------------------------------
  {
    id: 'lp',
    name: 'ドヤLP AI',
    shortName: 'LP',
    description: 'ランディングページを簡単作成',
    longDescription: 'AIがあなたのビジネスに最適なLPを自動生成。コーディング不要でプロ品質のページを作成。',
    icon: '🌐',
    color: 'green',
    gradient: 'from-green-500 to-emerald-500',
    bgGradient: 'from-green-50 to-emerald-50',
    href: '/lp',
    dashboardHref: '/lp/dashboard',
    pricingHref: '/lp/pricing',
    guideHref: '/lp/guide',
    features: [
      'ワンクリックでLP生成',
      '業界別テンプレート',
      'レスポンシブ対応',
      'HTMLエクスポート',
      'A/Bテスト機能',
    ],
    pricing: {
      free: { 
        name: '無料プラン', 
        limit: '月1ページまで', 
        dailyLimit: 0,
        price: 0 
      },
      pro: { 
        name: 'プロプラン', 
        limit: '月10ページまで', 
        dailyLimit: -1,
        price: 4980,
      },
    },
    status: 'coming_soon',
    category: 'web',
    order: 4,
    requiresAuth: true,
    badge: '近日公開',
  },
  
  // ----------------------------------------
  // 動画台本AI（近日公開）
  // ----------------------------------------
  {
    id: 'video',
    name: 'ドヤ動画AI',
    shortName: '動画',
    description: 'YouTube・TikTok用の台本を自動生成',
    longDescription: 'バズる動画の台本をAIが自動生成。YouTube、TikTok、Instagram Reelsに対応。',
    icon: '🎬',
    color: 'red',
    gradient: 'from-red-500 to-orange-500',
    bgGradient: 'from-red-50 to-orange-50',
    href: '/video',
    dashboardHref: '/video/dashboard',
    pricingHref: '/video/pricing',
    guideHref: '/video/guide',
    features: [
      'YouTube台本生成',
      'TikTok/Reels用短尺台本',
      'サムネイルアイデア提案',
      'タグ・概要文生成',
      '再生数予測',
    ],
    pricing: {
      free: { 
        name: '無料プラン', 
        limit: '1日1本まで', 
        dailyLimit: 1,
        price: 0 
      },
      pro: { 
        name: 'プロプラン', 
        limit: '無制限', 
        dailyLimit: -1,
        price: 3980,
      },
    },
    status: 'coming_soon',
    category: 'text',
    order: 5,
    requiresAuth: true,
    badge: '近日公開',
  },
  
  // ----------------------------------------
  // ドヤ展開AI（コンテンツ展開）
  // ----------------------------------------
  {
    id: 'tenkai',
    name: 'ドヤ展開AI',
    shortName: '展開',
    description: '1つのコンテンツを9プラットフォームに最適化して自動変換',
    longDescription: '記事URL・テキスト・YouTube・動画から、note/Blog/X/Instagram/LINE/Facebook/LinkedIn/メルマガ/プレスリリースに最適化されたコンテンツをAIが自動生成。ブランドボイス設定で統一感のある発信を実現。',
    icon: '🔄',
    color: 'blue',
    gradient: 'from-blue-500 to-indigo-500',
    bgGradient: 'from-blue-50 to-indigo-50',
    href: '/tenkai',
    dashboardHref: '/tenkai/projects',
    pricingHref: '/tenkai/pricing',
    guideHref: '/tenkai/guide',
    features: [
      '9プラットフォーム同時生成',
      'URL/テキスト/YouTube/動画入力',
      'AI分析でコンテンツ最適化',
      'ブランドボイス設定',
      'テンプレート管理',
      'SSEリアルタイム生成',
    ],
    useCases: [
      'SNS運用の工数を削減したい',
      '記事をSNS投稿に展開したい',
      '複数PFへの投稿を一括化したい',
      'ブランドの統一感を保ちたい',
    ],
    pricing: {
      free: {
        name: '無料プラン',
        limit: '月10回まで',
        dailyLimit: 3,
        price: 0,
      },
      pro: {
        name: 'プロプラン',
        limit: '月200回まで',
        dailyLimit: -1,
        price: 9800,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_TENKAI_PRO_PRICE_ID,
      },
      enterprise: {
        name: 'エンタープライズ',
        limit: '無制限',
        dailyLimit: -1,
        price: 29800,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_TENKAI_ENTERPRISE_PRICE_ID,
      },
    },
    status: 'active',
    category: 'text',
    order: 3,
    requiresAuth: true,
    isNew: true,
    badge: 'NEW',
  },

  // ----------------------------------------
  // プレゼン資料AI（近日公開）
  // ----------------------------------------
  {
    id: 'presentation',
    name: 'ドヤプレゼンAI',
    shortName: 'プレゼン',
    description: 'パワポ用の構成を自動生成',
    longDescription: '説得力のあるプレゼン構成をAIが自動生成。PowerPoint形式でエクスポート可能。',
    icon: '📊',
    color: 'amber',
    gradient: 'from-amber-500 to-yellow-500',
    bgGradient: 'from-amber-50 to-yellow-50',
    href: '/presentation',
    dashboardHref: '/presentation/dashboard',
    pricingHref: '/presentation/pricing',
    guideHref: '/presentation/guide',
    features: [
      'ストーリー構成提案',
      'スライド内容生成',
      'デザイン提案',
      'PPTX出力',
      '図解アイデア',
    ],
    pricing: {
      free: { 
        name: '無料プラン', 
        limit: '月3回まで', 
        dailyLimit: 0,
        price: 0 
      },
      pro: { 
        name: 'プロプラン', 
        limit: '無制限', 
        dailyLimit: -1,
        price: 2980,
      },
    },
    status: 'coming_soon',
    category: 'text',
    order: 6,
    requiresAuth: true,
    badge: '近日公開',
  },
]

// ============================================
// ヘルパー関数
// ============================================

// IDでサービスを取得
export function getServiceById(id: string): Service | undefined {
  return SERVICES.find(service => service.id === id)
}

// アクティブなサービスのみ取得
export function getActiveServices(): Service[] {
  return SERVICES.filter(s => s.status === 'active').sort((a, b) => a.order - b.order)
}

// 全サービス（近日公開含む）をorder順で取得
export function getAllServices(): Service[] {
  return [...SERVICES].sort((a, b) => a.order - b.order)
}

// カテゴリ別にサービスを取得
export function getServicesByCategory(category: ServiceCategory): Service[] {
  return SERVICES.filter(s => s.category === category).sort((a, b) => a.order - b.order)
}

// サービスが利用可能かチェック
export function isServiceAvailable(serviceId: string): boolean {
  const service = getServiceById(serviceId)
  return service?.status === 'active' || service?.status === 'beta'
}

// 1日の使用上限を取得
export function getDailyLimit(serviceId: string, plan: 'free' | 'pro'): number {
  const service = getServiceById(serviceId)
  if (!service) return 0
  return service.pricing[plan].dailyLimit
}

// 料金を取得（月額）
export function getMonthlyPrice(serviceId: string, plan: 'free' | 'pro'): number {
  const service = getServiceById(serviceId)
  if (!service) return 0
  return service.pricing[plan].price
}
