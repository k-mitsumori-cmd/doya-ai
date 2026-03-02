// ============================================
// SEO設定
// ============================================

import { SEO_PRICING, BANNER_PRICING, KANTAN_PRICING, PERSONA_PRICING } from './pricing'

export const SITE_CONFIG = {
  name: 'ドヤAI',
  tagline: 'ビジネスを加速するAIツール群',
  description: 'SEO記事生成、バナー作成、LP制作など、ビジネスに必要なAIツールを1つのアカウントで利用可能。ドヤライティングAI、ドヤバナーAIなど続々追加中。',
  url: process.env.NEXT_PUBLIC_APP_URL || 'https://doya-ai.vercel.app',
  locale: 'ja_JP',
  twitter: '@doya_ai',
  // OGP画像のベースURL
  ogImageBase: '/og',
}

// 各サービスのSEO設定
export const SERVICE_SEO = {
  // ポータル
  portal: {
    title: 'ドヤAIポータル | ビジネスを加速するAIツール群',
    description: 'SEO記事生成、バナー作成、LP制作など、ビジネスに必要なAIツールを1つのアカウントで利用可能。ドヤライティングAI、ドヤバナーAIなど続々追加中。',
    keywords: ['AI', 'ビジネスツール', '文章生成', 'バナー作成', 'LP作成', '自動化'],
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
    title: '管理画面 | ドヤAIポータル',
    description: 'ドヤAIポータルの管理画面。ユーザー管理、統計、設定などを一元管理。',
    ogImage: '/og/portal.png',
  },
  
  // ドヤLP AI
  lp: {
    title: 'ドヤLP AI | LPランディングページをAIで自動生成',
    description: 'URLを入力するだけで、LPの構成案・コピー・デザインをAIが自動生成。8種類のテーマから選んでHTMLエクスポート。',
    keywords: ['LP作成', 'ランディングページ', 'AI', '自動生成', 'Webデザイン'],
    ogImage: '/og/portal.png',
  },

  // 認証
  auth: {
    signin: {
      title: 'ログイン | ドヤAIポータル',
      description: 'Googleアカウントでログインして、すべてのドヤAIサービスをご利用ください。',
    },
  },
}

// 構造化データ（JSON-LD）
export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'ドヤAI',
    url: SITE_CONFIG.url,
    logo: `${SITE_CONFIG.url}/logo.png`,
    description: SITE_CONFIG.description,
    sameAs: [
      `https://twitter.com/${SITE_CONFIG.twitter.replace('@', '')}`,
    ],
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
