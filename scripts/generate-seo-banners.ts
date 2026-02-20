/**
 * SEO記事テンプレート用バナー生成＆DB保存スクリプト
 *
 * 使い方:
 * cd 09_Cursol && set -a && source .env.local && set +a && npx tsx scripts/generate-seo-banners.ts
 */
import { PrismaClient } from '@prisma/client'
import sharp from 'sharp'

const prisma = new PrismaClient()

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// 生成対象テンプレート（design-library.jp風スタイリッシュデザイン）
const TEMPLATES = [
  // --- 入門・解説 ---
  {
    id: 'guide-1',
    title: 'ChatGPTの使い方\n完全ガイド',
    subtitle: '初心者でも5分で始められる',
    bgStyle: 'ダークネイビー〜ブラックのグラデーション背景',
    accentColor: '#818CF8（ラベンダー/バイオレット）',
    visualConcept: 'ミニマルなAIチャットUI画面のモックアップ（右寄り配置、半透明、奥行き感）。吹き出しアイコン、ニューラルネットワークの微細なライン装飾が背景にうっすら',
    layoutHint: 'テキスト左寄せ、右側にビジュアル。余白を大きくとり、洗練された"メディア記事"のアイキャッチ感',
  },
  {
    id: 'guide-2',
    title: '副業の始め方',
    subtitle: '月5万円ロードマップ',
    bgStyle: 'ウォームグレー〜ベージュの上品なグラデーション背景',
    accentColor: '#F59E0B（ゴールド/アンバー）',
    visualConcept: 'ノートPC＋コーヒーカップの俯瞰風景がうっすら透けた背景（低彩度）。右上の上昇グラフアイコン（シンプルな線画）',
    layoutHint: 'テキスト中央寄せ。ゴールドのアクセントラインで区切り。ナチュラル＆信頼感のある雰囲気',
  },
  {
    id: 'guide-3',
    title: 'マーケティングとは？',
    subtitle: '基礎から実践まで',
    bgStyle: '白〜ライトグレーのクリーンな背景',
    accentColor: '#2563EB（ロイヤルブルー）',
    visualConcept: '幾何学的なファネル図形やグラフのアイコンが右寄りにフロート配置（フラットデザイン、低彩度のブルー系）。アナリティクスダッシュボードの断片が装飾的に',
    layoutHint: 'テキスト左寄せ、大きな余白。白背景にブルーのアクセント。清潔感＋知的なメディアバナー感',
  },
  {
    id: 'guide-4',
    title: 'DX推進の進め方',
    subtitle: '成功する7ステップ',
    bgStyle: 'ディープブルー〜インディゴのグラデーション背景',
    accentColor: '#38BDF8（スカイブルー）＋#F472B6（ピンク）',
    visualConcept: 'デジタルトランスフォーメーションを象徴するシンプルなアイコン群（歯車→クラウド→グラフ）が横に並ぶ。幾何学パターンの微細な装飾',
    layoutHint: 'テキスト中央〜左。「7」の数字を大きくアクセント表示。未来感＋プロフェッショナルな雰囲気',
  },

  // --- 比較 ---
  {
    id: 'compare-1',
    title: 'プロジェクト管理ツール\n10選比較',
    subtitle: 'チーム規模別おすすめ',
    bgStyle: 'アンバー〜オレンジのウォームグラデーション背景',
    accentColor: '#F59E0B（アンバー/ゴールド）',
    visualConcept: '3つのツールアイコンが並列に並ぶ比較レイアウト風。チェックマーク、星、比較表の抽象モチーフ',
    layoutHint: 'テキスト左寄せ、右に比較アイコン。「10選」の数字を大きくアクセント。信頼感＋比較記事感',
  },
  {
    id: 'compare-2',
    title: 'AIライティングツール\n比較',
    subtitle: 'ChatGPT vs Claude vs Gemini',
    bgStyle: 'ダークグレー〜チャコールのモダン背景',
    accentColor: '#8B5CF6（パープル）',
    visualConcept: '3つのAIアイコンがVS形式で対決配置。ニューラルネットワークのライン装飾',
    layoutHint: 'テキスト中央、VS構図を暗示するレイアウト。テック感＋比較記事の雰囲気',
  },
  {
    id: 'compare-3',
    title: 'クラウド会計ソフト\n比較',
    subtitle: 'freee vs マネーフォワード vs 弥生',
    bgStyle: '淡いブルーグレー〜ホワイトのクリーン背景',
    accentColor: '#0EA5E9（スカイブルー）',
    visualConcept: '計算機、グラフ、帳簿のミニマルアイコン。比較表のグリッド線が装飾的に背景に',
    layoutHint: 'テキスト左寄せ。清潔感＋信頼性。ビジネス会計の堅実なイメージ',
  },
  {
    id: 'compare-4',
    title: 'CRMツール比較',
    subtitle: '導入ガイド付き',
    bgStyle: 'ネイビー〜ダークブルーの落ち着いた背景',
    accentColor: '#06B6D4（シアン）',
    visualConcept: '顧客管理をイメージするフローチャート、人物アイコンのネットワーク図が控えめに',
    layoutHint: 'テキスト左寄せ、右にフローチャート装飾。プロフェッショナル＋導入ガイド感',
  },

  // --- 比較ランキング ---
  {
    id: 'ranking-1',
    title: 'SEOツール\nおすすめTOP10',
    subtitle: '無料〜有料まで徹底比較',
    bgStyle: 'ローズ〜マゼンタの暖色グラデーション背景',
    accentColor: '#F43F5E（ローズ）',
    visualConcept: '1位の王冠アイコン、棒グラフが階段状に並ぶランキングモチーフ。星評価のアイコン',
    layoutHint: 'テキスト左寄せ、「TOP10」を大きくアクセント。ランキング記事の権威感',
  },
  {
    id: 'ranking-2',
    title: '動画編集ソフト\n比較ランキング',
    subtitle: '目的別おすすめ12選',
    bgStyle: 'ダークパープル〜インディゴのクリエイティブ背景',
    accentColor: '#A855F7（パープル）＋#EC4899（ピンク）',
    visualConcept: 'フィルムストリップ、再生ボタン、タイムラインの抽象モチーフが装飾的に配置',
    layoutHint: 'テキスト中央。クリエイティブ感＋ランキングの信頼性。「12選」をアクセント',
  },
  {
    id: 'ranking-3',
    title: 'ビジネスチャットツール\n比較',
    subtitle: 'コスパ最強はどれ？',
    bgStyle: 'ティール〜ダークグリーンのクール背景',
    accentColor: '#14B8A6（ティール）',
    visualConcept: 'チャットバブル、コスパを示す天秤アイコン、価格タグのミニマルモチーフ',
    layoutHint: 'テキスト左寄せ。コスパ・お得感を伝えつつ、スタイリッシュさを維持',
  },
  {
    id: 'ranking-4',
    title: '転職サイト\nおすすめランキング',
    subtitle: '年代別TOP10',
    bgStyle: 'ウォームグレー〜ブラウンの落ち着いた背景',
    accentColor: '#D97706（アンバー/ブラウン）',
    visualConcept: 'ビジネススーツのシルエット、上昇矢印、星評価の控えめな装飾',
    layoutHint: 'テキスト中央。キャリア・信頼感のある大人っぽいトーン',
  },

  // --- HowTo・実践 ---
  {
    id: 'howto-1',
    title: 'LP制作で\nCVRを上げる7ステップ',
    subtitle: 'コンバージョン改善の完全ガイド',
    bgStyle: 'エメラルド〜ティールのグラデーション背景',
    accentColor: '#10B981（エメラルド）',
    visualConcept: 'ランディングページのモックアップが半透明で背景に。上昇矢印、ターゲットアイコン',
    layoutHint: 'テキスト左寄せ、「7ステップ」をアクセント。実践的＋成果重視の雰囲気',
  },
  {
    id: 'howto-2',
    title: 'コンテンツマーケティング\nの始め方',
    subtitle: '成功するメディア運営の全手順',
    bgStyle: 'ディープグリーン〜ダークティールの背景',
    accentColor: '#059669（グリーン）＋#F59E0B（アンバー）',
    visualConcept: 'ペンとノート、コンテンツカレンダーの抽象モチーフ。記事アイコンが浮かぶ装飾',
    layoutHint: 'テキスト左寄せ。メディア運営＋コンテンツ制作の知的な雰囲気',
  },
  {
    id: 'howto-3',
    title: '採用ブランディング\n戦略',
    subtitle: '応募数を5倍にする方法',
    bgStyle: 'ダークネイビー〜スレートのプロフェッショナル背景',
    accentColor: '#6366F1（インディゴ）',
    visualConcept: '人材ネットワーク図、握手アイコン、ブランドロゴの抽象モチーフが控えめに',
    layoutHint: 'テキスト中央。「5倍」の数字をアクセント。人事・採用のプロフェッショナル感',
  },
  {
    id: 'howto-4',
    title: 'ECサイトの\nCVR改善',
    subtitle: '売上を2倍にする最適化手法',
    bgStyle: 'ダークブルー〜パープルのグラデーション背景',
    accentColor: '#8B5CF6（バイオレット）＋#F97316（オレンジ）',
    visualConcept: 'ショッピングカート、上昇グラフ、A/Bテストの抽象モチーフ',
    layoutHint: 'テキスト左寄せ。「2倍」をアクセント。EC・売上改善のビジネス感',
  },

  // --- ハウツー（tutorial） ---
  {
    id: 'tutorial-1',
    title: 'Notionの使い方',
    subtitle: '業務効率が3倍になるテクニック集',
    bgStyle: '白〜ライトベージュのクリーン背景',
    accentColor: '#000000（ブラック）＋#F59E0B（アンバー）',
    visualConcept: 'NotionのようなミニマルなドキュメントUI、チェックリストアイコン、カンバンボードの断片が装飾的に',
    layoutHint: 'テキスト左寄せ。Notionブランドのミニマル感を意識。白×黒＋アクセントカラー',
  },
  {
    id: 'tutorial-2',
    title: 'GA4の設定・分析方法',
    subtitle: '初心者でも迷わない手順解説',
    bgStyle: 'ライトブルー〜ホワイトのクリーン背景',
    accentColor: '#2563EB（ロイヤルブルー）＋#F97316（オレンジ）',
    visualConcept: 'アナリティクスダッシュボードの抽象モチーフ、折れ線グラフ、円グラフの装飾',
    layoutHint: 'テキスト左寄せ。データ分析＋ステップバイステップの安心感。Googleカラーを意識',
  },
  {
    id: 'tutorial-3',
    title: 'SEO内部対策\nチェックリスト',
    subtitle: '50項目｜2026年最新版',
    bgStyle: 'シアン〜ダークティールのグラデーション背景',
    accentColor: '#06B6D4（シアン）＋#FBBF24（イエロー）',
    visualConcept: 'チェックリストアイコン、検索虫眼鏡、コードの断片が背景にうっすら',
    layoutHint: 'テキスト左寄せ。「50項目」を大きくアクセント。網羅性＋実用性の権威感',
  },
  {
    id: 'tutorial-4',
    title: '確定申告のやり方',
    subtitle: 'フリーランスが知るべき節税テク',
    bgStyle: 'ウォームグレー〜チャコールの落ち着いた背景',
    accentColor: '#22C55E（グリーン）＋#F59E0B（アンバー）',
    visualConcept: '計算機、領収書、お金のアイコンがミニマルに配置。確定申告書の断片がうっすら背景に',
    layoutHint: 'テキスト左寄せ。お金＋税金の堅実さ＋フリーランスの親しみやすさ',
  },

  // --- トレンド ---
  {
    id: 'trend-1',
    title: '2026年注目\nSaaSトレンド20選',
    subtitle: '業界別まとめ【保存版】',
    bgStyle: 'オレンジ〜アンバーのウォームグラデーション背景',
    accentColor: '#F97316（オレンジ）＋#FBBF24（イエロー）',
    visualConcept: '上昇トレンド矢印、クラウドアイコン、SaaSのダッシュボード断片が装飾的に',
    layoutHint: 'テキスト中央。「2026年」「20選」を大きくアクセント。最新トレンドの勢い感',
  },
  {
    id: 'trend-2',
    title: 'AI活用の\n最新トレンド',
    subtitle: '企業が今すぐ取り組むべき5つの領域',
    bgStyle: 'ダークブルー〜ブラックのテック系背景',
    accentColor: '#818CF8（ラベンダー）＋#38BDF8（スカイブルー）',
    visualConcept: 'AIブレイン、ニューラルネットワーク、データフローの抽象ライン装飾が光るように配置',
    layoutHint: 'テキスト左寄せ。未来感＋テクノロジーの先端性。「5つの領域」をアクセント',
  },
  {
    id: 'trend-3',
    title: 'SNSマーケティング\n最新トレンド',
    subtitle: 'X・Instagram・TikTok攻略法',
    bgStyle: 'ピンク〜パープルのポップだが上品なグラデーション',
    accentColor: '#EC4899（ピンク）＋#8B5CF6（パープル）',
    visualConcept: 'SNSのいいねアイコン、シェアボタン、フォロワーグラフの抽象モチーフ。ただしポップすぎず上品に',
    layoutHint: 'テキスト中央。SNSの華やかさ＋マーケティングの知性を両立',
  },
  {
    id: 'trend-4',
    title: 'EC・D2Cブランドの\n成功戦略',
    subtitle: '2026年に伸びるビジネスモデルとは',
    bgStyle: 'ダークグリーン〜エメラルドのリッチ背景',
    accentColor: '#10B981（エメラルド）＋#F59E0B（ゴールド）',
    visualConcept: 'ショッピングバッグ、ブランドロゴの抽象形、上昇チャートのミニマル装飾',
    layoutHint: 'テキスト左寄せ。D2C・ブランディングの洗練感＋ビジネス成長のイメージ',
  },

  // --- 事例 ---
  {
    id: 'case-1',
    title: 'BtoB営業\n成功事例10選',
    subtitle: '受注率を3倍にした戦略を公開',
    bgStyle: 'ディープパープル〜インディゴのプロフェッショナル背景',
    accentColor: '#7C3AED（パープル）＋#F59E0B（ゴールド）',
    visualConcept: 'ビジネスグラフ、握手アイコン、トロフィーの控えめな装飾',
    layoutHint: 'テキスト左寄せ。「3倍」「10選」を大きくアクセント。実績＋信頼感',
  },
  {
    id: 'case-2',
    title: 'SNSマーケティング\n成功事例',
    subtitle: 'フォロワー10万人達成の軌跡',
    bgStyle: 'グラデーション（コーラルピンク〜パープル）の華やかな背景',
    accentColor: '#EC4899（ピンク）＋#F97316（オレンジ）',
    visualConcept: 'スマートフォンのモック、フォロワー数カウンター、ハートアイコンの装飾',
    layoutHint: 'テキスト中央。「10万人」を大きくアクセント。SNSの華やかさ＋成功の実感',
  },
  {
    id: 'case-3',
    title: 'DX推進\n成功事例',
    subtitle: '製造・小売・金融の業種別ベストプラクティス',
    bgStyle: 'スレートブルー〜ダークグレーの堅実な背景',
    accentColor: '#3B82F6（ブルー）＋#10B981（エメラルド）',
    visualConcept: '工場・店舗・銀行のミニマルアイコンが横に並ぶ。デジタル化を示す矢印',
    layoutHint: 'テキスト左寄せ。業種別の多様性＋DXの先進性を表現',
  },
  {
    id: 'case-4',
    title: 'データドリブン経営\n完全ガイド',
    subtitle: '意思決定を変える分析手法',
    bgStyle: 'ダークネイビー〜ブラックの高級感ある背景',
    accentColor: '#06B6D4（シアン）＋#FBBF24（ゴールド）',
    visualConcept: 'ダッシュボード画面のモックアップ、KPIメーター、データチャートの抽象装飾',
    layoutHint: 'テキスト左寄せ。データ＋経営の知性。分析ダッシュボードの雰囲気',
  },
]

function getApiKey(): string {
  const key = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!key) throw new Error('GOOGLE_GENAI_API_KEY not set')
  return key
}

async function resolveModel(apiKey: string): Promise<string> {
  // ListModelsからNano Banana Proを見つける
  const res = await fetch(`${GEMINI_API_BASE}/models`, {
    headers: { 'x-goog-api-key': apiKey },
  })
  if (!res.ok) throw new Error(`ListModels failed: ${res.status}`)
  const json = await res.json()
  const models = (json.models || []) as any[]

  // banana / gemini-3-pro-image を探す
  const candidates = models
    .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m: any) => String(m.name || '').replace(/^models\//, ''))

  const banana = candidates.find((n: string) => n.toLowerCase().includes('banana'))
  if (banana) return banana

  const imagey = candidates.find((n: string) => n.toLowerCase().includes('image'))
  if (imagey) return imagey

  // フォールバック
  return 'gemini-3-pro-image-preview'
}

function buildPrompt(tmpl: typeof TEMPLATES[0], size: string): string {
  const [width, height] = size.split('x')

  return `
あなたはバナーデザインギャラリーサイトに掲載される"スタイリッシュ・おしゃれ"カテゴリの
トップクオリティ記事バナーを制作するデザイナーです。

■ 制作するもの
記事アイキャッチバナー（${width}×${height}px、横長）

■ デザインの方向性（最重要）
・「シンプル」「スタイリッシュ」「高級感・きれいめ」がキーワード
・余白を大胆に使い、情報を詰め込みすぎない
・タイポグラフィ（文字組み）を主役にしたデザイン
・広告バナーではなく、メディア・マガジンの記事ヘッダー風
・洗練された大人っぽいトーン。ポップさ・イラスト感は排除

■ 背景
・${tmpl.bgStyle}
・微細なテクスチャやグラデーションで奥行きを出すのはOK
・ベタ塗りではなく、ほんの少し動きのある背景

■ アクセントカラー
・${tmpl.accentColor}
・アクセントは控えめに。線・小さなアイコン・文字の一部に使用

■ ビジュアル要素（控えめに）
・${tmpl.visualConcept}
・ビジュアル要素はあくまでテキストを引き立てる装飾。主役はテキスト
・要素の透明度を落としたり、背景に溶け込ませる
・人物は不要

■ テキスト（日本語・必ず画像内に含める）
・メインタイトル：「${tmpl.title}」
　→ 太めのゴシック体、大きく配置、可読性最優先
　→ テキストと背景のコントラストを十分確保
・サブタイトル：「${tmpl.subtitle}」
　→ メインより小さく、控えめに配置

■ レイアウト
・${tmpl.layoutHint}
・文字の周囲に十分な余白（パディング）をとること
・テキストがビジュアル要素に被って読めなくなるのは絶対NG

■ 禁止事項
・文字化け、存在しない漢字、意味不明な文字列
・ポップ・カワイイ・ガチャガチャしたデザイン
・CTA/ボタン要素
・ウォーターマーク、ロゴ、署名
・テキストの重複表示
・日本語が正しく表示できない場合はテキストなしで生成

■ 品質基準
「バナーデザインギャラリーの"スタイリッシュ・おしゃれ"カテゴリに
掲載されてもおかしくない、プロのデザイナーが作ったクオリティ」

=== 出力サイズ（必須） ===
**正確に ${width}×${height} ピクセル**
・幅${width}px × 高さ${height}px で出力
・アスペクト比厳守、キャンバス全体を使う
・レターボックス、余白パディング、ボーダーは禁止
・1枚のPNG画像を返すこと
`.trim()
}

async function generateBanner(apiKey: string, model: string, tmpl: typeof TEMPLATES[0]): Promise<string> {
  const size = '1200x628'
  const prompt = buildPrompt(tmpl, size)
  const [w, h] = size.split('x').map(Number)

  const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`

  const requestBody = {
    contents: [{
      role: 'user',
      parts: [{
        text: [
          prompt,
          '',
          '=== MANDATORY OUTPUT CONSTRAINTS ===',
          `**TARGET SIZE: ${w}x${h} pixels (width x height)**`,
          '**ASPECT RATIO: landscape (horizontal)**',
          '',
          'CRITICAL REQUIREMENTS:',
          '- Generate image with landscape (horizontal) aspect ratio.',
          '- Fill the entire canvas edge-to-edge with content.',
          '- NO letterboxing, NO empty bars, NO padding, NO borders.',
          '',
          '=== JAPANESE TEXT QUALITY (CRITICAL) ===',
          '- Japanese text must be PERFECTLY CORRECT and READABLE.',
          '- ABSOLUTELY FORBIDDEN: garbled text, non-existent kanji, meaningless character combinations.',
          '- If you cannot render Japanese text correctly, DO NOT include any text in the image.',
          '- Better to have NO TEXT than WRONG TEXT.',
          '',
          'Return ONE PNG image.',
        ].join('\n'),
      }],
    }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      temperature: 0.4,
      candidateCount: 1,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  }

  console.log(`  Calling ${model}...`)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API error ${response.status}: ${errorText.substring(0, 300)}`)
  }

  const result = await response.json()
  const parts = result?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) throw new Error('No parts in response')

  for (const part of parts) {
    const inline = part?.inlineData || part?.inline_data
    if (inline?.data) {
      // Resize to exact dimensions
      const imageBuffer = Buffer.from(inline.data, 'base64')
      const resized = await sharp(imageBuffer)
        .resize({ width: w, height: h, fit: 'fill' })
        .png()
        .toBuffer()

      return `data:image/png;base64,${resized.toString('base64')}`
    }
  }

  throw new Error('No image data in response')
}

async function saveToDB(templateId: string, imageData: string) {
  const dbId = `seo-article-${templateId}`

  await prisma.bannerTemplate.upsert({
    where: { templateId: dbId },
    update: {
      previewUrl: imageData,
      imageUrl: imageData,
      isActive: true,
    },
    create: {
      templateId: dbId,
      industry: 'seo',
      category: 'article-banner',
      prompt: `SEO article banner for ${templateId}`,
      size: '1200x628',
      previewUrl: imageData,
      imageUrl: imageData,
      isActive: true,
    },
  })

  console.log(`  Saved to DB as ${dbId}`)
}

async function main() {
  console.log('=== SEO Article Banner Generator ===')

  const apiKey = getApiKey()
  console.log('API key found')

  const model = await resolveModel(apiKey)
  console.log(`Resolved model: ${model}`)

  const results: { id: string; success: boolean; error?: string }[] = []

  for (let i = 0; i < TEMPLATES.length; i++) {
    const tmpl = TEMPLATES[i]
    console.log(`\n[${i + 1}/${TEMPLATES.length}] ${tmpl.id}: ${tmpl.title}`)

    try {
      const imageData = await generateBanner(apiKey, model, tmpl)
      console.log(`  Generated (${Math.round(imageData.length / 1024)}KB)`)

      await saveToDB(tmpl.id, imageData)
      results.push({ id: tmpl.id, success: true })
    } catch (err: any) {
      console.error(`  FAILED: ${err.message}`)
      results.push({ id: tmpl.id, success: false, error: err.message })
    }

    // API rate limit
    if (i < TEMPLATES.length - 1) {
      console.log('  Waiting 3s...')
      await new Promise(r => setTimeout(r, 3000))
    }
  }

  console.log('\n=== Results ===')
  for (const r of results) {
    console.log(`${r.success ? 'OK' : 'NG'} ${r.id}${r.error ? ` - ${r.error}` : ''}`)
  }

  const ok = results.filter(r => r.success).length
  const ng = results.filter(r => !r.success).length
  console.log(`\nTotal: ${ok} success, ${ng} failed`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
