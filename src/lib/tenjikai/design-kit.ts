// ============================================
// ブースのデザインの決まり（Booth Design Kit。BDK）
// ============================================
// 仕様: docs/architecture/tenjikai/BOOTH-DESIGN-KIT-2026-10-29.md（4 章）と、
//       docs/architecture/tenjikai/BOOTH-CONCEPT-FLOW-2026-11-11.md（4 章。デザインの方向 = 実写 / 大きな文字と色面 / 世界観）
// 最初に1つ決め、このあと作る面・制作物・完成予想図の指示文に、同じ文を入れる。
// ⚠️ 色の規則と指示文の組み立てだけを持つ（React・DB・課金の API は使わない。テストあり: design-kit.test.ts）
import type { Goal, SiteAnalysis } from './engine'

export type KitVariantKey = 'band' | 'paper' | 'dark'

// ---------- デザインの方向（絵の作り方の型。3つ） ----------

export type ArtType = 'photo' | 'graphic' | 'world'
export const ART_TYPES: readonly ArtType[] = ['photo', 'graphic', 'world']

/** デザインの方向。文章の AI（または下書き）が、サイトの内容に合わせて書く。型は3つから1つずつ使う */
export interface ArtDirection {
  type: ArtType
  /** 方向の名前（全角12字まで。画像には描かない） */
  name: string
  /** 狙い（全角40字まで） */
  aim: string
  /** キービジュアルの題材（全角60字まで。文字・数字は含めない） */
  subject: string
  /** キービジュアルに描く見出し（1行12字・2行まで。\n で改行できる） */
  headline: string
  /** 絵の調子の文（画面に出す。型ごとに決まった文） */
  look: string
}

/** 出展の狙いの文（戦略。画面に出す） */
export interface BoothStrategy {
  /** 出展の狙い */
  aim: string
  /** 来てほしい人 */
  audience: string
  /** 通路から3秒で伝える一言 */
  hook: string
  /** ブースで体験してもらうこと */
  experience: string
}

export interface ArtTypeSpec {
  label: string
  /** 画面用: 絵の作り方 / 素材 / 照明 / 向く目的 */
  how: string
  material: string
  light: string
  fit: string
  /** 指示文用（型ごとに、構図・光・素材の言葉を具体的に書く） */
  look: string
  composition: string
  lightText: string
  materialText: string
  /** この型の既定の面積の比率・帯の高さ（KIT_VARIANTS の案） */
  variant: KitVariantKey
}

export const ART_SPEC: Record<ArtType, ArtTypeSpec> = {
  photo: {
    label: '実写',
    how: '人や利用の場面、製品を使う手元を、写真のような絵で面いっぱいに使う',
    material: '木・紙・布・金属など、実物の質感',
    light: '窓からの自然光。奥をぼかす',
    fit: '信頼・導入の実感を伝えたいとき',
    look: '人や利用の場面、製品を使う手元などを写した、写真のような絵を、見出しの帯の下から面の端まで広げて使う。イラストやグラフィックの形は使わない。',
    composition: '構図: 人物は後ろ姿・横顔・手元・肩越しのどれかにして、顔を正面から大きく写さない。手前に主役（手元や製品）、奥に執務室や展示会場の背景を置く。視線の高さから、面に正対して撮る。',
    lightText: '光: 窓からの自然光のような、やわらかい光。被写界深度は浅く、奥をなめらかにぼかす。',
    materialText: '素材: 木、紙、布、金属など、実物の質感が見える。服・小物・背景に主色と差し色を使い、全体の色みを決まりの色に寄せる。',
    variant: 'paper',
  },
  graphic: {
    label: '大きな文字と色面',
    how: 'ブランドの色の大きな面と太い見出し。幾何の形を大きく使う',
    material: '印刷物のような、無地の色の面',
    light: '影も光沢もない、平らな色面',
    fit: '通路で足を止めたい、認知を広げたいとき',
    look: '大きな文字と色面で作るグラフィック。ブランドの色の大きな面と、太い見出しを主役にする。幾何の形を大きく、1〜2つだけ使い、遠くから読める強さにする。写真、3D の描写、影、グラデーション、イラスト、アイコン、人物、矢印、歯車、端末や画面の絵は描かない。',
    composition: '構図: 見出しの帯と、大きな幾何の形（帯1本・円1つまで）で、面を大胆に分ける。形の中に、模様・絵・図を描かない。',
    lightText: '光: 影も光沢もない、均一で平らな色面。',
    materialText: '素材: 印刷物のような、無地の色の面。',
    variant: 'band',
  },
  world: {
    label: '世界観',
    how: '立体のイラストや、光と奥行のある空間で、サービスの世界を1枚で見せる',
    material: 'ガラスの透明感、半透明の樹脂、つや消しの金属',
    light: '暗い背景に、主色と差し色の光が回り込む',
    fit: 'デモ・体験に引きこみたいとき',
    look: '立体のイラストや、光と奥行のある空間の絵で、サービスの世界を1枚で見せる。製品の画面は、文字のない抽象的な図形と色の面で見せる。',
    composition: '構図: 中央に、主役となる立体の形を1つ置き、そのまわりに小さな立体を少数だけ浮かせる。手前から奥へ小さくなる奥行きをつける。面に正対した構図にする。',
    lightText: '光: 暗色の背景の中に、主色と差し色の光が回り込む。立体の縁に、細く明るい線（リムライト）が出る。',
    materialText: '素材: ガラスのような透明感、半透明の樹脂、つや消しの金属。やわらかい影を落とす。全体の色みを決まりの色に寄せる。',
    variant: 'dark',
  },
}

export const isArtType = (v: unknown): v is ArtType => typeof v === 'string' && (ART_TYPES as readonly string[]).includes(v)

export interface BoothDesignKit {
  version: 2
  variant: KitVariantKey
  /** デザインの方向（型・名前・狙い・題材・見出し・絵の調子の文）。2026-11-11 から */
  direction: ArtDirection
  /** 5つの役割の色（#rrggbb） */
  palette: { primary: string; dark: string; accent: string; paper: string; mist: string }
  /** 面積の目安の比率（合計 1） */
  ratio: { paper: number; primary: number; dark: number; accent: number }
  /** 書体の雰囲気（指示文に毎回同じ言葉で入れる） */
  typeLook: string
  motif: { bandAngleDeg: number; bandHeightRatio: number; circleDiameterRatio: number; circleAnchor: 'right-bottom' }
  zones: { headBandRatio: number; footBandRatio: number }
  tone: string
  /** 色ごとの出どころ（画面に出して、利用者が直せるようにする） */
  provenance: Record<'primary' | 'dark' | 'accent', { from: 'analysis' | 'derived' | 'user' | 'default'; note: string }>
}

// ---------- 色の計算 ----------

const HEX = /^#[0-9a-fA-F]{6}$/
export const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v)

export function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export function toHex([r, g, b]: [number, number, number]): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** 相対輝度（WCAG 2.x） */
export function luminance(hex: string): number {
  const f = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const [r, g, b] = parseHex(hex)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** 2色の対比（1〜21）。文字は 4.5 以上（大きい文字は 3 以上）にする */
export function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** 彩度（0〜1。HSL） */
export function saturation(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => v / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max === min) return 0
  const l = (max + min) / 2
  return (max - min) / (1 - Math.abs(2 * l - 1))
}

/** a と b を、t（0〜1）の割合で混ぜる（t=0 で a、t=1 で b） */
export function mix(a: string, b: string, t: number): string {
  const x = parseHex(a), y = parseHex(b)
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t])
}

const WHITE = '#ffffff'
const BLACK = '#000000'
const DEFAULT_ACCENT = '#ffd400'

/** 白い文字を乗せて、対比が min 以上になるまで暗くする（同じ色相を保つ） */
export function darkenForWhiteText(hex: string, min = 4.5): string {
  let c = hex
  for (let i = 0; i < 40 && contrast(c, WHITE) < min; i++) c = mix(c, BLACK, 0.06)
  return c
}

// ---------- 決まりを作る ----------

export const KIT_VARIANTS: Record<KitVariantKey, { label: string; note: string; ratio: BoothDesignKit['ratio']; headBandRatio: number; circleDiameterRatio: number }> = {
  band: { label: '主色の帯を大きく', note: '遠くからでも色が目に入る。見出しの帯を高めにとる', ratio: { paper: 0.5, primary: 0.35, dark: 0.1, accent: 0.05 }, headBandRatio: 0.35, circleDiameterRatio: 0.4 },
  paper: { label: '紙を広く', note: '余白を広くとり、すっきり見せる。帯は細め', ratio: { paper: 0.7, primary: 0.2, dark: 0.07, accent: 0.03 }, headBandRatio: 0.3, circleDiameterRatio: 0.36 },
  dark: { label: '暗色で引き締める', note: '暗い円を大きくして、全体を引き締める', ratio: { paper: 0.45, primary: 0.2, dark: 0.3, accent: 0.05 }, headBandRatio: 0.3, circleDiameterRatio: 0.5 },
}

/**
 * サイトの解析（色は読み取り、または仮の値）から、5つの役割の色を決める。
 * - 主色: 白い文字を乗せて対比 4.5 以上。足りないときは同じ色相のまま暗くする。黒・白・灰色に近いときは、差し色を主役にする
 * - 暗色: とても暗い色（白との対比 12 以上）。元の色が明るければ、主色を暗くして作る
 * - 差し色: 主色と見分けがつく色（対比 1.5 以上）。つかなければ既定の黄色
 */
export function deriveKit(a: Pick<SiteAnalysis, 'colors' | 'tone'>, variant: KitVariantKey = 'band', direction?: ArtDirection): BoothDesignKit {
  const src = a.colors
  const prov: BoothDesignKit['provenance'] = {
    primary: { from: 'analysis', note: '読み取った主な色' },
    dark: { from: 'analysis', note: '読み取った暗い色' },
    accent: { from: 'analysis', note: '読み取った差し色' },
  }
  let primary = isHex(src.primary) ? src.primary.toLowerCase() : '#0066ff'
  let accent = isHex(src.accent) ? src.accent.toLowerCase() : DEFAULT_ACCENT
  let dark = isHex(src.secondary) ? src.secondary.toLowerCase() : ''
  if (!isHex(src.primary)) prov.primary = { from: 'default', note: '色を読み取れなかったため、ドヤAIの青' }

  // 黒・白・灰色に近い主色は、色としての主役にならない。差し色を主色に回す
  if (saturation(primary) < 0.12 && saturation(accent) >= 0.25) {
    const oldPrimary = primary
    primary = accent
    accent = DEFAULT_ACCENT
    prov.primary = { from: 'derived', note: `主色（${oldPrimary}）が無彩色に近いため、差し色を主色にした` }
    prov.accent = { from: 'default', note: '既定の黄色' }
  }
  const darkened = darkenForWhiteText(primary)
  if (darkened !== primary) {
    prov.primary = { from: 'derived', note: '白い文字が読めるよう、同じ色相のまま暗くした' }
    primary = darkened
  }
  if (!dark || luminance(dark) > 0.06 || contrast(dark, WHITE) < 12) {
    dark = mix(primary, BLACK, 0.78)
    prov.dark = { from: 'derived', note: '主色を暗くして作った' }
  }
  if (contrast(accent, primary) < 1.5) {
    accent = DEFAULT_ACCENT
    prov.accent = { from: 'default', note: '主色と見分けがつかないため、既定の黄色' }
  }
  const v = KIT_VARIANTS[variant]
  return {
    version: 2,
    variant,
    direction: direction ?? makeDirection('graphic', { name: '大きな文字と色面', aim: '', subject: '', headline: '' }),
    palette: { primary, dark, accent, paper: WHITE, mist: mix(primary, WHITE, 0.94) },
    ratio: v.ratio,
    typeLook: '太い日本語のゴシック体。字間は広め。角は丸めない。',
    motif: { bandAngleDeg: 12, bandHeightRatio: 0.18, circleDiameterRatio: v.circleDiameterRatio, circleAnchor: 'right-bottom' },
    zones: { headBandRatio: v.headBandRatio, footBandRatio: 0.2 },
    tone: a.tone,
    provenance: prov,
  }
}

/** 色・出どころはそのままに、3つの案（面積の比率・帯の高さ・円の大きさ）だけを切り替える */
export function withVariant(kit: BoothDesignKit, variant: KitVariantKey): BoothDesignKit {
  const v = KIT_VARIANTS[variant]
  return { ...kit, variant, ratio: v.ratio, motif: { ...kit.motif, circleDiameterRatio: v.circleDiameterRatio }, zones: { ...kit.zones, headBandRatio: v.headBandRatio } }
}

/** 方向を作る（絵の調子の文は、型ごとに決まった文を入れる） */
export function makeDirection(type: ArtType, d: Partial<Omit<ArtDirection, 'type' | 'look'>> = {}): ArtDirection {
  return { type, name: d.name ?? ART_SPEC[type].label, aim: d.aim ?? '', subject: d.subject ?? '', headline: d.headline ?? '', look: ART_SPEC[type].look }
}

/** 方向を選ぶ。型の既定の面積の比率・帯の高さにも切り替える（色・出どころはそのまま） */
export function withDirection(kit: BoothDesignKit, direction: ArtDirection): BoothDesignKit {
  return { ...withVariant(kit, ART_SPEC[direction.type].variant), direction }
}

function isDirection(v: unknown): v is ArtDirection {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Partial<ArtDirection>
  return isArtType(d.type) && ['name', 'aim', 'subject', 'headline', 'look'].every((k) => typeof (d as Record<string, unknown>)[k] === 'string')
}

/** 保存した決まり（version 2）が、使える形かを確かめる（壊れた保存は捨てる） */
export function isKit(v: unknown): v is BoothDesignKit {
  if (typeof v !== 'object' || v === null) return false
  const k = v as Partial<BoothDesignKit>
  return k.version === 2 && isDirection(k.direction) && isKitBody(v)
}

/** 保存を読む。version 1（方向を持たない）は、大きな文字と色面（graphic）の決まりとして読む。使えない保存は null */
export function readKit(v: unknown): BoothDesignKit | null {
  if (isKit(v)) return v
  if (typeof v === 'object' && v !== null && (v as { version?: unknown }).version === 1 && isKitBody(v)) {
    return { ...(v as unknown as Omit<BoothDesignKit, 'version' | 'direction'>), version: 2, direction: makeDirection('graphic') }
  }
  return null
}

function isKitBody(v: unknown): boolean {
  const k = v as Partial<BoothDesignKit>
  return !!k.palette && ['primary', 'dark', 'accent', 'paper', 'mist'].every((r) => isHex((k.palette as Record<string, unknown>)[r])) && !!k.ratio && !!k.motif && !!k.zones && !!k.provenance && typeof k.variant === 'string' && k.variant in KIT_VARIANTS
}

/** 利用者が色を直したときの反映。直した色は出どころを 'user' にする */
export function withPaletteColor(kit: BoothDesignKit, role: 'primary' | 'dark' | 'accent', hex: string): BoothDesignKit {
  if (!isHex(hex)) return kit
  const value = hex.toLowerCase()
  const palette = { ...kit.palette, [role]: value }
  if (role === 'primary') palette.mist = mix(value, WHITE, 0.94)
  return { ...kit, palette, provenance: { ...kit.provenance, [role]: { from: 'user', note: 'あなたが直した色' } } }
}

/** 決まりの点検（画面に出す）。ok が false のものがあれば、直すようすすめる */
export function checkKit(kit: BoothDesignKit): { key: string; label: string; value: number; min: number; ok: boolean }[] {
  const p = kit.palette
  const rows = [
    { key: 'head', label: '主色の帯の上の白い見出し', value: contrast(p.primary, WHITE), min: 4.5 },
    { key: 'dark', label: '紙の上の暗い文字', value: contrast(p.dark, p.paper), min: 4.5 },
    { key: 'accent', label: '差し色と主色の見分け', value: contrast(p.accent, p.primary), min: 1.5 },
  ]
  return rows.map((r) => ({ ...r, value: Math.round(r.value * 10) / 10, ok: r.value >= r.min }))
}

// ---------- 見出しの文字 ----------

export const HEADLINE_MAX_PER_LINE = 12
export const HEADLINE_MAX_LINES = 2

/**
 * 画像に描かせる見出しを、1行 12 字・2行までにする（仕様 4.4）。
 * 改行（\n）があればそれを使う。長いときは、真ん中あたりで2行に分ける。合計が 24 字を超えるときは、先頭の 24 字までにする。
 */
export function headlineLines(text: string): string[] {
  const t = (text ?? '').replace(/\r/g, '')
  const manual = t.split('\n').map((s) => s.trim()).filter(Boolean)
  if (manual.length >= 2 && manual.every((l) => [...l].length <= HEADLINE_MAX_PER_LINE)) return manual.slice(0, HEADLINE_MAX_LINES)
  const flat = [...t.replace(/\s+/g, ' ').trim()]
  if (flat.length === 0) return []
  if (flat.length <= HEADLINE_MAX_PER_LINE) return [flat.join('')]
  const limited = flat.slice(0, HEADLINE_MAX_PER_LINE * HEADLINE_MAX_LINES)
  const cut = Math.ceil(limited.length / 2)
  return [limited.slice(0, cut).join(''), limited.slice(cut).join('')]
}

// ---------- 面の型 ----------

export type LayoutType = 'hero' | 'appeal' | 'number' | 'guide'

/** 大きな文字と色面（graphic）の面の型。前の版の名前のまま残す */
export const LAYOUT_TEXT: Record<LayoutType, string> = {
  hero: 'ヒーロー（上の帯に見出しとブランド名。中央に円。下は無地）',
  appeal: '訴求（上の帯に見出し1つ。中央に斜めの帯。下は無地）',
  number: '数字（上の帯に見出し。中央は、あとから数字を重ねるための無地。下に QR コードを重ねる場所を空ける）',
  guide: '案内（主色の面に、短い案内文1つ。足元は暗色）',
}

export const LAYOUT_TEXT_BY_TYPE: Record<ArtType, Record<LayoutType, string>> = {
  graphic: LAYOUT_TEXT,
  photo: {
    hero: 'ヒーロー（上の帯に見出しとブランド名。帯の下は、題材の写真を面いっぱいに。この面が、ブース全体の見本になる）',
    appeal: '訴求（上の帯に見出し1つ。帯の下は、その強みが伝わる場面の写真）',
    number: '数字（上の帯に見出し。中央は、あとから数字を重ねるため、写真を薄く、ぼかして使う。下に QR コードを重ねる場所を空ける）',
    guide: '案内（主色の面に、短い案内文1つ。足元は暗色。写真は使わない）',
  },
  world: {
    hero: 'ヒーロー（上の帯に見出しとブランド名。帯の下は、題材の世界を、光と奥行で面いっぱいに。この面が、ブース全体の見本になる）',
    appeal: '訴求（上の帯に見出し1つ。帯の下は、その強みを表す立体を1つ中央に）',
    number: '数字（上の帯に見出し。中央は、あとから数字を重ねるため、暗色の無地に近い、光だけの空間。下に QR コードを重ねる場所を空ける）',
    guide: '案内（主色の面に、短い案内文1つ。足元は暗色。立体は使わない）',
  },
}

// ---------- 指示文 ----------

/**
 * 割合は、数字と「%」でなく「割」「分」の言葉で書く。
 * 2026-10-29 の試し（12枚）で、指示文に「2000mm」「18%」と書くと、画像に寸法線や「18%」の注釈が描かれることが分かった（12枚中5枚）。
 */
const wari = (n: number) => (n >= 0.095 ? `約${Math.round(n * 100) / 10}割` : `約${Math.max(1, Math.round(n * 100))}分`)

/** AI や利用者が書いた文を、指示文に入れられる形にする（引用符・数字と単位・改行を除く。画像に文字や寸法線が描かれないため） */
export function scrub(text: string, max = 80): string {
  return (text ?? '')
    .replace(/[「」『』"“”]/g, '')
    .replace(/[0-9０-９][0-9０-９.,，．]*\s*(mm|cm|m|ミリ|メートル|%|％|割|型|台|px|人|社|件|倍)?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/** 全部の面・制作物・完成予想図で、一字も違わずに同じになる共通のブロック */
export function kitBlock(kit: BoothDesignKit): string {
  const p = kit.palette, r = kit.ratio, m = kit.motif, z = kit.zones
  const d = kit.direction
  const spec = ART_SPEC[d.type]
  const aim = scrub(d.aim, 60), subject = scrub(d.subject, 80)
  const graphic = d.type === 'graphic'
  const colorLine = graphic
    ? `・色は5つだけ: 主色 ${p.primary}（見出しの帯・大きな面）、暗色 ${p.dark}（濃い面と、紙の上の文字）、差し色 ${p.accent}（小さな面だけ）、紙 ${p.paper}、薄い補助色 ${p.mist}。面積の目安は、紙 ${wari(r.paper)}、主色 ${wari(r.primary)}、暗色 ${wari(r.dark)}、差し色 ${wari(r.accent)} 以内。ほかの色は足さない。`
    : `・色は5つを主に使う: 主色 ${p.primary}（見出しの帯と、全体の色みの中心）、暗色 ${p.dark}（影と、濃い部分）、差し色 ${p.accent}（小さな差し色だけ）、紙 ${p.paper}、薄い補助色 ${p.mist}。写真や立体の絵でも、服・小物・背景・光の色をこの5色に寄せ、全体の色みをそろえる。ほかの強い色は足さない。`
  const shapeLine = graphic
    ? `・形: 大きな幾何の形を1〜2つ。帯は1本だけ（右上がり ${m.bandAngleDeg} 度、面の高さの ${wari(m.bandHeightRatio)} の太さ、色は差し色）。円は1つだけ（直径は面の短い辺の ${wari(m.circleDiameterRatio)}、中心は右下寄り、色は暗色）。`
    : ''
  const zoneLine = graphic
    ? `・構図: 上から ${wari(z.headBandRatio)} は主色の無地の帯（見出しを置く）。下から ${wari(z.footBandRatio)} は紙の色の無地。面の端まで、色で塗りきる（枠、額縁、外側の余白、影、背景の灰色は描かない）。`
    : `・構図: 上から ${wari(z.headBandRatio)} は主色の無地の帯（見出しを置く）。その下から面の端まで、絵で塗りきる（枠、額縁、外側の余白、背景の灰色は描かない）。`
  return [
    '【ブースのデザインの決まり（全部の面で、一字も違わずに同じにする）】',
    `・デザインの方向: ${spec.label}型。狙い: ${aim || spec.fit}。キービジュアルの題材: ${subject || '（サービスの利用の場面）'}。題材は絵で表し、文字にしない。`,
    `・絵の調子: ${spec.look}`,
    `・${spec.composition}`,
    `・${spec.lightText}`,
    `・${spec.materialText}`,
    colorLine,
    shapeLine,
    zoneLine,
    `・書体: ${kit.typeLook}見出しの文字は紙の色（白）。`,
    `・トーン: ${kit.tone}`,
  ].filter(Boolean).join('\n')
}

/** 面の形を、数字を使わずに言葉で書く（寸法の数字を、画像に描かれないようにする） */
export function shapeWord(widthMm: number, heightMm: number): string {
  const r = widthMm / heightMm
  if (r > 1.6) return '横に長い長方形'
  if (r > 1.1) return 'やや横長の長方形'
  if (r >= 0.9) return '正方形に近い'
  if (r >= 0.6) return 'やや縦長の長方形'
  return '縦に細長い長方形'
}

export interface DesignTarget {
  /** 面・制作物の名前 */
  name: string
  widthMm: number
  heightMm: number
  role: string
  /** 見る距離（m）。無ければ書かない */
  viewDistanceM?: number
  layout: LayoutType
  /** 画像に描く文字。空のときは、文字を1つも描かない背景にする */
  headline: string
  /** 見本の画像を参照として渡すか */
  hasReference?: boolean
  /** 左右が切られるときの、文字を置く幅（%）。100 なら制限なし */
  safeWidthPct?: number
  /** 上下が切られるときの、文字を置く高さ（%） */
  safeHeightPct?: number
}

const FORBID_COMMON = '実在する人物（有名人・実在の顔）、ロゴや認証マーク（実在のものも、作ったものも）、枠・額縁・外側の余白・背景の灰色、寸法線と寸法・割合の数字、指定した文字以外の文字（看板・画面・書類・商品に写る文字も含む）、絵文字'
const FORBID_BY_TYPE: Record<ArtType, string> = {
  graphic: '決まりにない色、写真、3D の描写、イラスト、アイコン、人物、矢印、歯車、端末や画面の絵、影、斜めのアングル',
  photo: '決まりの色から外れた強い色、イラスト調、アイコン、矢印、歯車、CG のような質感、顔を正面から大きく写した人物、斜めのアングル（面に正対して撮る）',
  world: '決まりの色から外れた強い色、実写の人物、アイコン、矢印、歯車、文字の入った画面、斜めのアングル（面に正対した構図にする）',
}
const REFERENCE_BY_TYPE: Record<ArtType, string> = {
  graphic: '見本の、色・帯と円の形と位置・書体の雰囲気・余白を、そのまま使う。',
  photo: '見本の、写真の色みと光・見出しの帯の位置と書体・余白を、そのまま使う。題材の場面は、この面に合うものに変えてよい。',
  world: '見本の、立体の質感・光の回り込み・色み・見出しの帯の位置と書体を、そのまま使う。立体の形は、この面に合うものに変えてよい。',
}

/**
 * 指示文を作る（仕様 4.10。役割 → 方向 → 色 → 文字 → 禁止 の順）。面も、制作物も、完成予想図以外はこの関数だけを通す。
 */
export function buildDesignPrompt(kit: BoothDesignKit, t: DesignTarget): string {
  const type = kit.direction.type
  const lines = headlineLines(t.headline)
  const safe = t.safeWidthPct && t.safeWidthPct < 100 ? `。文字は、面の中央の約${Math.max(1, Math.round(t.safeWidthPct / 10))}割の幅の中に置く（左右が切られることがあるため）` : ''
  const safeH = t.safeHeightPct && t.safeHeightPct < 100 ? '。上下も、端から十分に空ける' : ''
  const textBlock = lines.length
    ? [
        '【文字】この面に描く文字は、次の1つだけ。一字も変えず、一字も足さず、正確に描く。',
        lines.map((l) => `「${l}」`).join('\n') + (lines.length > 1 ? '\n（2行に分けて描く。行の切れ目はここのとおり）' : ''),
        `位置は、上の主色の帯の中央。帯からはみ出さない大きさで描き、左右に十分な余白を空ける${safe}${safeH}。背景との対比をはっきりさせる。`,
        'この文字以外の、ロゴ、数字、記号、寸法線、寸法の数字、割合の数字、小さな文字、文字に見える模様は、画面に1つも描かない。',
      ].join('\n')
    : '【文字】この面には、文字・数字・ロゴ・記号を、一切描かない。無地の背景として作る。'
  return [
    `展示会ブースの「${t.name}」に貼る完成デザイン。${shapeWord(t.widthMm, t.heightMm)}の面を、枠なしで、面いっぱいに作る。役割：${t.role}${t.viewDistanceM ? `（遠くから見られる面。見る距離は ${t.viewDistanceM}m ほど）` : ''}`,
    kitBlock(kit),
    `この面の型：${LAYOUT_TEXT_BY_TYPE[type][t.layout]}`,
    textBlock,
    `【禁止】${FORBID_BY_TYPE[type]}、${FORBID_COMMON}。`,
    t.hasReference ? `【参照】添付の画像は、このブースの見本（キービジュアル）。${REFERENCE_BY_TYPE[type]}見本の中の文字や内容は写さない（この面の文字は、上に書いたものだけ）。` : '',
  ].filter(Boolean).join('\n')
}

// ---------- 戦略と方向の下書き・検査 ----------

const GOAL_TEXT: Record<Goal, { aim: string; experience: string }> = {
  lead: { aim: '名刺交換を増やし、商談につなげる', experience: '受付で話を聞き、デモで使い方を見て、資料と名刺を交換する' },
  brand: { aim: 'サービスの名前と特長を、通路で知ってもらう', experience: '通路から特長が伝わり、立ち止まって映像や展示を見る' },
  demo: { aim: '実際に触って、使い心地を確かめてもらう', experience: 'デモ台で操作を体験し、担当者に質問する' },
}

const flat = (t: string) => (t ?? '').replace(/\s+/g, '')

/** サイトの解析から作る、戦略の下書き（AI が使えないとき・欠けたときに使う） */
export function draftStrategy(a: Pick<SiteAnalysis, 'brand' | 'category' | 'headline' | 'valueProps' | 'targets'>, goal: Goal): BoothStrategy {
  const g = GOAL_TEXT[goal] ?? GOAL_TEXT.lead
  return {
    aim: g.aim,
    audience: a.targets.length ? a.targets.join('、') : `${a.category}に関心のある人`,
    hook: flat(a.headline) || a.valueProps[0]?.title || a.brand,
    experience: g.experience,
  }
}

/** サイトの解析から作る、3つの方向の下書き（型は必ず3つそろえる） */
export function draftDirections(a: Pick<SiteAnalysis, 'brand' | 'category' | 'headline' | 'valueProps' | 'targets'>, goal: Goal = 'lead'): ArtDirection[] {
  const vp = (i: number) => a.valueProps[i % Math.max(1, a.valueProps.length)]?.title || a.brand
  const who = a.targets[0] || `${a.category}の担当者`
  return [
    makeDirection('photo', { name: '導入の実感', aim: '導入した会社の毎日が見え、信頼を伝える', subject: `${who}が、${a.category}を使って仕事を進める場面。机の上の手元と、打ち合わせの後ろ姿`, headline: vp(0) }),
    makeDirection('graphic', { name: '通路で止める', aim: '遠くからでも読める見出しで、足を止めてもらう', subject: 'ブランドの色の大きな面と、大きな幾何の形。人物や製品の絵は使わない', headline: flat(a.headline) || vp(0) }),
    makeDirection('world', { name: '世界に引きこむ', aim: 'サービスの世界を1枚で見せ、デモに誘う', subject: `${a.category}の仕組みを、光る立体の部品が並ぶ空間として表した絵`, headline: vp(1) }),
  ]
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** AI の返した戦略を、項目ごとに検査する。欠けた項目は下書きで埋める */
export function completeStrategy(raw: unknown, draft: BoothStrategy): BoothStrategy {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  return {
    aim: clean(r.aim, 80) || draft.aim,
    audience: clean(r.audience, 80) || draft.audience,
    hook: clean(r.hook, 30) || draft.hook,
    experience: clean(r.experience, 100) || draft.experience,
  }
}

/** AI の返した方向（配列、または型をキーにした連想配列）を、型ごと・項目ごとに検査する。型が欠けたら下書きで埋め、必ず3つ返す */
export function completeDirections(raw: unknown, draft: ArtDirection[]): ArtDirection[] {
  const list: unknown[] = Array.isArray(raw) ? raw : typeof raw === 'object' && raw !== null ? Object.entries(raw).map(([k, v]) => (typeof v === 'object' && v !== null ? { type: k, ...(v as object) } : v)) : []
  return ART_TYPES.map((type) => {
    const fallback = draft.find((d) => d.type === type) ?? makeDirection(type)
    const found = list.find((x) => typeof x === 'object' && x !== null && (x as { type?: unknown }).type === type) as Record<string, unknown> | undefined
    if (!found) return fallback
    return makeDirection(type, {
      name: clean(found.name, 24) || fallback.name,
      aim: clean(found.aim, 80) || fallback.aim,
      subject: scrub(clean(found.subject, 120), 120) || fallback.subject,
      headline: headlineLines(clean(found.headline, 60)).join('\n') || fallback.headline,
    })
  })
}

/** 保存した戦略・方向を読む（壊れていたら、下書きで埋める） */
export function readStrategy(raw: unknown, draft: BoothStrategy): BoothStrategy {
  return completeStrategy(raw, draft)
}
