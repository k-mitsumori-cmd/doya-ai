// ============================================
// ドヤ面接官 質問セット＋ルーブリック生成（F3-4, F3-5）
// ============================================
// 構造化面接（全応募者に同じ主質問・同じ評価基準）を既定とする。
// 差別的質問はプロンプト制約（GUARDRAIL_PROMPT）＋生成後の機械チェックの二段で排除する。
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { GUARDRAIL_PROMPT, stripViolations, type GuardrailViolation } from './guardrails'
import { LEVEL_LABELS, type CompanyProfileData, type GeneratedTemplate, type MensetsuLevel } from './types'

export interface GenerateTemplateInput {
  profile: CompanyProfileData
  jobTitle: string
  level: MensetsuLevel
  durationMin: number
  /** 担当者が特に見たい点（任意） */
  focus?: string
}

/** 所要時間から主質問の本数を決める（深掘り2回ぶんの余白を見込む） */
function questionCountFor(durationMin: number): number {
  if (durationMin <= 10) return 5
  if (durationMin <= 20) return 8
  return 12
}

export async function generateTemplate(input: GenerateTemplateInput): Promise<{
  template: GeneratedTemplate
  removed: GuardrailViolation[]
}> {
  const { profile, jobTitle, level, durationMin, focus } = input
  const qCount = questionCountFor(durationMin)

  const prompt = [
    'あなたは構造化面接の設計に長けた採用のプロです。',
    '以下の企業情報と募集要件に基づき、面接の「評価軸（ルーブリック付き）」と「主質問」を設計してください。',
    '',
    GUARDRAIL_PROMPT,
    '',
    '【設計方針】',
    '- 構造化面接: 全応募者に同じ主質問・同じ基準で評価する',
    '- 質問は行動事実を引き出す形（過去の具体的な経験を尋ねる）を優先する',
    '- 評価軸は5〜7個。各軸に1〜5点の到達基準（ルーブリック）を必ず書く',
    `- 主質問は ${qCount} 問ちょうど`,
    '- 各主質問には「深掘りの方針」を書く（面接AIが最大2回まで追加質問するときの指針）',
    '- ルーブリックは「観察可能な事実」で書く。「意欲が高い」ではなく「自ら課題を定義し、他者を巻き込んで完遂した経験を具体的に説明できる」のように書く',
    '',
    '【出力するJSONの形式】',
    '{',
    '  "criteria": [',
    '    { "key": "英数字の短いキー", "name": "評価軸名", "description": "何を見る軸か",',
    '      "rubric": { "1": "...", "2": "...", "3": "...", "4": "...", "5": "..." }, "weight": 1 }',
    '  ],',
    '  "questions": [',
    '    { "text": "主質問", "followUpHint": "深掘りの方針", "targetMin": 3, "criterionKeys": ["key1"] }',
    '  ],',
    '  "intro": "面接冒頭でAI面接官が話す挨拶と進め方（120字程度）",',
    '  "closing": "面接の締めでAI面接官が話す文面（80字程度）"',
    '}',
    '',
    '【企業情報】',
    `会社名: ${profile.companyName || '（不明）'}`,
    `事業内容: ${profile.business || '（不明）'}`,
    `提供価値: ${profile.valueProp || '（不明）'}`,
    `カルチャー: ${profile.culture || '（不明）'}`,
    `求める人物像: ${profile.idealProfile || '（不明）'}`,
    '',
    '【募集要件】',
    `職種: ${jobTitle}`,
    `レベル: ${LEVEL_LABELS[level]}`,
    `面接時間: ${durationMin}分`,
    focus ? `特に見たい点: ${focus}` : '',
    '',
    'intro には「AIが面接を行うこと」「録音・記録されること」を必ず含めてください。',
  ]
    .filter(Boolean)
    .join('\n')

  const raw = await geminiGenerateJson<GeneratedTemplate>(
    { prompt, model: GEMINI_TEXT_MODEL_DEFAULT },
    'MensetsuTemplate'
  )

  // --- 生成後の安全網: 禁止領域に触れる質問を機械的に除去 ---
  const { kept, removed } = stripViolations(raw.questions || [])

  // --- 正規化: keyの重複排除、criterionKeys の実在チェック ---
  const seen = new Set<string>()
  const criteria = (raw.criteria || [])
    .filter((c) => c && c.key && c.name)
    .map((c, i) => {
      let key = String(c.key).replace(/[^a-zA-Z0-9_]/g, '') || `c${i + 1}`
      while (seen.has(key)) key = `${key}_${i + 1}`
      seen.add(key)
      return {
        key,
        name: String(c.name),
        description: String(c.description || ''),
        rubric: c.rubric,
        weight: Number.isFinite(c.weight) ? Math.max(1, Math.min(5, Number(c.weight))) : 1,
      }
    })

  const validKeys = new Set(criteria.map((c) => c.key))
  const questions = kept.map((q) => ({
    text: String(q.text),
    followUpHint: String(q.followUpHint || ''),
    targetMin: Number.isFinite(q.targetMin) ? Math.max(1, Math.min(10, Number(q.targetMin))) : 3,
    // 実在しない軸を指していたら空にする（採点時の参照切れを防ぐ）
    criterionKeys: (q.criterionKeys || []).filter((k) => validKeys.has(k)),
  }))

  return {
    template: {
      criteria,
      questions,
      intro: String(raw.intro || ''),
      closing: String(raw.closing || ''),
    },
    removed,
  }
}
