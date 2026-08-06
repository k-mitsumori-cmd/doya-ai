// ============================================
// SEO設定
// ============================================

import type { Metadata } from 'next'
import { SEO_PRICING, BANNER_PRICING, KANTAN_PRICING, PERSONA_PRICING } from './pricing'
import { getServiceById } from './services'

export const SITE_CONFIG = {
  name: 'ドヤマーケAI',
  tagline: 'ドヤマーケAIのサービス群',
  description: 'ドヤマーケAIは、記事生成、広告バナー、営業リスト、人事、勤怠、SFA、資料作成などをキャラクターと一緒に試せるAI SaaSサービス群です。SaaSは死にましぇん、ドヤマーケ、株式会社スリスタ、三森 捷暉の運営文脈から生まれています。',
  // 末尾スラッシュは定義時に一度だけ除去（url を使う全箇所＝org url / service url / OG url の二重スラッシュを防ぐ）
  // 既定は本番ドメイン（NEXT_PUBLIC_APP_URL 未設定でも canonical/OG が vercel.app に化けないように）
  url: (process.env.NEXT_PUBLIC_APP_URL || 'https://doya-ai.surisuta.jp').replace(/\/+$/, ''),
  locale: 'ja_JP',
  twitter: '@doyamarke',
  // OGP画像のベースURL
  ogImageBase: '/og',
}

// サイト名の表記ゆれ（指名検索の受け皿）。
// 検索されうる別表記を構造化データの alternateName で明示し、
// 「ドヤAI」「doya ai」等でもこのサイトが同一エンティティとして認識されるようにする。
export const SITE_ALTERNATE_NAMES = [
  'ドヤAI',
  'ドヤ マーケAI',
  'ドヤマーケ AI',
  'Doya Marke AI',
  'DoyaMarke AI',
  'Doya AI',
  'DoyaAI',
]

// ============================================
// サービス名の表記ゆれ（指名検索対策）
// ============================================
// 正本の name（services.ts）は変えずに、検索で使われうる別表記だけをここで補う。
// - 構造化データ SoftwareApplication.alternateName に出力
// - LPメタデータの keywords 先頭に自動付与
// 追加する際は「実際に検索窓に打たれうる形」だけにする（無関係な語を足さない）。
export const SERVICE_ALIASES: Record<string, string[]> = {
  kantan: ['カンタンマーケAI', 'かんたんマーケAI', 'Kantan Marke AI'],
  banner: ['ドヤバナー', 'ドヤバナー AI', 'ドヤ バナーAI', 'Doya Banner AI', 'doya banner ai'],
  logo: ['ドヤロゴAI', 'ドヤ ロゴ', 'Doya Logo'],
  seo: ['ドヤライティングAI', 'ドヤ記事作成AI', 'ドヤSEO', 'ドヤ記事', 'Doya Writing AI'],
  interview: ['ドヤインタビューAI', 'ドヤ インタビュー', 'Doya Interview AI'],
  shindan: ['ドヤ診断AI', 'ドヤWeb診断', 'Doya Web Shindan'],
  persona: ['ドヤペルソナ', 'ドヤ ペルソナAI', 'Doya Persona AI'],
  lp: ['ドヤワイヤーフレームAI', 'ドヤワイヤーフレーム', 'ドヤLP', 'Doya Wireframe AI'],
  tenkai: ['ドヤ展開', 'ドヤてんかいAI', 'Doya Tenkai AI'],
  copy: ['ドヤコピー', 'ドヤ コピーAI', 'Doya Copy AI'],
  opening: ['ドヤオープニング', 'ドヤOP AI', 'Doya Opening AI'],
  voice: ['ドヤボイス', 'ドヤ ボイスAI', 'Doya Voice AI'],
  interviewx: ['ドヤヒヤリング', 'ドヤヒアリングAI', 'ドヤ ヒヤリングAI', 'Doya Hearing AI'],
  movie: ['ドヤムービー', 'ドヤ動画AI', 'Doya Movie AI'],
  adsim: ['ドヤ広告シミュAI', 'ドヤ広告シミュレーション', 'Doya Ad Simulation AI'],
  hr: ['ドヤHR AI', 'ドヤエイチアール', 'ドヤ人事', 'Doya HR'],
  kintai: ['ドヤ勤怠AI', 'ドヤきんたい', 'ドヤ勤怠管理', 'Doya Kintai'],
  doyalist: ['ドヤリストAI', 'ドヤ リスト', 'Doya List'],
  doyaslide: ['ドヤスライドAI', 'ドヤ スライド', 'ドヤスラ', 'Doya Slide'],
  cunning: ['ドヤカンニングAI', 'ドヤ カンニング', 'Doya Cunning'],
  promane: ['ドヤプロマネAI', 'ドヤ プロマネ', 'ドヤプロジェクト管理', 'Doya Promane'],
  sfa: ['ドヤ営業管理AI', 'ドヤSFA', 'ドヤ営業', 'Doya SFA'],
  shodan: ['ドヤ商談準備AI', 'ドヤ商談', 'Doya Shodan'],
  aio: ['ドヤAIO AI', 'ドヤ エーアイオー', 'ドヤAEO', 'Doya AIO'],
  adbanner: ['ドヤ広告バナー', 'ドヤ広告バナーエーアイ', 'Doya Ad Banner AI'],
}

export function getServiceAliases(serviceId: string): string[] {
  return SERVICE_ALIASES[serviceId] || []
}

function withoutTrailingSlash(url: string) {
  return url.replace(/\/+$/, '')
}

// 各サービスのSEO設定
export const SERVICE_SEO = {
  // ポータル
  portal: {
    title: 'ドヤマーケAI | AI SaaSサービス群',
    description: 'ドヤマーケAIは、記事生成、広告バナー、営業リスト、人事、勤怠、SFA、資料作成などを束ねたAI SaaSサービス群です。SaaSは死にましぇん、ドヤマーケ、株式会社スリスタ、三森 捷暉が運営しています。',
    keywords: ['ドヤマーケAI', 'ドヤマーケ', 'SaaSは死にましぇん', '株式会社スリスタ', '三森捷暉', 'AI SaaS', '記事生成', 'バナー作成', '営業支援', '人事AI', '勤怠管理', 'SFA'],
    ogImage: '/og/portal.png',
  },
  
  // ドヤ広告バナーAI（広告バナーを量産して改善）
  adbanner: {
    title: 'ドヤ広告バナーAI | 広告バナーを量産して改善',
    description:
      'サービスURLやブランドカラー・ロゴから、媒体別の広告バナーを一括量産。AIが視認性・訴求・CTA・媒体適合・ブランド整合を自動採点し、改善提案を反映してワンクリック再生成できます。',
    keywords: ['広告バナー', 'バナー作成', '広告クリエイティブ', 'Meta広告', 'Google広告', 'LINE広告', 'AI バナー', '量産'],
    ogImage: '/og/portal.png',
  },

  // ドヤ商談準備（商談先URLだけで提案準備を一括生成）
  shodan: {
    title: 'ドヤ商談準備 | 商談先のURLだけで提案準備を一括生成',
    description:
      '商談先企業のURLを入れるだけで、実従業員数・マーケ状況・オウンドメディア・PR TIMESの最新動向まで深掘り調査。現状分析・課題仮説・解決策から提案資料・スライドまでAIが一括作成します。',
    keywords: ['商談準備', '営業AI', '提案資料作成', '企業調査', '商談', 'BtoB営業', '提案スライド', 'PR TIMES'],
    ogImage: '/og/portal.png',
  },

  // カンタンマーケAI（マーケティング業務AIエージェント）
  kantan: {
    title: 'カンタンマーケAI | マーケティング業務をAIで劇的効率化',
    description:
      'LP構成案、バナーコピー、広告文、メルマガ、競合分析…マーケ業務を丸ごとAIエージェントがサポート。チャット形式で誰でもプロ品質のアウトプット。',
    keywords: ['マーケティングAI', 'LP構成案', 'バナーコピー', '広告文作成', 'メルマガ', '競合分析', 'AIエージェント', 'マーケティング自動化'],
    ogImage: '/og/portal.png',
    sections: {
      dashboard: {
        title: 'ダッシュボード | カンタンマーケAI',
        description: 'チャット形式でマーケティング業務を効率化。15種類のAIエージェントが対応。',
      },
      pricing: {
        title: '料金プラン | カンタンマーケAI',
        description: `無料プランはゲスト1日${KANTAN_PRICING.guestLimit}回、ログイン後1日${KANTAN_PRICING.freeLimit}回まで。プロプランは1日${KANTAN_PRICING.proLimit}回まで。`,
      },
      guide: {
        title: '使い方 | カンタンマーケAI',
        description: 'AIエージェントの選び方、プロンプトのコツ、マーケ業務効率化のポイントを解説します。',
      },
    },
  },
  
  // ドヤライティングAI（旧: ドヤSEO）
  seo: {
    title: 'ドヤライティングAI | SEO + LLMOに強い長文記事を安定生成',
    description: 'アウトライン→分割生成→整合性チェック→統合のパイプラインで、長文でも崩れにくい記事生成を目指します。',
    keywords: ['SEO', '記事生成', 'アウトライン', 'LLMO', 'コンテンツマーケ', '生成AI'],
    ogImage: '/og/seo.png',
    sections: {
      dashboard: {
        title: 'ダッシュボード | ドヤライティングAI',
        description: '記事一覧・進捗を確認し、生成中のジョブにすぐ戻れます。',
      },
      pricing: {
        title: '料金プラン | ドヤライティングAI',
        description: `無料プランはゲスト1日${SEO_PRICING.guestLimit}回、ログイン後1日${SEO_PRICING.freeLimit}回まで。プロプランは1日${SEO_PRICING.proLimit}回まで。月額${SEO_PRICING.plans[1].priceLabel}。`,
      },
      guide: {
        title: '使い方 | ドヤライティングAI',
        description: 'ドヤライティングAIの使い方を解説。キーワード設計、アウトライン、生成のコツなど。',
      },
    },
  },
  
  // ドヤバナーAI
  banner: {
    title: 'ドヤバナーAI - プロ品質バナーを自動生成',
    description: '「1分待って選ぶだけ」プロ品質バナーを数クリックで自動生成。用途・業種・キャッチコピーを入力するだけ。ドヤバナーAIが、広告・SNS・LPで使えるプロ品質バナーを自動生成します。A/B/C 3パターン同時生成。',
    keywords: ['AIバナー生成', 'バナー自動生成', 'プロ品質バナー', '広告バナー', 'ABテスト', 'デザイン自動化', 'Facebook広告', 'Instagram広告', 'SNS広告', 'LP'],
    // LPと同じOGP画像を使用
    ogImage: 'https://doyamarke.surisuta.jp/tool/doya_banner_ai/ogp.png',
    sections: {
      dashboard: {
        title: 'バナー生成 | ドヤバナーAI',
        description: 'カテゴリを選んでキーワードを入力するだけ。AIがA/B/Cの3案を自動生成。',
      },
      history: {
        title: '生成履歴 | ドヤバナーAI',
        description: '過去に生成したバナーの一覧。ダウンロード、再編集が可能。',
      },
      brand: {
        title: 'ブランド設定 | ドヤバナーAI',
        description: 'ロゴ、カラー、フォントを設定してブランドイメージに合ったバナーを生成。',
      },
      pricing: {
        title: '料金プラン | ドヤバナーAI',
        description: `無料プランはゲスト月${BANNER_PRICING.guestLimit}枚、ログイン後月${BANNER_PRICING.freeLimit}枚まで。プロプランは月${BANNER_PRICING.proLimit}枚まで生成可能。月額${BANNER_PRICING.plans[1].priceLabel}。`,
      },
      guide: {
        title: '使い方ガイド | ドヤバナーAI',
        description: 'ドヤバナーAIの使い方を詳しく解説。カテゴリの選び方、キーワードのコツなど。',
      },
    },
  },
  
  // ドヤペルソナAI
  persona: {
    title: 'ドヤペルソナAI | URLからマーケティングペルソナを自動生成',
    description: 'URLを入れるだけでターゲットペルソナを自動生成。履歴書・日記・スケジュール・深掘りインタビュー・導入ストーリーまで一括作成。',
    keywords: ['ペルソナ生成', 'マーケティングペルソナ', 'ターゲット分析', 'AI', 'カスタマージャーニー', '顧客分析', 'ペルソナ設計'],
    ogImage: '/persona/opengraph-image',
    sections: {
      history: {
        title: '生成履歴 | ドヤペルソナAI',
        description: '過去に生成したペルソナの一覧。再表示・編集が可能。',
      },
    },
  },

  // ドヤオープニングAI
  opening: {
    title: 'ドヤオープニングAI | URLからReactオープニングアニメーションを自動生成',
    description: 'URLを入れるだけで、サイトに最適化されたReactオープニングアニメーションを6種類自動生成。カラー・ロゴ・テキスト自動抽出。プレビュー→微調整→コードエクスポートまで一気通貫。',
    keywords: ['オープニングアニメーション', 'React', 'framer-motion', 'Webアニメーション', '自動生成', 'AI', 'モーション'],
    ogImage: '/og/portal.png',
    sections: {
      dashboard: {
        title: 'ダッシュボード | ドヤオープニングAI',
        description: '生成済みプロジェクトの一覧。プレビュー・編集・エクスポートが可能。',
      },
      pricing: {
        title: '料金プラン | ドヤオープニングAI',
        description: '無料プランは1日3回まで（3テンプレート）。プロプランは1日30回、全6テンプレート利用可能。月額¥2,980。',
      },
      guide: {
        title: '使い方ガイド | ドヤオープニングAI',
        description: 'ドヤオープニングAIの使い方を解説。URL入力→テンプレート選択→微調整→エクスポートの流れ。',
      },
    },
  },

  // ドヤコピーAI
  copy: {
    title: 'ドヤコピーAI | AIが刺さるコピーを自動生成',
    description: 'ターゲットと訴求軸を入力するだけで、プロ品質の広告コピー・キャッチコピーを一括生成。ペルソナ分析・ブランドボイス対応。',
    keywords: ['コピーライティング', 'AIコピー', 'キャッチコピー', '広告文', 'コピー生成', '自動生成'],
    ogImage: '/og/portal.png',
  },

  // ドヤボイスAI
  voice: {
    title: 'ドヤボイスAI | AI音声ナレーションを自動生成',
    description: 'テキストを入力するだけで自然なAIナレーションを生成。SSML対応、複数話者、バッチ処理に対応。',
    keywords: ['AI音声', 'テキスト読み上げ', 'TTS', 'ナレーション', '音声合成', '自動生成'],
    ogImage: '/og/portal.png',
  },

  // ドヤムービーAI
  movie: {
    title: 'ドヤムービーAI | AIで動画を自動生成',
    description: '商品情報を入力するだけで、プロ品質のプロモーション動画を自動生成。シーン構成・テロップ・BGM・ナレーション対応。',
    keywords: ['AI動画生成', '動画自動生成', 'プロモーション動画', 'Remotion', '動画制作', '自動化'],
    ogImage: '/og/portal.png',
  },

  // 管理画面
  admin: {
    title: '管理画面 | ドヤマーケAI',
    description: 'ドヤマーケAIの管理画面。ユーザー管理、統計、設定などを一元管理。',
    ogImage: '/og/portal.png',
  },
  
  // ドヤワイヤーフレーム AI
  lp: {
    title: 'ドヤワイヤーフレーム AI | ワイヤーフレームをAIで自動生成',
    description: 'URLを入力するだけで、LPの構成案・コピー・デザインをAIが自動生成。8種類のテーマから選んでHTMLエクスポート。',
    keywords: ['LP作成', 'ランディングページ', 'AI', '自動生成', 'Webデザイン'],
    ogImage: '/og/portal.png',
  },

  // 認証
  auth: {
    signin: {
      title: 'ログイン | ドヤマーケAI',
      description: 'Googleアカウントでログインして、すべてのドヤマーケAIサービスをご利用ください。',
    },
  },
}

// 構造化データ（JSON-LD）
export function generateOrganizationSchema() {
  const baseUrl = withoutTrailingSlash(SITE_CONFIG.url)

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'ドヤマーケAI',
    alternateName: SITE_ALTERNATE_NAMES,
    url: SITE_CONFIG.url,
    logo: `${baseUrl}/logo.png`,
    description: SITE_CONFIG.description,
    parentOrganization: {
      '@type': 'Organization',
      name: '株式会社スリスタ',
      url: 'https://surisuta.jp/',
    },
    sameAs: [
      `https://twitter.com/${SITE_CONFIG.twitter.replace('@', '')}`,
      'https://surisuta.jp/',
      'https://doyamarke.surisuta.jp/',
    ],
  }
}

// WebSite スキーマ（サイト名の確定用）
// Google はサイト名（検索結果に表示されるサイト名）を WebSite.name から取る。
// alternateName に表記ゆれを並べ、指名検索でこのサイトに紐づくようにする。
export function generateWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_CONFIG.name,
    alternateName: SITE_ALTERNATE_NAMES,
    url: `${withoutTrailingSlash(SITE_CONFIG.url)}/`,
    description: SITE_CONFIG.description,
    inLanguage: 'ja',
    publisher: {
      '@type': 'Organization',
      name: '株式会社スリスタ',
      url: 'https://surisuta.jp/',
    },
  }
}

export function generateSoftwareApplicationSchema(service: 'seo' | 'banner' | 'kantan') {
  const seo = SERVICE_SEO[service]
  const pricing = service === 'seo' ? SEO_PRICING : service === 'banner' ? BANNER_PRICING : KANTAN_PRICING
  
  const serviceData = {
    seo: {
      name: 'ドヤライティングAI',
      applicationCategory: 'BusinessApplication',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'JPY',
        description: `無料プラン（ゲスト1日${pricing.guestLimit}回まで）`,
      },
    },
    banner: {
      name: 'ドヤバナーAI',
      applicationCategory: 'DesignApplication',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'JPY',
        description: `無料プラン（ゲスト1日${pricing.guestLimit}回まで）`,
      },
    },
    kantan: {
      name: 'カンタンマーケAI',
      applicationCategory: 'BusinessApplication',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'JPY',
        description: `無料プラン（ゲスト1日${pricing.guestLimit}回まで）`,
      },
    },
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    ...serviceData[service],
    operatingSystem: 'Web',
    url: `${SITE_CONFIG.url}/${service}`,
    description: seo.description,
  }
}

// 汎用ツールLP用 SoftwareApplication スキーマ生成
// 全ツールLPの JSON-LD はこれを使う（generateSoftwareApplicationSchema は旧3サービス専用）
export function generateToolSchema(opts: {
  path: string
  name: string
  description: string
  category?: 'BusinessApplication' | 'DesignApplication' | 'MultimediaApplication'
  /** services.ts の id。渡すと表記ゆれが alternateName に載る */
  serviceId?: string
}) {
  const aliases = opts.serviceId ? getServiceAliases(opts.serviceId) : []
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: opts.name,
    ...(aliases.length ? { alternateName: aliases } : {}),
    applicationCategory: opts.category || 'BusinessApplication',
    operatingSystem: 'Web',
    url: `${SITE_CONFIG.url}${opts.path}`,
    description: opts.description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'JPY',
      description: '無料プランあり。プロプラン（月額9,980円）で全ツールが利用可能',
    },
    publisher: {
      '@type': 'Organization',
      name: '株式会社スリスタ',
      url: SITE_CONFIG.url,
    },
  }
}

// OGP画像URL生成
export function getOgImageUrl(path?: string): string {
  if (path) {
    return `${SITE_CONFIG.url}${path}`
  }
  return `${SITE_CONFIG.url}/og/portal.png`
}

// ページタイトル生成
export function generatePageTitle(title: string, suffix = true): string {
  if (suffix) {
    return `${title} | ${SITE_CONFIG.name}`
  }
  return title
}

// ============================================
// サービスLP用メタデータ・ファクトリ（正本 = services.ts）
// 各サービス layout.tsx の手書き metadata をこれ1本に置換する。
// canonical は必ず自ページの href（相対 → metadataBase で解決）を指し、
// root layout の '/' 継承バグ（別ページのcanonicalがトップに吸われる）を解消する。
// ============================================
export function buildServiceMetadata(
  serviceId: string,
  opts?: {
    /** タイトルの説明部（既定は service.description の要約）。root templateで ` | ドヤマーケAI` が付く */
    tagline?: string
    keywords?: string[]
    /** OG画像パス（既定は動的OGルート /og/{id}） */
    ogPath?: string
    /** LP以外のサブページに使う場合の canonical パス上書き（例: '/seo/pricing'） */
    canonicalPath?: string
    /** タイトル全体の上書き（サブページ用。指定時は `${name}｜${tagline}` を使わない） */
    titleOverride?: string
    /** ログイン後のアプリ画面など、検索結果に出したくないページ */
    noindex?: boolean
  }
): Metadata {
  const svc = getServiceById(serviceId)
  if (!svc) {
    // 未知IDでも壊れないフォールバック
    return { alternates: { canonical: `/${serviceId}` } }
  }
  const tagline = opts?.tagline || svc.description
  // 見出し部（OG/Twitter用。サイト名は付けない）
  const headline = opts?.titleOverride || `${svc.name}｜${tagline}`
  // <title> は absolute で確定させる。
  // ルートlayoutの title.template は「親がtitleを持つ入れ子」では下層まで届かず、
  // /banner はサイト名が付くのに /banner/pricing は付かない、という不揃いが起きるため。
  const title = { absolute: `${headline} | ${SITE_CONFIG.name}` }
  const description = svc.longDescription || svc.description
  const canonical = opts?.canonicalPath || svc.href
  const ogImage = `${SITE_CONFIG.url}${opts?.ogPath || `/og/${svc.id}`}`
  // 指名検索の受け皿として、サービス名と表記ゆれを keywords の先頭に必ず置く
  const keywords = Array.from(
    new Set([svc.name, ...getServiceAliases(svc.id), ...(opts?.keywords || [])])
  )

  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    ...(opts?.noindex
      ? { robots: { index: false, follow: true, googleBot: { index: false, follow: true } } }
      : {}),
    openGraph: {
      type: 'website',
      locale: SITE_CONFIG.locale,
      url: `${SITE_CONFIG.url}${canonical}`,
      siteName: SITE_CONFIG.name,
      title: headline,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${svc.name} - ${SITE_CONFIG.name}` }],
    },
    twitter: {
      card: 'summary_large_image',
      site: SITE_CONFIG.twitter,
      creator: SITE_CONFIG.twitter,
      title: headline,
      description,
      images: [ogImage],
    },
  }
}

// ============================================
// サービス配下サブページ用メタデータ・ファクトリ
// ============================================
// 料金/ガイド/アプリ画面が親LPと同じ <title> を継承すると、
// 指名検索（例:「ドヤバナーAI」）でLPではなく設定画面が選ばれてしまう。
// サブページごとに固有の title と canonical を与えて受け皿をLPに寄せる。
export type ServiceSubPageKind = 'pricing' | 'guide' | 'app'

const SUB_PAGE_LABEL: Record<ServiceSubPageKind, string> = {
  pricing: '料金プラン',
  guide: '使い方ガイド',
  app: 'マイページ',
}

export function buildServiceSubMetadata(
  serviceId: string,
  kind: ServiceSubPageKind,
  opts?: {
    /** canonical パス（既定は services.ts の pricingHref / guideHref） */
    path?: string
    /** 説明文の上書き */
    description?: string
    /** ラベルの上書き（例: '導入事例'） */
    label?: string
  }
): Metadata {
  const svc = getServiceById(serviceId)
  if (!svc) return { alternates: { canonical: `/${serviceId}` } }

  const label = opts?.label || SUB_PAGE_LABEL[kind]
  const path = opts?.path || (kind === 'pricing' ? svc.pricingHref : kind === 'guide' ? svc.guideHref : svc.dashboardHref)

  const description =
    opts?.description ||
    (kind === 'pricing'
      ? `${svc.name}の料金プラン。無料プランで試せて、プロプラン（月額9,980円）ならドヤマーケAIの全ツールが使い放題です。`
      : kind === 'guide'
        ? `${svc.name}の使い方ガイド。基本の流れとコツを解説します。`
        : `${svc.name}の管理画面です。`)

  // アプリ画面はログイン前提のため検索結果から外す（リンク評価は流す）
  if (kind === 'app') {
    return {
      title: { absolute: `${label}｜${svc.name} | ${SITE_CONFIG.name}` },
      description,
      robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
    }
  }

  return buildServiceMetadata(serviceId, {
    titleOverride: `${label}｜${svc.name}`,
    canonicalPath: path,
    keywords: [`${svc.name} ${label}`, `${svc.name} 料金`, `${svc.name} 使い方`],
  })
}
