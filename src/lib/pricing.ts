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
  lightLimit?: number
  proLimit: number
  enterpriseLimit?: number
  // 文字数制限（SEO記事生成用）
  charLimit?: {
    guest: number
    free: number
    light: number
    pro: number
    enterprise: number
  }
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
// ドヤライティングAI 料金設定
// ========================================
// SEO記事生成はコストが読みづらいため、まずは控えめな上限で運用
export const SEO_PRICING: ServicePricing = {
  serviceId: 'seo',
  serviceName: 'ドヤライティングAI',
  serviceIcon: '🧠',
  guestLimit: 0,        // ゲスト: 生成不可（ログイン必須）
  freeLimit: 3,         // ログイン無料: 月3回まで
  lightLimit: 10,       // LIGHT: 月10回まで
  proLimit: 30,         // PRO: 月30回まで
  enterpriseLimit: 200, // Enterprise: 月200回まで
  // 文字数制限（1記事あたり）
  charLimit: {
    guest: 5000,       // ゲスト: 5,000字まで
    free: 10000,       // ログイン無料: 10,000字まで
    light: 15000,      // LIGHT: 15,000字まで
    pro: 20000,        // PRO: 20,000字まで
    enterprise: 50000, // Enterprise: 50,000字まで
  },
  historyDays: {
    free: 90,         // 直近3ヶ月（DB肥大化防止）
    pro: 90,
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
        { text: 'ログイン必須（ゲストは生成不可）', included: true },
        { text: '月3回 / 10,000字まで', included: true },
        { text: 'アウトライン/セクション生成', included: true },
        { text: '履歴保存（直近3ヶ月）', included: true },
        { text: '画像生成（図解/サムネ）はLIGHTから', included: true },
      ],
      cta: '無料で試す',
    },
    {
      id: 'seo-light',
      name: 'ライト',
      price: 2980,
      priceLabel: '¥2,980',
      period: '/月（税込）',
      description: '月額2,980円：月10回 / 15,000字まで',
      color: 'blue',
      features: [
        { text: '月10回まで生成', included: true },
        { text: '1記事15,000字まで生成可能', included: true },
        { text: '分割生成（安定化）', included: true },
        { text: '監査（二重チェック）', included: true },
        { text: '履歴保存（直近3ヶ月）', included: true },
        { text: '画像生成（図解/サムネ）', included: true },
      ],
      cta: 'ライトプランを始める',
    },
    {
      id: 'seo-pro',
      name: 'プロ',
      price: 9980,
      priceLabel: '¥9,980',
      period: '/月（税込）',
      description: '月額9,980円：月30回 / 20,000字まで',
      popular: true,
      color: 'slate',
      features: [
        { text: '月30回まで生成', included: true },
        { text: '1記事20,000字まで生成可能', included: true },
        { text: '分割生成（安定化）', included: true },
        { text: '監査（二重チェック）', included: true },
        { text: '履歴保存（直近3ヶ月）', included: true },
        { text: '画像生成（図解/サムネ）', included: true },
        { text: '優先サポート', included: true },
      ],
      cta: 'プロプランを始める',
    },
    {
      id: 'seo-enterprise',
      name: 'エンタープライズ',
      price: 49800,
      priceLabel: '¥49,800',
      period: '/月（税込）',
      description: '月額49,800円：月200回 / 50,000字まで',
      color: 'slate',
      features: [
        { text: '月200回まで生成', included: true },
        { text: '1記事50,000字まで生成可能', included: true },
        { text: '画像生成（図解/サムネ）', included: true },
        { text: 'チーム運用・大量制作向け', included: true },
        { text: '優先サポート', included: true },
      ],
      cta: 'エンタープライズを始める',
    },
  ],
}

// SEO: user.plan から月次上限を決定（Stripe webhookの更新方針に合わせる）
export function getSeoMonthlyLimitByUserPlan(plan: string | null | undefined): number {
  // テスト用: 回数制限を無効化（本番で戻すのが簡単なように環境変数で制御）
  // Vercel側で DOYA_DISABLE_LIMITS=1 を設定すると無制限になる
  if (process.env.DOYA_DISABLE_LIMITS === '1' || process.env.SEO_DISABLE_LIMITS === '1') return -1
  const p = String(plan || 'FREE').toUpperCase()
  if (p === 'ENTERPRISE') return SEO_PRICING.enterpriseLimit ?? 200
  if (p === 'PRO') return SEO_PRICING.proLimit
  if (p === 'LIGHT') return SEO_PRICING.lightLimit ?? 10
  return SEO_PRICING.freeLimit
}

/** @deprecated 後方互換用。新コードでは getSeoMonthlyLimitByUserPlan を使うこと */
export function getSeoDailyLimitByUserPlan(plan: string | null | undefined): number {
  return getSeoMonthlyLimitByUserPlan(plan)
}

// SEO: user.plan から文字数上限を決定
export function getSeoCharLimitByUserPlan(plan: string | null | undefined, isGuest: boolean = false): number {
  const charLimit = SEO_PRICING.charLimit
  if (!charLimit) return 10000 // フォールバック
  
  if (isGuest) return charLimit.guest // 5,000字

  const p = String(plan || 'FREE').toUpperCase()
  if (p === 'ENTERPRISE') return charLimit.enterprise // 50,000字
  if (p === 'PRO') return charLimit.pro // 20,000字
  if (p === 'LIGHT') return charLimit.light ?? 15000 // 15,000字
  return charLimit.free // 10,000字
}

// ========================================
// ドヤバナーAI 料金設定
// ========================================
// 画像生成はAPIコストが高いため、適正価格を設定
// 3案同時生成 = 約25円/生成 → 月50回で約1,250円のコスト
// 競合: Canva Pro ¥1,000/月、Adobe Express ¥1,078/月
// NOTE: バナーAIは「月間」上限で管理（他サービスは日次のまま）
export const BANNER_PRICING: ServicePricing = {
  serviceId: 'banner',
  serviceName: 'ドヤバナーAI',
  serviceIcon: '🎨',
  // NOTE: 生成「枚数」ベースで管理（1回の生成で複数枚作れるため）
  // NOTE: バナーAIのみ月間上限（guestLimit/freeLimit/proLimit/enterpriseLimit は月間値）
  guestLimit: 3,         // ゲスト: 月3枚
  freeLimit: 15,         // 無料会員: 月15枚
  lightLimit: 50,        // LIGHT: 月50枚
  proLimit: 150,         // PRO: 月150枚
  enterpriseLimit: 1000, // ENTERPRISE: 月1000枚
  historyDays: {
    free: 7,
    pro: -1,
  },
  plans: [
    {
      id: 'banner-free',
      name: 'おためしプラン',
      price: 0,
      priceLabel: '無料',
      period: '',
      description: '月15枚まで生成できます',
      features: [
        { text: 'ゲスト: 月3枚まで', included: true },
        { text: 'ログイン: 月15枚まで', included: true },
        { text: 'サイズ: 1080×1080固定', included: true },
        { text: '同時生成: 最大3枚', included: true },
      ],
      cta: '無料で試す',
    },
    {
      id: 'banner-light',
      name: 'ライトプラン',
      price: 2980,
      priceLabel: '月額 ¥2,980',
      period: '/月（税込）',
      description: '月50枚まで生成（LIGHT）',
      color: 'blue',
      features: [
        { text: '月50枚まで生成', included: true },
        { text: 'サイズ自由指定', included: true },
        { text: '同時生成: 最大3枚', included: true },
      ],
      cta: 'ライトプランを始める',
    },
    {
      id: 'banner-pro',
      name: 'プロプラン',
      price: 9980,
      priceLabel: '月額 ¥9,980',
      period: '/月（税込）',
      description: '月150枚まで生成（PRO）',
      popular: true,
      color: 'slate',
      features: [
        { text: '月150枚まで生成', included: true },
        { text: 'サイズ自由指定', included: true },
        { text: '同時生成: 最大5枚', included: true },
      ],
      cta: 'プロプランを始める',
    },
    {
      id: 'banner-enterprise',
      name: 'エンタープライズ',
      price: 49800,
      priceLabel: '月額 ¥49,800',
      period: '/月（税込）',
      description: '月1000枚まで生成（Enterprise）',
      color: 'slate',
      features: [
        { text: '月1000枚まで生成', included: true },
        { text: '大量運用・チーム向け', included: true },
        { text: '優先サポート', included: true },
        { text: 'さらに上限UP相談可', included: true },
      ],
      cta: 'エンタープライズを始める',
    },
  ],
}

// Banner: user.plan / user.bannerPlan から月間上限（画像枚数）を決定
export function getBannerMonthlyLimitByUserPlan(plan: string | null | undefined): number {
  if (process.env.DOYA_DISABLE_LIMITS === '1' || process.env.BANNER_DISABLE_LIMITS === '1') return -1
  const p = String(plan || 'FREE').toUpperCase()
  if (p === 'BUNDLE') return BANNER_PRICING.proLimit
  if (p === 'ENTERPRISE') return BANNER_PRICING.enterpriseLimit || 1000
  if (p === 'PRO' || p === 'BASIC' || p === 'STARTER' || p === 'BUSINESS') return BANNER_PRICING.proLimit
  if (p === 'LIGHT') return BANNER_PRICING.lightLimit ?? 50
  return BANNER_PRICING.freeLimit
}

/** @deprecated 後方互換用。新コードでは getBannerMonthlyLimitByUserPlan を使うこと */
export const getBannerDailyLimitByUserPlan = getBannerMonthlyLimitByUserPlan

// ========================================
// ドヤペルソナAI 料金設定
// ========================================
// ペルソナ生成はテキスト中心でAPIコストが低い
export const PERSONA_PRICING: ServicePricing = {
  serviceId: 'persona',
  serviceName: 'ドヤペルソナAI',
  serviceIcon: '🎯',
  guestLimit: 2,      // ゲスト: 1日2回
  freeLimit: 5,       // ログイン無料: 1日5回
  lightLimit: 15,     // LIGHT: 1日15回
  proLimit: 30,       // PRO: 1日30回
  historyDays: {
    free: 7,
    pro: -1,
  },
  plans: [
    {
      id: 'persona-free',
      name: '無料',
      price: 0,
      priceLabel: '¥0',
      period: '',
      description: 'まずはペルソナ生成を体験',
      features: [
        { text: 'ゲスト: 1日2回まで', included: true },
        { text: 'ログイン: 1日5回まで', included: true },
        { text: 'ペルソナ + クリエイティブ生成', included: true },
        { text: 'ポートレート画像生成', included: true },
        { text: '履歴保存（7日間）', included: true },
      ],
      cta: '無料で試す',
    },
    {
      id: 'persona-light',
      name: 'ライト',
      price: 2980,
      priceLabel: '¥2,980',
      period: '/月（税込）',
      description: 'ペルソナ生成を日常的に活用',
      color: 'blue',
      features: [
        { text: '1日15回まで生成', included: true },
        { text: 'バナー画像生成', included: true },
        { text: '広告コピー + LP構成案', included: true },
        { text: '履歴保存（無制限）', included: true },
      ],
      cta: 'ライトプランを始める',
    },
    {
      id: 'persona-pro',
      name: 'プロ',
      price: 9980,
      priceLabel: '¥9,980',
      period: '/月（税込）',
      description: 'ペルソナ分析を本格活用',
      popular: true,
      color: 'purple',
      features: [
        { text: '1日30回まで生成', included: true },
        { text: 'バナー画像生成', included: true },
        { text: '広告コピー + LP構成案', included: true },
        { text: '履歴保存（無制限）', included: true },
        { text: '優先サポート', included: true },
      ],
      cta: 'プロプランを始める',
    },
  ],
}

// Persona: user.plan から日次上限を決定
export function getPersonaDailyLimitByUserPlan(plan: string | null | undefined): number {
  if (process.env.DOYA_DISABLE_LIMITS === '1' || process.env.PERSONA_DISABLE_LIMITS === '1') return -1
  const p = String(plan || 'FREE').toUpperCase()
  if (p === 'BUNDLE') return PERSONA_PRICING.proLimit
  if (p === 'ENTERPRISE') return PERSONA_PRICING.proLimit
  if (p === 'PRO' || p === 'BASIC' || p === 'STARTER' || p === 'BUSINESS') return PERSONA_PRICING.proLimit
  if (p === 'LIGHT') return PERSONA_PRICING.lightLimit ?? 15
  return PERSONA_PRICING.freeLimit
}

// ========================================
// ドヤインタビュー 料金設定
// ========================================
// インタビュー文字起こしはAssemblyAI APIコストが発生
// 月次制限（分数ベース + アップロード容量制限）
export const INTERVIEW_PRICING = {
  serviceId: 'interview',
  serviceName: 'ドヤインタビュー',
  serviceIcon: '🎙️',
  // 1回の文字起こし上限（約3時間 = 180分）
  // ※ Vercel maxDuration=5分 × 自動再接続最大10回 ≒ 45分のポーリング時間
  // AssemblyAI処理速度（実時間の1/4〜1/5）から約3時間が実質上限
  maxSingleTranscriptionMinutes: 180,
  // 月次文字起こし分数制限
  transcriptionMinutes: {
    guest: 5,          // ゲスト: 合計5分
    free: 30,          // ログイン無料: 毎月30分
    light: 60,         // LIGHT: 毎月60分
    pro: 150,          // PRO: 毎月150分
    enterprise: 1000,  // エンタープライズ: 毎月1000分
  },
  // アップロード容量制限（バイト単位）
  uploadSizeLimit: {
    guest: 100 * 1024 * 1024,         // ゲスト: 100MB
    free: 500 * 1024 * 1024,          // ログイン無料: 500MB
    light: 1 * 1024 * 1024 * 1024,    // LIGHT: 1GB
    pro: 2 * 1024 * 1024 * 1024,      // PRO: 2GB
    enterprise: 5 * 1024 * 1024 * 1024, // エンタープライズ: 5GB
  },
  guestLimit: 2,
  freeLimit: 5,
  proLimit: 30,
  enterpriseLimit: 100,
  historyDays: {
    guest: 30,
    free: 30,
    pro: 30,
    enterprise: 30,
  },
  plans: [
    {
      id: 'interview-free',
      name: '無料',
      price: 0,
      priceLabel: '¥0',
      period: '',
      description: 'まずはインタビュー記事生成を体験',
      features: [
        { text: 'ゲスト: 文字起こし合計5分まで / 100MBまで', included: true },
        { text: 'ログイン: 毎月30分まで / 500MBまで', included: true },
        { text: '1回の文字起こし: 最大約3時間', included: true },
        { text: 'AI記事生成 + スキル選択', included: true },
        { text: '校正・タイトル提案', included: true },
        { text: 'データ保存（30日間）', included: true },
      ],
      cta: '無料で試す',
    },
    {
      id: 'interview-light',
      name: 'ライト',
      price: 2980,
      priceLabel: '¥2,980',
      period: '/月（税込）',
      description: 'インタビュー記事制作を手軽に',
      color: 'blue',
      features: [
        { text: '毎月60分まで文字起こし', included: true },
        { text: '1回の文字起こし: 最大約3時間', included: true },
        { text: 'アップロード最大1GB', included: true },
        { text: 'ファクトチェック・翻訳', included: true },
        { text: 'SNS投稿文生成', included: true },
        { text: 'データ保存（30日間）', included: true },
      ],
      cta: 'ライトプランを始める',
    },
    {
      id: 'interview-pro',
      name: 'プロ',
      price: 9980,
      priceLabel: '¥9,980',
      period: '/月（税込）',
      description: 'インタビュー記事制作を本格活用',
      popular: true,
      color: 'purple',
      features: [
        { text: '毎月150分まで文字起こし', included: true },
        { text: '1回の文字起こし: 最大約3時間', included: true },
        { text: 'アップロード最大2GB', included: true },
        { text: 'ファクトチェック・翻訳', included: true },
        { text: 'SNS投稿文生成', included: true },
        { text: 'データ保存（30日間）', included: true },
        { text: '優先サポート', included: true },
      ],
      cta: 'プロプランを始める',
    },
    {
      id: 'interview-enterprise',
      name: 'エンタープライズ',
      price: 49800,
      priceLabel: '¥49,800',
      period: '/月（税込）',
      description: '大規模チーム・法人向け',
      color: 'slate',
      features: [
        { text: '毎月1,000分まで文字起こし', included: true },
        { text: '1回の文字起こし: 最大約3時間', included: true },
        { text: 'アップロード最大5GB', included: true },
        { text: '全機能利用可能', included: true },
        { text: 'チーム運用・大量制作', included: true },
        { text: '専任サポート', included: true },
      ],
      cta: 'エンタープライズを始める',
    },
  ],
}

// Interview: user.plan から制限を決定
export function getInterviewLimitsByPlan(plan: string | null | undefined): {
  transcriptionMinutes: number
  uploadSizeLimit: number
} {
  if (process.env.DOYA_DISABLE_LIMITS === '1' || process.env.INTERVIEW_DISABLE_LIMITS === '1') {
    return { transcriptionMinutes: -1, uploadSizeLimit: -1 }
  }
  const p = String(plan || 'FREE').toUpperCase()
  if (p === 'ENTERPRISE') return {
    transcriptionMinutes: INTERVIEW_PRICING.transcriptionMinutes.enterprise,
    uploadSizeLimit: INTERVIEW_PRICING.uploadSizeLimit.enterprise,
  }
  if (p === 'PRO' || p === 'BASIC' || p === 'STARTER' || p === 'BUSINESS' || p === 'BUNDLE') return {
    transcriptionMinutes: INTERVIEW_PRICING.transcriptionMinutes.pro,
    uploadSizeLimit: INTERVIEW_PRICING.uploadSizeLimit.pro,
  }
  if (p === 'LIGHT') return {
    transcriptionMinutes: INTERVIEW_PRICING.transcriptionMinutes.light,
    uploadSizeLimit: INTERVIEW_PRICING.uploadSizeLimit.light,
  }
  return {
    transcriptionMinutes: INTERVIEW_PRICING.transcriptionMinutes.free,
    uploadSizeLimit: INTERVIEW_PRICING.uploadSizeLimit.free,
  }
}

export function getInterviewGuestLimits(): {
  transcriptionMinutes: number
  uploadSizeLimit: number
} {
  return {
    transcriptionMinutes: INTERVIEW_PRICING.transcriptionMinutes.guest,
    uploadSizeLimit: INTERVIEW_PRICING.uploadSizeLimit.guest,
  }
}

// ========================================
// ドヤ診断AI 料金設定
// ========================================
// テキスト中心の診断でAPIコストは低め
export const SHINDAN_PRICING: ServicePricing = {
  serviceId: 'shindan',
  serviceName: 'ドヤWeb診断AI',
  serviceIcon: '📊',
  guestLimit: 1,      // ゲスト: 1日1回
  freeLimit: 3,       // ログイン無料: 1日3回
  lightLimit: 10,     // LIGHT: 1日10回
  proLimit: 20,       // PRO: 1日20回
  historyDays: {
    free: 7,
    pro: -1,
  },
  plans: [
    {
      id: 'shindan-free',
      name: '無料',
      price: 0,
      priceLabel: '¥0',
      period: '',
      description: 'まずはWeb診断を体験',
      features: [
        { text: 'ゲスト: 1日1回まで', included: true },
        { text: 'ログイン: 1日3回まで', included: true },
        { text: '7軸レーダーチャート診断', included: true },
        { text: '競合サイト自動発見・比較', included: true },
        { text: '履歴保存（7日間）', included: true },
      ],
      cta: '無料で試す',
    },
    {
      id: 'shindan-light',
      name: 'ライト',
      price: 2980,
      priceLabel: '¥2,980',
      period: '/月（税込）',
      description: 'Web診断を日常的に活用',
      color: 'blue',
      features: [
        { text: '1日10回まで診断', included: true },
        { text: '7軸Webサイト分析', included: true },
        { text: '競合サイト自動発見・比較', included: true },
        { text: '履歴保存（無制限）', included: true },
      ],
      cta: 'ライトプランを始める',
    },
    {
      id: 'shindan-pro',
      name: 'プロ',
      price: 9980,
      priceLabel: '¥9,980',
      period: '/月（税込）',
      description: 'Web診断を本格活用',
      popular: true,
      color: 'teal',
      features: [
        { text: '1日20回まで診断', included: true },
        { text: '7軸Webサイト分析', included: true },
        { text: 'PDF書き出し', included: true },
        { text: '履歴保存（無制限）', included: true },
        { text: '優先サポート', included: true },
      ],
      cta: 'プロプランを始める',
    },
  ],
}

// Shindan: user.plan から日次上限を決定
export function getShindanDailyLimitByUserPlan(plan: string | null | undefined): number {
  if (process.env.DOYA_DISABLE_LIMITS === '1' || process.env.SHINDAN_DISABLE_LIMITS === '1') return -1
  const p = String(plan || 'FREE').toUpperCase()
  if (p === 'BUNDLE') return SHINDAN_PRICING.proLimit
  if (p === 'ENTERPRISE') return SHINDAN_PRICING.proLimit
  if (p === 'PRO' || p === 'BASIC' || p === 'STARTER' || p === 'BUSINESS') return SHINDAN_PRICING.proLimit
  if (p === 'LIGHT') return SHINDAN_PRICING.lightLimit ?? 10
  return SHINDAN_PRICING.freeLimit
}

// ========================================
// ドヤコピーAI 料金設定
// ========================================
// コピー生成はテキスト中心でAPIコストは低め
// 月次上限（日次ではなく月次で管理）
export const COPY_PRICING: ServicePricing = {
  serviceId: 'copy',
  serviceName: 'ドヤコピーAI',
  serviceIcon: '✍️',
  guestLimit: 3,          // ゲスト: 月3回
  freeLimit: 10,          // 無料会員: 月10回
  lightLimit: 50,         // LIGHT: 月50回
  proLimit: 200,          // PRO: 月200回
  enterpriseLimit: 1000,  // ENTERPRISE: 月1000回
  historyDays: {
    free: 7,
    pro: -1,
  },
  plans: [
    {
      id: 'copy-free',
      name: '無料',
      price: 0,
      priceLabel: '¥0',
      period: '',
      description: 'まずは試してみたい方に',
      features: [
        { text: 'ゲスト: 月3回まで', included: true },
        { text: 'ログイン: 月10回まで', included: true },
        { text: 'ディスプレイ広告コピー生成', included: true },
        { text: '1ライタータイプ（ストレート）', included: true },
        { text: '履歴保存（7日間）', included: true },
      ],
      cta: '無料で始める',
    },
    {
      id: 'copy-light',
      name: 'ライト',
      price: 2980,
      priceLabel: '¥2,980',
      period: '/月（税込）',
      description: '広告コピーを手軽に活用',
      color: 'blue',
      features: [
        { text: '月50回まで生成', included: true },
        { text: 'ディスプレイ広告コピー生成', included: true },
        { text: '3ライタータイプ利用可能', included: true },
        { text: 'ブラッシュアップ', included: true },
        { text: '履歴保存（無制限）', included: true },
      ],
      cta: 'ライトプランを始める',
    },
    {
      id: 'copy-pro',
      name: 'Pro',
      price: 9980,
      priceLabel: '¥9,980',
      period: '/月（税込）',
      description: '広告運用を効率化したい方に',
      popular: true,
      color: 'amber',
      features: [
        { text: '月200回まで生成', included: true },
        { text: '全広告タイプ（ディスプレイ/検索/SNS）', included: true },
        { text: '5ライタータイプすべて利用可能', included: true },
        { text: 'ブラッシュアップ無制限', included: true },
        { text: 'レギュレーション設定', included: true },
        { text: 'ブランドボイス保存（3件）', included: true },
        { text: 'CSV/Excelエクスポート', included: true },
        { text: 'ドヤペルソナAI連携', included: true },
        { text: '履歴無期限保存', included: true },
        { text: '他サービスのPro枠も同時に解放', included: true },
      ],
      cta: 'Proプランを始める',
    },
    {
      id: 'copy-enterprise',
      name: 'Enterprise',
      price: 49800,
      priceLabel: '¥49,800',
      period: '/月（税込）',
      description: '代理店・大量運用向け',
      color: 'slate',
      features: [
        { text: '月1,000回まで生成', included: true },
        { text: 'Pro全機能', included: true },
        { text: 'ブランドボイス無制限', included: true },
        { text: 'API連携（JSON出力）', included: true },
        { text: 'チームアカウント（10名）', included: true },
        { text: '優先サポート', included: true },
      ],
      cta: 'お問い合わせ',
    },
  ],
}

// Copy: user.plan から月次上限を決定
export function getCopyMonthlyLimitByUserPlan(plan: string | null | undefined): number {
  if (process.env.DOYA_DISABLE_LIMITS === '1' || process.env.COPY_DISABLE_LIMITS === '1') return -1
  const p = String(plan || 'FREE').toUpperCase()
  if (p === 'ENTERPRISE') return COPY_PRICING.enterpriseLimit ?? 1000
  if (p === 'BUNDLE') return COPY_PRICING.proLimit
  if (p === 'PRO' || p === 'BASIC' || p === 'STARTER' || p === 'BUSINESS') return COPY_PRICING.proLimit
  if (p === 'LIGHT') return COPY_PRICING.lightLimit ?? 50
  return COPY_PRICING.freeLimit
}

// Copy: プラン判定ヘルパー
export function isCopyProPlan(plan: string | null | undefined): boolean {
  const p = String(plan || 'FREE').toUpperCase()
  return ['PRO', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(p)
}

export function isCopyLightOrAbove(plan: string | null | undefined): boolean {
  const p = String(plan || 'FREE').toUpperCase()
  return ['LIGHT', 'PRO', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(p)
}

// Copy: プランごとに許可されるライタータイプ
export function getAllowedWriterTypes(plan: string | null | undefined): string[] {
  if (isCopyProPlan(plan)) return ['straight', 'emotional', 'logical', 'provocative', 'story']
  if (isCopyLightOrAbove(plan)) return ['straight', 'emotional', 'logical']
  return ['straight']
}

// ========================================
// ドヤオープニングAI 料金設定
// ========================================
export const OPENING_PRICING: ServicePricing = {
  serviceId: 'opening',
  serviceName: 'ドヤオープニングAI',
  serviceIcon: '🎬',
  guestLimit: 2,
  freeLimit: 3,
  lightLimit: 15,
  proLimit: 30,
  historyDays: {
    free: 7,
    pro: -1,
  },
  plans: [
    {
      id: 'opening-free',
      name: '無料',
      price: 0,
      priceLabel: '¥0',
      period: '',
      description: 'まずはオープニングアニメーション生成を体験',
      features: [
        { text: 'ゲスト: 1日2回まで', included: true },
        { text: 'ログイン: 1日3回まで', included: true },
        { text: '3種類のテンプレート', included: true },
        { text: 'テキスト編集', included: true },
        { text: 'コードコピー', included: true },
        { text: '履歴保存（7日間）', included: true },
      ],
      cta: '無料で試す',
    },
    {
      id: 'opening-light',
      name: 'ライト',
      price: 2980,
      priceLabel: '¥2,980',
      period: '/月（税込）',
      description: 'オープニングアニメーション生成を手軽に',
      color: 'blue',
      features: [
        { text: '1日15回まで生成', included: true },
        { text: '全6テンプレート利用可能', included: true },
        { text: 'カラー・タイミング編集', included: true },
        { text: 'コードコピー', included: true },
        { text: '履歴保存（無制限）', included: true },
      ],
      cta: 'ライトプランを始める',
    },
    {
      id: 'opening-pro',
      name: 'プロ',
      price: 9980,
      priceLabel: '¥9,980',
      period: '/月（税込）',
      description: 'オープニングアニメーション生成を本格活用',
      popular: true,
      color: 'red',
      features: [
        { text: '1日30回まで生成', included: true },
        { text: '全6テンプレート利用可能', included: true },
        { text: 'カラー・タイミング・ロゴ編集', included: true },
        { text: 'ZIPダウンロード', included: true },
        { text: '透かしなし', included: true },
        { text: '履歴保存（無制限）', included: true },
        { text: '優先サポート', included: true },
      ],
      cta: 'プロプランを始める',
    },
  ],
}

// Opening: user.plan から日次上限を決定
export function getOpeningDailyLimitByUserPlan(plan: string | null | undefined): number {
  if (process.env.DOYA_DISABLE_LIMITS === '1' || process.env.OPENING_DISABLE_LIMITS === '1') return -1
  const p = String(plan || 'FREE').toUpperCase()
  if (p === 'BUNDLE') return OPENING_PRICING.proLimit
  if (p === 'ENTERPRISE') return OPENING_PRICING.proLimit
  if (p === 'PRO' || p === 'BASIC' || p === 'STARTER' || p === 'BUSINESS') return OPENING_PRICING.proLimit
  if (p === 'LIGHT') return OPENING_PRICING.lightLimit ?? 15
  return OPENING_PRICING.freeLimit
}

// 30枚/日を超える利用（チーム/法人/大量生成など）の相談導線
export const HIGH_USAGE_CONTACT_URL =
  process.env.NEXT_PUBLIC_HIGH_USAGE_CONTACT_URL ||
  'https://doyamarke.surisuta.jp/contact'

// 改善要望/不具合/問い合わせ導線（アプリ内から共通で利用）
export const SUPPORT_CONTACT_URL =
  process.env.NEXT_PUBLIC_SUPPORT_CONTACT_URL ||
  'https://doyamarke.surisuta.jp/contact'

// ========================================
// ドヤLP AI 料金設定
// ========================================
// 月次制限（ページ数ベース）
export const LP_PRICING: ServicePricing = {
  serviceId: 'lp',
  serviceName: 'ドヤLP AI',
  serviceIcon: '📄',
  guestLimit: 1,          // ゲスト: 月1ページ
  freeLimit: 3,           // 無料会員: 月3ページ
  lightLimit: 10,         // LIGHT: 月10ページ
  proLimit: 30,           // PRO: 月30ページ
  enterpriseLimit: 200,   // ENTERPRISE: 月200ページ
  historyDays: {
    free: 7,
    pro: -1,
  },
  plans: [
    {
      id: 'lp-free',
      name: 'Free',
      price: 0,
      priceLabel: '¥0',
      period: '',
      description: 'LP構成を試してみたい方に',
      features: [
        { text: '月3ページまで', included: true },
        { text: '構成案生成（3パターン）', included: true },
        { text: 'セクション別コピー自動生成', included: true },
        { text: '3テーマ（Corporate/Minimal/Warm）', included: true },
        { text: 'プレビューのみ（エクスポート不可）', included: false },
        { text: '保存7日間', included: true },
      ],
      cta: '無料で始める',
      popular: false,
      color: 'gray',
    },
    {
      id: 'lp-light',
      name: 'ライト',
      price: 2980,
      priceLabel: '¥2,980',
      period: '/月（税込）',
      description: 'LP構成を手軽に活用',
      color: 'blue',
      features: [
        { text: '月10ページまで', included: true },
        { text: '構成案生成（3パターン）', included: true },
        { text: 'セクション別コピー自動生成', included: true },
        { text: '5テーマ利用可能', included: true },
        { text: '保存（無制限）', included: true },
        { text: 'HTMLエクスポート', included: false },
        { text: 'PDF構成シート出力', included: false },
        { text: 'セクションブラッシュアップ', included: false },
      ],
      cta: 'ライトプランを始める',
    },
    {
      id: 'lp-pro',
      name: 'Pro',
      price: 9980,
      priceLabel: '¥9,980',
      period: '/月（税込）',
      description: 'LP制作を効率化したい方に',
      features: [
        { text: '月30ページまで', included: true },
        { text: '全8デザインテーマ', included: true },
        { text: 'HTMLエクスポート（レスポンシブ対応）', included: true },
        { text: 'PDF構成シート出力', included: true },
        { text: 'セクションブラッシュアップ', included: true },
        { text: 'Unsplash素材検索', included: true },
        { text: '履歴無期限保存', included: true },
        { text: '他サービスのPro枠も同時に解放', included: true },
      ],
      cta: 'Proプランを始める',
      popular: true,
      color: 'cyan',
    },
    {
      id: 'lp-enterprise',
      name: 'Enterprise',
      price: 49800,
      priceLabel: '¥49,800',
      period: '/月（税込）',
      description: '制作会社・代理店向け',
      features: [
        { text: '月200ページまで', included: true },
        { text: 'Pro全機能', included: true },
        { text: 'カスタムテーマ作成', included: true },
        { text: 'チームアカウント（10名）', included: true },
        { text: '優先サポート', included: true },
      ],
      cta: 'お問い合わせ',
      popular: false,
      color: 'slate',
    },
  ],
}

// LP: user.plan から月次上限（ページ数）を決定
export function getLpMonthlyLimitByUserPlan(plan: string | null | undefined): number {
  if (process.env.DOYA_DISABLE_LIMITS === '1' || process.env.LP_DISABLE_LIMITS === '1') return -1
  const p = String(plan || 'FREE').toUpperCase()
  if (p === 'ENTERPRISE') return LP_PRICING.enterpriseLimit ?? 200
  if (p === 'BUNDLE') return LP_PRICING.proLimit
  if (p === 'PRO' || p === 'BASIC' || p === 'STARTER' || p === 'BUSINESS') return LP_PRICING.proLimit
  if (p === 'LIGHT') return LP_PRICING.lightLimit ?? 10
  return LP_PRICING.freeLimit
}

// ========================================
// ドヤボイスAI 料金設定
// ========================================
export const VOICE_PRICING: ServicePricing = {
  serviceId: 'voice',
  serviceName: 'ドヤボイスAI',
  serviceIcon: '🎙️',
  guestLimit: 3,           // ゲスト: 月3回（500文字/回）
  freeLimit: 10,           // 無料会員: 月10回（1,000文字/回）
  lightLimit: 50,          // LIGHT: 月50回（3,000文字/回）
  proLimit: 200,           // PRO: 月200回（5,000文字/回）
  enterpriseLimit: 1000,   // ENTERPRISE: 月1,000回
  historyDays: { free: 7, pro: -1 },
  plans: [
    {
      id: 'voice-free',
      name: 'Free',
      price: 0,
      priceLabel: '¥0',
      period: '',
      description: 'まずは無料で「声の威力」を体感',
      features: [
        { text: '月10回まで生成', included: true },
        { text: '1回あたり1,000文字まで', included: true },
        { text: '4キャラクター（アキラ/サクラ/ハルト/ミサキ）', included: true },
        { text: 'MP3出力のみ', included: true },
        { text: '保存7日間', included: true },
        { text: '話速・ピッチ調整', included: false },
        { text: 'SSML編集', included: false },
        { text: 'クラウド録音スタジオ', included: false },
      ],
      cta: '無料で始める',
      popular: false,
      color: 'gray',
    },
    {
      id: 'voice-light',
      name: 'ライト',
      price: 2980,
      priceLabel: '¥2,980',
      period: '/月（税込）',
      description: '月50本の声を、外注の1/10の値段で',
      color: 'blue',
      features: [
        { text: '月50回まで生成', included: true },
        { text: '1回あたり3,000文字まで', included: true },
        { text: '全12キャラクター利用可', included: true },
        { text: 'MP3/WAV出力', included: true },
        { text: '話速・ピッチ調整', included: true },
        { text: '履歴無期限保存', included: true },
      ],
      cta: 'ライトプランを始める',
    },
    {
      id: 'voice-pro',
      name: 'Pro',
      price: 9980,
      priceLabel: '¥9,980',
      period: '/月（税込）',
      description: '本気の動画制作を、声の力で加速',
      features: [
        { text: '月200回まで生成', included: true },
        { text: '1回あたり5,000文字まで', included: true },
        { text: '全12キャラクター利用可', included: true },
        { text: '全出力形式（MP3/WAV/OGG/M4A）', included: true },
        { text: '音声パラメータ詳細調整', included: true },
        { text: 'SSML直接編集', included: true },
        { text: 'クラウド録音スタジオ', included: true },
        { text: 'AI + 録音の合成', included: true },
        { text: 'バッチ一括生成', included: true },
        { text: 'ドヤムービーAI連携', included: true },
        { text: '履歴無期限保存', included: true },
        { text: '他サービスのPro枠も同時に解放', included: true },
      ],
      cta: 'Proプランを始める',
      popular: true,
      color: 'violet',
    },
    {
      id: 'voice-enterprise',
      name: 'Enterprise',
      price: 49800,
      priceLabel: '¥49,800',
      period: '/月（税込）',
      description: '1,000本規模の量産を、チームで回す',
      features: [
        { text: '月1,000回まで生成', included: true },
        { text: 'Pro全機能', included: true },
        { text: 'カスタムボイス作成（要相談）', included: true },
        { text: 'API連携', included: true },
        { text: 'チームアカウント（10名）', included: true },
        { text: '高品質48kHz出力', included: true },
        { text: '優先サポート', included: true },
      ],
      cta: 'お問い合わせ',
      popular: false,
      color: 'slate',
    },
  ],
}

export function getVoiceMonthlyLimitByUserPlan(plan: string | null | undefined): number {
  if (process.env.DOYA_DISABLE_LIMITS === '1' || process.env.VOICE_DISABLE_LIMITS === '1') return -1
  const p = String(plan || 'FREE').toUpperCase()
  if (p === 'ENTERPRISE') return VOICE_PRICING.enterpriseLimit ?? 1000
  if (p === 'BUNDLE') return VOICE_PRICING.proLimit
  if (p === 'PRO' || p === 'BASIC' || p === 'STARTER' || p === 'BUSINESS') return VOICE_PRICING.proLimit
  if (p === 'LIGHT') return VOICE_PRICING.lightLimit ?? 50
  return VOICE_PRICING.freeLimit
}

export function getVoiceCharLimitByUserPlan(plan: string | null | undefined): number {
  const p = String(plan || 'FREE').toUpperCase()
  if (p === 'ENTERPRISE' || p === 'PRO' || p === 'BASIC' || p === 'STARTER' || p === 'BUSINESS' || p === 'BUNDLE') return 5000
  if (p === 'LIGHT') return 3000
  return 1000
}

// ========================================
// ポータル全体のセット割引
// ========================================
// セット割引（表示文言は価格改定の影響を受けやすいので、金額の直書きは避ける）
export const BUNDLE_PRICING = {
  name: 'ドヤAI オールインワン',
  price: 5980,
  priceLabel: '¥5,980',
  period: '/月（税込）',
  discount: '約25%OFF',
  originalPrice: '¥7,980',
  description: '両方使うなら断然お得',
  features: [
    { text: 'ドヤライティングAI プロ', included: true },
    { text: 'ドヤバナーAI プロ', included: true },
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
    case 'persona':
      return PERSONA_PRICING
    case 'interview':
      return INTERVIEW_PRICING as any
    case 'shindan':
      return SHINDAN_PRICING
    case 'opening':
      return OPENING_PRICING
    case 'copy':
      return COPY_PRICING
    case 'lp':
      return LP_PRICING
    case 'voice':
      return VOICE_PRICING
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
  const allPlans = [...KANTAN_PRICING.plans, ...SEO_PRICING.plans, ...BANNER_PRICING.plans, ...PERSONA_PRICING.plans, ...INTERVIEW_PRICING.plans, ...SHINDAN_PRICING.plans, ...COPY_PRICING.plans, ...VOICE_PRICING.plans, ...LP_PRICING.plans]
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
  // バナーAIは月間管理（YYYY-MM）、他サービスは日次管理（YYYY-MM-DD）
  const dateKey = serviceId === 'banner'
    ? new Date().toISOString().slice(0, 7) // YYYY-MM
    : new Date().toISOString().split('T')[0] // YYYY-MM-DD
  localStorage.setItem(key, JSON.stringify({ date: dateKey, count }))
}

export function getGuestRemainingCount(serviceId: string): number {
  const pricing = getPricingByService(serviceId)
  if (!pricing) return 0

  const usage = getGuestUsage(serviceId)
  // バナーAIは月間比較、他サービスは日次比較
  const currentKey = serviceId === 'banner'
    ? new Date().toISOString().slice(0, 7) // YYYY-MM
    : new Date().toISOString().split('T')[0] // YYYY-MM-DD

  if (usage.date !== currentKey) {
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

export function incrementUserUsage(serviceId: string, by: number = 1): number {
  const usage = getUserUsage(serviceId)
  const today = new Date().toISOString().split('T')[0]
  const inc = Number.isFinite(by) ? Math.max(1, Math.floor(by)) : 1
  const newCount = usage.date === today ? usage.count + inc : inc
  setUserUsage(serviceId, newCount)
  return newCount
}

// ========================================
// サーバーサイド日次リセット（日本時間00:00基準）
// ========================================
/**
 * 日本時間（JST = UTC+9）での今日の日付文字列を取得
 */
export function getTodayDateJST(): string {
  const now = new Date()
  // UTC時刻に9時間を加算してJSTに変換
  const jstOffset = 9 * 60 * 60 * 1000
  const jstDate = new Date(now.getTime() + jstOffset)
  return jstDate.toISOString().split('T')[0]
}

/**
 * lastUsageResetが今日（JST）でなければリセットが必要
 */
export function shouldResetDailyUsage(lastUsageReset: Date | null | undefined): boolean {
  if (!lastUsageReset) return true
  const todayJST = getTodayDateJST()
  // lastUsageResetもJSTに変換して比較
  const jstOffset = 9 * 60 * 60 * 1000
  const resetDateJST = new Date(lastUsageReset.getTime() + jstOffset).toISOString().split('T')[0]
  return resetDateJST !== todayJST
}

/**
 * 月次リセット判定（バナーAI用）
 * lastUsageResetの年月が現在の年月（JST）と異なればリセットが必要
 */
export function shouldResetMonthlyUsage(lastUsageReset: Date | null | undefined): boolean {
  if (!lastUsageReset) return true
  const jstOffset = 9 * 60 * 60 * 1000
  const nowJST = new Date(Date.now() + jstOffset)
  const resetJST = new Date(lastUsageReset.getTime() + jstOffset)
  return nowJST.getUTCFullYear() !== resetJST.getUTCFullYear() || nowJST.getUTCMonth() !== resetJST.getUTCMonth()
}

/**
 * 現在のJST年月文字列を取得（例: "2026-02"）
 */
export function getCurrentMonthJST(): string {
  const jstOffset = 9 * 60 * 60 * 1000
  const nowJST = new Date(Date.now() + jstOffset)
  return nowJST.toISOString().slice(0, 7)
}

// ========================================
// 初回ログイン後1時間生成し放題の判定
// ========================================
/** 1時間生成し放題の有効期間（ミリ秒）：デフォルト1時間 */
export const FREE_HOUR_DURATION_MS = 60 * 60 * 1000

/**
 * 初回ログインから1時間以内かどうかを判定
 * @param firstLoginAt - ISO文字列 or Date or null
 * @returns true なら「1時間生成し放題」が有効
 */
export function isWithinFreeHour(firstLoginAt: string | Date | null | undefined): boolean {
  if (!firstLoginAt) return false
  const loginTime = typeof firstLoginAt === 'string' ? new Date(firstLoginAt) : firstLoginAt
  if (isNaN(loginTime.getTime())) return false
  const elapsed = Date.now() - loginTime.getTime()
  return elapsed >= 0 && elapsed < FREE_HOUR_DURATION_MS
}

/**
 * 1時間生成し放題の残り時間（ミリ秒）。0以下なら終了済み
 */
export function getFreeHourRemainingMs(firstLoginAt: string | Date | null | undefined): number {
  if (!firstLoginAt) return 0
  const loginTime = typeof firstLoginAt === 'string' ? new Date(firstLoginAt) : firstLoginAt
  if (isNaN(loginTime.getTime())) return 0
  const remaining = FREE_HOUR_DURATION_MS - (Date.now() - loginTime.getTime())
  return Math.max(0, remaining)
}

// ========================================
// ドヤムービーAI 料金設定
// ========================================
export const MOVIE_PRICING: ServicePricing = {
  serviceId: 'movie',
  serviceName: 'ドヤムービーAI',
  serviceIcon: '🎬',
  guestLimit: 1,          // ゲスト: 月1本
  freeLimit: 3,           // 無料会員: 月3本
  lightLimit: 10,         // LIGHT: 月10本
  proLimit: 30,           // PRO: 月30本
  enterpriseLimit: 200,   // ENTERPRISE: 月200本
  historyDays: { free: 7, pro: -1 },
  plans: [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      priceLabel: '¥0',
      period: '',
      description: 'まずは動画AIを体験',
      features: [
        { text: '月3本まで生成', included: true },
        { text: '720p（SD画質）', included: true },
        { text: '15秒以下のみ', included: true },
        { text: '3テンプレート', included: true },
        { text: '透かしロゴあり', included: true },
        { text: '保存7日間', included: true },
      ],
      cta: '無料で始める',
      popular: false,
      color: 'gray',
    },
    {
      id: 'movie-light',
      name: 'ライト',
      price: 2980,
      priceLabel: '¥2,980',
      period: '/月（税込）',
      description: '動画AIを手軽に活用',
      color: 'blue',
      features: [
        { text: '月10本まで生成', included: true },
        { text: '1080p（HD画質）', included: true },
        { text: '30秒まで対応', included: true },
        { text: '10テンプレート', included: true },
        { text: '透かしロゴなし', included: true },
        { text: '保存（無制限）', included: true },
      ],
      cta: 'ライトプランを始める',
    },
    {
      id: 'movie-pro',
      name: 'Pro',
      price: 9980,
      priceLabel: '¥9,980',
      period: '/月',
      description: '動画広告を本格運用したい方に',
      features: [
        { text: '月30本まで生成', included: true },
        { text: '1080p（HD画質）', included: true },
        { text: '60秒まで対応', included: true },
        { text: '全45テンプレート', included: true },
        { text: '透かしロゴなし', included: true },
        { text: 'BGM・SE全種利用可', included: true },
        { text: 'ドヤボイスAI連携', included: true },
        { text: 'ドヤペルソナAI連携', included: true },
        { text: '素材アップロード無制限', included: true },
        { text: '履歴無期限保存', included: true },
        { text: '※ 他サービスのPro枠も同時に解放', included: true },
      ],
      cta: 'Proプランを始める',
      popular: true,
      color: 'rose',
    },
    {
      id: 'movie-enterprise',
      name: 'Enterprise',
      price: 49800,
      priceLabel: '¥49,800',
      period: '/月',
      description: '大量制作・代理店向け',
      features: [
        { text: '月200本まで生成', included: true },
        { text: 'Pro全機能', included: true },
        { text: 'カスタムテンプレート作成', included: true },
        { text: 'API連携', included: true },
        { text: 'チームアカウント（10名）', included: true },
        { text: '優先レンダリング', included: true },
        { text: '優先サポート', included: true },
      ],
      cta: 'お問い合わせ',
      popular: false,
      color: 'slate',
    },
  ],
}

export function getMovieMonthlyLimitByUserPlan(plan: string | null | undefined): number {
  if (process.env.DOYA_DISABLE_LIMITS === '1' || process.env.MOVIE_DISABLE_LIMITS === '1') return -1
  const p = String(plan || 'FREE').toUpperCase()
  switch (p) {
    case 'ENTERPRISE': return MOVIE_PRICING.enterpriseLimit ?? 200
    case 'BUNDLE': return MOVIE_PRICING.proLimit
    case 'PRO':
    case 'BASIC':
    case 'STARTER':
    case 'BUSINESS': return MOVIE_PRICING.proLimit
    case 'LIGHT': return MOVIE_PRICING.lightLimit ?? 10
    case 'FREE': return MOVIE_PRICING.freeLimit
    default: return MOVIE_PRICING.freeLimit
  }
}

// ========================================
// ドヤインタビューAI-X 料金設定
// ========================================
export const INTERVIEWX_PRICING: ServicePricing = {
  serviceId: 'interviewx',
  serviceName: 'ドヤインタビューAI-X',
  serviceIcon: '🚀',
  guestLimit: 1,
  freeLimit: 3,
  lightLimit: 10,
  proLimit: 50,
  enterpriseLimit: -1,
  historyDays: { free: 30, pro: -1 },
  plans: [
    {
      id: 'interviewx-free',
      name: '無料',
      price: 0,
      priceLabel: '¥0',
      period: '',
      description: 'まずはAI-Xを体験',
      features: [
        { text: '月3プロジェクトまで', included: true },
        { text: 'AI質問生成', included: true },
        { text: 'AI記事生成', included: true },
        { text: '品質チェック（校正のみ）', included: true },
        { text: 'Markdownエクスポート', included: true },
        { text: 'メール通知', included: false },
        { text: 'ブランドカスタマイズ', included: false },
      ],
      cta: '無料で試す',
    },
    {
      id: 'interviewx-light',
      name: 'ライト',
      price: 2980,
      priceLabel: '¥2,980',
      period: '/月（税込）',
      description: '個人・小規模チーム向け',
      color: 'blue',
      features: [
        { text: '月10プロジェクトまで', included: true },
        { text: 'AI質問生成', included: true },
        { text: 'AI記事生成', included: true },
        { text: '全品質チェック', included: true },
        { text: 'HTML/Markdownエクスポート', included: true },
        { text: 'メール通知', included: true },
        { text: 'ブランドカスタマイズ', included: false },
      ],
      cta: 'ライトプランを始める',
    },
    {
      id: 'interviewx-pro',
      name: 'プロ',
      price: 9980,
      priceLabel: '¥9,980',
      period: '/月（税込）',
      description: '本格的なコンテンツ制作に',
      popular: true,
      color: 'indigo',
      features: [
        { text: '月50プロジェクトまで', included: true },
        { text: 'AI質問生成', included: true },
        { text: 'AI記事生成', included: true },
        { text: '全品質チェック', included: true },
        { text: 'HTML/Markdownエクスポート', included: true },
        { text: 'メール通知', included: true },
        { text: 'ブランドカスタマイズ', included: true },
      ],
      cta: 'プロプランを始める',
    },
    {
      id: 'interviewx-enterprise',
      name: 'エンタープライズ',
      price: 49800,
      priceLabel: '¥49,800',
      period: '/月（税込）',
      description: '大規模チーム・法人向け',
      color: 'slate',
      features: [
        { text: '無制限プロジェクト', included: true },
        { text: 'AI質問生成', included: true },
        { text: 'AI記事生成', included: true },
        { text: '全品質チェック', included: true },
        { text: 'HTML/Markdownエクスポート', included: true },
        { text: 'メール通知', included: true },
        { text: 'ブランドカスタマイズ', included: true },
      ],
      cta: 'お問い合わせ',
    },
  ],
}

export function getInterviewXMonthlyLimitByUserPlan(plan: string | null | undefined): number {
  if (process.env.DOYA_DISABLE_LIMITS === '1') return -1
  const p = String(plan || 'FREE').toUpperCase()
  switch (p) {
    case 'ENTERPRISE': return INTERVIEWX_PRICING.enterpriseLimit ?? -1
    case 'BUNDLE': return INTERVIEWX_PRICING.proLimit
    case 'PRO':
    case 'BASIC':
    case 'STARTER':
    case 'BUSINESS': return INTERVIEWX_PRICING.proLimit
    case 'LIGHT': return INTERVIEWX_PRICING.lightLimit ?? 10
    case 'FREE': return INTERVIEWX_PRICING.freeLimit
    default: return INTERVIEWX_PRICING.freeLimit
  }
}
