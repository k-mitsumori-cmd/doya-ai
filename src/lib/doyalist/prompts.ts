export function buildTargetSuggestionPrompt(serviceDesc: string, strengths: string, hint?: string): string {
  return `あなたは日本のBtoB営業戦略のプロフェッショナルです。以下のサービス情報をもとに、最も効果的な営業ターゲット条件を提案してください。

【自社サービスの説明】
${serviceDesc}

【自社の強み・差別化ポイント】
${strengths}

${hint ? `【ユーザーからの補足情報】\n${hint}` : ''}

以下のJSON形式で回答してください（JSON以外の文字は含めないでください）:
{
  "industries": ["推奨業種1", "推奨業種2"],
  "areas": ["推奨エリア（都道府県）1", "推奨エリア2"],
  "keywords": ["ターゲット企業を見つけるための検索キーワード1", "キーワード2"],
  "companySize": {
    "minEmployees": 10,
    "maxEmployees": 100
  },
  "reasoning": "この条件を推奨する理由（200字以内）",
  "approachTips": "このターゲット層への効果的なアプローチ方法（200字以内）"
}`
}

export function buildCompanyAnalysisPrompt(
  companyName: string,
  companyInfo: { industry?: string; address?: string; website?: string; employeeCount?: string },
  serviceDesc: string,
  strengths: string
): string {
  const info = [
    companyInfo.industry && `業種: ${companyInfo.industry}`,
    companyInfo.address && `所在地: ${companyInfo.address}`,
    companyInfo.website && `Webサイト: ${companyInfo.website}`,
    companyInfo.employeeCount && `従業員数: ${companyInfo.employeeCount}`,
  ].filter(Boolean).join('\n')

  return `あなたは営業インテリジェンスのプロフェッショナルです。以下の企業と自社サービスのマッチ度を分析してください。

【分析対象企業】
企業名: ${companyName}
${info}

【自社サービス】
${serviceDesc}

【自社の強み】
${strengths}

以下のJSON形式で回答してください（JSON以外の文字は含めないでください）:
{
  "matchScore": 75,
  "needsAnalysis": "この企業が自社サービスを必要とする可能性の分析（150字以内）",
  "approachAdvice": "この企業への推奨アプローチ方法（150字以内）",
  "riskFlags": "注意すべきリスクや懸念事項（なければ空文字）"
}`
}

export function buildApproachPrompt(
  companyName: string,
  companyInfo: { industry?: string; needsAnalysis?: string; approachAdvice?: string },
  serviceDesc: string,
  type: 'email' | 'form' | 'letter' | 'phone_script',
  tone: string = 'formal'
): string {
  const typeLabel: Record<string, string> = {
    email: '営業メール',
    form: '問い合わせフォーム',
    letter: 'DM・手紙',
    phone_script: '電話営業スクリプト',
  }

  const toneLabel: Record<string, string> = {
    formal: 'フォーマル（敬語）',
    casual: 'カジュアル（親しみやすい）',
    consultative: 'コンサルティング（専門的）',
  }

  return `あなたはBtoB営業のプロフェッショナルです。以下の情報をもとに、${typeLabel[type]}の文面を作成してください。

【アプローチ先企業】
企業名: ${companyName}
${companyInfo.industry ? `業種: ${companyInfo.industry}` : ''}
${companyInfo.needsAnalysis ? `ニーズ分析: ${companyInfo.needsAnalysis}` : ''}
${companyInfo.approachAdvice ? `推奨アプローチ: ${companyInfo.approachAdvice}` : ''}

【自社サービス】
${serviceDesc}

【トーン】
${toneLabel[tone] || toneLabel.formal}

【要件】
- 企業の特性に合わせてパーソナライズすること
- 押し売り感のない、価値提案型の文面にすること
- 具体的なアクション（面談依頼、資料送付等）を含めること

以下のJSON形式で回答してください（JSON以外の文字は含めないでください）:
{
  "subject": "${type === 'email' ? '件名（30字以内）' : ''}",
  "body": "本文（${type === 'phone_script' ? '話し言葉で' : ''}）"
}`
}
