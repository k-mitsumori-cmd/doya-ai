// ============================================
// ブースのデザインの決まり（Booth Design Kit。BDK）
// ============================================
// 仕様: docs/architecture/tenjikai/BOOTH-DESIGN-KIT-2026-10-29.md（4 章）
// 最初に1つ決め、このあと作る面・制作物・完成予想図の指示文に、同じ文を入れる。
// ⚠️ 色の規則と指示文の組み立てだけを持つ（React・DB・課金の API は使わない。テストあり: design-kit.test.ts）
import type { SiteAnalysis } from './engine'

export type KitVariantKey = 'band' | 'paper' | 'dark'

export interface BoothDesignKit {
  version: 1
  variant: KitVariantKey
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
export function deriveKit(a: Pick<SiteAnalysis, 'colors' | 'tone'>, variant: KitVariantKey = 'band'): BoothDesignKit {
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
    version: 1,
    variant,
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

/** 保存した決まりが、使える形かを確かめる（壊れた保存は捨てる） */
export function isKit(v: unknown): v is BoothDesignKit {
  if (typeof v !== 'object' || v === null) return false
  const k = v as Partial<BoothDesignKit>
  return k.version === 1 && !!k.palette && ['primary', 'dark', 'accent', 'paper', 'mist'].every((r) => isHex((k.palette as Record<string, unknown>)[r])) && !!k.ratio && !!k.motif && !!k.zones && !!k.provenance && typeof k.variant === 'string' && k.variant in KIT_VARIANTS
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

export const LAYOUT_TEXT: Record<LayoutType, string> = {
  hero: 'ヒーロー（上の帯に見出しとブランド名。中央に円。下は無地）',
  appeal: '訴求（上の帯に見出し1つ。中央に斜めの帯。下は無地）',
  number: '数字（上の帯に見出し。中央は、あとから数字を重ねるための無地。下に QR コードを重ねる場所を空ける）',
  guide: '案内（主色の面に、短い案内文1つ。足元は暗色）',
}

// ---------- 指示文 ----------

/**
 * 割合は、数字と「%」でなく「割」「分」の言葉で書く。
 * 2026-10-29 の試し（12枚）で、指示文に「2000mm」「18%」と書くと、画像に寸法線や「18%」の注釈が描かれることが分かった（12枚中5枚）。
 */
const wari = (n: number) => (n >= 0.095 ? `約${Math.round(n * 100) / 10}割` : `約${Math.max(1, Math.round(n * 100))}分`)

/** 全部の面・制作物・完成予想図で、一字も違わずに同じになる共通のブロック */
export function kitBlock(kit: BoothDesignKit): string {
  const p = kit.palette, r = kit.ratio, m = kit.motif, z = kit.zones
  return [
    '【ブースのデザインの決まり（全部の面で、一字も違わずに同じにする）】',
    `・色は5つだけ: 主色 ${p.primary}（見出しの帯・大きな面）、暗色 ${p.dark}（濃い面と、紙の上の文字）、差し色 ${p.accent}（小さな面だけ）、紙 ${p.paper}、薄い補助色 ${p.mist}。面積の目安は、紙 ${wari(r.paper)}、主色 ${wari(r.primary)}、暗色 ${wari(r.dark)}、差し色 ${wari(r.accent)} 以内。ほかの色は足さない。`,
    '・絵の調子: 色の面だけで作る、フラットなデザイン。帯と円は、無地の色の面にする（中に模様・絵・図を描かない）。写真、3D の描写、影、グラデーション、イラスト、アイコン、人物、矢印、歯車、端末や画面の絵は、描かない。',
    `・形: 帯は1本だけ（右上がり ${m.bandAngleDeg} 度、面の高さの ${wari(m.bandHeightRatio)} の太さ、色は差し色）。円は1つだけ（直径は面の短い辺の ${wari(m.circleDiameterRatio)}、中心は右下寄り、色は暗色）。`,
    `・構図: 上から ${wari(z.headBandRatio)} は主色の無地の帯（見出しを置く）。下から ${wari(z.footBandRatio)} は紙の色の無地。面の端まで、色で塗りきる（枠、額縁、外側の余白、影、背景の灰色は描かない）。`,
    `・書体: ${kit.typeLook}見出しの文字は紙の色（白）。`,
    `・トーン: ${kit.tone}`,
  ].join('\n')
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

/**
 * 指示文を作る（仕様 4.10。6つのブロックを、この順に）。面も、制作物も、完成予想図以外はこの関数だけを通す。
 */
export function buildDesignPrompt(kit: BoothDesignKit, t: DesignTarget): string {
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
    `この面の型：${LAYOUT_TEXT[t.layout]}`,
    textBlock,
    '【禁止】決まりにない色、写真、3D の描写、イラスト、アイコン、人物、矢印、歯車、端末や画面の絵、実在しないロゴや認証マーク、斜めのアングル、枠・額縁・外側の余白・影・背景の灰色、寸法線と寸法・割合の数字、指定した文字以外の文字、絵文字。',
    t.hasReference ? '【参照】添付の画像は、このブースの見本。見本の、色・帯と円の形と位置・書体の雰囲気・余白を、そのまま使う。見本の中の文字や内容は写さない（この面の文字は、上に書いたものだけ）。' : '',
  ].filter(Boolean).join('\n')
}
