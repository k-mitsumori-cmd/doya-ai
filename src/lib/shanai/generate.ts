// ============================================
// ドヤ社内インタビュー 追加質問・事実抽出・記事生成
// ============================================
// ⚠️ 2段構えにする。
//    1. 素材（文字起こし／アンケート回答）と会社プロフィールから「事実」だけを抜き出す（原文引用つき）
//    2. 利用者が確認した事実だけを渡して記事を書かせる。各ブロックは根拠の事実番号を持つ
//    素材に無いこと（数字・制度・エピソード）を書かせないための構造。
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { quoteExists } from './evidence'
import { SURVEY_QUESTIONS, findQuestion, followupCandidates } from './survey'
import {
  clip,
  oneOf,
  PURPOSE_LABELS,
  TONE_LABELS,
  type ArticleBlock,
  type BlockType,
  type FactCategory,
  type ShanaiPurpose,
  type ShanaiTone,
  type SurveyAnswers,
  type TranscriptSegmentDto,
} from './types'

const FACT_CATEGORIES: readonly FactCategory[] = ['career', 'work', 'episode', 'value', 'team', 'future', 'company', 'other']
const BLOCK_TYPES: readonly BlockType[] = ['heading', 'qa', 'paragraph', 'quote', 'company']
const TRANSCRIPT_PROMPT_MAX = 60000

// ---------- 追加質問 ----------

/**
 * 回答が短い設問に、具体的なエピソードを引き出す追加質問を1つずつ作る。
 * 返り値は { 設問ID: 追加質問 }。対象が無ければ空。
 */
export async function generateFollowups(answers: SurveyAnswers, intervieweeName: string): Promise<Record<string, string>> {
  const ids = followupCandidates(answers)
  if (ids.length === 0) return {}
  const list = ids
    .map((id) => {
      const q = findQuestion(id)!
      return `- 設問ID: ${id}\n  設問: ${q.question}\n  回答: ${answers[id]?.answer || ''}`
    })
    .join('\n')
  const prompt = [
    `社員インタビューのアンケートで、${intervieweeName || '回答者'}さんの回答をより具体的にするための追加質問を作ってください。`,
    '回答にすでに書かれている内容を踏まえ、「いつ・誰と・何をして・どうなったか」や、そのときの気持ちを引き出す質問にしてください。',
    '1設問につき1つ、60字以内、丁寧な敬語で。回答者を責める言い方や、答えを誘導する言い方はしないでください。',
    '',
    list,
    '',
    '【出力するJSONの形式】',
    '{ "followups": [ { "id": "設問ID", "question": "追加質問" } ] }',
  ].join('\n')
  const raw = await geminiGenerateJson<{ followups?: { id?: string; question?: string }[] }>(
    { prompt, model: GEMINI_TEXT_MODEL_DEFAULT, generationConfig: { temperature: 0.4 } },
    'ShanaiFollowups'
  )
  const out: Record<string, string> = {}
  for (const f of Array.isArray(raw?.followups) ? raw!.followups! : []) {
    const id = String(f?.id || '')
    const question = clip(f?.question, 120)
    if (ids.includes(id) && question) out[id] = question
  }
  return out
}

// ---------- 事実の抽出 ----------

export interface ExtractedFact {
  sourceType: 'transcript' | 'answer' | 'company'
  sourceRef: string
  category: FactCategory
  statement: string
  quote: string
}

export interface CompanyItemForFacts {
  id: string
  category: string
  statement: string
  quote: string | null
  sourceId: string | null
}

interface RawFact {
  ref?: string | number
  category?: string
  statement?: string
  quote?: string
}

function transcriptLines(segments: TranscriptSegmentDto[]): string {
  let out = ''
  for (let i = 0; i < segments.length; i++) {
    const line = `[${i}] ${segments[i].speaker ? `話者${segments[i].speaker}` : '話者'}: ${segments[i].text}\n`
    if (out.length + line.length > TRANSCRIPT_PROMPT_MAX) break
    out += line
  }
  return out
}

function answerLines(answers: SurveyAnswers): string {
  return SURVEY_QUESTIONS.filter((q) => answers[q.id]?.answer || answers[q.id]?.followupAnswer)
    .map((q) => {
      const a = answers[q.id]
      const parts = [`[${q.id}] 設問: ${q.question}`, `回答: ${a.answer || ''}`]
      if (a.followupQuestion && a.followupAnswer) parts.push(`追加質問: ${a.followupQuestion}`, `追加回答: ${a.followupAnswer}`)
      return parts.join('\n')
    })
    .join('\n\n')
}

/**
 * 素材から事実を抜き出す。引用が原文に無い事実は捨てる。
 * 会社の事実は、プロフィール項目から機械的に選ぶ（AIに会社の事実を作らせない）。
 */
export async function extractFacts(input: {
  mode: 'voice' | 'survey'
  intervieweeName: string
  segments?: TranscriptSegmentDto[]
  answers?: SurveyAnswers
  companyItems: CompanyItemForFacts[]
  serviceSourceIds: string[]
}): Promise<ExtractedFact[]> {
  const facts: ExtractedFact[] = []
  const isVoice = input.mode === 'voice'
  const segments = input.segments || []
  const answers = input.answers || {}
  const material = isVoice ? transcriptLines(segments) : answerLines(answers)
  if (!material.trim()) return []

  const prompt = [
    `以下は、社員（${input.intervieweeName || '社員'}さん）へのインタビューの${isVoice ? '文字起こし' : 'アンケート回答'}です。`,
    '社員インタビュー記事の材料になる「事実」を抜き出してください。',
    '',
    '【厳守】',
    isVoice
      ? '- 聞き手の質問ではなく、社員本人が話した内容から抜き出す。聞き手と本人は文脈で判断する。'
      : '- 回答者本人が書いた内容から抜き出す。',
    '- quote には原文をそのまま（一字一句変えずに）10〜150字で写す。要約・言い換えはしない。言い淀み（えー、あの）は含めてよい。',
    '- statement は quote の内容を、記事で使える自然な一文（80字以内）にする。quote に無い情報を足さない。',
    `- ref には、quote を写した${isVoice ? '行番号（[ ] 内の数字）' : '設問ID（[ ] 内の英字）'}を入れる。`,
    '- 人柄が伝わる具体的なエピソード・数字・固有名詞を優先する。抽象的な感想だけの事実は少なめに。',
    '- 25〜40件。重複は1件にまとめる。',
    '',
    'category は次のいずれか: career（経歴・入社のきっかけ）, work（仕事内容）, episode（具体的なエピソード）, value（大切にしていること）, team（チーム・職場）, future（これからの目標）, other',
    '',
    '【出力するJSONの形式】',
    '{ "facts": [ { "ref": ..., "category": "...", "statement": "...", "quote": "..." } ] }',
    '',
    `【${isVoice ? '文字起こし' : 'アンケート回答'}】`,
    material,
  ].join('\n')

  const raw = await geminiGenerateJson<{ facts?: RawFact[] }>(
    { prompt, model: GEMINI_TEXT_MODEL_DEFAULT, generationConfig: { temperature: 0.2 } },
    'ShanaiFacts'
  )

  for (const f of Array.isArray(raw?.facts) ? raw!.facts!.slice(0, 50) : []) {
    const quote = clip(f?.quote, 500)
    const statement = clip(f?.statement, 240)
    if (!quote || !statement) continue
    if (isVoice) {
      const i = Number(f?.ref)
      if (!Number.isInteger(i) || i < 0 || i >= segments.length) continue
      // 発言が行をまたぐことがあるため、前後1行まで含めて照合する
      const window = segments.slice(Math.max(0, i - 1), i + 2).map((s) => s.text).join('')
      if (!quoteExists(quote, window)) continue
      facts.push({ sourceType: 'transcript', sourceRef: String(i), category: oneOf(f?.category, FACT_CATEGORIES, 'other'), statement, quote })
    } else {
      const id = String(f?.ref || '')
      const a = answers[id]
      if (!a) continue
      if (!quoteExists(quote, `${a.answer || ''}\n${a.followupAnswer || ''}`)) continue
      facts.push({ sourceType: 'answer', sourceRef: id, category: oneOf(f?.category, FACT_CATEGORIES, 'other'), statement, quote })
    }
  }

  // 会社の事実: 関わるサービスの項目を優先し、ミッション・数字・カルチャー・制度から補う
  const serviceIds = new Set(input.serviceSourceIds)
  const priority = (c: CompanyItemForFacts) =>
    (c.sourceId && serviceIds.has(c.sourceId) ? 0 : 10) + (['mission', 'service', 'number', 'culture', 'benefit', 'business'].indexOf(c.category) + 1 || 7)
  const picked = [...input.companyItems].sort((a, b) => priority(a) - priority(b)).slice(0, 15)
  for (const c of picked) {
    facts.push({ sourceType: 'company', sourceRef: c.id, category: 'company', statement: c.statement, quote: c.quote || c.statement })
  }
  return facts
}

// ---------- 記事の生成 ----------

export interface FactForArticle {
  id: string
  sourceType: string
  category: string
  statement: string
  quote: string
}

export interface GeneratedArticle {
  title: string
  lead: string
  catchphrase: string
  blocks: ArticleBlock[]
}

interface RawArticle {
  title?: string
  lead?: string
  catchphrase?: string
  blocks?: { type?: string; heading?: string; question?: string; body?: string; facts?: (string | number)[] }[]
}

export async function generateArticle(input: {
  companyName: string
  intervieweeName: string
  department: string
  position: string
  joinYear: string
  purpose: ShanaiPurpose
  tone: ShanaiTone
  roleInService: string
  serviceNames: string[]
  facts: FactForArticle[]
}): Promise<GeneratedArticle> {
  // AIには短い番号（F1, F2…）で事実を指させ、こちらで実IDに戻す
  const keyToId = new Map<string, string>()
  const factLines = input.facts
    .map((f, i) => {
      const key = `F${i + 1}`
      keyToId.set(key, f.id)
      const kind = f.sourceType === 'company' ? '会社' : '本人'
      return `${key}（${kind}・${f.category}）: ${f.statement}\n    原文: ${f.quote}`
    })
    .join('\n')

  const profile = [
    `氏名: ${input.intervieweeName}`,
    input.department && `部署: ${input.department}`,
    input.position && `役職: ${input.position}`,
    input.joinYear && `入社: ${input.joinYear}`,
    input.serviceNames.length > 0 && `関わっているサービス: ${input.serviceNames.join('、')}`,
    input.roleInService && `サービスでの役割: ${input.roleInService}`,
  ]
    .filter(Boolean)
    .join('\n')

  const prompt = [
    `あなたは採用広報を専門にする編集者です。${input.companyName || '会社'}の社員インタビュー記事を書いてください。`,
    `読んだ人が「この会社で働く人は魅力的だ」「この会社をもっと知りたい」と感じる記事にします。`,
    '',
    `記事の目的: ${PURPOSE_LABELS[input.purpose]}`,
    `文体: ${TONE_LABELS[input.tone]}（です・ます調）`,
    '',
    '【社員のプロフィール】',
    profile,
    '',
    '【使ってよい事実（これ以外の情報は書かない）】',
    factLines,
    '',
    '【厳守】',
    '- 上の事実に書かれていないこと（数字・制度・出来事・感情・固有名詞）は一切書かない。想像で補わない。',
    '- 各ブロックの facts には、そのブロックの根拠にした事実番号（F1 など）をすべて入れる。根拠の無いブロックは作らない。',
    '- 本人の言葉は「原文」を活かし、話し言葉の言い淀みだけ整える。意味を変えない。',
    '- 会社の事実（会社）は、本人のエピソードとつなげて紹介する。会社の宣伝だけの段落にしない。',
    '- 「quote」ブロックの body は、本人の原文から印象的な一言をほぼそのまま抜き出す（60字以内）。',
    '',
    '【構成】',
    '1. title: 記事タイトル（32字以内。本人の言葉や仕事の核心を入れる）',
    '2. lead: リード文（150〜250字。誰が・どんな仕事を・何を大切にしているか）',
    '3. catchphrase: サムネイル画像に載せる一言（20字以内、本人の言葉から）',
    '4. blocks: 本文。次の流れで 7〜12 ブロック。',
    '   - heading で章見出しを置き、その下に qa（question＝聞き手の質問、body＝本人の答え）を並べる',
    '   - 流れ: 入社のきっかけ → いまの仕事 → 印象に残ったエピソード → 大切にしていること・チーム → 会社について（company） → これからの目標・読者へのメッセージ',
    '   - 途中に quote を1つ入れる',
    '   - company ブロックは1〜2つ。本人の仕事が会社の事業やサービスのどこにつながっているかを書く',
    '   - 本文全体で 2,500〜4,000字',
    '',
    '【出力するJSONの形式】',
    '{ "title": "...", "lead": "...", "catchphrase": "...", "blocks": [ { "type": "heading|qa|paragraph|quote|company", "heading": "（headingのとき）", "question": "（qaのとき）", "body": "...", "facts": ["F1", "F3"] } ] }',
  ].join('\n')

  const raw = await geminiGenerateJson<RawArticle>(
    { prompt, model: GEMINI_TEXT_MODEL_DEFAULT, generationConfig: { temperature: 0.5, maxOutputTokens: 12000 } },
    'ShanaiArticle'
  )

  const factById = new Map(input.facts.map((f) => [f.id, f]))
  const blocks: ArticleBlock[] = []
  for (const b of Array.isArray(raw?.blocks) ? raw!.blocks!.slice(0, 30) : []) {
    const type = oneOf(b?.type, BLOCK_TYPES, 'paragraph')
    const heading = clip(b?.heading, 80)
    const body = clip(b?.body, 3000)
    if (type === 'heading') {
      if (heading || body) blocks.push({ type, heading: heading || body, body: '', factIds: [] })
      continue
    }
    if (!body) continue
    const factIds = [...new Set((Array.isArray(b?.facts) ? b!.facts! : []).map((k) => keyToId.get(String(k).trim().toUpperCase())).filter((x): x is string => !!x))]
    let unsupported = factIds.length === 0
    // 引用ブロックは、根拠の事実の原文に実在する言葉でなければ警告する
    if (type === 'quote' && !unsupported) {
      const sources = factIds.map((id) => factById.get(id)?.quote || '').join('\n')
      if (!quoteExists(body.replace(/^[「『]|[」』]$/g, ''), sources)) unsupported = true
    }
    blocks.push({
      type,
      ...(type === 'qa' ? { question: clip(b?.question, 200) } : {}),
      body,
      factIds,
      ...(unsupported ? { unsupported: true } : {}),
    })
  }

  if (blocks.filter((b) => b.type !== 'heading').length === 0) throw new Error('記事の本文が空でした')

  return {
    title: clip(raw?.title, 80) || `${input.intervieweeName}さんインタビュー`,
    lead: clip(raw?.lead, 800),
    catchphrase: clip(raw?.catchphrase, 40),
    blocks,
  }
}

/** 利用者が編集した本文ブロックの正規化（保存時） */
export function sanitizeBlocks(raw: unknown, validFactIds: Set<string>): ArticleBlock[] {
  const out: ArticleBlock[] = []
  for (const b of Array.isArray(raw) ? raw.slice(0, 60) : []) {
    const type = oneOf((b as any)?.type, BLOCK_TYPES, 'paragraph')
    const factIds = (Array.isArray((b as any)?.factIds) ? (b as any).factIds : []).filter((id: unknown) => typeof id === 'string' && validFactIds.has(id))
    const block: ArticleBlock = {
      type,
      body: clip((b as any)?.body, 5000),
      factIds,
    }
    if (type === 'heading') block.heading = clip((b as any)?.heading, 120)
    if (type === 'qa') block.question = clip((b as any)?.question, 300)
    if (type !== 'heading' && factIds.length === 0) block.unsupported = true
    if (type === 'heading' ? block.heading : block.body) out.push(block)
  }
  return out
}
