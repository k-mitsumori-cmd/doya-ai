// ============================================
// 年間レポートの共有画像（1200×630 / 1080×1350）
// ============================================
// ⚠️ 画像生成 AI は使わない。satori で文字と図形を SVG にし、resvg-js で PNG にする（費用ゼロ）。
// ⚠️ 入れるのは AnnualReport にあるものだけ。顧客名・金額・社員名は、report.ts が許した項目だけが入っている。
// 台紙は横長が public/annual-report/frame.webp（1200×630）、縦長が frame-tall.webp（1080×1350）。無いときは、無地の枠で出す。
// 台紙の右下にドヤくんがいるので、台紙があるときは、その場所を空けて文字を置く（framedTree）。
// フォントは assets/fonts の Noto Sans JP（shanai のサムネと同じ）。
// ⚠️ resvg-js はネイティブの .node を持ち、webpack で束ねるとビルドが落ちる。next.config.js の serverExternalPackages に
//    入っていないため、実行時に createRequire で読む（webpack は追わない）。読めないとき（同梱されていない等）は sharp で PNG にする。
import fs from 'node:fs'
import path from 'node:path'
import satori from 'satori'
import { createRequire } from 'node:module'
import { IMAGE_SIZES, formatYen, type AnnualReport, type ImageSize } from './report'

export const FRAME_PATH = path.join('public', 'annual-report', 'frame.webp')
export const FRAME_TALL_PATH = path.join('public', 'annual-report', 'frame-tall.webp')

const C = {
  ink: '#0b1b3a',
  sub: '#5b6b86',
  brand: '#0066ff',
  soft: '#dbe7ff',
  line: '#e3eaf6',
  paper: '#ffffff',
  tint: '#f5f8ff',
}

/** 読むファイル。⚠️ 本番では process.cwd() と文字のままのパスで書く（Vercel の同梱（ファイルの追跡）が見つけられるように） */
function files(root?: string) {
  if (root) {
    return {
      regular: path.join(root, 'assets', 'fonts', 'NotoSansJP-Regular.ttf'),
      bold: path.join(root, 'assets', 'fonts', 'NotoSansJP-Bold.ttf'),
      frame: path.join(root, FRAME_PATH),
      frameTall: path.join(root, FRAME_TALL_PATH),
    }
  }
  return {
    regular: path.join(process.cwd(), 'assets/fonts/NotoSansJP-Regular.ttf'),
    bold: path.join(process.cwd(), 'assets/fonts/NotoSansJP-Bold.ttf'),
    frame: path.join(process.cwd(), 'public/annual-report/frame.webp'),
    frameTall: path.join(process.cwd(), 'public/annual-report/frame-tall.webp'),
  }
}

const fontCache = new Map<string, { regular: Buffer; bold: Buffer }>()
function fonts(f: ReturnType<typeof files>) {
  let hit = fontCache.get(f.regular)
  if (!hit) {
    hit = { regular: fs.readFileSync(f.regular), bold: fs.readFileSync(f.bold) }
    fontCache.set(f.regular, hit)
  }
  return hit
}

/** 台紙。あれば PNG の data URI にして返す（satori は webp を読めないため sharp で変える）。無い・読めないときは null */
async function frameDataUri(file: string, width: number, height: number): Promise<string | null> {
  if (!fs.existsSync(file)) return null
  try {
    const sharp = (await import('sharp')).default
    const png = await sharp(file).resize(width, height, { fit: 'cover' }).png().toBuffer()
    return `data:image/png;base64,${png.toString('base64')}`
  } catch {
    return null
  }
}

type Node = { type: string; props: Record<string, unknown> }
function el(type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node {
  return { type, props: { style: { display: 'flex', ...style }, children, ...extra } }
}
const text = (s: string, style: Record<string, unknown>) => el('div', style, s)

function toolRows(r: AnnualReport, max: number, width: number, small = false) {
  const top = r.tools.slice(0, max)
  const peak = Math.max(1, ...top.map((t) => t.count))
  const labelW = small ? 130 : 170
  const barMax = width - labelW - 90
  const fs = small ? 17 : 20
  return el('div', { flexDirection: 'column', gap: small ? 8 : 12 }, [
    text('よく使ったツール', { fontSize: small ? 17 : 20, fontWeight: 700, color: C.sub }),
    ...top.map((t) =>
      el('div', { alignItems: 'center', gap: 12 }, [
        text(t.label, { width: labelW, fontSize: fs, color: C.ink }),
        el('div', { width: Math.max(6, Math.round((t.count / peak) * barMax)), height: 14, borderRadius: 7, backgroundColor: C.brand, opacity: 0.85 }),
        text(`${t.count.toLocaleString('ja-JP')}${t.unit}`, { fontSize: fs, fontWeight: 700, color: C.ink }),
      ])
    ),
  ])
}

function monthChart(r: AnnualReport, width: number, height: number, labels = true, small = false) {
  const peak = Math.max(1, ...r.monthly)
  const gap = small ? 6 : 8
  const barW = Math.floor((width - gap * 11) / 12)
  return el('div', { flexDirection: 'column', gap: 10 }, [
    text(r.busiestMonth ? (small ? `月ごとの件数（最多は ${r.busiestMonth}月）` : `月ごとの件数（いちばん多かったのは ${r.busiestMonth}月）`) : '月ごとの件数', { fontSize: small ? 17 : 20, fontWeight: 700, color: C.sub }),
    el('div', { alignItems: 'flex-end', gap, height }, r.monthly.map((c, i) =>
      el('div', { width: barW, height: Math.max(3, Math.round((c / peak) * height)), borderRadius: 4, backgroundColor: i + 1 === r.busiestMonth ? C.brand : C.soft })
    )),
    labels ? el('div', { gap }, r.monthly.map((_, i) => text(String(i + 1), { width: barW, justifyContent: 'center', fontSize: 14, color: C.sub }))) : null,
  ].filter(Boolean))
}

/** 選んだときだけ出す行（金額・取引先・人） */
function optionalRows(r: AnnualReport, labelW = 130) {
  const rows: Node[] = []
  if (r.amounts) {
    const parts = [r.amounts.quoted > 0 ? `見積 ${formatYen(r.amounts.quoted)}` : '', r.amounts.won > 0 ? `受注 ${formatYen(r.amounts.won)}` : ''].filter(Boolean)
    rows.push(row('金額', parts.map((x, i) => (i < parts.length - 1 ? `${x} /` : x)), labelW, 8))
  }
  if (r.customers) rows.push(row('主な取引先', r.customers.map((x, i, a) => (i < a.length - 1 ? `${x}、` : x)), labelW))
  if (r.members) rows.push(row('よく使った人', r.members.map((x, i, a) => (i < a.length - 1 ? `${x}、` : x)), labelW))
  return rows
}
/** 値は区切りごとの塊で受け取り、塊の途中では折り返さない（名前の最後の1文字だけが次の行に行かないように） */
function row(label: string, value: string[], labelW = 130, gap = 0) {
  return el('div', { gap: 16, alignItems: 'flex-start' }, [
    text(label, { width: labelW, fontSize: 18, color: C.sub, paddingTop: 2 }),
    el('div', { flex: 1, flexWrap: 'wrap', columnGap: gap }, value.map((v) => text(v, { fontSize: 19, fontWeight: 700, color: C.ink, whiteSpace: 'nowrap' }))),
  ])
}

function headline(r: AnnualReport, big: number, compact: boolean) {
  if (r.totalItems === 0) {
    return el('div', { flexDirection: 'column', gap: 10 }, [
      text('この年の記録は、まだありません', { fontSize: Math.round(big * 0.55), fontWeight: 700, color: C.ink }),
      text('ツールで作ると、ここに1年分がまとまります', { fontSize: 22, color: C.sub }),
    ])
  }
  return el('div', { flexDirection: 'column', gap: 6 }, [
    text('この1年で作ったもの', { fontSize: 22, color: C.sub }),
    el('div', { alignItems: 'baseline', gap: 10 }, [
      text(r.totalItems.toLocaleString('ja-JP'), { fontSize: big, fontWeight: 700, color: C.ink, lineHeight: 1.1 }),
      text('件', { fontSize: 30, fontWeight: 700, color: C.ink }),
    ]),
    text('節約できた時間（目安）', { fontSize: 22, color: C.sub, marginTop: compact ? 4 : 14 }),
    el('div', { alignItems: 'baseline', gap: 10 }, [
      text('約', { fontSize: 28, fontWeight: 700, color: C.brand }),
      text(r.hoursSaved.toLocaleString('ja-JP'), { fontSize: Math.round(big * 0.8), fontWeight: 700, color: C.brand, lineHeight: 1.1 }),
      text('時間', { fontSize: 28, fontWeight: 700, color: C.brand }),
    ]),
    r.hoursSaved > 0 ? text(`1日8時間で、約 ${r.workdaysSaved.toLocaleString('ja-JP')} 日分`, { fontSize: 20, color: C.sub }) : null,
  ].filter(Boolean))
}

function header(r: AnnualReport) {
  return el('div', { flexDirection: 'column', gap: 4 }, [
    el('div', { alignItems: 'center', gap: 12 }, [
      el('div', { width: 10, height: 26, borderRadius: 3, backgroundColor: C.brand }),
      text(`ドヤAI 年間レポート ${r.year}`, { fontSize: 24, fontWeight: 700, color: C.ink }),
    ]),
    r.companyName ? text(r.companyName, { fontSize: 22, color: C.sub, marginLeft: 22 }) : null,
  ].filter(Boolean))
}

function footer(stacked = false) {
  // stacked は台紙があるとき。台紙の模様の上でも読めるよう、白い下地を敷く
  const style = stacked
    ? { flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '8px 14px', backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 10, alignSelf: 'flex-start' }
    : { justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${C.line}`, paddingTop: 14 }
  return el('div', style, [
    text('doya-ai.surisuta.jp', { fontSize: 16, fontWeight: 700, color: C.brand }),
    text('時間は、1件あたりの目安の時間で換算しています', { fontSize: 14, color: C.sub }),
  ])
}

/**
 * 台紙があるときの並べ方。台紙の右下のドヤくんに文字が重ならないよう、場所を空ける。
 * - 横長: 右の 350px を空け、左の 786px に2段組みで置く
 * - 縦長: 上の方は横いっぱい。下の方（月ごとの件数から下）は左の 500px だけに置く
 */
function framedTree(r: AnnualReport, size: ImageSize, frame: string): Node {
  const { width, height } = IMAGE_SIZES[size]
  const extras = optionalRows(r, 112)
  const has = r.totalItems > 0
  let content: Node
  if (size === 'wide') {
    const W = width - 64 - 350
    const leftW = 300
    const rightW = W - leftW - 36
    content = el('div', { flexDirection: 'column', width, height, padding: '44px 350px 34px 64px', position: 'relative' }, [
      header(r),
      el('div', { flex: 1, flexDirection: 'column', marginTop: 14, gap: 12, overflow: 'hidden' }, [
        el('div', { flex: 1, gap: 36 }, [
          el('div', { width: has ? leftW : W, flexDirection: 'column' }, [headline(r, extras.length ? 46 : 64, extras.length > 0)]),
          has
            ? el('div', { width: rightW, flexDirection: 'column', gap: extras.length ? 10 : 20 }, [
                toolRows(r, extras.length ? 3 : 4, rightW, true),
                monthChart(r, rightW, extras.length ? 28 : 56, extras.length === 0, true),
              ])
            : null,
        ].filter(Boolean)),
        extras.length ? el('div', { flexDirection: 'column', gap: 4, padding: '10px 16px', backgroundColor: 'rgba(245,248,255,0.92)', borderRadius: 12 }, extras.map((x) => x)) : null,
      ].filter(Boolean)),
      footer(true),
    ])
  } else {
    const pad = 72
    const inner = width - pad * 2
    const lowerW = 500
    content = el('div', { flexDirection: 'column', width, height, padding: pad, position: 'relative' }, [
      header(r),
      el('div', { flex: 1, flexDirection: 'column', gap: 28, marginTop: 28, overflow: 'hidden' }, [
        headline(r, 84, false),
        ...(has ? [toolRows(r, 6, inner)] : []),
        el('div', { width: lowerW, flexDirection: 'column', gap: 24 }, [
          has ? monthChart(r, lowerW, extras.length ? 70 : 110, true, true) : null,
          extras.length ? el('div', { flexDirection: 'column', gap: 8, padding: '16px 20px', backgroundColor: 'rgba(245,248,255,0.92)', borderRadius: 16 }, extras) : null,
        ].filter(Boolean)),
      ]),
      footer(true),
    ])
  }
  return el('div', { width, height, position: 'relative', backgroundColor: C.paper, fontFamily: 'Noto Sans JP' }, [
    el('img', { position: 'absolute', left: 0, top: 0, width, height }, undefined, { src: frame, width, height }),
    content,
  ])
}

export function buildTree(r: AnnualReport, size: ImageSize, frame: string | null): Node {
  if (frame) return framedTree(r, size, frame)
  const { width, height } = IMAGE_SIZES[size]
  const pad = frame ? 72 : 56
  const inner = width - pad * 2
  const extras = optionalRows(r)
  const body =
    size === 'wide'
      ? el('div', { flex: 1, flexDirection: 'column', marginTop: 18, overflow: 'hidden' }, [
          el('div', { flex: 1, gap: 48 }, [
            el('div', { width: 450, flexDirection: 'column' }, [headline(r, extras.length ? 56 : 72, extras.length > 0)]),
            r.totalItems > 0
              ? el('div', { flex: 1, flexDirection: 'column', gap: extras.length ? 16 : 26 }, [
                  toolRows(r, extras.length ? 3 : 4, inner - 450 - 48),
                  monthChart(r, inner - 450 - 48, extras.length ? 36 : 70, extras.length === 0),
                ])
              : null,
          ].filter(Boolean)),
          extras.length ? el('div', { flexDirection: 'column', gap: 6, padding: '12px 20px', marginBottom: 14, backgroundColor: C.tint, borderRadius: 12 }, extras) : null,
        ].filter(Boolean))
      : el('div', { flex: 1, flexDirection: 'column', gap: 32, marginTop: 36, overflow: 'hidden' }, [
          headline(r, 96, false),
          ...(r.totalItems > 0 ? [toolRows(r, 6, inner), monthChart(r, inner, extras.length ? 100 : 130)] : []),
          extras.length ? el('div', { flexDirection: 'column', gap: 12, padding: '20px 26px', backgroundColor: C.tint, borderRadius: 16 }, extras) : null,
        ].filter(Boolean))

  const content = el('div', { flexDirection: 'column', width, height, padding: pad, position: 'relative' }, [header(r), body, footer()])
  return el('div', { width, height, position: 'relative', backgroundColor: C.paper, fontFamily: 'Noto Sans JP' }, [
    frame
      ? el('img', { position: 'absolute', left: 0, top: 0, width, height }, undefined, { src: frame, width, height })
      : el('div', { position: 'absolute', left: 20, top: 20, width: width - 40, height: height - 40, border: `2px solid ${C.soft}`, borderRadius: 28 }),
    content,
  ])
}

/** root は確認用（省略すると process.cwd()） */
export async function renderAnnualImage(r: AnnualReport, size: ImageSize, root?: string): Promise<Buffer> {
  const { width, height } = IMAGE_SIZES[size]
  const paths = files(root)
  const frame = await frameDataUri(size === 'tall' ? paths.frameTall : paths.frame, width, height)
  const f = fonts(paths)
  const svg = await satori(buildTree(r, size, frame) as any, {
    width,
    height,
    fonts: [
      { name: 'Noto Sans JP', data: f.regular, weight: 400, style: 'normal' },
      { name: 'Noto Sans JP', data: f.bold, weight: 700, style: 'normal' },
    ],
  })
  return svgToPng(svg, width, root ?? process.cwd())
}

async function svgToPng(svg: string, width: number, root: string): Promise<Buffer> {
  try {
    const load = createRequire(path.join(root, 'package.json'))
    const { Resvg } = load('@resvg/resvg-js') as typeof import('@resvg/resvg-js')
    return Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng())
  } catch {
    const sharp = (await import('sharp')).default
    return sharp(Buffer.from(svg)).png().toBuffer()
  }
}
