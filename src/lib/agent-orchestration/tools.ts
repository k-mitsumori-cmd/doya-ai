// ============================================
// 各ツールを内部から呼ぶ部品（商談の準備の3つ）
// ============================================
// 設計: docs/architecture/agent-orchestration/DESIGN.md §5
// - 各ツールの API のルート（POST）を、そのまま内部で呼ぶ。ルートの中の決まり（ログイン・組織のスコープ・
//   ドヤパワーの withDoyaPowerCharge・各ツールの利用枠）は、ルートが今までどおり確かめる。ここで飛ばさない。
// - どのルートを呼ぶかは、この表（ToolRouteId）に書いたものだけ。画面から届いた値でルートを選ばない。
// - 呼び方（call）と組織の名前（shodanSlug）は引数でもらう。本番は routes.server.ts、テストは差し替え。
// ⚠️ 失敗の文は、ルートが返した利用者向けの error の文を使う（短い文字列だけ）。ステータスコードは見せない。
import { AgentTaskError, type AgentFailureAction, type AgentFailureKind, type AgentPowerUse, type AgentTaskResult } from './runner'
import { doyaPowerCost } from '@/lib/doya-power/costs'
import { quoteInputOf, slideInputOf, type SalesPrepAnswers } from './recipes'

export type ToolRouteId = 'shodan.prepare' | 'quote.suggest' | 'quote.create' | 'slide.project' | 'slide.structure'

export interface ToolCallResult {
  status: number
  data: unknown
  /** ドヤパワーの包みが返す操作のキー（DOYA_POWER_OP_HEADER）。あれば、この呼び出しで減ったまま（戻していない） */
  opKey?: string | null
}

export interface ToolDeps {
  call: (route: ToolRouteId, body: Record<string, unknown>) => Promise<ToolCallResult>
  /** 商談準備の組織の slug（結果の画面のリンクに使う）。分からなければ null */
  shodanSlug: () => Promise<string | null>
  /** この人にドヤパワーの包みが効くか（旗の内側で、会社が登録済み）。戻した量を数えるのに使う */
  powerOn?: boolean
  /**
   * 作る物の名前の先頭に付ける印（システム点検の自動の確認のときだけ「【自動点検】」。本人の物と見分けるため）。
   * 名前に付ける関数は、システム点検の部品（src/lib/system-watch/marker.ts の withSystemWatchPrefix）が決める
   */
  label?: { prefix: string; apply: (name: string, maxLength: number) => string }
  /**
   * 途中まで作れたもの（resume）を、ToDo が終わる前に残す（記録の表があるときだけ。2026-10-26 統括の指摘）。
   * 関数の時間の上限で止められると、失敗の記録（catch）が走らず、作ったスライドの ID が消えていた
   */
  checkpoint?: (resume: Record<string, string>) => Promise<void>
  /**
   * 前の試みで作ったまま、構成の無いスライドの ID（本人の、少し前に同じ名前・種類・枚数で作ったもの）。無ければ null。
   * 記録の表が無いとき、時間切れのあとのやり直しで、同じ名前のスライドを作り増やさないために使う
   */
  reusableSlideProject?: (input: { title: string; docType: string; slideCount: number; customBrief: string }) => Promise<string | null>
  /** スライドの構成を待つ時間（ミリ秒）。無ければ SLIDE_STRUCTURE_WAIT_MS。テストで短くするためのもの */
  slideStructureWaitMs?: number
}

/** スライドの構成を待つ時間。構成のルートは 240 秒で自分で止まる（structure/route.ts）。ここは、それより遅れたときの備え */
export const SLIDE_STRUCTURE_WAIT_MS = 270_000

/** 名前に印を付ける（印が無ければそのまま。長さの上限は守る） */
const labeled = (deps: ToolDeps, name: string, maxLength: number) => (deps.label ? deps.label.apply(name, maxLength) : name.slice(0, maxLength))

/** ドヤパワーの包み（withDoyaPowerCharge）が付いているルートと、その操作の名前 */
const CHARGED: Partial<Record<ToolRouteId, string>> = { 'quote.suggest': 'text.generate', 'slide.structure': 'slide.generate' }

/** ルートの呼び出しを数えて、減った量と戻した量を出す */
function meter(deps: ToolDeps) {
  const power: AgentPowerUse = { used: 0, refunded: 0 }
  const call: ToolDeps['call'] = async (route, body) => {
    const res = await deps.call(route, body)
    const action = CHARGED[route]
    if (action) {
      const cost = doyaPowerCost(action) ?? 0
      const code = (obj(res.data).code as string | undefined) ?? ''
      if (res.opKey) power.used += cost
      else if (deps.powerOn && res.status >= 400 && !code.startsWith('DOYA_POWER')) power.refunded += cost
    }
    return res
  }
  /** 失敗に、ここまでの量を付ける */
  const fail = (e: unknown): never => {
    if (e instanceof AgentTaskError) { e.power = { ...power }; throw e }
    throw new AgentTaskError('うまく作れませんでした。もう一度お試しください。', 'tool', undefined, undefined, { ...power })
  }
  return { deps: { ...deps, call }, power, fail }
}

export type SalesPrepTaskId = 'research' | 'quote' | 'slides'

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})
const str = (v: unknown, max = 200): string | null => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null)
/** 中の画面だけ（外のサイト・//で始まる道すじは使わない） */
const safePath = (v: unknown): string | null => (typeof v === 'string' && /^\/(?!\/)[\w\-./?=&%]*$/.test(v) ? v : null)
const man = (n: number) => (n >= 10_000 ? `${(Math.round(n / 1000) / 10).toLocaleString('ja-JP')}万円` : `${Math.round(n).toLocaleString('ja-JP')}円`)

const SETUP: Record<'shodan' | 'quote', { message: string; href: string; label: string }> = {
  shodan: { message: 'ドヤ商談準備の組織がまだありません。商談準備を開いて、組織を作ってください。', href: '/shodan', label: '商談準備を開く' },
  quote: { message: 'ドヤ見積もりAIの組織がまだありません。見積もりAIを開いて、組織を作ってください。', href: '/quote', label: '見積もりAIを開く' },
}

/** ルートの失敗を、利用者に見せる失敗に直す */
const RETRY: AgentFailureAction = { kind: 'retry', label: 'やり直す' }
const BY_COMPANY_NAME: AgentFailureAction = { kind: 'input', field: 'companyName', label: '会社名で調べ直す', placeholder: '例: 株式会社サンプル' }
/** 会社の調査の失敗の原因（ルートの reason）。サイトを直しても読めないものは、やり直しを出さない */
const RESEARCH_REASONS = new Set(['url_rejected', 'dns', 'network', 'timeout', 'http', 'content_type', 'redirect', 'body', 'js_rendered', 'no_facts', 'save', 'unknown'])
const NO_RETRY_REASONS = new Set(['url_rejected', 'content_type', 'js_rendered', 'no_facts', 'dns'])

/** ルートの失敗を、利用者に見せる失敗（原因・次の一手）に直す。FAILURE-CHECKLIST.md */
export function toTaskError(tool: 'shodan' | 'quote' | 'doyaslide', res: ToolCallResult, fallback: string, resume?: Record<string, string>): AgentTaskError {
  const d = obj(res.data)
  const code = typeof d.code === 'string' ? d.code : ''
  const message = str(d.error) ?? fallback
  const upgrade = safePath(d.upgradeUrl)
  let kind: AgentFailureKind = 'tool'
  let href: { href: string; label: string } | undefined
  if (res.status === 401) {
    if (tool === 'doyaslide') {
      const login = { href: '/auth/signin?callbackUrl=/home', label: 'ログインする' }
      return new AgentTaskError('ログインが切れました。ログインし直してください。', 'auth', resume, login).withHelp('auth', [{ kind: 'href', ...login }])
    }
    const s = SETUP[tool]
    return new AgentTaskError(s.message, 'setup', resume, { href: s.href, label: s.label }).withHelp('no_org', [{ kind: 'href', href: s.href, label: s.label }, RETRY])
  }
  // 会社の調査: 原因ごとの文はルートが返す（researchFailureMessage）。会社名で調べ直す道を出す
  if (tool === 'shodan' && code === 'RESEARCH_FAILED') {
    const reason = typeof d.reason === 'string' && RESEARCH_REASONS.has(d.reason) ? d.reason : 'unknown'
    const actions = reason === 'save' ? [RETRY] : NO_RETRY_REASONS.has(reason) ? [BY_COMPANY_NAME] : [BY_COMPANY_NAME, RETRY]
    return new AgentTaskError(message, 'input', resume).withHelp(reason, actions)
  }
  if (code.startsWith('DOYA_POWER')) kind = 'power'
  else if (res.status === 402 || res.status === 403 || res.status === 429 || /LIMIT/.test(code)) kind = 'limit'
  else if (res.status === 400 || res.status === 404 || res.status === 409 || res.status === 422) kind = 'input'
  if ((kind === 'limit' || kind === 'power') && upgrade) href = { href: upgrade, label: '料金プランを見る' }
  const actions: AgentFailureAction[] = []
  if (href) actions.push({ kind: 'href', ...href })
  // 今日の上限（明日まで待つ）と、入力の誤りは、そのままのやり直しを出さない
  if (kind === 'tool' || (kind === 'input' && res.status === 409) || res.status >= 500) actions.push(RETRY)
  const cause = kind === 'power' ? 'power' : kind === 'limit' ? (code ? code.toLowerCase() : 'limit') : res.status >= 500 ? (res.status === 502 ? 'ai_failed' : 'server_error') : kind === 'input' ? 'input' : 'unknown'
  return new AgentTaskError(message, kind, resume, href).withHelp(cause, actions)
}

const ok = (res: ToolCallResult) => res.status >= 200 && res.status < 300

/** ドヤ商談準備: 相手の会社を調べる（POST /api/shodan/preparations） */
export async function runResearch(a: SalesPrepAnswers, raw: ToolDeps, resume?: Record<string, string>): Promise<AgentTaskResult> {
  const m = meter(raw)
  try { return { ...(await research(a, m.deps, resume)), power: { ...m.power } } } catch (e) { return m.fail(e) }
}
async function research(a: SalesPrepAnswers, deps: ToolDeps, resume?: Record<string, string>): Promise<AgentTaskResult> {
  // 会社名（失敗のあとに利用者が入れたもの）があれば、サイトが読めなくても会社名で調べる
  const companyName = str(resume?.companyName, 100)
  // 商談準備の記録の名前（targetName）は、ツールのルートが調べた社名から決める。印は labelPrefix で渡し、ルートが付ける
  const res = await deps.call('shodan.prepare', { url: a.url, ...(companyName ? { companyName } : {}), ...(deps.label ? { labelPrefix: deps.label.prefix } : {}) })
  if (!ok(res)) throw toTaskError('shodan', res, '会社を調べられませんでした。URLを確かめて、もう一度お試しください。')
  const d = obj(res.data)
  const id = str(d.id, 128)
  const r = obj(d.research)
  if (!id) throw new AgentTaskError('会社を調べられませんでした。もう一度お試しください。')
  const name = str(r.companyName, 120) ?? a.domain
  const services = Array.isArray(r.services) ? r.services.filter((s): s is string => typeof s === 'string').slice(0, 3) : []
  const points = [
    str(r.description, 400),
    str(r.industry, 100) ? `業種: ${r.industry}` : null,
    typeof r.employeeCount === 'number' ? `従業員: ${r.employeeCount.toLocaleString('ja-JP')}名` : null,
    services.length ? `主な事業: ${services.join('、')}` : null,
  ].filter((p): p is string => !!p)
  // どう調べたかを添える（サイトの文が少なかった・会社名で調べた・AI で読み取れなかった）。FAILURE-CHECKLIST.md S12・S20
  const diag = obj(r.diagnostics)
  const homepage = obj(diag.homepage)
  if (diag.companyNameFrom === 'input' && homepage.ok === false) points.push('サイトは読めなかったため、入力した会社名で調べました。')
  else if (diag.usedPageSummary === true) points.push('サイトの文が少なかったため、ページの題と説明から読み取りました。')
  if (diag.aiExtracted === false && homepage.ok === true) points.push('サイトから会社の情報を読み取れなかったため、分かった範囲でまとめています。')
  const slug = await deps.shodanSlug().catch(() => null)
  return {
    summary: `${name}の概要をまとめました。`,
    points: points.length ? points : ['サイトから読み取れた情報は多くありませんでした。'],
    href: slug ? `/shodan/${encodeURIComponent(slug)}/p/${encodeURIComponent(id)}` : '/shodan',
    hrefLabel: '商談準備で提案資料まで作る',
    detail: { kind: 'company', name },
    handoff: { companyName: name },
  }
}

interface SuggestedItemLike { itemName?: unknown; spec?: unknown; qty?: unknown; unit?: unknown; unitPrice?: unknown; taxRate?: unknown; priceSource?: unknown; sourceRef?: unknown; rangeMin?: unknown; rangeMax?: unknown }

/** ドヤ見積もりAI: 品目の案を作り（suggest）、下書きの見積書として保存する（documents） */
export async function runQuote(a: SalesPrepAnswers, raw: ToolDeps, resume?: Record<string, string>): Promise<AgentTaskResult> {
  const m = meter(raw)
  try { return { ...(await quote(a, m.deps, resume)), power: { ...m.power } } } catch (e) { return m.fail(e) }
}
/** 品目の案を、見積書の保存に渡せる形に整える（AI の答えも、やり直しのときに残した案も、同じ決まりで通す） */
export function normalizeQuoteItems(raw: unknown, limits = { items: 30, text: 1000 }) {
  const list = Array.isArray(raw) ? (raw as SuggestedItemLike[]) : []
  return list
    .filter((i) => typeof i?.itemName === 'string' && i.itemName.trim())
    .slice(0, limits.items)
    .map((i) => ({
      itemName: String(i.itemName).slice(0, 200),
      spec: typeof i.spec === 'string' ? i.spec.slice(0, limits.text) : undefined,
      qty: typeof i.qty === 'number' && i.qty >= 1 ? Math.min(1_000_000, Math.floor(i.qty)) : 1,
      unit: typeof i.unit === 'string' ? i.unit.slice(0, 12) : '式',
      unitPrice: typeof i.unitPrice === 'number' && i.unitPrice >= 0 ? Math.min(1_000_000_000, Math.floor(i.unitPrice)) : 0,
      taxRate: i.taxRate === 8 || i.taxRate === 0 ? i.taxRate : 10,
      priceSource: typeof i.priceSource === 'string' ? i.priceSource.slice(0, 20) : undefined,
      sourceRef: typeof i.sourceRef === 'string' ? i.sourceRef.slice(0, limits.text) : undefined,
      rangeMin: typeof i.rangeMin === 'number' && i.rangeMin >= 0 ? Math.floor(i.rangeMin) : null,
      rangeMax: typeof i.rangeMax === 'number' && i.rangeMax >= 0 ? Math.floor(i.rangeMax) : null,
    }))
}

/** やり直しのために残す品目の案（resume.quoteDraft）。大きくなりすぎないよう、15行・各文 300字に切る */
export const QUOTE_DRAFT_LIMITS = { items: 15, text: 300 }

async function quote(a: SalesPrepAnswers, deps: ToolDeps, resume?: Record<string, string>): Promise<AgentTaskResult> {
  // 前の試みで品目の案ができていて、保存だけが失敗していたら、AI を呼ばずに、その案で保存をやり直す（2026-10-25 ユーザー決定）
  let items = (() => { try { return resume?.quoteDraft ? normalizeQuoteItems(JSON.parse(resume.quoteDraft), QUOTE_DRAFT_LIMITS) : [] } catch { return [] } })()
  if (!items.length) {
    const input = quoteInputOf(a)
    const sug = await deps.call('quote.suggest', { productName: input.productName, profile: input.profile, situation: input.situation, budget: input.budget })
    if (!ok(sug)) throw toTaskError('quote', sug, '見積の品目を作れませんでした。もう一度お試しください。')
    items = normalizeQuoteItems(obj(sug.data).items)
  }
  if (!items.length) throw new AgentTaskError('見積の品目の案が出ませんでした。もう一度お試しください。')
  const doc = await deps.call('quote.create', { title: labeled(deps, `${a.offerLabel}のお見積り`, 200), items, notes: 'ドヤAIのエージェントが作った下書きです。内容を確かめてから確定してください。' })
  // 保存で失敗したら、できた案を resume に残す（やり直しは保存だけ。AI は呼ばない。減ったドヤパワーは戻さない）
  if (!ok(doc)) throw toTaskError('quote', doc, '見積書を保存できませんでした。もう一度お試しください。', { quoteDraft: JSON.stringify(normalizeQuoteItems(items, QUOTE_DRAFT_LIMITS)) })
  const id = str(obj(doc.data).id, 128)
  if (!id) throw new AgentTaskError('見積書を保存できませんでした。もう一度お試しください。')
  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  return {
    summary: `品目${items.length}行の見積の下書きを作りました（税抜 ${man(subtotal)}）。`,
    points: items.slice(0, 4).map((i) => `${i.itemName}　${i.qty}${i.unit} × ${man(i.unitPrice)}`),
    href: `/quote/documents/${encodeURIComponent(id)}`,
    hrefLabel: '見積書を確かめる',
    detail: { kind: 'quote', count: items.length, subtotal, rows: items.slice(0, 12).map((i) => ({ name: i.itemName.slice(0, 80), qty: i.qty, unit: i.unit, unitPrice: i.unitPrice })) },
  }
}

/** ドヤスライド: プロジェクトを作り（projects）、構成を作る（structure）。構成で失敗したら、プロジェクトの id を残してやり直しに使う */
export async function runSlides(a: SalesPrepAnswers, raw: ToolDeps, resume?: Record<string, string>): Promise<AgentTaskResult> {
  const m = meter(raw)
  try { return { ...(await slides(a, m.deps, resume)), power: { ...m.power } } } catch (e) { return m.fail(e) }
}
async function slides(a: SalesPrepAnswers, deps: ToolDeps, resume?: Record<string, string>): Promise<AgentTaskResult> {
  let projectId = str(resume?.projectId, 128)
  if (!projectId) {
    const input = slideInputOf(a)
    const title = labeled(deps, input.title, 120)
    // 前の試みが時間切れで終わり、ID が残っていないときは、そのとき作ったスライドを使う（同じ名前のスライドを増やさない）
    projectId = (await deps.reusableSlideProject?.({ title, docType: input.docType, slideCount: input.slideCount, customBrief: input.customBrief }).catch(() => null)) ?? null
    if (!projectId) {
      const res = await deps.call('slide.project', { ...input, title })
      if (!ok(res)) throw toTaskError('doyaslide', res, 'スライドを作り始められませんでした。もう一度お試しください。')
      projectId = str(obj(obj(res.data).project).id, 128)
      if (!projectId) throw new AgentTaskError('スライドを作り始められませんでした。もう一度お試しください。')
    }
    // 作ったらすぐ残す。このあと構成づくりの途中で止められても、やり直しは同じスライドを使う
    await deps.checkpoint?.({ projectId }).catch(() => {})
  }
  const st = await withWait(deps.call('slide.structure', { projectId, referenceUrl: a.url }), deps.slideStructureWaitMs ?? SLIDE_STRUCTURE_WAIT_MS)
  if (st === TIMED_OUT) throw new AgentTaskError('スライドの構成づくりに時間がかかっています。数分おいてからやり直すと、同じスライドで続けます。', 'tool', { projectId })
  const stCode = obj(st.data).code
  // 前の試みで構成までできていた（そのあと記録だけが止められた）: 作り直さず、できたものとして返す（2026-10-26 統括の監査）
  if (st.status === 409 && stCode === 'DOYASLIDE_STRUCTURE_EXISTS') {
    return {
      summary: 'スライドの構成はできています。',
      points: [],
      href: `/doyaslide/${encodeURIComponent(projectId)}`,
      hrefLabel: 'スライドの画像を作る',
    }
  }
  // 前の試みの構成づくりが、まだ動いている
  if (st.status === 409 && stCode === 'DOYASLIDE_STRUCTURE_BUSY') {
    throw new AgentTaskError('スライドの構成を作っています。数分おいてからやり直すと、同じスライドで続けます。', 'tool', { projectId })
  }
  if (!ok(st)) throw toTaskError('doyaslide', st, 'スライドの構成を作れませんでした。もう一度お試しください。', { projectId })
  const slides = Array.isArray(obj(st.data).slides) ? (obj(st.data).slides as unknown[]).map(obj) : []
  const heads = slides.map((s) => str(s.headline, 500)).filter((h): h is string => !!h)
  return {
    summary: `${heads.length || a.slideCount}枚のスライドの構成を作りました。`,
    points: heads.slice(0, 5).map((h, i) => `${i + 1}. ${h}`),
    href: `/doyaslide/${encodeURIComponent(projectId)}`,
    hrefLabel: 'スライドの画像を作る',
    ...(heads.length ? { detail: { kind: 'slides' as const, heads: heads.slice(0, 20).map((h) => h.slice(0, 120)) } } : {}),
  }
}

const TIMED_OUT = Symbol('timed-out')
/** 待つ時間を過ぎたら TIMED_OUT を返す（呼び出しそのものは止めない。構成のルートは自分の締め切りで止まる） */
async function withWait<T>(p: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([p, new Promise<typeof TIMED_OUT>((r) => { timer = setTimeout(() => r(TIMED_OUT), ms) })])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function runSalesPrepTask(taskId: SalesPrepTaskId, a: SalesPrepAnswers, deps: ToolDeps, resume?: Record<string, string>): Promise<AgentTaskResult> {
  if (taskId === 'research') return runResearch(a, deps, resume)
  if (taskId === 'quote') return runQuote(a, deps, resume)
  return runSlides(a, deps, resume)
}

/** 見本の結果（開発の確認用の差し替え。AGENT_ORCHESTRATION_FAKE_TOOLS=1 のときだけ。本番では使わない） */
export function fakeToolDeps(opts: { delayMs?: number; failSlidesOnce?: { done: boolean }; powerOn?: boolean } = {}): ToolDeps {
  const wait = () => new Promise((r) => setTimeout(r, opts.delayMs ?? 1200 + Math.random() * 1500))
  const base: ToolDeps['call'] = async (route, body) => {
      await wait()
      switch (route) {
        case 'shodan.prepare':
          return { status: 200, data: { id: 'prep_sample', status: 'researched', research: { companyName: '見本株式会社', url: body.url, description: '業務用のクラウドサービスを開発し、中小企業の営業と経理を支援している会社です。', industry: '情報通信業', employeeCount: 120, services: ['営業支援クラウド', '請求書の自動化', '導入の支援'], marketing: {} } } }
        case 'quote.suggest':
          return { status: 200, data: { items: [
            { itemName: '要件の整理と設計', spec: 'ヒアリング2回と設計書', qty: 1, unit: '式', unitPrice: 300000, taxRate: 10, priceSource: 'market', sourceRef: '' },
            { itemName: 'ページの制作', spec: 'トップと下層8ページ', qty: 9, unit: 'ページ', unitPrice: 60000, taxRate: 10, priceSource: 'market', sourceRef: '' },
            { itemName: '公開後の保守', spec: '3か月', qty: 3, unit: '月', unitPrice: 30000, taxRate: 10, priceSource: 'market', sourceRef: '' },
          ] } }
        case 'quote.create':
          return { status: 200, data: { id: 'quote_sample', quoteNo: 'Q-0001' } }
        case 'slide.project':
          return { status: 201, data: { project: { id: 'slide_sample' } } }
        case 'slide.structure':
          if (opts.failSlidesOnce && !opts.failSlidesOnce.done) {
            opts.failSlidesOnce.done = true
            return { status: 502, data: { error: '構成の生成に失敗しました。もう一度お試しください。' } }
          }
          return { status: 200, data: { slides: ['今日お話ししたいこと', '御社の現状と課題', 'ご提案の全体像', '進め方と期間', 'お見積りの概要', '次のご相談'].map((headline) => ({ headline })) } }
      }
  }
  return {
    shodanSlug: async () => 'sample',
    powerOn: opts.powerOn,
    // ドヤパワーを使う見本では、包みが付いたルートの成功に操作のキーを付ける（本番の包みと同じ）
    call: async (route, body) => {
      const res = await base(route, body)
      return opts.powerOn && CHARGED[route] && res.status < 400 ? { ...res, opKey: `op-${route}` } : res
    },
  }
}
