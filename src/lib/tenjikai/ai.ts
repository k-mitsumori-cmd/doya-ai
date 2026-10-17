// ============================================
// ドヤ展示会: LLM で文面を作る（サーバー専用）
// ============================================
// ⚠️ LLM に任せるのは文面だけ。寸法・金額・数量・締切は engine.ts のルール計算を使う。
// ⚠️ 返ってきた JSON は信用しない。項目ごとに検査し、欠けたものは engine.ts の下書きで埋める。
// ⚠️ 呼び出し元（/api/tenjikai/generate）でログインと利用枠を確認してから呼ぶこと。
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { safeFetchText, htmlToText } from '@/lib/net/safe-fetch'
import {
  GOAL_LABEL,
  POSITION_LABEL,
  analyzeSite,
  boothSize,
  generateBoothPlans,
  generateCreatives,
  type BoothCopy,
  type BoothPlan,
  type CreativeCopy,
  type CreativeKind,
  type GeneratedPlan,
  type ProjectInput,
  type SiteAnalysis,
} from './engine'

const MAX_SITE_CHARS = 12000

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const hex = (v: unknown) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim().toLowerCase() : '')

function brief(input: ProjectInput) {
  const { w, d, venue } = boothSize(input)
  return [
    `展示会: ${input.eventName}（${venue.name}、${input.days}日間）`,
    `ブース: ${input.komaCols * input.komaRows}小間 ${w}m × ${d}m、${POSITION_LABEL[input.position]}、高さ上限 ${venue.maxHeightM}m`,
    `出展の目的: ${GOAL_LABEL[input.goal]}`,
    `当日のスタッフ: ${input.staff}名`,
  ].join('\n')
}

function analysisText(a: SiteAnalysis) {
  return [
    `ブランド: ${a.brand}（${a.category}）`,
    `キャッチ: ${a.headline.replace(/\n/g, '')}`,
    `訴求点: ${a.valueProps.map((v) => `${v.title}（${v.body}）`).join(' / ')}`,
    `ターゲット: ${a.targets.join('、')}`,
    `トーン: ${a.tone}`,
  ].join('\n')
}

// ---------- サイト解析 ----------

export async function aiAnalyzeSite(url: string): Promise<SiteAnalysis> {
  const draft = analyzeSite(url)
  const html = await safeFetchText(url.startsWith('http') ? url : `https://${url}`).catch(() => null)
  const text = html ? htmlToText(html).slice(0, MAX_SITE_CHARS) : ''
  if (text.length < 200) throw new Error('サイトの内容を読み取れませんでした')
  const themeColor = html?.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-fA-F]{6})["']/i)?.[1] ?? ''

  const prompt = [
    'あなたはBtoB展示会のブース企画を担当するプランナーです。',
    '以下のWebサイトの内容から、展示会ブースで伝えるべき要点を読み取ってください。',
    '',
    '【制約】',
    '- サイトに書かれていない実績・数字・受賞歴を作らないこと。',
    '- headline は通路から読める短いキャッチ（全角20字以内）。改行位置に \\n を1つ入れてよい。',
    '- valueProps はちょうど3つ。title は全角12字以内、body は全角40字以内。',
    '- targets は2〜3つ。colors はサイトのブランドに近い #RRGGBB。わからなければ空文字。',
    themeColor ? `- サイトの theme-color は ${themeColor}。` : '',
    '',
    '【出力するJSONの形式】',
    '{"brand":"","category":"","headline":"","subline":"","valueProps":[{"title":"","body":""}],"targets":[""],"colors":{"primary":"","secondary":"","accent":""},"tone":""}',
    '',
    `【URL】${url}`,
    '【サイトの内容】',
    text,
  ].join('\n')

  const raw = await geminiGenerateJson<Record<string, any>>({ prompt, model: GEMINI_TEXT_MODEL_DEFAULT, generationConfig: { temperature: 0.4 } }, 'TenjikaiSiteAnalysis')

  const valueProps = Array.isArray(raw?.valueProps)
    ? raw.valueProps.map((v: any) => ({ title: str(v?.title, 24), body: str(v?.body, 80) })).filter((v: { title: string; body: string }) => v.title && v.body).slice(0, 3)
    : []
  const targets = Array.isArray(raw?.targets) ? raw.targets.map((t: unknown) => str(t, 40)).filter(Boolean).slice(0, 3) : []
  return {
    brand: str(raw?.brand, 40) || draft.brand,
    domain: draft.domain,
    category: str(raw?.category, 60) || draft.category,
    headline: str(raw?.headline, 40) || draft.headline,
    subline: str(raw?.subline, 80) || draft.subline,
    valueProps: valueProps.length === 3 ? valueProps : draft.valueProps,
    targets: targets.length ? targets : draft.targets,
    colors: {
      primary: hex(raw?.colors?.primary) || hex(themeColor) || draft.colors.primary,
      secondary: hex(raw?.colors?.secondary) || draft.colors.secondary,
      accent: hex(raw?.colors?.accent) || draft.colors.accent,
    },
    tone: str(raw?.tone, 40) || draft.tone,
  }
}

// ---------- ブース設営案 ----------

export async function aiBoothCopy(a: SiteAnalysis, input: ProjectInput): Promise<GeneratedPlan['boothCopy']> {
  const plans = generateBoothPlans(input)
  const prompt = [
    'あなたはBtoB展示会のブース企画を担当するプランナーです。',
    '3つのブース案（A/B/C）の型と配置は決まっています。各案の名前・コンセプト・来場者の動線を、この出展者向けに書き直してください。',
    '部材の追加や寸法・金額には触れないこと。',
    '- name は全角12字以内。concept は全角90字以内で、何をどう見せて誰を止めるか。flow は「通路 → … → …」の形で全角50字以内。',
    '',
    '【出展者】',
    analysisText(a),
    '',
    '【出展条件】',
    brief(input),
    '',
    '【決まっている3案】',
    ...plans.map((p) => `${p.variant}: ${p.name} / ${p.concept} / 部材: ${p.elements.map((e) => e.label).join('、')}`),
    '',
    '【出力するJSONの形式】',
    '{"A":{"name":"","concept":"","flow":""},"B":{"name":"","concept":"","flow":""},"C":{"name":"","concept":"","flow":""}}',
  ].join('\n')

  const raw = await geminiGenerateJson<Record<string, any>>({ prompt, model: GEMINI_TEXT_MODEL_DEFAULT, generationConfig: { temperature: 0.6 } }, 'TenjikaiBoothCopy')
  const out: GeneratedPlan['boothCopy'] = {}
  for (const v of ['A', 'B', 'C'] as BoothPlan['variant'][]) {
    const c: BoothCopy = { name: str(raw?.[v]?.name, 24), concept: str(raw?.[v]?.concept, 180), flow: str(raw?.[v]?.flow, 100) }
    if (c.name && c.concept && c.flow) out[v] = c
  }
  return out
}

// ---------- 制作物 ----------

export async function aiCreativeCopy(a: SiteAnalysis, input: ProjectInput): Promise<GeneratedPlan['creativeCopy']> {
  const creatives = generateCreatives(a, input)
  const prompt = [
    'あなたはBtoB展示会の制作物を担当するコピーライターです。',
    '以下の制作物それぞれに、載せるコピー（copy）と、その制作物の狙い・置き方（purpose）を書いてください。',
    'サイズ・数量・金額は決まっているので触れないこと。サイトに無い実績や数字を作らないこと。',
    '- copy は全角30字以内（loop はカットごとに「 / 」で区切って3つ）。purpose は全角60字以内。',
    '',
    '【出展者】',
    analysisText(a),
    '',
    '【出展条件】',
    brief(input),
    '',
    '【制作物】',
    ...creatives.map((c) => `${c.kind}: ${c.name}（${c.size}）`),
    '',
    '【出力するJSONの形式】',
    `{${creatives.map((c) => `"${c.kind}":{"copy":"","purpose":""}`).join(',')}}`,
  ].join('\n')

  const raw = await geminiGenerateJson<Record<string, any>>({ prompt, model: GEMINI_TEXT_MODEL_DEFAULT, generationConfig: { temperature: 0.7 } }, 'TenjikaiCreativeCopy')
  const out: GeneratedPlan['creativeCopy'] = {}
  for (const c of creatives) {
    const k = c.kind as CreativeKind
    const v: CreativeCopy = { copy: str(raw?.[k]?.copy, 80), purpose: str(raw?.[k]?.purpose, 120) }
    if (v.copy && v.purpose) out[k] = v
  }
  return out
}

/**
 * 解析 → ブース・制作物（並行）の順に作る。解析に失敗したら例外（呼び出し元でモックにする）。
 * ブース・制作物は片方が失敗しても、もう片方と解析は使う。
 */
export async function aiGeneratePlan(input: ProjectInput): Promise<GeneratedPlan> {
  const analysis = await aiAnalyzeSite(input.serviceUrl)
  const [booth, creative] = await Promise.allSettled([aiBoothCopy(analysis, input), aiCreativeCopy(analysis, input)])
  const partial = booth.status === 'rejected' || creative.status === 'rejected'
  if (booth.status === 'rejected') console.warn('[tenjikai] booth copy failed')
  if (creative.status === 'rejected') console.warn('[tenjikai] creative copy failed')
  return {
    source: 'ai',
    notice: partial ? '一部の文面はAIで作成できなかったため、下書きを表示しています。' : undefined,
    analysis,
    boothCopy: booth.status === 'fulfilled' ? booth.value : {},
    creativeCopy: creative.status === 'fulfilled' ? creative.value : {},
  }
}
