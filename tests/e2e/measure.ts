// ============================================
// ブラウザの中で測る処理（page.evaluate / addInitScript に渡す）
// ============================================
// ⚠️ ここの関数はブラウザに文字列として送られる。外の変数・import を中で使わないこと。
import type { Page } from '@playwright/test'

/** 要素を人が読める短い名前にする（失敗の報告用） */
const DESCRIBE = `function __e2eDescribe(el) {
  if (!el || el.nodeType !== 1) return String(el && el.nodeName || '?')
  let s = el.tagName.toLowerCase()
  if (el.id) s += '#' + el.id
  const cls = (typeof el.className === 'string' ? el.className : '').trim().split(/\\s+/).filter(Boolean).slice(0, 3)
  if (cls.length) s += '.' + cls.join('.')
  const text = (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 30)
  return text ? s + ' 「' + text + '」' : s
}`

// --------------------------------------------
// CLS: 読み込み前から layout-shift を集める
// --------------------------------------------
export const CLS_INIT_SCRIPT = `(() => {
  ${DESCRIBE}
  window.__e2eShifts = []
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue
        window.__e2eShifts.push({
          value: e.value,
          startTime: e.startTime,
          sources: (e.sources || []).map((s) => __e2eDescribe(s.node)).slice(0, 3),
        })
      }
    }).observe({ type: 'layout-shift', buffered: true })
  } catch (_) {}
})()`

export type Shift = { value: number; startTime: number; sources: string[] }

/** web-vitals と同じ「セッションの窓」（間が 1 秒未満・長さ 5 秒まで）の最大値 */
export function clsOf(shifts: Shift[]): { cls: number; worst: Shift[] } {
  let best = 0
  let bestWin: Shift[] = []
  let cur = 0
  let win: Shift[] = []
  for (const s of shifts) {
    const first = win[0]
    const last = win[win.length - 1]
    if (win.length && s.startTime - last.startTime < 1000 && s.startTime - first.startTime < 5000) {
      cur += s.value
      win.push(s)
    } else {
      cur = s.value
      win = [s]
    }
    if (cur > best) {
      best = cur
      bestWin = [...win]
    }
  }
  return { cls: best, worst: bestWin.sort((a, b) => b.value - a.value).slice(0, 3) }
}

export async function readShifts(page: Page): Promise<Shift[]> {
  return page.evaluate(() => ((window as any).__e2eShifts ?? []) as Shift[])
}

// --------------------------------------------
// h1 の数
// --------------------------------------------
export async function h1Info(page: Page) {
  return page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('h1'))
    const visible = all.filter((h) => h.getClientRects().length > 0 && getComputedStyle(h).visibility !== 'hidden')
    return {
      count: all.length,
      visible: visible.length,
      texts: all.map((h) => (h.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)),
    }
  })
}

// --------------------------------------------
// 横のはみ出し
// --------------------------------------------
// 実際に横へスクロールできるか（scrollTo で動くか）で決める。
// はみ出している要素も、いくつか名前を出す（overflow-x:hidden で隠れているものは数えない）。
export async function horizontalOverflow(page: Page) {
  return page.evaluate(`(() => {
    ${DESCRIBE}
    const y = window.scrollY
    const vw = document.documentElement.clientWidth
    window.scrollTo(100000, y)
    const scrollX = window.scrollX
    window.scrollTo(0, y)
    const scrollWidth = document.documentElement.scrollWidth
    const culprits = []
    if (scrollX > 0) {
      for (const el of document.body.querySelectorAll('*')) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        if (r.right > vw + 1 || r.left < -1) {
          // 親もはみ出しているなら、親だけを出す
          const p = el.parentElement && el.parentElement.getBoundingClientRect()
          if (p && (p.right > vw + 1 || p.left < -1)) continue
          culprits.push(__e2eDescribe(el) + ' (left ' + Math.round(r.left) + ', right ' + Math.round(r.right) + ')')
          if (culprits.length >= 5) break
        }
      }
    }
    return { scrollX, scrollWidth, viewport: vw, culprits }
  })()`) as Promise<{ scrollX: number; scrollWidth: number; viewport: number; culprits: string[] }>
}

// --------------------------------------------
// 最初の画面のキービジュアル（120px 以上の画像）
// --------------------------------------------
// img / svg / video / canvas と、背景画像（url(...)）を持つ要素を候補にする。
// 最初の画面（スクロール 0 のビューポート）に一部でも入り、縦横とも 120px 以上、見えている（不透明度 > 0）もの。
// 外部の画像は fixture で止めているので、止めた画像は「読み込めた」とみなす（blockedImages）。
export async function keyVisual(page: Page, blockedImages: string[], min = 120) {
  return page.evaluate(
    `((args) => {
    ${DESCRIBE}
    const { blocked, min } = args
    const vw = window.innerWidth, vh = window.innerHeight
    const visible = (el) => {
      for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
        const cs = getComputedStyle(e)
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false
      }
      return true
    }
    const found = []
    for (const el of document.body.querySelectorAll('*')) {
      const tag = el.tagName.toLowerCase()
      let kind = null
      if (tag === 'img') {
        const ok = (el.complete && el.naturalWidth > 0) || blocked.includes(el.currentSrc || el.src)
        if (!ok) continue
        kind = 'img'
      } else if (tag === 'svg') {
        if (el.parentElement && el.parentElement.closest('svg')) continue
        kind = 'svg'
      } else if (tag === 'video' || tag === 'canvas') {
        kind = tag
      } else {
        const bg = getComputedStyle(el).backgroundImage
        if (!bg || !bg.includes('url(')) continue
        kind = 'background'
      }
      const r = el.getBoundingClientRect()
      if (r.width < min || r.height < min) continue
      if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue
      if (!visible(el)) continue
      found.push(kind + ': ' + __e2eDescribe(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height))
      if (found.length >= 3) break
    }
    return found
  })`,
    { blocked: blockedImages, min },
  ) as Promise<string[]>
}

// --------------------------------------------
// 読み込めない画像
// --------------------------------------------
// ページの下までスクロールして遅延読み込みを起こしてから、<img> の読み込み結果を見る。
// 外部の画像（fixture で止めたもの）は数えない（＝この E2E では確かめられない）。
export async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8))
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
    window.scrollTo(0, document.documentElement.scrollHeight)
    await new Promise((r) => setTimeout(r, 300))
  })
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
  await page.waitForTimeout(500)
}

export async function brokenImages(page: Page, blockedImages: string[]) {
  return page.evaluate((blocked) => {
    const out: string[] = []
    for (const img of Array.from(document.images)) {
      const src = img.currentSrc || img.src
      if (!src || src.startsWith('data:') || blocked.includes(src)) continue
      // まだ読み込み中（遅延読み込みで画面の外に残っているなど）は、壊れているとは言えない
      if (!img.complete) continue
      if (img.naturalWidth === 0) out.push(src)
    }
    return out
  }, blockedImages)
}

// --------------------------------------------
// 1文字だけの行
// --------------------------------------------
// 文字ごとの位置（Range）を「ブロックの単位」（inline でない一番近い祖先）で集め、
// 縦の位置で行に分ける。同じ行の中で <span> などの区切りが分かれていても、縦の位置が同じなら1行と数える。
// 2行以上あるブロックの中に、空白以外が1文字だけの行があれば報告する。
export async function singleCharLines(page: Page) {
  return page.evaluate(`(() => {
    ${DESCRIBE}
    const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE', 'SVG', 'TITLE', 'TEMPLATE'])
    const blockOf = (node) => {
      let el = node.parentElement
      while (el && el !== document.body) {
        const d = getComputedStyle(el).display
        if (d !== 'inline' && d !== 'contents') return el
        el = el.parentElement
      }
      return el
    }
    const groups = new Map()
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const range = document.createRange()
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.nodeValue || ''
      if (!text.trim()) continue
      let skip = false
      for (let p = n.parentElement; p; p = p.parentElement) {
        if (SKIP.has(p.tagName.toUpperCase())) { skip = true; break }
      }
      if (skip) continue
      const block = blockOf(n)
      if (!block) continue
      const cs = getComputedStyle(block)
      if (cs.writingMode && cs.writingMode.startsWith('vertical')) continue
      if (cs.visibility === 'hidden') continue
      let g = groups.get(block)
      if (!g) { g = []; groups.set(block, g) }
      // サロゲートペア（絵文字など）を1文字として扱う
      let i = 0
      for (const ch of text) {
        const len = ch.length
        if (ch.trim()) {
          range.setStart(n, i)
          range.setEnd(n, i + len)
          const r = range.getBoundingClientRect()
          if (r.width > 0 && r.height > 0) g.push({ ch, top: r.top, bottom: r.bottom })
        }
        i += len
      }
    }
    const found = []
    for (const [block, chars] of groups) {
      if (chars.length < 2) continue
      chars.sort((a, b) => a.top - b.top)
      const lines = []
      for (const c of chars) {
        const mid = (c.top + c.bottom) / 2
        const line = lines.find((l) => mid >= l.top && mid <= l.bottom)
        if (line) { line.chars.push(c.ch); line.top = Math.min(line.top, c.top); line.bottom = Math.max(line.bottom, c.bottom) }
        else lines.push({ top: c.top, bottom: c.bottom, chars: [c.ch] })
      }
      if (lines.length < 2) continue
      const lone = lines.filter((l) => l.chars.length === 1)
      if (!lone.length) continue
      found.push({
        element: __e2eDescribe(block),
        lines: lines.length,
        lone: lone.map((l) => l.chars[0]),
        y: Math.round(lone[0].top + window.scrollY),
      })
      if (found.length >= 10) break
    }
    return found
  })()`) as Promise<Array<{ element: string; lines: number; lone: string[]; y: number }>>
}

// --------------------------------------------
// 画面の切り替えの間の背景の色
// --------------------------------------------
// 毎フレーム（requestAnimationFrame）、キャンバスの背景（html の背景。透明なら body の背景）を
// Node 側（exposeBinding）へ送る。full のページ移動でも、新しいページで同じスクリプトが動く。
// paint: そのフレームの時点で最初の描画（first-paint）が済んでいたか。
// ⚠️ ページ移動の直後、最初の描画の前のフレームは画面に出ない（Chrome は前の画面を残す）。
export const BG_INIT_SCRIPT = `(() => {
  // exposeBinding が入る前のフレームはためておき、入ったらまとめて送る
  const pending = []
  const report = (f) => {
    if (typeof window.__e2eBg !== 'function') { pending.push(f); return }
    while (pending.length) window.__e2eBg(pending.shift())
    window.__e2eBg(f)
  }
  const canvasBg = () => {
    const html = document.documentElement
    const hb = html ? getComputedStyle(html).backgroundColor : ''
    if (hb && hb !== 'rgba(0, 0, 0, 0)' && hb !== 'transparent') return hb
    return document.body ? getComputedStyle(document.body).backgroundColor : 'rgba(0, 0, 0, 0)'
  }
  const tick = () => {
    const painted = performance.getEntriesByType('paint').some((e) => e.name === 'first-paint')
    report({ t: Date.now(), path: location.pathname, bg: canvasBg(), painted, hasBody: !!document.body })
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})()`

export type BgFrame = { t: number; path: string; bg: string; painted: boolean; hasBody: boolean }

export function isTransparent(color: string): boolean {
  if (!color || color === 'transparent') return true
  const m = color.match(/rgba?\(([^)]+)\)/)
  if (!m) return false
  const parts = m[1].split(/[,\s/]+/).filter(Boolean)
  return parts.length === 4 && Number(parts[3]) === 0
}
