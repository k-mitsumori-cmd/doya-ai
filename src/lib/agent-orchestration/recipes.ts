// ============================================
// エージェントの「組み合わせ」（やりたいこと → 聞くこと → 動かすツール）
// ============================================
// 設計: docs/architecture/agent-orchestration/DESIGN.md §4・§5
// ⚠️ 画面（クライアント）とサーバーの両方が使う。秘密や DB の処理は書かない。
// ⚠️ サーバーは、画面から届いた答えを parseAnswers でもう一度確かめてから、ツールへの入力を作る
//    （画面が作った入力をそのまま各ツールへ流さない）。
// 第1段で動くのは「商談の準備」だけ。販促と採用は設計書に書き、ここにはまだ入れない。
import type { AgentActionId } from './types'

export interface AgentChoice {
  value: string
  label: string
}

export interface AgentQuestion {
  id: string
  label: string
  kind: 'text' | 'choice'
  options?: AgentChoice[]
  placeholder?: string
  /** 最初から入れておく例（T6 サンプル入力済み） */
  sample: string
  help?: string
}

export interface AgentRecipeTask {
  id: string
  /** 実行の操作（plan.ts の ACTION_CATALOG のキー） */
  action: AgentActionId
  /** 作戦の柱の id（AgentRecipe.pillars） */
  pillar: string
  toolId: 'shodan' | 'quote' | 'doyaslide'
  toolName: string
  /** 計画に出す一文（何をするか） */
  label: (a: SalesPrepAnswers) => string
  /** 何ができるか（計画の小さな文） */
  makes: string
  /** 利用枠・ドヤパワーの説明（計画に出す） */
  uses: string
  /** 動いている間に出す段（利用者の入力を入れる。T3） */
  stages: (a: SalesPrepAnswers) => string[]
  dependsOn?: string[]
}

export interface AgentRecipe {
  id: 'sales-prep'
  title: string
  /** 計画の最初に出す一文 */
  lead: string
  /** 作戦の目的と期間（答えから作る） */
  goal: (a: SalesPrepAnswers) => string
  period: string
  /** 作戦の柱 */
  pillars: { id: string; name: string; why: string }[]
  /** 入力した文にこの言葉があれば、この組み合わせを出す */
  keywords: string[]
  /** 入口のチップの文 */
  chip: string
  questions: AgentQuestion[]
  tasks: AgentRecipeTask[]
}

export interface SalesPrepAnswers {
  url: string
  domain: string
  offer: OfferKey
  offerLabel: string
  budget: BudgetKey
  budgetYen: number | null
  stage: StageKey
  stageLabel: string
  slideCount: number
}

type OfferKey = 'web' | 'ads' | 'saas' | 'consulting'
type BudgetKey = 'u50' | '50to200' | 'o200' | 'unknown'
type StageKey = 'first' | 'proposal' | 'closing'

const OFFERS: Record<OfferKey, { label: string; productName: string; deliveryModel: string; pricingAxis: string }> = {
  web: { label: 'Webサイトの制作', productName: 'Webサイト制作', deliveryModel: '受託制作', pricingAxis: '制作物単位' },
  ads: { label: '広告の運用', productName: '広告運用代行', deliveryModel: '運用代行', pricingAxis: '月額' },
  saas: { label: 'SaaS の導入', productName: 'SaaS 導入支援', deliveryModel: 'SaaS', pricingAxis: '月額' },
  consulting: { label: 'コンサルティング', productName: 'マーケティング支援コンサルティング', deliveryModel: 'コンサル', pricingAxis: '工数' },
}
const BUDGETS: Record<BudgetKey, { label: string; yen: number | null }> = {
  u50: { label: '50万円まで', yen: 500_000 },
  '50to200': { label: '50万〜200万円', yen: 2_000_000 },
  o200: { label: '200万円より上', yen: 5_000_000 },
  unknown: { label: 'まだ分からない', yen: null },
}
const STAGES: Record<StageKey, { label: string; slides: number; situation: string }> = {
  first: { label: '初めての訪問', slides: 6, situation: '初回の訪問で、課題を聞き取りながら概算を示す' },
  proposal: { label: '提案の場', slides: 8, situation: '2回目以降の訪問で、具体的な提案と見積を示す' },
  closing: { label: '条件のすり合わせ', slides: 5, situation: '最終の条件を詰め、発注の判断をしてもらう' },
}

const choices = <K extends string>(m: Record<K, { label: string }>): AgentChoice[] =>
  (Object.keys(m) as K[]).map((value) => ({ value, label: m[value].label }))

export const SALES_PREP: AgentRecipe = {
  id: 'sales-prep',
  title: '商談の準備をまとめて進める',
  lead: '相手の会社を調べながら、見積の下書きと提案スライドの構成を同時に作ります。',
  goal: (a) => `${a.domain} との${a.stageLabel}に、資料をそろえて臨む`,
  period: '今日',
  pillars: [
    { id: 'know', name: '相手を知る', why: '会社の事業と最近の動きを押さえ、話の入口を作るため' },
    { id: 'price', name: '条件を示す', why: '予算の目安に合う見積の案を、先に用意しておくため' },
    { id: 'propose', name: '提案を形にする', why: '話の流れをスライドにして、その場で見せられるようにするため' },
  ],
  keywords: ['商談の準備', '商談準備', '商談に行く', '商談前', '提案の準備', '訪問の準備', '営業の準備'],
  chip: '商談の準備をまとめて進めたい',
  questions: [
    { id: 'url', label: '相手の会社のサイトは？', kind: 'text', placeholder: 'https://example.co.jp', sample: '', help: 'トップページの URL を入れてください。ここだけは入力が要ります。' },
    { id: 'offer', label: '何を提案しますか？', kind: 'choice', options: choices(OFFERS), sample: 'web' },
    { id: 'budget', label: '相手の予算の目安は？', kind: 'choice', options: choices(BUDGETS), sample: '50to200' },
    { id: 'stage', label: 'どんな場の商談ですか？', kind: 'choice', options: choices(STAGES), sample: 'proposal' },
  ],
  tasks: [
    {
      id: 'research',
      action: 'shodan.research',
      pillar: 'know',
      toolId: 'shodan',
      toolName: 'ドヤ商談準備',
      label: (a) => `${a.domain} の会社を調べる`,
      makes: '会社の概要・事業・最近の動きをまとめます',
      uses: '商談準備の今月の件数に数えます',
      stages: (a) => [`${a.domain} のサイトを読み込み`, '事業と最近の動きを整理', '仕上げています'],
    },
    {
      id: 'quote',
      action: 'quote.draft',
      pillar: 'price',
      toolId: 'quote',
      toolName: 'ドヤ見積もりAI',
      label: (a) => `${a.offerLabel}の見積の下書きを作る`,
      makes: '品目と単価の案を入れた見積書を、下書きで保存します',
      uses: '見積書の件数に1件数えます',
      stages: (a) => [`${a.offerLabel}の品目を考える`, `予算（${BUDGETS[a.budget].label}）に合わせて単価を置く`, '下書きに保存して、仕上げています'],
    },
    {
      id: 'slides',
      action: 'slide.structure',
      pillar: 'propose',
      toolId: 'doyaslide',
      toolName: 'ドヤスライド',
      label: (a) => `提案スライドの構成を作る（${a.slideCount}枚）`,
      makes: '各ページの見出しと本文の案を作ります。画像はまだ作りません',
      uses: 'スライドの今月の作成数に数えます',
      stages: (a) => [`${a.stageLabel}向けの流れを決める`, `${a.slideCount}枚の見出しと本文を書く`, '仕上げています'],
    },
  ],
}

export const AGENT_RECIPES: AgentRecipe[] = [SALES_PREP]

export function findRecipe(id: unknown): AgentRecipe | null {
  return AGENT_RECIPES.find((r) => r.id === id) ?? null
}

/** 入力した文から組み合わせを選ぶ。合うものが無ければ null */
export function matchRecipe(text: string): AgentRecipe | null {
  const q = text.replace(/\s+/g, '')
  if (!q) return null
  return AGENT_RECIPES.find((r) => r.keywords.some((k) => q.includes(k))) ?? null
}

/** 質問の例（サンプル入力済み）の答え */
export function sampleAnswers(recipe: AgentRecipe): Record<string, string> {
  return Object.fromEntries(recipe.questions.map((q) => [q.id, q.sample]))
}

/** URL を確かめて整える（http(s) だけ。資格情報つきは断る） */
export function normalizeCompanyUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null
  let s = input.trim()
  if (!s || s.length > 2048) return null
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:\/\//i.test(s)) return null
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (u.username || u.password || !u.hostname.includes('.')) return null
    return u.toString()
  } catch {
    return null
  }
}

const isKey = <K extends string>(m: Record<K, unknown>, v: unknown): v is K =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(m, v)

/** 答えを確かめて、ツールへの入力に使う形にする。足りない・正しくないときは、直す質問と理由を返す */
export function parseSalesPrepAnswers(raw: unknown): { ok: true; value: SalesPrepAnswers } | { ok: false; questionId: string; error: string } {
  const a = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
  const url = normalizeCompanyUrl(a.url)
  if (!url) return { ok: false, questionId: 'url', error: '相手の会社のサイトの URL を入れてください。' }
  if (!isKey(OFFERS, a.offer)) return { ok: false, questionId: 'offer', error: '提案するものを選んでください。' }
  if (!isKey(BUDGETS, a.budget)) return { ok: false, questionId: 'budget', error: '予算の目安を選んでください。' }
  if (!isKey(STAGES, a.stage)) return { ok: false, questionId: 'stage', error: '商談の場を選んでください。' }
  const offer = OFFERS[a.offer]
  const stage = STAGES[a.stage]
  return {
    ok: true,
    value: {
      url,
      domain: new URL(url).hostname.replace(/^www\./, ''),
      offer: a.offer,
      offerLabel: offer.label,
      budget: a.budget,
      budgetYen: BUDGETS[a.budget].yen,
      stage: a.stage,
      stageLabel: stage.label,
      slideCount: stage.slides,
    },
  }
}

/** 見積の品目を考えるときの材料（ドヤ見積もりAI の suggest に渡す） */
export function quoteInputOf(a: SalesPrepAnswers) {
  const offer = OFFERS[a.offer]
  return {
    productName: offer.productName,
    profile: { summary: `${offer.label}の提案`, deliveryModel: offer.deliveryModel, pricingAxis: offer.pricingAxis, targetCustomer: a.domain },
    situation: `${STAGES[a.stage].situation}。相手は ${a.domain}。予算の目安は${BUDGETS[a.budget].label}。`,
    budget: a.budgetYen,
  }
}

/** スライドのプロジェクトを作るときの材料（ドヤスライドの projects に渡す） */
export function slideInputOf(a: SalesPrepAnswers) {
  return {
    title: `${a.domain} 様への${a.offerLabel}のご提案`.slice(0, 120),
    docType: 'proposal',
    customBrief: `${STAGES[a.stage].situation}。提案するのは${a.offerLabel}。予算の目安は${BUDGETS[a.budget].label}。`,
    slideCount: a.slideCount,
  }
}
