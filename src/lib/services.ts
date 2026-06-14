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
    light?: ServicePricing
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
    status: 'maintenance',
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
        limit: '月15枚まで',
        dailyLimit: 15,
        price: 0
      },
      light: {
        name: 'ライトプラン',
        limit: '月50枚まで',
        dailyLimit: 50,
        price: 2980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_BANNER_LIGHT_PRICE_ID,
      },
      pro: {
        name: 'プロプラン',
        limit: '月150枚まで',
        dailyLimit: 150,
        price: 9980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_BANNER_PRO_PRICE_ID,
      },
      enterprise: {
        name: 'エンタープライズ',
        limit: '月1000枚まで',
        dailyLimit: 1000,
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
    status: 'maintenance',
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
      free: { name: '無料プラン', limit: 'お試し', dailyLimit: 0, price: 0 },
      light: {
        name: 'ライトプラン',
        limit: '月10回まで',
        dailyLimit: 10,
        price: 2980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_SEO_LIGHT_PRICE_ID,
      },
      pro: {
        name: 'プロプラン',
        limit: '月30回まで',
        dailyLimit: 30,
        price: 9980,
      },
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
        limit: '1日5回まで',
        dailyLimit: 5,
        price: 0,
      },
      light: {
        name: 'ライトプラン',
        limit: '月60分まで',
        dailyLimit: 60,
        price: 2980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_INTERVIEW_LIGHT_PRICE_ID,
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
      light: {
        name: 'ライトプラン',
        limit: '1日10回まで',
        dailyLimit: 10,
        price: 2980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_SHINDAN_LIGHT_PRICE_ID,
      },
      pro: {
        name: 'プロプラン',
        limit: '1日20回まで',
        dailyLimit: 20,
        price: 9980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_SHINDAN_PRO_PRICE_ID,
      },
    },
    status: 'maintenance',
    category: 'other',
    order: 6,
    requiresAuth: false,
    isNew: true,
  },

  // ----------------------------------------
  // ドヤペルソナAI（ペルソナ生成）
  // ----------------------------------------
  {
    id: 'persona',
    name: 'ドヤペルソナAI',
    shortName: 'ペルソナ',
    description: 'ターゲットペルソナをAIで自動生成',
    longDescription: 'ビジネスに最適なペルソナ像をAIが自動生成。年齢・職業・悩み・行動パターンまで詳細なペルソナシートを作成。',
    icon: '🎯',
    color: 'purple',
    gradient: 'from-purple-500 to-purple-600',
    bgGradient: 'from-purple-50 to-purple-100',
    href: '/persona',
    dashboardHref: '/persona',
    pricingHref: '/persona',
    guideHref: '/persona',
    features: [
      'AIペルソナ自動生成',
      '詳細なペルソナシート出力',
      '業界・商材に最適化',
      'マーケティング施策に活用',
    ],
    pricing: {
      free: {
        name: '無料プラン',
        limit: '1日5回まで',
        dailyLimit: 5,
        price: 0,
      },
      light: {
        name: 'ライトプラン',
        limit: '1日15回まで',
        dailyLimit: 15,
        price: 2980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PERSONA_LIGHT_PRICE_ID,
      },
      pro: {
        name: 'プロプラン',
        limit: '1日30回まで',
        dailyLimit: 30,
        price: 9980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PERSONA_PRO_PRICE_ID,
      },
    },
    status: 'active',
    category: 'text',
    order: 8,
    requiresAuth: false,
  },

  // ----------------------------------------
  // ドヤワイヤーフレーム AI
  // ----------------------------------------
  {
    id: 'lp',
    name: 'ドヤワイヤーフレーム AI',
    shortName: 'ワイヤーフレーム',
    description: 'ワイヤーフレームを、1分で設計する。',
    longDescription: '商品情報を入力するだけで、LP構成案・セクション別コピー・デザイン方針をAIが自動生成。HTMLエクスポートで、そのまま公開or制作会社への指示書として使用できる。',
    icon: '📄',
    color: 'cyan',
    gradient: 'from-cyan-500 to-blue-500',
    bgGradient: 'from-cyan-50 to-blue-50',
    href: '/lp',
    dashboardHref: '/lp',
    pricingHref: '/lp/pricing',
    guideHref: '/lp/guide',
    features: [
      'URL/手動入力から商品情報を自動抽出',
      'LP目的別に3パターンの構成案を生成',
      'セクション別コピーを自動生成',
      '8種類のデザインテーマ',
      'HTMLエクスポート（レスポンシブ対応）',
      'PDF構成シート出力',
    ],
    useCases: [
      'LPの構成案作成に時間がかかっている',
      '制作会社への指示書を効率化したい',
      'コピーライターを雇う前に叩き台が欲しい',
      'LP制作コストを削減したい',
    ],
    pricing: {
      free: {
        name: 'Freeプラン',
        limit: '月3ページまで',
        dailyLimit: 0,
        price: 0,
      },
      light: {
        name: 'ライトプラン',
        limit: '月10ページまで',
        dailyLimit: 10,
        price: 2980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_LP_LIGHT_PRICE_ID,
      },
      pro: {
        name: 'Proプラン',
        limit: '月30ページまで',
        dailyLimit: -1,
        price: 9980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_LP_PRO_PRICE_ID,
      },
      enterprise: {
        name: 'Enterpriseプラン',
        limit: '月200ページまで',
        dailyLimit: -1,
        price: 49800,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_LP_ENTERPRISE_PRICE_ID,
      },
    },
    status: 'coming_soon',
    category: 'web',
    order: 8,
    requiresAuth: false,
    isNew: true,
    badge: 'NEW',
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
    status: 'coming_soon',
    category: 'text',
    order: 3,
    requiresAuth: true,
    badge: '開発中',
  },

  // ----------------------------------------
  // ドヤコピーAI（広告コピー量産）
  // ----------------------------------------
  {
    id: 'copy',
    name: 'ドヤコピーAI',
    shortName: 'コピー',
    description: '広告コピーを、AIで量産する。',
    longDescription: 'ペルソナ情報や商品URLを入力するだけで、ディスプレイ広告・検索広告・SNS広告向けのコピーを大量生成。5種類のAIコピーライターが異なる切り口で提案し、ブラッシュアップ機能で実用品質まで磨き上げる。',
    icon: '✍️',
    color: 'amber',
    gradient: 'from-amber-500 to-orange-500',
    bgGradient: 'from-amber-50 to-orange-50',
    href: '/copy',
    dashboardHref: '/copy',
    pricingHref: '/copy/pricing',
    guideHref: '/copy/guide',
    features: [
      'ディスプレイ広告コピー20案以上を一括生成',
      '検索広告（Google/Yahoo!）RSA対応',
      'SNS広告（Meta/X/LINE/TikTok）最適化',
      '5種類のAIコピーライター（トーン別）',
      'ブラッシュアップ（チャット形式）',
      'CSV/Excelエクスポート',
    ],
    useCases: [
      '広告コピーのアイデアが枯渇している',
      'A/Bテスト用に大量のバリエーションが欲しい',
      'コピーライターへの依頼コストを削減したい',
      'リスティング広告のアセットを素早く揃えたい',
    ],
    pricing: {
      free: {
        name: '無料プラン',
        limit: '月10回まで',
        dailyLimit: 10,
        price: 0,
      },
      light: {
        name: 'ライトプラン',
        limit: '月50回まで',
        dailyLimit: 50,
        price: 2980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_COPY_LIGHT_PRICE_ID,
      },
      pro: {
        name: 'プロプラン',
        limit: '月200回まで',
        dailyLimit: 200,
        price: 9980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_COPY_PRO_PRICE_ID,
      },
      enterprise: {
        name: 'エンタープライズ',
        limit: '月1,000回まで',
        dailyLimit: 1000,
        price: 49800,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_COPY_ENTERPRISE_PRICE_ID,
      },
    },
    status: 'coming_soon',
    category: 'text',
    order: 6,
    requiresAuth: false,
    isNew: true,
    badge: 'NEW',
  },

  // ----------------------------------------
  // ドヤオープニングAI（オープニングアニメーション生成）
  // ----------------------------------------
  {
    id: 'opening',
    name: 'ドヤオープニングAI',
    shortName: 'オープニング',
    description: 'URLを入れるだけで、感動のオープニングアニメーションを自動生成',
    longDescription: 'サイトのURLを入力するだけで、カラースキーム・ロゴ・テキストを自動抽出し、6種類のReactオープニングアニメーションを提案。プレビュー→微調整→コードエクスポートまで一気通貫。',
    icon: '🎬',
    color: 'red',
    gradient: 'from-red-500 to-rose-600',
    bgGradient: 'from-red-50 to-rose-50',
    href: '/opening',
    dashboardHref: '/opening/dashboard',
    pricingHref: '/opening/pricing',
    guideHref: '/opening/guide',
    features: [
      'URLからカラー・ロゴ・テキスト自動抽出',
      '6種類のアニメーションテンプレート',
      '1クリックでフルスクリーンプレビュー',
      'テキスト・カラー・タイミング微調整',
      'Reactコンポーネント一発エクスポート',
      'framer-motion ベースの美しいアニメーション',
    ],
    useCases: [
      'クライアント納品用のリッチなオープニングが欲しい',
      'ポートフォリオやLPに印象的なアニメーションを付けたい',
      'キャンペーンLPやイベントページを差別化したい',
      'プロダクトのローンチページにインパクトが欲しい',
    ],
    pricing: {
      free: {
        name: '無料プラン',
        limit: '1日3回まで',
        dailyLimit: 3,
        price: 0,
      },
      light: {
        name: 'ライトプラン',
        limit: '1日15回まで',
        dailyLimit: 15,
        price: 2980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_OPENING_LIGHT_PRICE_ID,
      },
      pro: {
        name: 'プロプラン',
        limit: '1日30回まで',
        dailyLimit: 30,
        price: 9980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_OPENING_PRO_PRICE_ID,
      },
    },
    status: 'maintenance',
    category: 'web',
    order: 7,
    requiresAuth: false,
    isNew: true,
    badge: 'NEW',
  },

  // ----------------------------------------
  // ドヤボイスAI（音声生成）
  // ----------------------------------------
  {
    id: 'voice',
    name: 'ドヤボイスAI',
    shortName: 'ボイス',
    description: 'プロの声を、数秒で手に入れる',
    longDescription: 'ナレーター手配・スタジオ予約・リテイク待ち――もう全部不要。テキストを打つだけで、プロ品質の日本語ナレーションが即完成。12人のAIボイスキャラクターが、YouTube・広告・e-Learning・ポッドキャストまで、あなたの声のパートナーになります。',
    icon: '🎙️',
    color: 'violet',
    gradient: 'from-violet-500 to-purple-500',
    bgGradient: 'from-violet-50 to-purple-50',
    href: '/voice',
    dashboardHref: '/voice',
    pricingHref: '/voice/pricing',
    guideHref: '/voice/guide',
    features: [
      '12人のAIボイスキャラクター — 声優手配ゼロで即戦力',
      '話速・ピッチ・音量を1%単位で微調整',
      '5つの感情トーンでニュアンスまで操る',
      'SSML対応 — 間・強調・抑揚をプロ並みに制御',
      'ブラウザ録音スタジオ — アプリ不要で即収録',
      'AI音声×自分の声を1本にミックス',
      'バッチ一括生成 — 100本のナレーションも一撃',
      'MP3/WAV/OGG/M4A — 現場が求める全形式対応',
    ],
    useCases: [
      'YouTube・広告動画のナレーションを外注なしで仕上げたい',
      'e-Learning教材を1/10のコストで量産したい',
      'ポッドキャストの音声を「プロ級」に格上げしたい',
      '社内動画・IVRの音声ガイドを今日中に100本つくりたい',
    ],
    pricing: {
      free: {
        name: '無料プラン',
        limit: '月10回まで',
        dailyLimit: 10,
        price: 0,
      },
      light: {
        name: 'ライトプラン',
        limit: '月50回まで',
        dailyLimit: 50,
        price: 2980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_VOICE_LIGHT_PRICE_ID,
      },
      pro: {
        name: 'プロプラン',
        limit: '月200回まで',
        dailyLimit: 200,
        price: 9980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_VOICE_PRO_PRICE_ID,
      },
      enterprise: {
        name: 'エンタープライズ',
        limit: '月1,000回まで',
        dailyLimit: 1000,
        price: 49800,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_VOICE_ENTERPRISE_PRICE_ID,
      },
    },
    status: 'coming_soon',
    category: 'other',
    order: 9,
    requiresAuth: false,
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

  // ----------------------------------------
  // ドヤヒヤリングAI（AIチャット自動ヒヤリング）
  // ----------------------------------------
  {
    id: 'interviewx',
    name: 'ドヤヒヤリングAI',
    shortName: 'ヒヤリング',
    description: 'AIチャットで自動ヒヤリング＆要約生成',
    longDescription:
      '商談・調査・要件定義など多様なヒヤリングをAIチャットで自動化。相手のサービスURLを事前調査し、最適な質問を生成。共有URLを送るだけで、回答完了後にAIが要約を自動生成します。',
    icon: '🚀',
    color: 'indigo',
    gradient: 'from-indigo-500 to-violet-500',
    bgGradient: 'from-indigo-50 to-violet-50',
    href: '/interviewx',
    dashboardHref: '/interviewx',
    pricingHref: '/interviewx/pricing',
    guideHref: '/interviewx',
    features: [
      '8種類のテンプレート（商談/サービス調査/顧客満足度/要件定義/社内/競合/新規事業/カスタム）',
      'サービスURLの事前AI調査で最適な質問を自動生成',
      'AIチャット形式で自然なヒヤリングを実施',
      '共有URLで回答者にヒヤリング送信（ログイン不要）',
      '回答完了後にAIが要約を自動生成',
      'HTML/Markdownでエクスポート',
    ],
    useCases: [
      '商談前の情報収集を効率化したい',
      'サービス調査・競合分析を自動化したい',
      '要件定義のヒヤリングを漏れなく実施したい',
      '顧客満足度調査を手軽に行いたい',
    ],
    pricing: {
      free: {
        name: '無料プラン',
        limit: '月3件まで',
        dailyLimit: 3,
        price: 0,
      },
      light: {
        name: 'ライトプラン',
        limit: '月10件まで',
        dailyLimit: 10,
        price: 2980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_INTERVIEWX_LIGHT_PRICE_ID,
      },
      pro: {
        name: 'プロプラン',
        limit: '月30件まで',
        dailyLimit: 30,
        price: 9980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_INTERVIEWX_PRO_PRICE_ID,
      },
      enterprise: {
        name: 'エンタープライズ',
        limit: '無制限',
        dailyLimit: -1,
        price: 49800,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_INTERVIEWX_ENTERPRISE_PRICE_ID,
      },
    },
    status: 'coming_soon',
    category: 'text',
    order: 5,
    requiresAuth: true,
    isNew: false,
    badge: '開発中',
  },

  // ----------------------------------------
  // ドヤムービーAI（動画広告生成）
  // ----------------------------------------
  {
    id: 'movie',
    name: 'ドヤムービーAI',
    shortName: 'ムービー',
    description: '動画広告を、10分で作る。',
    longDescription: 'テキスト指示だけで6秒〜60秒の動画広告を自動生成。テンプレート（勝ちフォーマット）× AI企画 × 素材ライブラリで、動画制作の経験ゼロでもプロ品質の動画広告が完成。',
    icon: '🎬',
    color: 'rose',
    gradient: 'from-rose-500 to-pink-500',
    bgGradient: 'from-rose-50 to-pink-50',
    href: '/movie',
    dashboardHref: '/movie',
    pricingHref: '/movie/pricing',
    guideHref: '/movie/guide',
    features: [
      '45テンプレート（15業種 × 3バリエーション）',
      '6秒〜60秒対応',
      '9配信先サイズプリセット',
      'AI企画3案自動生成（SSE）',
      'Remotion Playerでリアルタイムプレビュー',
      'MP4/GIFエクスポート',
      'ドヤボイスAI連携（ナレーション）',
      'ドヤペルソナAI連携',
    ],
    useCases: [
      '動画広告を短時間で作りたい',
      'デザイナーなしで高品質動画を制作したい',
      'SNS広告用の縦型動画を量産したい',
      'YouTube・Instagram・TikTok向けに最適化したい',
    ],
    pricing: {
      free: {
        name: '無料プラン',
        limit: '月3本まで',
        dailyLimit: 0,
        price: 0,
      },
      light: {
        name: 'ライトプラン',
        limit: '月10本まで',
        dailyLimit: 10,
        price: 2980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_MOVIE_LIGHT_PRICE_ID,
      },
      pro: {
        name: 'プロプラン',
        limit: '月30本まで',
        dailyLimit: -1,
        price: 9980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_MOVIE_PRO_PRICE_ID,
      },
      enterprise: {
        name: 'エンタープライズ',
        limit: '月200本まで',
        dailyLimit: -1,
        price: 49800,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_MOVIE_ENTERPRISE_PRICE_ID,
      },
    },
    status: 'coming_soon',
    category: 'video',
    order: 7,
    requiresAuth: false,
    isNew: true,
    badge: 'NEW',
  },

  // ----------------------------------------
  // ドヤ広告シミュレーションAI（広告提案資料 自動生成）
  // ----------------------------------------
  {
    id: 'adsim',
    name: 'ドヤ広告シミュレーションAI',
    shortName: '広告シミュ',
    description: '広告提案資料をAIが一発生成',
    longDescription:
      'クライアント情報・予算・媒体配分を入力するだけで、媒体別×月次のシミュレーション数値、提案テキスト、グラフ、提案スライド（PPTX/PDF）を自動生成。広告代理店・運用者の提案工数を4〜8時間 → 10分に短縮。',
    icon: '📊',
    color: 'indigo',
    gradient: 'from-indigo-500 to-blue-600',
    bgGradient: 'from-indigo-50 to-blue-50',
    href: '/adsim',
    dashboardHref: '/adsim',
    pricingHref: '/adsim/pricing',
    guideHref: '/adsim/guide',
    features: [
      '媒体別×月次の数値シミュレーション',
      '提案テキスト10セクション自動生成',
      'Recharts グラフ5種（予算配分・CV推移・ファネル等）',
      'PDF / PPTX / Excel 出力',
      '6媒体対応（Google / Meta / X / LINE / TikTok / Yahoo!）',
      '業界平均ベンチマーク自動補完',
    ],
    useCases: [
      '広告提案資料の作成に毎回4〜8時間かかっている',
      'Excelでの数値シミュレーションが手間',
      '業界平均値を毎回調べている',
      '媒体別のクリエイティブ方針を考えるのが面倒',
    ],
    pricing: {
      free: {
        name: '無料プラン',
        limit: '月3プロジェクトまで',
        dailyLimit: 0,
        price: 0,
      },
      pro: {
        name: 'プロプラン',
        limit: '無制限・PPTX出力',
        dailyLimit: -1,
        price: 9980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_ADSIM_PRO_PRICE_ID,
      },
      enterprise: {
        name: 'エンタープライズ',
        limit: '複数ブランド・チーム共有',
        dailyLimit: -1,
        price: 49800,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_ADSIM_ENTERPRISE_PRICE_ID,
      },
    },
    status: 'coming_soon',
    category: 'other',
    order: 8,
    requiresAuth: true,
    isNew: true,
    badge: 'NEW',
  },

  // ----------------------------------------
  // ドヤHR（タレントマネジメント）
  // ----------------------------------------
  {
    id: 'hr',
    name: 'ドヤHR',
    shortName: 'HR',
    description: '人を活かすAI。中小企業のためのタレントマネジメント。',
    longDescription: '従業員データベース、顔写真管理、人事評価をAIが支援。AI評価コメント生成で、データドリブンな人材マネジメントを実現。',
    icon: '👥',
    color: 'sky',
    gradient: 'from-sky-500 to-blue-600',
    bgGradient: 'from-sky-50 to-blue-50',
    href: '/hr',
    dashboardHref: '/hr/dashboard',
    pricingHref: '/hr/pricing',
    guideHref: '/hr',
    features: [
      '顔写真中心の従業員データベース',
      '組織図の自動生成',
      'MBO対応の人事評価',
      'AI評価コメント生成',
      'CSV一括インポート/エクスポート',
    ],
    useCases: [
      '従業員情報がExcelでバラバラに管理されている',
      '人事評価のやり取りがメールで煩雑',
      '1on1の記録が残っていない',
      '組織図を手作業で更新している',
      '少人数でも使えるタレマネを探している',
    ],
    pricing: {
      free: {
        name: '無料プラン',
        limit: '従業員5名まで',
        dailyLimit: 3,
        price: 0,
      },
      light: {
        name: 'スタータープラン',
        limit: '従業員30名まで',
        dailyLimit: 30,
        price: 4980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_HR_STARTER_PRICE_ID,
      },
      pro: {
        name: 'プロプラン',
        limit: '従業員100名まで',
        dailyLimit: -1,
        price: 14800,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_HR_PRO_PRICE_ID,
      },
      enterprise: {
        name: 'エンタープライズ',
        limit: '無制限',
        dailyLimit: -1,
        price: 49800,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_HR_ENTERPRISE_PRICE_ID,
      },
    },
    status: 'active',
    category: 'other',
    order: 9,
    requiresAuth: true,
    isNew: true,
    badge: 'NEW',
  },

  // ----------------------------------------
  // ドヤ勤怠（クラウド勤怠管理）
  // ----------------------------------------
  {
    id: 'kintai',
    name: 'ドヤ勤怠',
    shortName: '勤怠',
    description: 'シンプルで使いやすいクラウド勤怠管理。',
    longDescription: '打刻・勤怠集計・申請承認をオールインワンで。中小企業のための勤怠管理システム。KING OF TIME/ジョブカンに匹敵する機能を、ドヤAIのアカウントで。',
    icon: '⏰',
    color: 'violet',
    gradient: 'from-violet-500 to-purple-600',
    bgGradient: 'from-violet-50 to-purple-50',
    href: '/kintai',
    dashboardHref: '/kintai/dashboard',
    pricingHref: '/kintai/pricing',
    guideHref: '/kintai',
    features: [
      'ワンクリック出退勤打刻',
      '勤怠自動集計（残業・深夜・休日）',
      '打刻修正・休暇申請承認フロー',
      '従業員・部署・就業ルール管理',
      'リアルタイム勤務状況ダッシュボード',
      'かわいいクマキャラクターUI',
    ],
    useCases: [
      'Excelで勤怠を手動管理していて限界',
      '打刻忘れや残業計算ミスが多い',
      '申請・承認がメールで煩雑',
      'KING OF TIMEやジョブカンが高すぎる',
      '少人数チームでもちゃんと勤怠管理したい',
    ],
    pricing: {
      free: {
        name: '無料プラン',
        limit: '従業員5名まで',
        dailyLimit: -1,
        price: 0,
      },
      light: {
        name: 'スタータープラン',
        limit: '従業員30名まで',
        dailyLimit: -1,
        price: 2980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_KINTAI_STARTER_PRICE_ID,
      },
      pro: {
        name: 'プロプラン',
        limit: '従業員100名まで',
        dailyLimit: -1,
        price: 9980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_KINTAI_PRO_PRICE_ID,
      },
      enterprise: {
        name: 'エンタープライズ',
        limit: '無制限',
        dailyLimit: -1,
        price: 49800,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_KINTAI_ENTERPRISE_PRICE_ID,
      },
    },
    status: 'active',
    category: 'other',
    order: 10,
    requiresAuth: true,
    isNew: true,
    badge: 'NEW',
  },

  // ----------------------------------------
  // ドヤリスト（営業リスト生成AI）
  // ----------------------------------------
  {
    id: 'doyalist',
    name: 'ドヤリスト',
    shortName: 'リスト',
    description: 'AIで営業リスト自動生成 + 営業文面ツール。',
    longDescription: '業界・地域・規模を指定するだけでAIが営業ターゲット企業をリストアップ。さらにフォーム営業文・メール文面・荷電スクリプトをワンクリックで生成できる、シンプル＆実用的な営業支援ツール。',
    icon: '📋',
    color: 'purple',
    gradient: 'from-purple-500 to-fuchsia-600',
    bgGradient: 'from-purple-50 to-fuchsia-50',
    href: '/doyalist',
    dashboardHref: '/doyalist',
    pricingHref: '/doyalist/pricing',
    guideHref: '/doyalist',
    features: [
      'AIによる営業リスト自動生成',
      'フォーム営業文の作成ツール',
      '新規開拓メール文面の作成ツール',
      '荷電スクリプトの作成ツール',
      'CSV/Excelエクスポート',
      'シンプルで使いやすいUI',
    ],
    useCases: [
      '新規開拓リストを作るのに毎月時間がかかる',
      'お問い合わせフォーム送信用の営業文を量産したい',
      '新規開拓メールの文面を考えるのが負担',
      '電話営業のスクリプトを毎回考えるのが大変',
    ],
    pricing: {
      free: {
        name: 'おためし',
        limit: '月100社 / 営業文ツール月30回',
        dailyLimit: 100,
        price: 0,
      },
      pro: {
        name: 'プロ',
        limit: '月5,000社 / 営業文ツール月500回',
        dailyLimit: 5000,
        price: 9980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_DOYALIST_PRO_PRICE_ID,
      },
      enterprise: {
        name: 'エンタープライズ',
        limit: '無制限',
        dailyLimit: -1,
        price: 49800,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_DOYALIST_ENTERPRISE_PRICE_ID,
      },
    },
    status: 'active',
    category: 'other',
    order: 11,
    requiresAuth: true,
    isNew: true,
    badge: 'NEW',
  },

  // ----------------------------------------
  // ドヤスライド（全スライド フル画像生成）
  // ----------------------------------------
  {
    id: 'doyaslide',
    name: 'ドヤスライド',
    shortName: 'スライド',
    description: 'AIが全スライドを画像でド派手に生成。',
    longDescription:
      'テーマを入力するだけで、AIが各スライドを1枚絵のビジュアルとして生成。最初にアップしたロゴを最後に重ねて統一感を出し、チャットでその場修正もできる。営業・提案・SNS資料を“映える画像”で作れます。',
    icon: '🖼️',
    color: 'blue',
    gradient: 'from-blue-500 to-indigo-600',
    bgGradient: 'from-blue-50 to-indigo-50',
    href: '/doyaslide',
    dashboardHref: '/doyaslide',
    pricingHref: '/doyaslide/pricing',
    guideHref: '/doyaslide',
    features: [
      '全スライドをAI画像でド派手に生成',
      '資料タイプ別に最適な構成を自動設計',
      'ロゴを重ねて全スライドに統一感',
      'チャットでその場修正（再生成）',
      'PNG / PDF / ZIP で出力',
    ],
    useCases: [
      '映える営業・提案資料を作りたい',
      'SNS用のカルーセル画像を量産したい',
      'デザイナーがいないがプロ品質の資料が欲しい',
      '第一印象で惹きつけるプレゼンにしたい',
    ],
    pricing: {
      free: {
        name: '無料プラン',
        limit: '月3プロジェクト / 20枚まで',
        dailyLimit: -1,
        price: 0,
      },
      pro: {
        name: 'プロプラン',
        limit: '月150枚 / プロジェクト無制限',
        dailyLimit: -1,
        price: 9980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_DOYASLIDE_PRO_PRICE_ID,
      },
    },
    status: 'active',
    category: 'image',
    order: 22,
    requiresAuth: true,
    isNew: true,
    badge: 'NEW',
  },

  // ----------------------------------------
  // ドヤカンニング（リアルタイム回答支援）
  // ----------------------------------------
  {
    id: 'cunning',
    name: 'ドヤカンニング',
    shortName: 'カンニング',
    description: 'Web会議の相手の声を解析し、最適な回答をリアルタイム提示。',
    longDescription:
      'Google Meet / Zoom のタブ音声を取り込み、相手の日本語の質問をリアルタイムで文字起こし。商談なら自社ナレッジ、面接なら応募先企業情報に基づいた回答案（要点＋話すスクリプト）を即座に画面に提示するAIカンペです。',
    icon: '🎧',
    color: 'purple',
    gradient: 'from-[#7f19e6] to-fuchsia-600',
    bgGradient: 'from-purple-50 to-fuchsia-50',
    href: '/cunning',
    dashboardHref: '/cunning',
    pricingHref: '/cunning/pricing',
    guideHref: '/cunning',
    features: [
      'Meet/Zoomのタブ音声をリアルタイム解析',
      '相手の質問を検出して回答案を即時提示',
      '要点（一言）＋話すスクリプト＋根拠を表示',
      '商談モード：自社ナレッジに基づく回答',
      '面接モード：応募先企業に最適化した回答',
    ],
    useCases: [
      '商談で想定外の質問に即答したい',
      '採用面接で企業に刺さる回答を準備したい',
      'カスタマーサクセスの応対品質を標準化したい',
    ],
    pricing: {
      free: {
        name: '無料プラン',
        limit: '合計60分 / ナレッジ1個',
        dailyLimit: -1,
        price: 0,
      },
      pro: {
        name: 'プロプラン',
        limit: '月20時間 / ナレッジ無制限',
        dailyLimit: -1,
        price: 9980,
      },
    },
    status: 'active',
    category: 'other',
    order: 23,
    requiresAuth: true,
    isNew: true,
    badge: 'NEW',
  },

  // ----------------------------------------
  // ドヤプロマネ（案件管理）
  // ----------------------------------------
  {
    id: 'promane',
    name: 'ドヤプロマネ',
    shortName: 'プロマネ',
    description: '案件の進捗・収支・人件費を一元管理。',
    longDescription: 'ガントチャートとカンバンで案件を進捗管理。作業時間記録から人件費を自動計算し、売上・原価・利益をリアルタイム可視化。中小企業/制作会社のための案件管理ツール。',
    icon: '📊',
    color: 'blue',
    gradient: 'from-blue-500 to-violet-600',
    bgGradient: 'from-blue-50 to-violet-50',
    href: '/promane',
    dashboardHref: '/promane',
    pricingHref: '/promane',
    guideHref: '/promane',
    features: [
      'ガントチャートで進捗ひと目',
      'カンバンでタスク管理',
      '時間記録→人件費自動算出',
      '売上・原価・利益のリアルタイム可視化',
      'クライアント/メンバー/招待管理',
      'レポートグラフ（Recharts）',
    ],
    useCases: [
      '複数案件の進捗を一元管理したい',
      '案件ごとの利益率を把握したい',
      'メンバーの工数を見える化したい',
      '顧客ごとの売上を集計したい',
      'Excel管理から脱却したい',
    ],
    pricing: {
      free: {
        name: '無料プラン',
        limit: '3案件まで',
        dailyLimit: -1,
        price: 0,
      },
      pro: {
        name: 'プロ',
        limit: '無制限',
        dailyLimit: -1,
        price: 4980,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PROMANE_PRO_PRICE_ID,
      },
      enterprise: {
        name: 'エンタープライズ',
        limit: '無制限+SSO',
        dailyLimit: -1,
        price: 19800,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PROMANE_ENTERPRISE_PRICE_ID,
      },
    },
    status: 'active',
    category: 'other',
    order: 12,
    requiresAuth: true,
    isNew: true,
    badge: 'NEW',
  },

  // ----------------------------------------
  // ドヤ営業管理（SFA）
  // ----------------------------------------
  {
    id: 'sfa',
    name: 'ドヤ営業管理',
    shortName: '営業管理',
    description: '取引先・商談・タスクを一元管理。シンプルで安いかんたんSFA。',
    longDescription:
      '取引先／商談パイプライン（カンバン）／タスク／売上ダッシュボードを、設定不要・即日で。チーム招待・権限管理、CSV出力にも対応。個人情報は最小限しか持たない軽量設計。Salesforceは重すぎる中小チーム向けの、シンプルで安いSFAです。',
    icon: '📈',
    color: 'green',
    gradient: 'from-green-500 to-lime-600',
    bgGradient: 'from-green-50 to-lime-50',
    href: '/sfa',
    dashboardHref: '/sfa',
    pricingHref: '/sfa/pricing',
    guideHref: '/sfa',
    features: [
      '商談パイプラインをカンバンで管理',
      '取引先を一元管理・CSV出力',
      'タスク管理と売上ダッシュボード',
      'チーム招待・権限管理',
      '個人情報は最小限のシンプル設計',
    ],
    useCases: [
      'Excel管理から卒業したい営業チーム',
      'Salesforceは重すぎる中小企業',
      'まずはシンプルに商談を見える化したい',
    ],
    pricing: {
      free: { name: '無料プラン', limit: '3名 / 取引先・商談 各50件', dailyLimit: -1, price: 0 },
      pro: {
        name: 'プロプラン',
        limit: '50名 / 無制限',
        dailyLimit: -1,
        price: 9980,
      },
    },
    status: 'active',
    category: 'other',
    order: 24,
    requiresAuth: true,
    isNew: true,
    badge: 'NEW',
  },

  // ----------------------------------------
  // ドヤ商談準備（Shodan）
  // ----------------------------------------
  {
    id: 'shodan',
    name: 'ドヤ商談準備',
    shortName: '商談準備',
    description: '商談先のURLを入れるだけ。リサーチ〜課題仮説〜提案資料まで一括生成。',
    longDescription:
      '商談先企業のURLを入力するだけで、実従業員数・マーケ実施状況・オウンドメディアの規模・記事の更新頻度まで深掘り調査。現状分析（はっきりめ）から課題仮説・解決策、そして提案資料（Markdown）までAIが一括で作成します。自社情報を登録しておけば、自社の商材・強みに最適化された提案に。チーム招待・組織スコープで情報は安全に分離。',
    icon: '🎯',
    color: 'purple',
    gradient: 'from-purple-600 to-fuchsia-600',
    bgGradient: 'from-purple-50 to-fuchsia-50',
    href: '/shodan',
    dashboardHref: '/shodan',
    pricingHref: '/shodan/pricing',
    guideHref: '/shodan',
    features: [
      '企業URLだけで商談準備が完結',
      '実従業員数・マーケ・オウンドメディアを深掘り調査',
      '現状分析・課題仮説・解決策をAIが立案',
      '提案資料（Markdown）まで一括生成',
      '自社情報を登録して提案を最適化',
      'チーム招待・組織スコープで安全に共有',
    ],
    useCases: [
      'アポ前の企業リサーチに時間がかかっている',
      '提案資料づくりを毎回ゼロから作っている',
      'チームで商談準備の型を揃えたい',
    ],
    pricing: {
      free: { name: '無料プラン', limit: '月5件まで', dailyLimit: -1, price: 0 },
      pro: { name: 'プロプラン', limit: '無制限 / チーム招待', dailyLimit: -1, price: 9980 },
    },
    status: 'active',
    category: 'other',
    order: 25,
    requiresAuth: true,
    isNew: true,
    badge: 'NEW',
  },

  // ----------------------------------------
  // ドヤ広告バナーAI（AdBanner）
  // ----------------------------------------
  {
    id: 'adbanner',
    name: 'ドヤ広告バナーAI',
    shortName: '広告バナー',
    description: '広告に特化したバナーを量産し、AIフィードバックで改善し続ける運用型クリエイティブ。',
    longDescription:
      'サービスURLやブランドカラー・ロゴを反映して、媒体別の広告バナーを一括量産。各バナーをAIが「視認性／訴求／CTA／媒体適合／ブランド整合」で自動採点し、提案を1クリックで反映して再生成。キャンペーン単位で作り続け、成果の出るクリエイティブを継続供給します。',
    icon: '📣',
    color: 'purple',
    gradient: 'from-purple-500 to-orange-500',
    bgGradient: 'from-purple-50 to-orange-50',
    href: '/adbanner',
    dashboardHref: '/adbanner/dashboard',
    pricingHref: '/adbanner/pricing',
    guideHref: '/adbanner',
    features: [
      'URL・ブランドから広告バナーを一括量産',
      '媒体別サイズ（Meta/Google/LINE/X 等）',
      'AIが視認性・訴求・CTAを自動採点',
      '改善提案を反映してワンクリック再生成',
      'ロゴは原寸で正確に合成（AIに描かせない）',
      'キャンペーン単位で作り続けて改善',
    ],
    useCases: [
      '広告バナーを大量に回す運用担当・マーケター',
      'デザイナーに頼まず自分で量産したい中小企業',
      'クライアント別にキャンペーン管理したい代理店',
    ],
    pricing: {
      free: { name: '無料プラン', limit: 'ゲスト3枚/日・無料9枚/日', dailyLimit: 9, price: 0 },
      pro: { name: 'プロプラン', limit: '60枚/日・全サイズ・改善', dailyLimit: 60, price: 9980 },
    },
    status: 'active',
    category: 'image',
    order: 26,
    requiresAuth: false,
    isNew: true,
    badge: 'NEW',
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
export function getDailyLimit(serviceId: string, plan: 'free' | 'light' | 'pro'): number {
  const service = getServiceById(serviceId)
  if (!service) return 0
  const pricing = service.pricing[plan]
  if (!pricing) return service.pricing.free.dailyLimit
  return pricing.dailyLimit
}

// 料金を取得（月額）
export function getMonthlyPrice(serviceId: string, plan: 'free' | 'light' | 'pro'): number {
  const service = getServiceById(serviceId)
  if (!service) return 0
  const pricing = service.pricing[plan]
  if (!pricing) return 0
  return pricing.price
}
