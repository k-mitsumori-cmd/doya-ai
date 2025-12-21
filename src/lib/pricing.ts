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
// カンタンマーケAI（マーケティング業務AIエージェント）料金設定
// ========================================
// /kantan ページや robots/sitemap のメタ生成で参照されるため、
// ここで必ず export して「undefined参照でビルド落ち」を防ぐ。
// 参考: https://lp.airmake.airdesign.ai/ エアマケ
export const KANTAN_PRICING: ServicePricing = {
  serviceId: 'kantan',
  serviceName: 'カンタンマーケAI',
  serviceIcon: '🚀',
  guestLimit: 3, // ゲスト: 1日3回
  freeLimit: 10, // ログイン無料: 1日10回
  proLimit: 100, // プロ: 1日100回
  historyDays: {
    free: 7,
    pro: -1,
  },
  plans: [
    {
      id: 'kantan-free',
      name: '無料',
      price: 0,
      priceLabel: '¥0',
      period: '',
      description: 'まずはAIマーケターを体験',
      features: [
        { text: 'ゲスト: 1日3回まで', included: true },
        { text: 'ログイン: 1日10回まで', included: true },
        { text: 'チャット形式でマーケ相談', included: true },
        { text: '15種類のマーケAIエージェント', included: true },
        { text: '履歴保存（7日間）', included: true },
      ],
      cta: '無料で試す',
    },
    {
      id: 'kantan-pro',
      name: 'プロ',
      price: 4980,
      priceLabel: '¥4,980',
      period: '/月（税込）',
      description: 'マーケ業務を劇的効率化',
      popular: true,
      color: 'emerald',
      features: [
        { text: '1日100回まで生成', included: true },
        { text: '全AIエージェント利用可能', included: true },
        { text: 'ブランド設定対応', included: true },
        { text: '広告データ分析', included: true },
        { text: '履歴保存（無制限）', included: true },
        { text: '優先サポート', included: true },
      ],
      cta: 'プロプランを始める',
    },
    {
      id: 'kantan-enterprise',
      name: '法人',
      price: 0,
      priceLabel: '要相談',
      period: '',
      description: 'カスタムAIエージェント構築',
      color: 'slate',
      features: [
        { text: '業務プロセス全体をAI化', included: true },
        { text: 'カスタムAIエージェント開発', included: true },
        { text: '高セキュリティ環境', included: true },
        { text: '請求書払い・契約書対応', included: true },
        { text: '専任サポート', included: true },
      ],
      cta: 'お問い合わせ',
    },
  ],
}

// ========================================
// ドヤSEO 料金設定
// ========================================
// SEO記事生成はコストが読みづらいため、まずは控えめな上限で運用
export const SEO_PRICING: ServicePricing = {
  serviceId: 'seo',
  serviceName: 'ドヤSEO',
  serviceIcon: '🧠',
  guestLimit: 0,      // ゲスト: 生成はログイン推奨（0回）
  freeLimit: 1,       // 無料会員: 1日1回（お試し）
  proLimit: 10,       // 互換用（旧インターフェース向け）: PRO=1日10回
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
        { text: 'ログイン: 1日1回まで生成', included: true },
        { text: 'アウトライン/セクション生成', included: true },
        { text: '履歴保存（7日間）', included: true },
      ],
      cta: '無料で試す',
    },
    {
      id: 'seo-pro',
      name: 'プロ',
      price: 3000,
      priceLabel: '¥3,000',
      period: '/月（税込）',
      description: '月額3,000円：1日10回',
      popular: true,
      color: 'slate',
      features: [
        { text: '1日10回まで生成', included: true },
        { text: '分割生成（安定化）', included: true },
        { text: '監査（二重チェック）', included: true },
        { text: '履歴保存（無制限）', included: true },
        { text: '優先サポート', included: true },
      ],
      cta: 'プロプランを始める',
    },
    {
      id: 'seo-business',
      name: 'ビジネス',
      price: 9900,
      priceLabel: '¥9,900',
      period: '/月（税込）',
      description: '月額9,900円：1日50回',
      color: 'slate',
      features: [
        { text: '1日50回まで生成', included: true },
        { text: '分割生成（安定化）', included: true },
        { text: '監査（二重チェック）', included: true },
        { text: '履歴保存（無制限）', included: true },
        { text: '優先サポート', included: true },
      ],
      cta: 'ビジネスを始める',
    },
    {
      id: 'seo-enterprise',
      name: '法人',
      price: 0,
      priceLabel: '要相談',
      period: '',
      description: '法人：要相談',
      color: 'slate',
      features: [
        { text: '上限のカスタム', included: true },
        { text: '請求書払い/契約書対応', included: true },
        { text: 'SLA/専任サポート', included: true },
      ],
      cta: 'お問い合わせ',
    },
  ],
}

// SEO: user.plan から日次上限を決定（Stripe webhookの更新方針に合わせる）
export function getSeoDailyLimitByUserPlan(plan: string | null | undefined): number {
  // テスト用: 回数制限を無効化（本番で戻すのが簡単なように環境変数で制御）
  // Vercel側で DOYA_DISABLE_LIMITS=1 を設定すると無制限になる
  if (process.env.DOYA_DISABLE_LIMITS === '1' || process.env.SEO_DISABLE_LIMITS === '1') return -1
  const p = String(plan || 'FREE').toUpperCase()
  if (p === 'BUSINESS') return 50
  if (p === 'PRO') return 10
  if (p === 'STARTER') return 5 // 互換（旧プランを持つユーザーがいても破綻しない）
  return SEO_PRICING.freeLimit
}

// ========================================
// Bunridge AI 料金設定
// ========================================
// 画像生成はAPIコストが高いため、適正価格を設定
// 3案同時生成 = 約25円/生成 → 月50回で約1,250円のコスト
// 競合: Canva Pro ¥1,000/月、Adobe Express ¥1,078/月
export const BANNER_PRICING: ServicePricing = {
  serviceId: 'banner',
  serviceName: 'Bunridge AI',
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
      name: '無料版',
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
      id: 'banner-pro',
      name: '有料版',
      price: 4980,
      priceLabel: '¥4,980',
      period: '/月（税込）',
      description: '月額4,980円：1日30回まで',
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
      cta: '有料版を始める',
    },
  ],
}

// 30回/日を超える利用（チーム/法人/大量生成など）の相談導線
export const HIGH_USAGE_CONTACT_URL =
  process.env.NEXT_PUBLIC_HIGH_USAGE_CONTACT_URL ||
  'mailto:support@doya-ai.com?subject=%E4%B8%8A%E4%BD%8D%E3%83%97%E3%83%A9%E3%83%B3%EF%BC%8830%E5%9B%9E%2F%E6%97%A5%E8%B6%85%EF%BC%89%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6'

// ========================================
// ポータル全体のセット割引
// ========================================
// SEO（¥3,000）+ バナー（¥4,980）= ¥7,980 → 約25%OFF
export const BUNDLE_PRICING = {
  name: 'ドヤAI オールインワン',
  price: 5980,
  priceLabel: '¥5,980',
  period: '/月（税込）',
  discount: '約25%OFF',
  originalPrice: '¥7,980',
  description: '両方使うなら断然お得',
  features: [
    { text: 'ドヤSEO プロ（通常¥3,000）', included: true },
    { text: 'Bunridge AI プロ（通常¥4,980）', included: true },
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
    case 'seo':
      return SEO_PRICING
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

// プランを取得（無料版/有料版など）
export function getPlanById(planId: string): Plan | null {
  const allPlans = [...KANTAN_PRICING.plans, ...SEO_PRICING.plans, ...BANNER_PRICING.plans]
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

// ========================================
// ログインユーザー使用状況（ローカルストレージ）
// ※ 現状は簡易実装（ユーザーIDまでは区別しない）
// ========================================
export interface UserUsage {
  date: string
  count: number
}

export function getUserUsage(serviceId: string): UserUsage {
  if (typeof window === 'undefined') return { date: '', count: 0 }
  try {
    const key = `doya_user_usage_${serviceId}`
    const stored = localStorage.getItem(key)
    if (!stored) return { date: '', count: 0 }
    return JSON.parse(stored)
  } catch {
    return { date: '', count: 0 }
  }
}

export function setUserUsage(serviceId: string, count: number): void {
  if (typeof window === 'undefined') return
  const key = `doya_user_usage_${serviceId}`
  const today = new Date().toISOString().split('T')[0]
  localStorage.setItem(key, JSON.stringify({ date: today, count }))
}

export function getUserRemainingCount(serviceId: string, userType: 'free' | 'pro'): number {
  const pricing = getPricingByService(serviceId)
  if (!pricing) return 0
  const limit = userType === 'pro' ? pricing.proLimit : pricing.freeLimit
  const usage = getUserUsage(serviceId)
  const today = new Date().toISOString().split('T')[0]
  if (usage.date !== today) return limit
  return Math.max(0, limit - usage.count)
}

export function incrementUserUsage(serviceId: string): number {
  const usage = getUserUsage(serviceId)
  const today = new Date().toISOString().split('T')[0]
  const newCount = usage.date === today ? usage.count + 1 : 1
  setUserUsage(serviceId, newCount)
  return newCount
}
