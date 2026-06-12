// ============================================
// ドヤ営業管理（SFA）AI機能（全プラン標準搭載）
// テキスト生成は @seo/lib/gemini（既定 gemini-2.0-flash、JSONはgeminiGenerateJson）。
// ============================================
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'

export interface LeadScoreInput {
  name: string
  industry?: string | null
  prefecture?: string | null
  employeeCount?: number | null
  capital?: number | null
  status?: string | null
  note?: string | null
  source?: string | null
}

export interface LeadScoreResult {
  score: number // 0-100（受注確度）
  reason: string // スコアの根拠（1〜2文）
  nextAction: string // 推奨する次の一手
}

/** リードスコアリング：企業属性から受注確度を0-100で推定し、根拠＋次アクションを返す。 */
export async function scoreLead(input: LeadScoreInput): Promise<LeadScoreResult> {
  const facts = [
    `企業/リード名: ${input.name}`,
    input.industry ? `業界: ${input.industry}` : '',
    input.prefecture ? `地域: ${input.prefecture}` : '',
    input.employeeCount != null ? `従業員数: ${input.employeeCount}` : '',
    input.capital != null ? `資本金: ${input.capital}` : '',
    input.status ? `現在のステータス: ${input.status}` : '',
    input.source ? `流入元: ${input.source}` : '',
    input.note ? `メモ: ${input.note.slice(0, 500)}` : '',
  ].filter(Boolean).join('\n')

  const prompt = [
    'あなたは日本のBtoB営業のエキスパートです。次のリード情報から「受注に至る確度」を0〜100で評価してください。',
    '企業属性（業界/規模/資本金/地域）と現在のステータスを踏まえ、現実的かつ具体的に判断します。',
    '',
    facts,
    '',
    '次のJSONのみを日本語で出力（マークダウン・コードフェンス禁止）:',
    '{',
    '  "score": 0から100の整数,',
    '  "reason": "スコアの根拠を1〜2文で",',
    '  "nextAction": "今すぐ取るべき次の一手を1文で"',
    '}',
  ].join('\n')

  const r = await geminiGenerateJson<LeadScoreResult>(
    { prompt, model: GEMINI_TEXT_MODEL_DEFAULT },
    'SfaLeadScore'
  )
  return {
    score: typeof r?.score === 'number' ? Math.max(0, Math.min(100, Math.round(r.score))) : 0,
    reason: r?.reason || '',
    nextAction: r?.nextAction || '',
  }
}

export interface NextActionInput {
  dealName: string
  accountName?: string | null
  amount?: number | null
  stageName?: string | null
  probability?: number | null
  daysSinceLastActivity?: number | null
  recentActivities?: string[] // 直近の活動（時系列・新しい順）
}

export interface NextActionTaskCandidate {
  title: string // タスク名（例: 見積書を送付する）
  dueDate: string | null // 'YYYY-MM-DD'（提案期日。不明なら null）
}

export interface NextActionResult {
  nextAction: string // 推奨アクション（1文）
  reason: string // なぜ今それか
  risk: string // 失注リスクの所見（1文。無ければ空）
  tasks: NextActionTaskCandidate[] // そのまま登録できるタスク候補（2〜4件）
}

/** 次アクション提案：停滞・履歴から商談の「次の一手」「失注リスク」と、登録可能なタスク候補を提案。 */
export async function suggestNextAction(input: NextActionInput): Promise<NextActionResult> {
  const facts = [
    `商談名: ${input.dealName}`,
    input.accountName ? `取引先: ${input.accountName}` : '',
    input.amount != null ? `金額: ¥${input.amount.toLocaleString('ja-JP')}` : '',
    input.stageName ? `現在のステージ: ${input.stageName}` : '',
    input.probability != null ? `確度: ${input.probability}%` : '',
    input.daysSinceLastActivity != null ? `最終活動からの経過日数: ${input.daysSinceLastActivity}日` : '',
    input.recentActivities && input.recentActivities.length
      ? `直近の活動:\n${input.recentActivities.slice(0, 8).map((a) => `- ${a}`).join('\n')}`
      : '直近の活動: 記録なし',
  ].filter(Boolean).join('\n')

  // 期日提案の基準日（AIに「3日後」等を実日付で計算させる）
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const prompt = [
    'あなたは日本のBtoB営業のマネージャーです。次の商談を前に進めるための「次の一手」を提案してください。',
    '停滞（最終活動からの経過）・ステージ・履歴を踏まえ、今日からできる具体的な行動を示します。',
    `今日の日付: ${todayStr}`,
    '',
    facts,
    '',
    'あわせて、この商談を進めるために登録すべき具体的なタスク候補を2〜4件提案してください。',
    'タスク名は「〜する」で終わる短い行動（30文字以内）。期日は今日以降の現実的な日付（緊急なら1〜3日後、通常は1週間前後）。',
    '',
    '次のJSONのみを日本語で出力（マークダウン・コードフェンス禁止）:',
    '{',
    '  "nextAction": "推奨する次の一手を1文で",',
    '  "reason": "なぜ今それが有効かを1文で",',
    '  "risk": "失注リスクの所見を1文で（特になければ空文字）",',
    '  "tasks": [{"title": "タスク名", "dueDate": "YYYY-MM-DD"}, ...]',
    '}',
  ].join('\n')

  const r = await geminiGenerateJson<NextActionResult>(
    { prompt, model: GEMINI_TEXT_MODEL_DEFAULT },
    'SfaNextAction'
  )
  // タスク候補のサニタイズ（型崩れ・過去日・件数超過をここで吸収）
  const tasks: NextActionTaskCandidate[] = Array.isArray(r?.tasks)
    ? r.tasks
        .filter((t): t is NextActionTaskCandidate => !!t && typeof (t as any).title === 'string' && !!(t as any).title.trim())
        .slice(0, 4)
        .map((t) => {
          let due: string | null = null
          if (typeof t.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate)) {
            due = t.dueDate < todayStr ? todayStr : t.dueDate // 過去日は今日に丸める
          }
          return { title: t.title.trim().slice(0, 100), dueDate: due }
        })
    : []
  return {
    nextAction: r?.nextAction || '',
    reason: r?.reason || '',
    risk: r?.risk || '',
    tasks,
  }
}
