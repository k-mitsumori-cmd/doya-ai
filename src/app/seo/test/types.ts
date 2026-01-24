// 記事テンプレートの型定義
export type ArticlePhase = '認知' | '比較' | 'CV'
export type ArticleCategory = '解説型' | '比較型' | '一覧型'
export type ArticleUsage = 'ブログ向け' | 'DL誘導向け' | 'LP補助向け'

export interface ArticleTemplate {
  id: string
  title: string
  phase: ArticlePhase
  category: ArticleCategory
  usage: ArticleUsage
  imageUrl?: string // バナー画像URL（オプション）
  // ユーザーが編集可能なフィールド
  defaultKeyword?: string // デフォルトの主キーワード
  defaultTitle?: string // デフォルトの記事タイトル
  description?: string // テンプレートの説明
  exampleContent?: string // 一次情報の例
  exampleKeywords?: string[] // 関連キーワードの例
  targetAudience?: string // 推奨読者像
  recommendedTone?: string // 推奨文体
  recommendedChars?: number // 推奨文字数
}

// 棚（Section）の型定義
export interface ArticleSection {
  id: string
  title: string
  description?: string
  templates: ArticleTemplate[]
}
