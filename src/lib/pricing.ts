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
// ドヤSEO 料金設定
// ========================================
// SEO記事生成はコストが読みづらいため、まずは控えめな上限で運用
export const SEO_PRICING: ServicePricing = {
  serviceId: 'seo',
  serviceName: 'ドヤSEO',
  serviceIcon: '🧠',
  guestLimit: 1,      // ゲスト: 1日1回
  freeLimit: 2,       // 無料会員: 1日2回
  proLimit: 10,       // プロ会員: 1日10回
  historyDays: {
    free: 7,          // 無料: 7日間保存
    pro: -1,          // プロ: 無制限
  },
  plans: [
    {
      id: 'seo-free',
      name: 'フリー',
      price: 0,
      priceLabel: '¥0',
      period: '',
      description: 'まずは試してみたい方',
      features: [
        { text: 'ゲスト: 1日1回まで', included: true },
        { text: 'ログイン: 1日2回まで', included: true },
        { text: 'アウトライン/セクション生成', included: true },
        { text: '履歴保存（7日間）', included: true },
      ],
      cta: '無料で試す',
    },
    {
      id: 'seo-starter',
      name: 'スターター',
      price: 980,
      priceLabel: '¥980',
      period: '/月（税込）',
      description: '個人利用に最適',
      color: 'slate',
      features: [
        { text: '1日5回まで生成', included: true },
        { text: 'SEO構成/FAQ生成', included: true },
        { text: '簡易監査（重複/整合性）', included: true },
        { text: '履歴保存（30日間）', included: true },
        { text: 'メールサポート', included: true },
      ],
      cta: 'スタータープランを始める',
    },
    {
      id: 'seo-pro',
      name: 'プロ',
      price: 2980,
      priceLabel: '¥2,980',
      period: '/月（税込）',
      description: 'ビジネス利用に',
      popular: true,
      color: 'slate',
      features: [
        { text: '1日10回まで生成', included: true },
        { text: 'セクション分割生成（安定化）', included: true },
        { text: '監査（二重チェック）', included: true },
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
// カンタンドヤAI 料金設定
// ========================================
// 文章生成は画像より低コストなので、ゲスト枠は少し多めに設定
export const KANTAN_PRICING: ServicePricing = {
  serviceId: 'kantan',
  serviceName: 'カンタンドヤAI',
  serviceIcon: '📝',
  guestLimit: 3, // ゲスト: 1日3回
  freeLimit: 5, // 無料会員: 1日5回
  proLimit: 50, // プロ会員: 1日50回
  historyDays: {
    free: 7,
    pro: -1,
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
        { text: '主要テンプレートを利用可能', included: true },
        { text: '履歴保存（7日間）', included: true },
      ],
      cta: '無料で試す',
    },
    {
      id: 'kantan-pro',
      name: 'プロ',
      price: 1980,
      priceLabel: '¥1,980',
      period: '/月（税込）',
      description: '業務で継続利用する方向け',
      popular: true,
      color: 'blue',
      features: [
        { text: '1日50回まで生成', included: true },
        { text: '全テンプレート利用可能', included: true },
        { text: '履歴保存（無制限）', included: true },
        { text: '優先サポート', included: true },
      ],
      cta: 'プロプランを始める',
    },
  ],
}

// ========================================
// ポータル全体のセット割引
// ========================================
// SEO（¥2,980）+ バナー（¥4,980）= ¥7,960 → 25%OFF
export const BUNDLE_PRICING = {
  name: 'ドヤAI オールインワン',
  price: 5980,
  priceLabel: '¥5,980',
  period: '/月（税込）',
  discount: '約25%OFF',
  originalPrice: '¥7,960',
  description: '両方使うなら断然お得',
  features: [
    { text: 'ドヤSEO プロ（通常¥2,980）', included: true },
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
    case 'seo':
      return SEO_PRICING
    case 'banner':
      return BANNER_PRICING
    case 'kantan':
      return KANTAN_PRICING
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
  const allPlans = [...SEO_PRICING.plans, ...BANNER_PRICING.plans, ...KANTAN_PRICING.plans]
  return allPlans.find(p => p.id === planId) || null
}

// ========================================
// ゲスト使用状況管理（ローカルストレージ）
// ========================================
export interface GuestUsage {
  date: string
  count: number
}

export function getGuestUsage(serviceId: string): GuestUsage {
  if (typeof window === 'undefined') return { date: '', count: 0 }
  
  try {
    const key = `doya_guest_usage_${serviceId}`
    const stored = localStorage.getItem(key)
    if (!stored) return { date: '', count: 0 }
    return JSON.parse(stored)
  } catch {
    return { date: '', count: 0 }
  }
}

export function setGuestUsage(serviceId: string, count: number): void {
  if (typeof window === 'undefined') return
  
  const key = `doya_guest_usage_${serviceId}`
  const today = new Date().toISOString().split('T')[0]
  localStorage.setItem(key, JSON.stringify({ date: today, count }))
}

export function getGuestRemainingCount(serviceId: string): number {
  const pricing = getPricingByService(serviceId)
  if (!pricing) return 0
  
  const usage = getGuestUsage(serviceId)
  const today = new Date().toISOString().split('T')[0]
  
  if (usage.date !== today) {
    return pricing.guestLimit
  }
  
  return Math.max(0, pricing.guestLimit - usage.count)
}

export function incrementGuestUsage(serviceId: string): number {
  const usage = getGuestUsage(serviceId)
  const today = new Date().toISOString().split('T')[0]
  
  let newCount: number
  if (usage.date === today) {
    newCount = usage.count + 1
  } else {
    newCount = 1
  }
  
  setGuestUsage(serviceId, newCount)
  return newCount
}
