// ============================================
// ドヤインタビュー — LLMプロンプト構築
// ============================================

/**
 * 記事生成用のフルプロンプトを構築
 *
 * 構造:
 * 1. ベースシステムプロンプト (品質基準)
 * 2. スキル固有プロンプト (記事種別の構成指示)
 * 3. プロジェクトコンテキスト (対象者情報等)
 * 4. 素材テキスト (文字起こし結果)
 * 5. こだわり指示 (ユーザー任意入力)
 */
export function buildArticlePrompt(opts: {
  recipe: {
    name: string
    editingGuidelines: string | null
    category: string | null
  }
  project: {
    title: string
    intervieweeName: string | null
    intervieweeRole: string | null
    intervieweeCompany: string | null
    intervieweeBio: string | null
    genre: string | null
    theme: string | null
    purpose: string | null
    targetAudience: string | null
    tone: string | null
  }
  transcriptionTexts: string[]
  extractedTexts: string[]
  customInstructions: string | null
  displayFormat: string | null // QA | MONOLOGUE
}): string {
  // 文字起こしテキストの総文字数から適切な出力文字数を算出
  const totalTranscriptionChars = opts.transcriptionTexts.reduce((sum, t) => sum + t.length, 0)
  let targetWordRange = '1500〜2500'
  if (totalTranscriptionChars > 60000) targetWordRange = '12000〜20000'
  else if (totalTranscriptionChars > 30000) targetWordRange = '8000〜12000'
  else if (totalTranscriptionChars > 10000) targetWordRange = '5000〜8000'
  else if (totalTranscriptionChars > 3000) targetWordRange = '3000〜5000'

  const parts: string[] = []

  // ====== 1. ベースシステムプロンプト ======
  parts.push(`あなたはプロの編集者・ライターです。
以下のインタビュー素材（文字起こしテキスト等）を元に、高品質な記事を執筆してください。

【基本品質基準】
- 読者にとって価値のある、読みやすい記事を書く
- 事実に基づき、素材にない情報を捏造しない
- 話者の発言は正確に引用し、意味を変えない
- 適切な見出し構成（h2/h3）でMarkdown形式で出力する
- 日本語として自然な文章を心がける
- 誤字脱字・表記揺れがない

【出力文字数の目安】
素材の分量に基づき、${targetWordRange}文字程度の記事を生成してください。
インタビューの内容を十分にカバーし、重要な発言やエピソードを省略しないでください。
短すぎる要約にならないよう注意してください。`)

  // ====== 2. スキル固有プロンプト ======
  parts.push(`\n【使用スキル】${opts.recipe.name}`)
  if (opts.recipe.editingGuidelines) {
    parts.push(`\n【編集方針】\n${opts.recipe.editingGuidelines}`)
  }

  // 表示形式
  if (opts.displayFormat === 'QA') {
    parts.push(`\n【表示形式】Q&A形式（質問と回答を交互に配置）`)
  } else if (opts.displayFormat === 'MONOLOGUE') {
    parts.push(`\n【表示形式】モノローグ形式（第三者の語りで構成）`)
  }

  // ====== 3. プロジェクトコンテキスト ======
  const contextLines: string[] = []
  if (opts.project.title) contextLines.push(`記事タイトル（仮）: ${opts.project.title}`)
  if (opts.project.intervieweeName) {
    let person = opts.project.intervieweeName
    if (opts.project.intervieweeCompany) person = `${opts.project.intervieweeCompany} ${person}`
    if (opts.project.intervieweeRole) person += `（${opts.project.intervieweeRole}）`
    contextLines.push(`インタビュー対象者: ${person}`)
  }
  if (opts.project.intervieweeBio) contextLines.push(`対象者プロフィール: ${opts.project.intervieweeBio}`)
  if (opts.project.theme) contextLines.push(`取材テーマ: ${opts.project.theme}`)
  if (opts.project.purpose) contextLines.push(`記事の目的: ${opts.project.purpose}`)
  if (opts.project.targetAudience) contextLines.push(`想定読者: ${opts.project.targetAudience}`)
  if (opts.project.tone) {
    const toneMap: Record<string, string> = {
      friendly: 'フレンドリー（です・ます調、親しみやすい）',
      professional: 'ビジネス（です・ます調、信頼感のある）',
      casual: 'カジュアル（話し言葉寄り、軽い）',
      formal: 'フォーマル（である調、格調高い）',
    }
    contextLines.push(`トーン: ${toneMap[opts.project.tone] || opts.project.tone}`)
  }

  if (contextLines.length > 0) {
    parts.push(`\n【記事コンテキスト】\n${contextLines.join('\n')}`)
  }

  // ====== 4. 素材テキスト ======
  if (opts.transcriptionTexts.length > 0) {
    parts.push(`\n====== 文字起こしテキスト ======`)
    for (let i = 0; i < opts.transcriptionTexts.length; i++) {
      const text = opts.transcriptionTexts[i]
      // トークン制限対策: 1素材あたり最大80,000文字
      const truncated = text.length > 80000 ? text.slice(0, 80000) + '\n\n[...以降省略]' : text
      parts.push(`\n--- 素材${i + 1} ---\n${truncated}`)
    }
  }

  if (opts.extractedTexts.length > 0) {
    parts.push(`\n====== 参考資料テキスト ======`)
    for (let i = 0; i < opts.extractedTexts.length; i++) {
      const text = opts.extractedTexts[i]
      const truncated = text.length > 30000 ? text.slice(0, 30000) + '\n\n[...以降省略]' : text
      parts.push(`\n--- 資料${i + 1} ---\n${truncated}`)
    }
  }

  // ====== 5. こだわり指示 ======
  if (opts.customInstructions?.trim()) {
    parts.push(`\n【追加指示（ユーザーからの特別な要望）】\n${opts.customInstructions.trim()}`)
  }

  parts.push(`\n上記の素材とコンテキストを元に、記事をMarkdown形式で出力してください。見出し(##, ###)を適切に使い、読みやすく構成してください。`)

  return parts.join('\n')
}
