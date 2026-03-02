// ============================================
// ドヤ展開AI — 共通システムプロンプト & プラットフォーム登録
// ============================================

import * as notePrompts from './note'
import * as blogPrompts from './blog'
import * as xPrompts from './x'
import * as instagramPrompts from './instagram'
import * as linePrompts from './line'
import * as facebookPrompts from './facebook'
import * as linkedinPrompts from './linkedin'
import * as newsletterPrompts from './newsletter'
import * as pressReleasePrompts from './press-release'

export interface PlatformPromptModule {
  PLATFORM_CONFIG: {
    name: string
    displayName: string
    minChars: number
    maxChars: number
    recommendedChars: number
  }
  buildSystemPrompt: (analysis: Record<string, unknown>, brandVoice?: Record<string, unknown> | null) => string
  buildUserPrompt: (analysis: Record<string, unknown>, customInstructions?: string | null) => string
}

/**
 * プラットフォーム名 → プロンプトモジュールのマッピング
 */
export const PLATFORM_PROMPTS: Record<string, PlatformPromptModule> = {
  note: notePrompts,
  blog: blogPrompts,
  x: xPrompts,
  instagram: instagramPrompts,
  line: linePrompts,
  facebook: facebookPrompts,
  linkedin: linkedinPrompts,
  newsletter: newsletterPrompts,
  press_release: pressReleasePrompts,
}

/**
 * 対応プラットフォーム一覧
 */
export const SUPPORTED_PLATFORMS = Object.keys(PLATFORM_PROMPTS)

/**
 * 共通のベースシステムプロンプト（全プラットフォーム共通）
 */
export const BASE_SYSTEM_PROMPT = `あなたは日本語コンテンツ制作の専門家です。ドヤ展開AIのコンテンツ生成エンジンとして、与えられた元コンテンツの分析結果を基に、指定されたプラットフォームに最適化された高品質なコンテンツを生成します。

## 基本原則
1. 元コンテンツの核心メッセージ・価値を正確に理解し、プラットフォームの特性に合わせて再構成する
2. 単なる要約や短縮ではなく、各プラットフォームのユーザー行動と文化を理解した「展開」を行う
3. 読者の注意を引き、エンゲージメントを最大化する構成・表現を選択する
4. 日本語として自然で読みやすい文章を心がける
5. 事実に基づかない情報の追加や誇張は絶対に行わない

## 出力ルール
- 必ず指定されたJSON構造で出力してください
- JSONは\`\`\`json\`\`\`で囲んでください
- 日本語のテキストはUnicodeエスケープせず、そのまま記述してください
`
