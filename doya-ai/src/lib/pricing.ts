// ========================================
// 料金・プラン設定（統一管理）
// ========================================
// このファイルで全ての料金情報を一元管理
// 各ページはこのファイルから情報を取得する

export interface PlanFeature {
  text: string
  included: boolean
}

export interface Plan {
  id: string
  name: string
  price: number
  priceLabel: string
  period: string
  description: string
  features: PlanFeature[]
  cta: string
  popular?: boolean
  color?: string
}

export interface ServicePricing {
  serviceId: string
  serviceName: string
  serviceIcon: string
  plans: Plan[]
  guestLimit: number
  freeLimit: number
  proLimit: number
  historyDays: {
    free: number
    pro: number
  }
}

// ========================================
// カンタンドヤAI 料金設定
// ========================================
export const KANTAN_PRICING: ServicePricing = {
  serviceId: 'kantan',
  serviceName: 'カンタンドヤAI',
  serviceIcon: '📝',
  guestLimit: 3,      // ゲスト: 1日3回
  freeLimit: 10,      // 無料会員: 1日10回
  proLimit: 100,      // プロ会員: 1日100回
  historyDays: {
    free: 7,          // 無料: 7日間保存
    pro: -1,          // プロ: 無制限
  },
  plans: [
    {
      id: 'kantan-free',
      name: '無料プラン',
      price: 0,
      priceLabel: '¥0',
      period: '',
      description: '登録するだけで使える',
      features: [
        { text: 'ゲスト: 1日3回まで', included: true },
        { text: 'ログイン: 1日10回まで', included: true },
        { text: '全68テンプレート利用可能', included: true },
        { text: '履歴保存（7日間）', included: true },
        { text: 'メールサポート', included: true },
      ],
      cta: '無料で始める',
    },
    {
      id: 'kantan-pro',
      name: 'プロプラン',
      price: 2980,
      priceLabel: '¥2,980',
      period: '/月（税込）',
      description: 'たくさん使いたい方に',
      popular: true,
      color: 'blue',
      features: [
        { text: '1日100回まで生成', included: true },
        { text: '全68テンプレート利用可能', included: true },
        { text: 'トーン・長さ調整機能', included: true },
        { text: '履歴保存（無制限）', included: true },
        { text: '優先サポート', included: true },
        { text: 'いつでも解約OK', included: true },
      ],
      cta: 'プロプランを始める',
    },
  ],
}

// ========================================
// ドヤバナーAI 料金設定
// ========================================
export const BANNER_PRICING: ServicePricing = {
  serviceId: 'banner',
  serviceName: 'ドヤバナーAI',
  serviceIcon: '🎨',
  guestLimit: 3,      // ゲスト: 1日3回
  freeLimit: 10,      // 無料会員: 1日10回
  proLimit: -1,       // プロ会員: 無制限
  historyDays: {
    free: 7,          // 無料: 7日間保存
    pro: -1,          // プロ: 無制限
  },
  plans: [
    {
      id: 'banner-free',
      name: '無料プラン',
      price: 0,
      priceLabel: '¥0',
      period: '',
      description: '登録するだけで使える',
      features: [
        { text: 'ゲスト: 1日3回まで', included: true },
        { text: 'ログイン: 1日10回まで', included: true },
        { text: '全カテゴリ利用可能', included: true },
        { text: 'A/B/C 3案同時生成', included: true },
        { text: '履歴保存（7日間）', included: true },
      ],
      cta: '無料で始める',
    },
    {
      id: 'banner-pro',
      name: 'プロプラン',
      price: 4980,
      priceLabel: '¥4,980',
      period: '/月（税込）',
      description: '本格的に使いたい方に',
      popular: true,
      color: 'violet',
      features: [
        { text: '無制限に生成', included: true },
        { text: '全カテゴリ利用可能', included: true },
        { text: 'A/B/C 3案同時生成', included: true },
        { text: 'ロゴ・人物画像の組み込み', included: true },
        { text: '履歴保存（無制限）', included: true },
        { text: '優先サポート', included: true },
        { text: 'いつでも解約OK', included: true },
      ],
      cta: 'プロプランを始める',
    },
  ],
}

// ========================================
// ポータル全体のセット割引
// ========================================
export const BUNDLE_PRICING = {
  name: 'ドヤAI セットプラン',
  price: 5980,
  priceLabel: '¥5,980',
  period: '/月（税込）',
  discount: '約25%OFF',
  description: '全サービスをお得に使える',
  features: [
    { text: 'カンタンドヤAI プロ（通常¥2,980）', included: true },
    { text: 'ドヤバナーAI プロ（通常¥4,980）', included: true },
    { text: '今後追加される新サービスも含む', included: true },
    { text: '優先サポート', included: true },
  ],
  cta: 'セットプランを始める',
}

// ========================================
// ヘルパー関数
// ========================================
export function getPricingByService(serviceId: string): ServicePricing | null {
  switch (serviceId) {
    case 'kantan':
      return KANTAN_PRICING
    case 'banner':
      return BANNER_PRICING
    default:
      return null
  }
}

export function formatPrice(price: number): string {
  return `¥${price.toLocaleString()}`
}

export function getDailyLimit(serviceId: string, userType: 'guest' | 'free' | 'pro'): number {
  const pricing = getPricingByService(serviceId)
  if (!pricing) return 0
  
  switch (userType) {
    case 'guest':
      return pricing.guestLimit
    case 'free':
      return pricing.freeLimit
    case 'pro':
      return pricing.proLimit
    default:
      return 0
  }
}
