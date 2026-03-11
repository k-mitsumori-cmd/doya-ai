// ============================================
// ドヤヒヤリングAI — AIプロンプト
// ============================================

import type { HearingType, ToneType, CompanyAnalysis } from './types'

// ---------- URL調査結果をプロンプト文に変換 ----------

function formatCompanyAnalysis(analysis: CompanyAnalysis | null | undefined): string {
  if (!analysis) return ''
  const lines: string[] = []
  if (analysis.companyName) lines.push(`- 企業名: ${analysis.companyName}`)
  if (analysis.businessDescription) lines.push(`- 事業概要: ${analysis.businessDescription}`)
  if (analysis.industry) lines.push(`- 業界: ${analysis.industry}`)
  if (analysis.scale) lines.push(`- 規模: ${analysis.scale}`)
  if (analysis.services?.length) lines.push(`- サービス: ${analysis.services.join('、')}`)
  if (analysis.keyFeatures?.length) lines.push(`- 特徴: ${analysis.keyFeatures.join('、')}`)
  if (analysis.targetCustomers) lines.push(`- ターゲット: ${analysis.targetCustomers}`)
  if (lines.length === 0) return ''
  return `\n## URL調査で判明した企業情報\n${lines.join('\n')}`
}

// ---------- 質問生成プロンプト ----------

export function buildQuestionGenerationPrompt(params: {
  templateName: string
  templateCategory: string
  defaultQuestions?: any[]
  projectTitle: string
  companyName?: string | null
  companyUrl?: string | null
  purpose?: string | null
  targetAudience?: string | null
  tone?: ToneType | null
  hearingType?: HearingType | null
  companyAnalysis?: CompanyAnalysis | null
  customInstructions?: string | null
}): string {
  const toneLabel: Record<string, string> = {
    friendly: '親しみやすい',
    professional: 'プロフェッショナル',
    casual: 'カジュアル',
    formal: 'フォーマル',
  }

  return `あなたはプロのヒヤリングディレクターです。以下の情報を基に、回答者に送るヒヤリング質問を生成してください。

## プロジェクト情報
- テンプレート: ${params.templateName}（${params.templateCategory}）
- プロジェクト名: ${params.projectTitle}
${params.companyName ? `- 企業名: ${params.companyName}` : ''}
${params.companyUrl ? `- 企業URL: ${params.companyUrl}` : ''}
${params.purpose ? `- ヒヤリングの目的: ${params.purpose}` : ''}
${params.targetAudience ? `- 対象者: ${params.targetAudience}` : ''}
${params.tone ? `- トーン: ${toneLabel[params.tone] || params.tone}` : ''}
${formatCompanyAnalysis(params.companyAnalysis)}
${params.customInstructions ? `\n## ユーザーからの追加指示\n${params.customInstructions}` : ''}

## 参考質問（テンプレートのデフォルト）
${params.defaultQuestions?.map((q: any, i: number) => `${i + 1}. ${q.text}`).join('\n') || 'なし'}

## 指示
1. 上記の参考質問を基にしつつ、プロジェクトの目的に合わせて**8〜12問**の質問を生成してください。
2. URL調査結果がある場合は、その企業・サービスに合わせた具体的な質問にしてください。
3. 回答者が具体的なエピソードや数値を出しやすい聞き方にしてください。
4. 各質問には、回答者が答えやすいよう簡潔な補足説明を付けてください。

## 出力形式（JSON配列）
以下のJSON配列を返してください。他のテキストは不要です。
[
  {
    "text": "質問文",
    "description": "回答者への補足説明（任意）",
    "type": "TEXTAREA",
    "required": true,
    "order": 1
  }
]

typeは以下から選択:
- "TEXT": 短い回答（名前、日付など）
- "TEXTAREA": 長文回答（説明、エピソードなど）
- "SELECT": 選択式（options配列を含める）
- "RATING": 5段階評価
- "YES_NO": はい/いいえ`
}

// ---------- 要約生成プロンプト ----------

export function buildSummaryGenerationPrompt(params: {
  templateName: string
  templatePrompt?: string | null
  projectTitle: string
  companyName?: string | null
  respondentName?: string | null
  respondentRole?: string | null
  respondentCompany?: string | null
  purpose?: string | null
  targetAudience?: string | null
  tone?: ToneType | null
  hearingType?: HearingType | null
  companyAnalysis?: CompanyAnalysis | null
  customInstructions?: string | null
  questionsAndAnswers: { question: string; answer: string }[]
  chatMessages?: { role: string; content: string }[]
}): string {
  const toneLabel: Record<string, string> = {
    friendly: '親しみやすく温かみのある',
    professional: 'プロフェッショナルで信頼感のある',
    casual: 'カジュアルで読みやすい',
    formal: 'フォーマルで格式のある',
  }

  const qaPairs = params.questionsAndAnswers
    .map((qa, i) => `### Q${i + 1}: ${qa.question}\n${qa.answer}`)
    .join('\n\n')

  const chatLog = params.chatMessages?.length
    ? `\n## チャットログ\n${params.chatMessages.map(m => `**${m.role === 'interviewer' ? 'AI' : '回答者'}**: ${m.content}`).join('\n\n')}`
    : ''

  return `${params.templatePrompt || 'あなたはプロのヒヤリングアナリストです。以下のヒヤリング結果を要約してください。'}

## プロジェクト情報
- テーマ: ${params.projectTitle}
${params.companyName ? `- 企業名: ${params.companyName}` : ''}
${params.respondentName ? `- 回答者: ${params.respondentName}` : ''}
${params.respondentRole ? `- 役職: ${params.respondentRole}` : ''}
${params.respondentCompany ? `- 所属: ${params.respondentCompany}` : ''}
${params.purpose ? `- 目的: ${params.purpose}` : ''}
${params.targetAudience ? `- 対象者: ${params.targetAudience}` : ''}
- トーン: ${params.tone ? toneLabel[params.tone] || params.tone : 'プロフェッショナル'}
${formatCompanyAnalysis(params.companyAnalysis)}

## ヒヤリング回答

${qaPairs}
${chatLog}

${params.customInstructions ? `## 追加指示\n${params.customInstructions}\n` : ''}
## 出力ルール
1. Markdown形式で出力してください。
2. 最初の行にH1で要約タイトルを書いてください。
3. 2行目にリード文（要約の概要を3-4行で）を書いてください。
4. 回答者の言葉をなるべく活かし、「」で引用してください。
5. 数値やエピソードは正確に引用してください。
6. H2、H3で適切にセクション分けしてください。
7. 最後に「## アクションアイテム」セクションで、次のステップを箇条書きで記載してください。
8. 最後に「## 重要な発言・キーワード」セクションで、特に注目すべき発言を引用してください。`
}

// ---------- URL調査プロンプト ----------

export function buildUrlAnalysisPrompt(scrapedContent: string): string {
  return `以下のWebページの内容から、企業・サービス情報を抽出してください。

## Webページの内容
${scrapedContent.slice(0, 8000)}

## 出力形式（JSON）
以下のJSON形式で返してください。不明な項目はnullにしてください。
{
  "companyName": "企業名",
  "businessDescription": "事業概要（2-3文で簡潔に）",
  "services": ["サービス1", "サービス2"],
  "industry": "業界（例: SaaS、製造業、コンサルなど）",
  "scale": "規模（従業員数、拠点数など。不明ならnull）",
  "keyFeatures": ["特徴1", "特徴2", "特徴3"],
  "targetCustomers": "主なターゲット顧客層"
}`
}

// ---------- チャットインタビュアー システムプロンプト ----------

export function buildChatInterviewerSystemPrompt(params: {
  projectTitle: string
  companyName?: string | null
  purpose?: string | null
  targetAudience?: string | null
  tone?: ToneType | null
  hearingType?: HearingType | null
  companyAnalysis?: CompanyAnalysis | null
  customInstructions?: string | null
  respondentName?: string | null
  questions: { text: string; order: number; description?: string | null }[]
}): string {
  const toneLabel: Record<string, string> = {
    friendly: '親しみやすく温かみのある',
    professional: 'プロフェッショナルで丁寧な',
    casual: 'カジュアルでフランクな',
    formal: 'フォーマルで格式のある',
  }

  const toneStyle = params.tone ? toneLabel[params.tone] || 'プロフェッショナルで丁寧な' : 'プロフェッショナルで丁寧な'

  const topicsList = params.questions
    .map((q, i) => `${i + 1}. ${q.text}${q.description ? `（補足: ${q.description}）` : ''}`)
    .join('\n')

  return `あなたはプロのヒヤリング担当者です。テキストチャット形式で回答者にヒヤリングを行います。

## あなたの設定
- 話し方: ${toneStyle}口調
- 役割: 「${params.projectTitle}」のヒヤリング担当者
${params.companyName ? `- ヒヤリング依頼元: ${params.companyName}` : ''}
${params.respondentName ? `- 回答者名: ${params.respondentName}さん` : ''}
${formatCompanyAnalysis(params.companyAnalysis)}

## ヒヤリングの目的
${params.purpose || '回答者の情報を正確にヒヤリングし、質の高い要約を作成すること'}
${params.targetAudience ? `対象者: ${params.targetAudience}` : ''}

## カバーすべきトピック（質問リスト）
${topicsList}

## ヒヤリング進行ルール
1. 一度に1つの質問だけ聞いてください。複数の質問を同時にしないでください。
2. 回答者の返答内容に基づいて、自然な深掘り質問（フォローアップ）を1-2回行ってください。
3. 十分な情報が得られたら、自然な接続詞で次のトピックに移行してください。
4. すべてのトピックをカバーしたら、ヒヤリングを自然に締めくくってください。
5. 回答が短い場合は「もう少し詳しく教えていただけますか？」と促してください。
6. 回答者の言葉を繰り返し確認するなど、傾聴の姿勢を示してください。
7. 各返答は200文字以内を目安にしてください。長すぎると読みにくくなります。
8. URL調査で企業情報がある場合は、その情報を踏まえた上で的確な質問をしてください。

## 出力形式（JSON）
必ず以下のJSON形式で返答してください。JSON以外のテキストは含めないでください。

{
  "reply": "ヒヤリング担当者としての返答テキスト",
  "topicIndex": 現在聞いているトピックのインデックス（0始まり）,
  "messageType": "greeting" | "question" | "follow_up" | "transition" | "closing",
  "shouldEndInterview": false
}

messageTypeの使い分け:
- "question": 新しいトピックの質問
- "follow_up": 同じトピックの深掘り
- "transition": トピック移行（前の回答への感想 + 次の質問）
- "closing": ヒヤリング終了の挨拶（shouldEndInterview: true と一緒に使う）

${params.customInstructions ? `\n## 追加指示\n${params.customInstructions}` : ''}`
}

// ---------- チャットヒヤリング 挨拶プロンプト ----------

export function buildChatGreetingPrompt(params: {
  respondentName?: string | null
  projectTitle: string
  companyName?: string | null
  tone?: ToneType | null
  firstQuestion: string
}): string {
  const toneLabel: Record<string, string> = {
    friendly: '親しみやすい',
    professional: '丁寧な',
    casual: 'カジュアルな',
    formal: 'フォーマルな',
  }
  const tone = params.tone ? toneLabel[params.tone] || '丁寧な' : '丁寧な'

  return `ヒヤリングの最初の挨拶メッセージを生成してください。${tone}口調で書いてください。

回答者: ${params.respondentName || '回答者'}さん
テーマ: ${params.projectTitle}
${params.companyName ? `依頼元: ${params.companyName}` : ''}

挨拶では以下を含めてください：
1. 自己紹介（AIヒヤリング担当であること）
2. ヒヤリングの目的と所要時間（10〜15分程度）の目安
3. リラックスして答えてほしいこと
4. 最初の質問: 「${params.firstQuestion}」

JSON形式で返してください:
{
  "reply": "挨拶テキスト（最初の質問を含む）",
  "topicIndex": 0,
  "messageType": "greeting",
  "shouldEndInterview": false
}`
}
