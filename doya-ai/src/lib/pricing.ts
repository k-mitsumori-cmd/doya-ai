// ========================================
// 料金・プラン設定（統一管理）
// ========================================
// このファイルで全ての料金情報を一元管理
// 各ページはこのファイルから情報を取得する
//
// 【料金設定の根拠】
// - Gemini API画像生成: 約$0.02〜0.05/回（約3〜8円）
// - 3案同時生成 = 約10〜25円/生成
// - 月間コスト + 運営費 + 利益を考慮
// - 競合: Copy.ai $49/月、Jasper $39/月、Canva Pro ¥12,000/年

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
// 文章生成はAPIコストが低いため、手頃な価格設定
// 競合: ChatGPT Plus $20/月、Copy.ai $49/月
export const KANTAN_PRICING: ServicePricing = {
  serviceId: 'kantan',
  serviceName: 'カンタンドヤAI',
  serviceIcon: '📝',
  guestLimit: 3,      // ゲスト: 1日3回（お試し用）
  freeLimit: 5,       // 無料会員: 1日5回（継続利用促進）
  proLimit: 50,       // プロ会員: 1日50回（実用的な量）
  historyDays: {
    free: 7,          // 無料: 7日間保存
    pro: -1,          // プロ: 無制限
  },
  plans: [
    {
      id: 'kantan-free',
      name: 'フリー',
      price: 0,
      priceLabel: '¥0',
      period: '',
      description: 'まずは試してみたい方',
      features: [
        { text: 'ゲスト: 1日3回まで', included: true },
        { text: 'ログイン: 1日5回まで', included: true },
        { text: '基本テンプレート（20種類）', included: true },
        { text: '履歴保存（7日間）', included: true },
      ],
      cta: '無料で試す',
    },
    {
      id: 'kantan-starter',
      name: 'スターター',
      price: 980,
      priceLabel: '¥980',
      period: '/月（税込）',
      description: '個人利用に最適',
      color: 'blue',
      features: [
        { text: '1日20回まで生成', included: true },
        { text: '全68テンプレート利用可能', included: true },
        { text: 'トーン調整機能', included: true },
        { text: '履歴保存（30日間）', included: true },
        { text: 'メールサポート', included: true },
      ],
      cta: 'スタータープランを始める',
    },
    {
      id: 'kantan-pro',
      name: 'プロ',
      price: 2980,
      priceLabel: '¥2,980',
      period: '/月（税込）',
      description: 'ビジネス利用に',
      popular: true,
      color: 'blue',
      features: [
        { text: '1日50回まで生成', included: true },
        { text: '全68テンプレート利用可能', included: true },
        { text: 'トーン・長さ調整機能', included: true },
        { text: '履歴保存（無制限）', included: true },
        { text: 'API連携（近日公開）', included: true },
        { text: '優先サポート', included: true },
      ],
      cta: 'プロプランを始める',
    },
  ],
}

// ========================================
// ドヤバナーAI 料金設定
// ========================================
// 画像生成はAPIコストが高いため、適正価格を設定
// 3案同時生成 = 約25円/生成 → 月50回で約1,250円のコスト
// 競合: Canva Pro ¥1,000/月、Adobe Express ¥1,078/月
export const BANNER_PRICING: ServicePricing = {
  serviceId: 'banner',
  serviceName: 'ドヤバナーAI',
  serviceIcon: '🎨',
  guestLimit: 2,      // ゲスト: 1日2回（コスト管理）
  freeLimit: 3,       // 無料会員: 1日3回
  proLimit: 30,       // プロ会員: 1日30回（90案/日）
  historyDays: {
    free: 7,          // 無料: 7日間保存
    pro: -1,          // プロ: 無制限
  },
  plans: [
    {
      id: 'banner-free',
      name: 'フリー',
      price: 0,
      priceLabel: '¥0',
      period: '',
      description: 'まずは試してみたい方',
      features: [
        { text: 'ゲスト: 1日2回まで', included: true },
        { text: 'ログイン: 1日3回まで', included: true },
        { text: '基本カテゴリ（6種類）', included: true },
        { text: 'A/B/C 3案同時生成', included: true },
        { text: '標準解像度', included: true },
      ],
      cta: '無料で試す',
    },
    {
      id: 'banner-starter',
      name: 'スターター',
      price: 1980,
      priceLabel: '¥1,980',
      period: '/月（税込）',
      description: '個人・小規模事業者向け',
      color: 'violet',
      features: [
        { text: '1日10回まで生成（30案/日）', included: true },
        { text: '全カテゴリ利用可能', included: true },
        { text: 'A/B/C 3案同時生成', included: true },
        { text: '高解像度出力', included: true },
        { text: '履歴保存（30日間）', included: true },
      ],
      cta: 'スタータープランを始める',
    },
    {
      id: 'banner-pro',
      name: 'プロ',
      price: 4980,
      priceLabel: '¥4,980',
      period: '/月（税込）',
      description: 'マーケター・代理店向け',
      popular: true,
      color: 'violet',
      features: [
        { text: '1日30回まで生成（90案/日）', included: true },
        { text: '全カテゴリ利用可能', included: true },
        { text: 'A/B/C 3案同時生成', included: true },
        { text: 'ロゴ・人物画像の組み込み', included: true },
        { text: '高解像度出力', included: true },
        { text: '履歴保存（無制限）', included: true },
        { text: '優先サポート', included: true },
      ],
      cta: 'プロプランを始める',
    },
    {
      id: 'banner-business',
      name: 'ビジネス',
      price: 14800,
      priceLabel: '¥14,800',
      period: '/月（税込）',
      description: '企業・チーム利用',
      color: 'violet',
      features: [
        { text: '無制限に生成', included: true },
        { text: '全カテゴリ利用可能', included: true },
        { text: 'ブランドカラー設定', included: true },
        { text: 'ロゴ・人物画像の組み込み', included: true },
        { text: 'チームメンバー5名まで', included: true },
        { text: 'API連携', included: true },
        { text: '専任サポート', included: true },
      ],
      cta: 'お問い合わせ',
    },
  ],
}

// ========================================
// ポータル全体のセット割引
// ========================================
// カンタン（¥2,980）+ バナー（¥4,980）= ¥7,960 → 25%OFF
export const BUNDLE_PRICING = {
  name: 'ドヤAI オールインワン',
  price: 5980,
  priceLabel: '¥5,980',
  period: '/月（税込）',
  discount: '約25%OFF',
  originalPrice: '¥7,960',
  description: '両方使うなら断然お得',
  features: [
    { text: 'カンタンドヤAI プロ（通常¥2,980）', included: true },
    { text: 'ドヤバナーAI プロ（通常¥4,980）', included: true },
    { text: '今後追加される新サービスも利用可能', included: true },
    { text: '優先サポート', included: true },
  ],
  cta: 'オールインワンを始める',
}

// ========================================
// 年間プラン（20%OFF）
// ========================================
export const ANNUAL_DISCOUNT = 0.20 // 20%オフ

export function getAnnualPrice(monthlyPrice: number): number {
  return Math.floor(monthlyPrice * 12 * (1 - ANNUAL_DISCOUNT))
}

export function getAnnualMonthlyPrice(monthlyPrice: number): number {
  return Math.floor(monthlyPrice * (1 - ANNUAL_DISCOUNT))
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

// プランを取得（フリー、スターター、プロなど）
export function getPlanById(planId: string): Plan | null {
  const allPlans = [...KANTAN_PRICING.plans, ...BANNER_PRICING.plans]
  return allPlans.find(p => p.id === planId) || null
}
