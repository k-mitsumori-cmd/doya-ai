// ドヤ展示会 エンジン（画面とサーバーで共用。サーバー専用の処理は置かない）
// analyze / booth / creatives の文面は /api/tenjikai/generate（src/lib/tenjikai/ai.ts）が LLM で作る。
// ここにある analyzeSite / generateBoothPlans / generateCreatives はその下書き兼フォールバック。
// 金額・寸法・数量・締切はAIに任せず、ここにあるルール計算を本番でもそのまま使う。

export type BoothPosition = 'inline' | 'corner' | 'peninsula' | 'island'
export type Goal = 'lead' | 'brand' | 'demo'

export interface ProjectInput {
  serviceUrl: string
  eventName: string
  venueId: string
  eventStart: string // YYYY-MM-DD
  days: number
  komaCols: number
  komaRows: number
  /** 小間の横幅（m）。利用者が入れた値。無いとき（前の版で保存した内容）は会場の基礎小間 × 小間数で決める */
  widthM?: number
  /** 小間の奥行（m）。widthM と組で使う */
  depthM?: number
  position: BoothPosition
  budgetYen: number
  goal: Goal
  staff: number
}

export interface Venue {
  id: string
  name: string
  komaM: number
  komaPriceYen: number
  maxHeightM: number
  note: string
}

// 料金は画面設計用の目安。実装時に各会場・各展示会の公開料金で差し替える。
export const VENUES: Venue[] = [
  { id: 'bigsight', name: '東京ビッグサイト', komaM: 2.97, komaPriceYen: 420000, maxHeightM: 2.7, note: '基礎小間 2.97m × 2.97m' },
  { id: 'makuhari', name: '幕張メッセ', komaM: 3.0, komaPriceYen: 400000, maxHeightM: 2.7, note: '基礎小間 3.0m × 3.0m' },
  { id: 'intex', name: 'インテックス大阪', komaM: 3.0, komaPriceYen: 330000, maxHeightM: 2.7, note: '基礎小間 3.0m × 3.0m' },
  { id: 'portmesse', name: 'ポートメッセなごや', komaM: 3.0, komaPriceYen: 300000, maxHeightM: 2.7, note: '基礎小間 3.0m × 3.0m' },
]

export const POSITION_LABEL: Record<BoothPosition, string> = {
  inline: '並び小間（1面開放）',
  corner: '角小間（2面開放）',
  peninsula: '半島小間（3面開放）',
  island: '島小間（4面開放）',
}

export const GOAL_LABEL: Record<Goal, string> = {
  lead: 'リード獲得（名刺を集める）',
  brand: '認知拡大（覚えてもらう）',
  demo: '体験・デモ（触ってもらう）',
}

export const SAMPLE_INPUT: ProjectInput = {
  serviceUrl: 'https://doya-ai.surisuta.jp',
  eventName: 'マーケティングWeek 秋 2027',
  venueId: 'bigsight',
  eventStart: '2027-02-17',
  days: 3,
  komaCols: 2,
  komaRows: 2,
  widthM: 6,
  depthM: 6,
  position: 'corner',
  budgetYen: 4500000,
  goal: 'lead',
  staff: 4,
}

// ---------- サイト解析 ----------

export interface SiteAnalysis {
  brand: string
  domain: string
  category: string
  headline: string
  subline: string
  valueProps: { title: string; body: string }[]
  targets: string[]
  colors: { primary: string; secondary: string; accent: string }
  tone: string
}

function domainOf(url: string) {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0] || 'example.com'
  }
}

function hashStr(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const PALETTES = [
  { primary: '#7f19e6', secondary: '#1b1530', accent: '#ffb020' },
  { primary: '#0f62fe', secondary: '#0b1b33', accent: '#22d3a6' },
  { primary: '#e5484d', secondary: '#1f1414', accent: '#ffd23f' },
  { primary: '#0e9f6e', secondary: '#0d2620', accent: '#ffcf33' },
]

export function analyzeSite(url: string): SiteAnalysis {
  const domain = domainOf(url)
  if (domain.includes('doya')) {
    return {
      brand: 'ドヤAI',
      domain,
      category: 'マーケティング向け生成AIツール群',
      headline: 'マーケの作業、\nAIでドヤ速。',
      subline: 'バナー・記事・インタビュー・ペルソナまで、ひとつのアカウントで。',
      valueProps: [
        { title: 'バナーを30秒で', body: '商材URLを入れるだけで、広告バナーを複数パターン生成' },
        { title: 'SEO記事を一気通貫', body: '構成・執筆・画像まで、検索上位を狙う長文記事を作成' },
        { title: '取材記事も自動化', body: '録音から文字起こし、インタビュー記事の下書きまで' },
      ],
      targets: ['中小企業のマーケ担当', 'Web制作・広告代理店', '一人で広報を担う経営者'],
      // ドヤAIの、いまのブランドの色（青・紺・黄）。以前は旧ブランドの紫（PALETTES[0]）のままだった（2026-10-29）
      colors: { primary: '#0066ff', secondary: '#0a0f3c', accent: '#ffd400' },
      tone: '親しみやすく、自信がある',
    }
  }
  const h = hashStr(domain)
  const name = domain.split('.')[0]
  const brand = name.charAt(0).toUpperCase() + name.slice(1)
  return {
    brand,
    domain,
    category: 'BtoB向けクラウドサービス',
    headline: `その業務、\n${brand}で変わる。`,
    subline: '導入企業の声と数字で、効果をその場でお見せします。',
    valueProps: [
      { title: '導入が早い', body: '最短で翌営業日から使い始められる' },
      { title: '現場で使える', body: 'ITに詳しくない担当者でも迷わない画面' },
      { title: '効果が見える', body: '削減時間と成果をダッシュボードで確認' },
    ],
    targets: ['情報システム部門', '現場の業務責任者', '経営企画'],
    colors: PALETTES[h % PALETTES.length],
    tone: '誠実で、わかりやすい',
  }
}

// ---------- ブース設営案 ----------

export type ElementKind = 'wall' | 'monitor' | 'counter' | 'table' | 'demo' | 'rollup' | 'storage' | 'sign'

export interface BoothElement {
  id: string
  kind: ElementKind
  label: string
  x: number
  y: number
  z?: number
  w: number
  d: number
  h: number
  costYen: number
  note?: string
}

export interface BoothPlan {
  variant: 'A' | 'B' | 'C'
  name: string
  concept: string
  widthM: number
  depthM: number
  elements: BoothElement[]
  flow: string
}

const UNIT = {
  wallPerM: 38000,
  monitor: 65000,
  counter: 42000,
  table: 26000,
  demo: 55000,
  rollup: 18000,
  storage: 36000,
  sign: 90000,
  carpetPerM2: 3200,
  designFee: 150000,
  laborPerKoma: 80000,
}

export const KIND_LABEL: Record<ElementKind, string> = {
  wall: '壁面パネル',
  monitor: 'モニター',
  counter: 'カウンター',
  table: '商談テーブル',
  demo: 'デモ台',
  rollup: 'ロールアップ',
  storage: 'ストックルーム',
  sign: '吊り看板',
}

// ---------- 小間の大きさ ----------
// 横と奥行は利用者が m で入れる（2026-10-26 ユーザー指示）。画面とサーバーで同じ決まりを使う。

export const BOOTH_SIZE_LIMIT = { minM: 1, maxM: 30, stepM: 0.5 } as const

/** よく使う大きさ。押すと横と奥行に入る */
export const BOOTH_SIZE_PRESETS: { label: string; widthM: number; depthM: number }[] = [
  { label: '1小間', widthM: 3, depthM: 3 },
  { label: '2小間（横並び）', widthM: 6, depthM: 3 },
  { label: '4小間', widthM: 6, depthM: 6 },
  { label: '6小間', widthM: 9, depthM: 6 },
  { label: '9小間', widthM: 9, depthM: 9 },
]

/** 1〜30m で、0.5m 刻みの数か */
export function isValidBoothMeter(v: unknown): v is number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return false
  if (v < BOOTH_SIZE_LIMIT.minM || v > BOOTH_SIZE_LIMIT.maxM) return false
  const steps = v / BOOTH_SIZE_LIMIT.stepM
  return Math.abs(steps - Math.round(steps)) < 1e-9
}

/** 入力欄の文字を確かめる。正しくないときは、直し方を日本語で返す */
export function checkBoothMeter(label: '横' | '奥行', raw: string): { ok: true; value: number } | { ok: false; message: string } {
  const t = raw.trim().replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  if (!t) return { ok: false, message: `${label}の長さを入れてください。` }
  const n = Number(t)
  if (!Number.isFinite(n)) return { ok: false, message: `${label}は数字で入れてください。` }
  if (n < BOOTH_SIZE_LIMIT.minM || n > BOOTH_SIZE_LIMIT.maxM) return { ok: false, message: `${label}は${BOOTH_SIZE_LIMIT.minM}〜${BOOTH_SIZE_LIMIT.maxM}mで入れてください。` }
  if (!isValidBoothMeter(n)) return { ok: false, message: `${label}は0.5m刻みで入れてください（例：3、4.5）。` }
  return { ok: true, value: n }
}

/** 小間の大きさ（m）と、小間料の計算に使う小間の数 */
export function boothSize(input: ProjectInput) {
  const v = VENUES.find((x) => x.id === input.venueId) ?? VENUES[0]
  if (isValidBoothMeter(input.widthM) && isValidBoothMeter(input.depthM)) {
    const w = input.widthM
    const d = input.depthM
    // 小間料は会場の基礎小間の面積で割って数える（最低1小間）
    return { w, d, venue: v, komas: Math.max(1, Math.round((w * d) / (v.komaM * v.komaM))), custom: true as const }
  }
  return { w: +(v.komaM * input.komaCols).toFixed(2), d: +(v.komaM * input.komaRows).toFixed(2), venue: v, komas: input.komaCols * input.komaRows, custom: false as const }
}

/** 横と奥行を入れた内容にする。小間の列と行（DB の項目）も、会場の基礎小間からおおよそに合わせる */
export function withBoothSize(input: ProjectInput, widthM: number, depthM: number): ProjectInput {
  const v = VENUES.find((x) => x.id === input.venueId) ?? VENUES[0]
  const fit = (m: number) => Math.min(10, Math.max(1, Math.round(m / v.komaM)))
  return { ...input, widthM, depthM, komaCols: fit(widthM), komaRows: fit(depthM) }
}

export function generateBoothPlans(input: ProjectInput): BoothPlan[] {
  const { w: W, d: D, venue } = boothSize(input)
  const H = venue.maxHeightM
  const t = 0.1
  const openLeft = input.position === 'peninsula' || input.position === 'island'
  const openBack = input.position === 'island'

  const backWall = (id: string, len = W): BoothElement => ({
    id, kind: 'wall', label: '背面壁（大判グラフィック）', x: 0, y: 0, w: len, d: t, h: H, costYen: Math.round(len * UNIT.wallPerM),
  })
  const sideWall = (id: string, len: number): BoothElement => ({
    id, kind: 'wall', label: '側面壁', x: 0, y: t, w: t, d: len, h: H, costYen: Math.round(len * UNIT.wallPerM),
  })

  const base: BoothElement[] = []
  if (!openBack) base.push(backWall('w1'))
  if (!openLeft) base.push(sideWall('w2', D * 0.62))

  const plans: BoothPlan[] = [
    {
      variant: 'A',
      name: 'オープンデモ型',
      concept: '通路から製品に触れられる。中央のデモ台に人だかりを作り、立ち止まった人をカウンターで受ける。',
      widthM: W,
      depthM: D,
      flow: '通路 → デモ台 → 受付カウンター（名刺交換）',
      elements: [
        ...base,
        { id: 'm1', kind: 'monitor', label: '65型モニター（ループ動画）', x: W * 0.36, y: 0.12, z: 1.1, w: 1.45, d: 0.08, h: 0.82, costYen: UNIT.monitor },
        { id: 'd1', kind: 'demo', label: 'デモ台（タブレット2台）', x: W * 0.38, y: D * 0.42, w: 1.2, d: 0.7, h: 0.95, costYen: UNIT.demo },
        { id: 'c1', kind: 'counter', label: '受付カウンター', x: W - 1.9, y: D - 0.8, w: 1.6, d: 0.5, h: 1.0, costYen: UNIT.counter },
        { id: 'r1', kind: 'rollup', label: 'ロールアップバナー', x: 0.3, y: D - 0.6, w: 0.85, d: 0.25, h: 2.0, costYen: UNIT.rollup },
        { id: 's1', kind: 'storage', label: 'ストックルーム', x: W - 1.2, y: 0.12, w: 1.1, d: 1.0, h: H, costYen: UNIT.storage },
      ],
    },
    {
      variant: 'B',
      name: 'シアター型',
      concept: '大型モニターでミニセミナーを15分ごとに開催。着席した来場者にまとめて説明し、終了後に名刺を回収する。',
      widthM: W,
      depthM: D,
      flow: '通路 → ベンチ着席（ミニセミナー） → 個別相談',
      elements: [
        ...base,
        { id: 'm1', kind: 'monitor', label: '86型モニター（セミナー用）', x: W * 0.3, y: 0.12, z: 0.9, w: 1.9, d: 0.08, h: 1.08, costYen: UNIT.monitor * 2 },
        { id: 'm2', kind: 'monitor', label: '43型サイネージ', x: 0.15, y: D * 0.3, z: 1.2, w: 0.08, d: 0.95, h: 0.55, costYen: Math.round(UNIT.monitor * 0.6) },
        { id: 't1', kind: 'table', label: '観覧ベンチ', x: W * 0.28, y: D * 0.45, w: 2.0, d: 0.45, h: 0.45, costYen: UNIT.table },
        { id: 't2', kind: 'table', label: '観覧ベンチ', x: W * 0.28, y: D * 0.62, w: 2.0, d: 0.45, h: 0.45, costYen: UNIT.table },
        { id: 'c1', kind: 'counter', label: '受付カウンター', x: W - 1.8, y: D - 0.75, w: 1.5, d: 0.5, h: 1.0, costYen: UNIT.counter },
        { id: 'g1', kind: 'sign', label: '吊り看板（ロゴ）', x: W * 0.3, y: D * 0.35, z: 3.6, w: 2.2, d: 0.6, h: 0.6, costYen: UNIT.sign },
      ],
    },
    {
      variant: 'C',
      name: '商談重視型',
      concept: '展示は壁面に集約し、床は商談席を広く取る。決裁者との30分商談を会期中に何件入れられるかを優先する。',
      widthM: W,
      depthM: D,
      flow: '通路 → 壁面パネルで課題を確認 → 商談席へ案内',
      elements: [
        ...base,
        { id: 'm1', kind: 'monitor', label: '55型モニター', x: W * 0.15, y: 0.12, z: 1.2, w: 1.22, d: 0.08, h: 0.7, costYen: UNIT.monitor },
        { id: 't1', kind: 'table', label: '商談テーブル（4名）', x: W * 0.2, y: D * 0.4, w: 1.0, d: 1.0, h: 0.72, costYen: UNIT.table },
        { id: 't2', kind: 'table', label: '商談テーブル（4名）', x: W * 0.55, y: D * 0.4, w: 1.0, d: 1.0, h: 0.72, costYen: UNIT.table },
        { id: 'c1', kind: 'counter', label: '受付カウンター', x: W - 1.7, y: D - 0.7, w: 1.4, d: 0.5, h: 1.0, costYen: UNIT.counter },
        { id: 'r1', kind: 'rollup', label: 'ロールアップバナー', x: 0.25, y: D - 0.55, w: 0.85, d: 0.25, h: 2.0, costYen: UNIT.rollup },
        { id: 's1', kind: 'storage', label: 'ストックルーム', x: W - 1.15, y: 0.12, w: 1.05, d: 1.1, h: H, costYen: UNIT.storage },
      ],
    },
  ]

  // 小さい小間では置けない部材を落とす（ルールエンジンの簡易版）
  return plans.map((p) => ({
    ...p,
    elements: p.elements.filter((e) => e.x + e.w <= W + 0.01 && e.y + e.d <= D + 0.01 && e.x >= 0 && e.y >= 0),
  }))
}

export function planCost(plan: BoothPlan, input: ProjectInput) {
  const { komas } = boothSize(input)
  const parts = plan.elements.reduce((s, e) => s + e.costYen, 0)
  const carpet = Math.round(plan.widthM * plan.depthM * UNIT.carpetPerM2)
  return { parts, carpet, design: UNIT.designFee, labor: UNIT.laborPerKoma * komas, total: parts + carpet + UNIT.designFee + UNIT.laborPerKoma * komas }
}

// ---------- 制作物 ----------

export type CreativeKind = 'backwall' | 'rollup' | 'flyer' | 'clearfile' | 'card' | 'loop'

export interface Creative {
  kind: CreativeKind
  name: string
  size: string
  widthMm: number
  heightMm: number
  qty: number
  unitYen: number
  copy: string
  purpose: string
}

export function generateCreatives(a: SiteAnalysis, input: ProjectInput): Creative[] {
  const { w } = boothSize(input)
  const base = handoutBase(input)
  const wallMm = Math.round(w * 1000)
  return [
    { kind: 'backwall', name: '背面壁グラフィック', size: `${wallMm.toLocaleString()} × 2,700 mm`, widthMm: wallMm, heightMm: 2700, qty: 1, unitYen: Math.round(w * 42000), copy: a.headline.replace('\n', ''), purpose: '通路の15m先から何の会社かわかる。文字は上部1,800mmより上に置く' },
    { kind: 'rollup', name: 'ロールアップバナー', size: '850 × 2,000 mm', widthMm: 850, heightMm: 2000, qty: 2, unitYen: 9800, copy: a.valueProps[0].title, purpose: '通路側の角に立て、足を止めるきっかけを作る' },
    { kind: 'flyer', name: 'A4チラシ', size: '210 × 297 mm', widthMm: 210, heightMm: 297, qty: Math.max(100, Math.round(base * 1.2 / 100) * 100), unitYen: 12, copy: a.subline, purpose: '持ち帰って社内で回覧される前提で、料金と導入事例を載せる' },
    { kind: 'clearfile', name: 'A4クリアファイル', size: '220 × 310 mm', widthMm: 220, heightMm: 310, qty: Math.max(100, Math.round(base * 0.6 / 100) * 100), unitYen: 48, copy: a.brand, purpose: 'チラシを挟んで配布。会場で他社の資料も入れてもらえる' },
    { kind: 'card', name: 'QRカード', size: '91 × 55 mm', widthMm: 91, heightMm: 55, qty: 1000, unitYen: 4, copy: '資料のダウンロードはこちら', purpose: '名刺交換できなかった人にも後から接点を残す' },
    { kind: 'loop', name: 'モニター用ループ動画', size: '1920 × 1080 / 15秒', widthMm: 1920, heightMm: 1080, qty: 1, unitYen: 120000, copy: a.valueProps.map((v) => v.title).join(' / '), purpose: '音なしで伝わる構成。3カットを15秒で繰り返す' },
  ]
}

// ---------- ノベルティ ----------

export interface Novelty {
  id: string
  name: string
  unitYen: number
  leadDays: number
  tier: '名刺交換者' | '来場者全員' | '商談者'
  reason: string
  recommended: boolean
}

/**
 * 制作物とノベルティの数量の初期値を決めるための目安の数。
 * ⚠️ 来場者の人数の推計ではない。根拠のある人数ではないので、画面に「○人」として出さない（2026-10-26 ユーザー指示）。
 *    数量は目安として出し、配る見込みに合わせて利用者が直す前提。
 */
export function handoutBase(input: ProjectInput) {
  const { komas } = boothSize(input)
  const perKomaPerDay = input.goal === 'brand' ? 140 : input.goal === 'demo' ? 90 : 110
  return Math.round(komas * perKomaPerDay * input.days)
}

export function generateNovelties(input: ProjectInput): Novelty[] {
  return [
    { id: 'n1', name: '名入れモバイルバッテリー 5,000mAh', unitYen: 1250, leadDays: 30, tier: '商談者', reason: '展示会後も毎日使われ、ロゴが目に入る。商談まで進んだ人に限定して渡す', recommended: input.goal !== 'brand' },
    { id: 'n2', name: 'オリジナルエコバッグ（A4が入る）', unitYen: 380, leadDays: 21, tier: '名刺交換者', reason: '会場で他社の資料を入れて持ち歩かれ、歩く広告になる', recommended: true },
    { id: 'n3', name: 'A4クリアファイル', unitYen: 48, leadDays: 14, tier: '来場者全員', reason: 'チラシとセットで配布。単価が低く数を撒ける', recommended: true },
    { id: 'n4', name: '名入れボールペン', unitYen: 110, leadDays: 14, tier: '名刺交換者', reason: 'アンケート記入時に使ってもらい、そのまま持ち帰ってもらう', recommended: input.goal === 'lead' },
    { id: 'n5', name: 'ロゴ入りステッカー', unitYen: 35, leadDays: 10, tier: '来場者全員', reason: 'PCに貼られやすい。デザイン性が高いほど効果がある', recommended: input.goal === 'brand' },
    { id: 'n6', name: '個包装のお菓子（ロゴ帯付き）', unitYen: 60, leadDays: 10, tier: '来場者全員', reason: '通路での声かけのきっかけになる。会場の飲食物ルールを確認', recommended: input.goal === 'demo' },
  ]
}

export function noveltyQty(n: Novelty, input: ProjectInput) {
  const v = handoutBase(input)
  const rate = n.tier === '来場者全員' ? 0.9 : n.tier === '名刺交換者' ? 0.35 : 0.06
  return Math.max(50, Math.ceil((v * rate) / 50) * 50)
}

// ---------- 予算 ----------

export type BudgetCategory = 'space' | 'build' | 'electric' | 'print' | 'novelty' | 'staff' | 'logistics'

export const BUDGET_META: Record<BudgetCategory, { label: string; color: string }> = {
  space: { label: '小間料', color: '#7f19e6' },
  build: { label: '装飾・施工', color: '#4c0f8f' },
  electric: { label: '電気工事・機材', color: '#f59e0b' },
  print: { label: '制作・印刷', color: '#10b981' },
  novelty: { label: 'ノベルティ', color: '#ec4899' },
  staff: { label: '人件費', color: '#3b82f6' },
  logistics: { label: '輸送・その他', color: '#94a3b8' },
}

export interface BudgetLine {
  category: BudgetCategory
  amountYen: number
  detail: string
}

export function computeBudget(input: ProjectInput, plan: BoothPlan, creatives: Creative[], novelties: Novelty[], selectedNovelty: string[]): BudgetLine[] {
  const { venue, komas } = boothSize(input)
  const pc = planCost(plan, input)
  const monitors = plan.elements.filter((e) => e.kind === 'monitor').length
  const print = creatives.reduce((s, c) => s + c.unitYen * c.qty, 0)
  const nov = novelties.filter((n) => selectedNovelty.includes(n.id)).reduce((s, n) => s + n.unitYen * noveltyQty(n, input), 0)
  return [
    { category: 'space', amountYen: venue.komaPriceYen * komas, detail: `${venue.name} ${komas}小間 × ¥${venue.komaPriceYen.toLocaleString()}` },
    { category: 'build', amountYen: pc.total, detail: `部材 ¥${pc.parts.toLocaleString()} / 床 ¥${pc.carpet.toLocaleString()} / デザイン・施工費` },
    { category: 'electric', amountYen: 60000 + monitors * 18000, detail: `幹線工事＋モニター${monitors}台分の電源` },
    { category: 'print', amountYen: print, detail: `${creatives.length}点の制作物` },
    { category: 'novelty', amountYen: nov, detail: `${selectedNovelty.length}品目` },
    { category: 'staff', amountYen: input.staff * input.days * 25000, detail: `${input.staff}名 × ${input.days}日（交通・日当）` },
    { category: 'logistics', amountYen: 80000 + komas * 10000, detail: '搬入出の車両・保険・予備費' },
  ]
}

// ---------- 業者 ----------

export interface Vendor {
  id: string
  category: '装飾・施工' | '印刷' | 'ノベルティ' | '人材'
  name: string
  area: string
  strength: string
  minYen: number
  leadDays: number
  match: number
}

// サンプル。実装時は提携業者マスタ（TenjikaiVendor）に置き換える。
export const VENDORS: Vendor[] = [
  { id: 'v1', category: '装飾・施工', name: '装飾業者A（サンプル）', area: '首都圏', strength: 'システムブース。2小間から対応、図面1週間', minYen: 600000, leadDays: 45, match: 94 },
  { id: 'v2', category: '装飾・施工', name: '装飾業者B（サンプル）', area: '首都圏・関西', strength: '木工造作。大型サイン・照明演出が得意', minYen: 1500000, leadDays: 60, match: 81 },
  { id: 'v3', category: '装飾・施工', name: '装飾業者C（サンプル）', area: '全国', strength: 'パッケージブース。価格固定で見積が早い', minYen: 350000, leadDays: 30, match: 88 },
  { id: 'v4', category: '印刷', name: '大判印刷D（サンプル）', area: '全国配送', strength: '会場への直送、ターポリン・ファブリック', minYen: 30000, leadDays: 7, match: 92 },
  { id: 'v5', category: 'ノベルティ', name: 'ノベルティE（サンプル）', area: '全国配送', strength: '名入れ小ロット100個から、最短10営業日', minYen: 20000, leadDays: 14, match: 90 },
  { id: 'v6', category: '人材', name: 'イベント人材F（サンプル）', area: '首都圏', strength: 'コンパニオン・受付スタッフ、1日単位', minYen: 25000, leadDays: 21, match: 76 },
]

// ---------- 締切 ----------

export interface Deadline {
  id: string
  daysBefore: number
  title: string
  owner: '自社' | '主催者' | '装飾業者' | '印刷・ノベルティ'
  date: string
}

export function generateDeadlines(input: ProjectInput): Deadline[] {
  const base = new Date(`${input.eventStart}T00:00:00`)
  const items: Omit<Deadline, 'date' | 'id'>[] = [
    { daysBefore: 120, title: '出展申込・小間位置の確定', owner: '主催者' },
    { daysBefore: 90, title: '装飾業者の決定・ブース図面の確定', owner: '装飾業者' },
    { daysBefore: 60, title: '電気工事・小間装飾の届出', owner: '主催者' },
    { daysBefore: 45, title: '大判グラフィックの入稿', owner: '印刷・ノベルティ' },
    { daysBefore: 30, title: 'ノベルティ・チラシの発注締切', owner: '印刷・ノベルティ' },
    { daysBefore: 21, title: '搬入車両・出展者バッジの登録', owner: '主催者' },
    { daysBefore: 14, title: '既存顧客への来場招待メール', owner: '自社' },
    { daysBefore: 7, title: '説明トークのリハーサル・役割分担', owner: '自社' },
    { daysBefore: 1, title: '搬入・ブース設営立ち会い', owner: '装飾業者' },
    { daysBefore: 0, title: '会期初日', owner: '自社' },
  ]
  return items.map((it, i) => {
    const d = new Date(base)
    d.setDate(d.getDate() - it.daysBefore)
    return { ...it, id: `dl${i}`, date: d.toISOString().slice(0, 10) }
  })
}

export function daysUntil(dateStr: string, from = new Date()) {
  const d = new Date(`${dateStr}T00:00:00`)
  return Math.ceil((d.getTime() - from.getTime()) / 86400000)
}

export const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`
export const man = (n: number) => `${(n / 10000).toLocaleString(undefined, { maximumFractionDigits: 1 })}万円`

// ---------- 印刷会社のおすすめ ----------
// 実在のネット印刷サービス。おすすめ理由は一般的な特徴にもとづく仮置きで、価格・納期は各社サイトで確認する。
// 提携が決まったら TenjikaiVendor に移し、送客URLに計測パラメータを付ける。

export const PRINT_PARTNERS: { id: string; name: string; url: string; strength: string; kinds: (CreativeKind | 'novelty')[] }[] = [
  { id: 'raksul', name: 'ラクスル', url: 'https://raksul.com/', strength: 'チラシ・クリアファイル・ノベルティまで1か所で発注でき、会場直送や短納期の選択肢が多い', kinds: ['flyer', 'clearfile', 'card', 'rollup', 'novelty'] },
  { id: 'printpac', name: 'プリントパック', url: 'https://www.printpac.co.jp/', strength: '大量部数のチラシで単価を抑えやすい。納期を長めに取れるなら候補', kinds: ['flyer', 'card', 'clearfile'] },
  { id: 'graphic', name: 'グラフィック', url: 'https://www.graphic.jp/', strength: '大判出力やタペストリー、特殊加工の品目が豊富。背面壁やバナー向け', kinds: ['backwall', 'rollup', 'flyer'] },
]

export function recommendPrinters(kind: CreativeKind | 'novelty') {
  return PRINT_PARTNERS.filter((p) => p.kinds.includes(kind))
}

// ---------- AIで作った文面の重ね合わせ ----------
// AIが返すのは文面だけ。寸法・金額・数量はルール計算のものを使い、予算や小間数を後から変えても文面は保つ。

export interface BoothCopy {
  name: string
  concept: string
  flow: string
}

export interface CreativeCopy {
  copy: string
  purpose: string
}

export interface GeneratedPlan {
  /** ai = LLMで作成 / mock = ルールの下書き（未ログイン・上限・失敗時） */
  source: 'ai' | 'mock'
  /** 利用者に見せる補足（モックにした理由など） */
  notice?: string
  analysis: SiteAnalysis
  boothCopy: Partial<Record<BoothPlan['variant'], BoothCopy>>
  creativeCopy: Partial<Record<CreativeKind, CreativeCopy>>
}

export function mockGeneratedPlan(input: ProjectInput, notice?: string): GeneratedPlan {
  return { source: 'mock', notice, analysis: analyzeSite(input.serviceUrl), boothCopy: {}, creativeCopy: {} }
}

export function applyBoothCopy(plans: BoothPlan[], copy: GeneratedPlan['boothCopy']): BoothPlan[] {
  return plans.map((p) => (copy[p.variant] ? { ...p, ...copy[p.variant] } : p))
}

export function applyCreativeCopy(creatives: Creative[], copy: GeneratedPlan['creativeCopy']): Creative[] {
  return creatives.map((c) => (copy[c.kind] ? { ...c, ...copy[c.kind] } : c))
}

/** 画面から呼ぶ。通信・認証・上限・LLMのどこで失敗してもモックを返す（画面は止めない） */
export async function requestGeneratedPlan(input: ProjectInput): Promise<GeneratedPlan> {
  try {
    const res = await fetch('/api/tenjikai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const json = (await res.json().catch(() => null)) as (GeneratedPlan & { error?: string }) | null
    if (res.ok && json?.analysis) return json
    if (res.status === 401) return mockGeneratedPlan(input, 'ログインすると、サイトの内容に合わせてAIが作成します。いまは下書きを表示しています。')
    return mockGeneratedPlan(input, json?.error ? `${json.error} いまは下書きを表示しています。` : 'AIでの作成に失敗したため、下書きを表示しています。')
  } catch {
    return mockGeneratedPlan(input, 'AIでの作成に失敗したため、下書きを表示しています。')
  }
}
