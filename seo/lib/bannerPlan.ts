/**
 * ドヤライティングAI - 記事バナー生成用プロンプト
 * 
 * 記事内容に基づいた「クリックされる記事バナー画像」を生成する
 */

/**
 * 記事バナー生成用プロンプトテンプレート
 */
export const ARTICLE_BANNER_PROMPT_TEMPLATE = `あなたは「広告・記事バナーを専門に制作するトップレベルのAIデザイナー」です。
以下の記事内容を正確に理解し、成果が出ている記事バナー画像の構成・情報設計・視線誘導を踏襲した
"クリックされる記事バナー画像"を生成してください。

# 参照するバナーの共通特徴（必ず反映）
- 大きく強いメインコピー（一目で内容が伝わる）
- 数字・実績・条件などの"判断材料"を明示
- 人物 or 商品を主役にした視線誘導
- 情報は多いが、整理されていて読みやすい
- 広告感はあるが「記事内容と完全一致」している

# 入力情報
【記事タイトル】
{{ARTICLE_TITLE}}

【記事本文】
{{ARTICLE_TEXT}}

【用途】
記事バナー（アイキャッチ／SNS／広告流用可）

【サイズ】
{{BANNER_SIZE}}

【想定ジャンル】
{{GENRE}}
（例：転職 / スクール / 美容 / EC / IT / ビジネス / 情報商材）

# ステップ1：記事理解（必須）
以下を内部で必ず整理してください。
- 記事の結論・一番伝えたいこと
- 読者が「自分ごと」と感じる悩み・欲求
- 記事内で最も強い訴求ポイント
- 記事の信頼性を支える要素（実績・数字・条件・専門性）

# ステップ2：コピー設計（超重要）
以下の構成で文字情報を設計してください。

■ メインコピー（最重要・20〜30文字）
- 記事の結論 or ベネフィットを端的に
- 強いが誇張しない
- 記事内表現を優先

■ サブコピー（補足・10〜20文字）
- 条件・背景・安心材料

■ 強調ワード
- 数字（％、年齢、金額、実績など）
- 限定性・簡単さ・変化

■ CTAテキスト（短く）
- 「詳しくはこちら」
- 「今すぐチェック」
- 「無料で見る」など

※ 記事に書かれていない数字・実績は絶対に作らない

# ステップ3：デザイン指示（成果バナー準拠）
- 広告で実際に使われている記事バナーの構図を採用
- メインコピーは大きく、背景と強いコントラスト
- 人物がいる場合は、自然で信頼感のある表情
- 商品がある場合は、清潔感・質感が伝わる配置
- 色はジャンルに合わせて最適化
  - 転職・IT：青・ネイビー
  - 美容：白・パステル・透明感
  - EC：オレンジ・赤で訴求
- 情報は多くても「ブロック化」して整理

# 禁止事項
- 記事内容とズレた煽り表現
- 根拠のないNo.1表記
- 読めないほど小さい文字
- 世界観だけで中身が伝わらないデザイン

# 出力要件
- 記事バナー画像を1枚生成
- 広告・記事一覧に並んでも"負けない"視認性
- 見ただけで「この記事、気になる」と思わせる完成度

以上をすべて満たした、プロ品質の記事バナー画像を生成してください。`

/**
 * 記事内容からジャンルを推定
 */
export function guessArticleGenreJa(text: string): string {
  const t = String(text || '').toLowerCase()
  if (/転職|採用|求人|rpo|人材|hr/.test(t)) return '転職/採用'
  if (/itスクール|プログラミングスクール|スクール|学習|教育|研修|資格/.test(t)) return 'ITスクール/学習'
  if (/美容|コスメ|サロン|エステ|スキンケア/.test(t)) return '美容'
  if (/健康|医療|ヘルスケア|病院|福祉|ダイエット/.test(t)) return '健康'
  if (/ec|通販|物販|ショップ|d2c|楽天|アマゾン|amazon/.test(t)) return 'EC'
  if (/ai|人工知能|機械学習|llm|gpt/.test(t)) return 'AI/IT'
  if (/不動産|物件|住宅|建築|リノベ/.test(t)) return '不動産'
  if (/金融|投資|資産|保険|fintech/.test(t)) return '金融'
  if (/マーケ|広告|sns|instagram|twitter|x\\b|meta/.test(t)) return 'マーケティング'
  if (/情報商材|副業|稼ぐ|収入|ノウハウ/.test(t)) return '情報商材'
  return 'ビジネス'
}

/**
 * バナー生成用プロンプトを組み立て
 */
export function buildArticleBannerPrompt(args: {
  title: string
  articleText: string
  bannerSize?: string
  genre?: string
}): string {
  const title = String(args.title || '').trim().slice(0, 200)
  const articleText = String(args.articleText || '').trim().slice(0, 5000)
  const bannerSize = args.bannerSize || '1200x628（16:9、SNS/広告向け）'
  const genre = args.genre || guessArticleGenreJa([title, articleText].join(' '))

  return ARTICLE_BANNER_PROMPT_TEMPLATE
    .replace('{{ARTICLE_TITLE}}', title)
    .replace('{{ARTICLE_TEXT}}', articleText)
    .replace('{{BANNER_SIZE}}', bannerSize)
    .replace('{{GENRE}}', genre)
}
