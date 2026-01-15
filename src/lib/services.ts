// ========================================
// サービス定義（統一管理）
// ========================================

export type ServiceStatus = 'active' | 'coming_soon' | 'beta' | 'stopped'

export interface Service {
  id: string
  name: string
  shortName?: string
  description?: string
  icon: string
  color: string
  gradient: string
  href: string
  dashboardHref: string
  pricingHref?: string
  guideHref?: string
  features?: string[]
  pricing?: {
    free: { name: string; limit: string; dailyLimit: number; price: number }
    pro: { name: string; limit: string; dailyLimit: number; price: number }
  }
  status: ServiceStatus
  badge?: string
  category?: 'text' | 'image' | 'video' | 'other'
  order: number
  requiresAuth?: boolean
  isNew?: boolean
}

export const SERVICES: Service[] = [
  {
    id: 'kantan',
    name: 'カンタンマーケAI',
    shortName: 'カンタン',
    description: 'マーケティング業務をAIで効率化',
    icon: '🚀',
    color: 'emerald',
    gradient: 'from-emerald-500 to-teal-600',
    href: '/kantan',
    dashboardHref: '/kantan',
    pricingHref: '/kantan/pricing',
    features: [
      '15種類のマーケAIエージェント',
      'チャット形式でマーケ相談',
      'ブランド設定対応',
      '広告データ分析',
    ],
    pricing: {
      free: { name: '無料プラン', limit: '1日10回まで', dailyLimit: 10, price: 0 },
      pro: { name: 'プロプラン', limit: '1日100回まで', dailyLimit: 100, price: 4980 },
    },
    status: 'active',
    category: 'text',
    order: 1,
    requiresAuth: false,
  },
  {
    id: 'banner',
    name: 'ドヤバナーAI',
    shortName: 'バナー',
    description: 'AIで広告バナーを自動生成',
    icon: '🎨',
    color: 'blue',
    gradient: 'from-blue-500 to-blue-600',
    href: '/banner',
    dashboardHref: '/banner/dashboard',
    pricingHref: '/banner/pricing',
    features: [
      '3案同時生成',
      'カテゴリ別テンプレート',
      'サイズ自動調整',
      '履歴保存',
    ],
    pricing: {
      free: { name: '無料プラン', limit: '1日9枚まで', dailyLimit: 9, price: 0 },
      pro: { name: 'プロプラン', limit: '1日50枚まで', dailyLimit: 50, price: 2980 },
    },
    status: 'active',
    category: 'image',
    order: 2,
    requiresAuth: false,
  },
  {
    id: 'seo',
    name: 'ドヤライティングAI',
    shortName: 'ライティング',
    description: 'SEO記事を自動生成',
    icon: '🧠',
    color: 'emerald',
    gradient: 'from-emerald-500 to-emerald-600',
    href: '/seo',
    dashboardHref: '/seo',
    pricingHref: '/seo/pricing',
    features: [
      'アウトライン/セクション生成',
      '画像生成（図解/サムネ）',
      '監査（二重チェック）',
      '履歴保存',
    ],
    pricing: {
      free: { name: '無料プラン', limit: '1日1回まで', dailyLimit: 1, price: 0 },
      pro: { name: 'プロプラン', limit: '1日3回まで', dailyLimit: 3, price: 9980 },
    },
    status: 'active',
    category: 'text',
    order: 3,
    requiresAuth: false,
  },
  {
    id: 'persona',
    name: 'ドヤペルソナAI',
    shortName: 'ペルソナ',
    description: 'マーケティングペルソナを自動生成',
    icon: '🎯',
    color: 'purple',
    gradient: 'from-purple-500 to-purple-600',
    href: '/persona',
    dashboardHref: '/persona',
    pricingHref: '/persona/pricing',
    features: [
      'ペルソナ自動生成',
      '詳細な属性設定',
      '画像生成',
      '履歴保存',
    ],
    pricing: {
      free: { name: '無料プラン', limit: '1日3回まで', dailyLimit: 3, price: 0 },
      pro: { name: 'プロプラン', limit: '1日100回まで', dailyLimit: 100, price: 4980 },
    },
    status: 'active',
    category: 'text',
    order: 4,
    requiresAuth: false,
  },
  {
    id: 'interview',
    name: 'ドヤインタビューAI',
    shortName: 'インタビュー',
    description: 'インタビュー記事制作をゼロから完結させるオールインワン型AI編集アシスタント',
    icon: '🎤',
    color: 'orange',
    gradient: 'from-orange-500 to-amber-600',
    href: '/interview',
    dashboardHref: '/interview',
    pricingHref: '/interview/pricing',
    features: [
      '音声・動画の自動文字起こし',
      '企画提案と質問リスト生成',
      '構成案の自動作成',
      '記事ドラフト生成',
      '校閲・品質チェック',
      'レシピ機能（テンプレート保存）',
    ],
    pricing: {
      free: { name: '無料プラン', limit: '1日3回まで', dailyLimit: 3, price: 0 },
      pro: { name: 'プロプラン', limit: '1日100回まで', dailyLimit: 100, price: 4980 },
    },
    status: 'beta',
    badge: 'ベータ版',
    category: 'text',
    order: 10,
    requiresAuth: false,
  },
  {
    id: 'lp-site',
    name: 'ドヤサイト',
    shortName: 'サイト',
    description: 'AIでLPを自動生成・編集するデザインツール',
    icon: '🎨',
    color: 'teal',
    gradient: 'from-teal-500 to-cyan-600',
    href: '/lp-site',
    dashboardHref: '/lp-site',
    pricingHref: '/lp-site/pricing',
    features: [
      'セクション単位の画像生成',
      'ドラッグ&ドロップで並び替え',
      'セクションごとの編集・再生成',
      'PC版・SP版対応',
      'ワイヤーフレームから完成まで',
    ],
    pricing: {
      free: { name: '無料プラン', limit: '1日3回まで', dailyLimit: 3, price: 0 },
      pro: { name: 'プロプラン', limit: '1日100回まで', dailyLimit: 100, price: 4980 },
    },
    status: 'beta',
    badge: 'ベータ版',
    category: 'image',
    order: 11,
    requiresAuth: false,
  },
  {
    id: 'strategy',
    name: 'ドヤ戦略AI',
    shortName: '戦略',
    description: 'マーケティング戦略を構造化・可視化・再利用するAI',
    icon: '📊',
    color: 'indigo',
    gradient: 'from-indigo-500 to-purple-600',
    href: '/strategy',
    dashboardHref: '/strategy',
    pricingHref: '/strategy/pricing',
    features: [
      '戦略の構造化・可視化',
      'フェーズ別戦略展開',
      'ダッシュボードで一瞬で理解',
      '予算配分・KPI管理',
      '競合調査連携',
    ],
    pricing: {
      free: { name: '無料プラン', limit: '1日3回まで', dailyLimit: 3, price: 0 },
      pro: { name: 'プロプラン', limit: '1日100回まで', dailyLimit: 100, price: 4980 },
    },
    status: 'active',
    category: 'text',
    order: 12,
    requiresAuth: false,
    isNew: true,
  },
]

// サービスIDでサービスを取得
export function getServiceById(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id)
}

// アクティブなサービス一覧を取得
export function getActiveServices(): Service[] {
  return SERVICES.filter((s) => s.status === 'active').sort((a, b) => a.order - b.order)
}

// 全サービス一覧を取得
export function getAllServices(): Service[] {
  return [...SERVICES].sort((a, b) => a.order - b.order)
}
