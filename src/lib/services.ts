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
  // カンタンドヤAI（テキスト生成）
  // ----------------------------------------
  {
    id: 'kantan',
    name: 'カンタンドヤAI',
    shortName: 'カンタン',
    description: 'ビジネス文章をAIが自動生成',
    longDescription: 'メール、ブログ、SNS投稿など68種類のテンプレートから、必要な文章をワンボタンで作成できます。',
    icon: '📝',
    color: 'blue',
    gradient: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-50 to-cyan-50',
    href: '/kantan',
    dashboardHref: '/kantan/dashboard',
    pricingHref: '/kantan/pricing',
    guideHref: '/kantan/guide',
    features: [
      '68種類のテンプレート',
      'ビジネスメール自動生成',
      'ブログ記事作成',
      'SNS投稿文作成',
      'キャッチコピー生成',
      '議事録・提案書作成',
    ],
    useCases: [
      '営業メールを素早く作成したい',
      'ブログのネタが尽きた',
      'SNS運用を効率化したい',
      'キャッチコピーが思いつかない',
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
        price: 2980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_KANTAN_PRO_PRICE_ID,
      },
    },
    status: 'active',
    category: 'text',
    order: 1,
    requiresAuth: false,  // ゲストも一部利用可
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
        limit: '1日1枚まで', 
        dailyLimit: 1,
        price: 0 
      },
      pro: { 
        name: 'プロプラン', 
        limit: '無制限', 
        dailyLimit: -1,
        price: 9980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_BANNER_PRO_PRICE_ID,
      },
    },
    status: 'active',
    category: 'image',
    order: 2,
    requiresAuth: false,  // ゲストも1日1回まで利用可
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
    order: 3,
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
    order: 4,
    requiresAuth: true,
    badge: '近日公開',
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
    order: 5,
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
