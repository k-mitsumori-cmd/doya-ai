// ============================================
// 会話の動き（見本 src2.html の fly / cursorTo / focusField / typeInto / celebrate を、実物の画面へ移したもの）
// ============================================
// 決まり:
//   - 動きは実際の処理に合わせて呼ぶ（呼ぶ側 AgentChatProvider が、setValue と成功の知らせの順に進める）。ここは見せるだけで、値は変えない。
//   - 飛ぶ値とカーソルは、見えている領域だけで動かす（会話の欄と、欄の両方が画面に見えているとき）。
//   - prefers-reduced-motion では、飛ぶ値・カーソル・札・お祝い・1字ずつの入力を出さない（間合いも短くする）。
//   - 位置と透明度だけを動かす。1つ 0.2〜0.5 秒。
export const EASE = 'cubic-bezier(.22,1,.36,1)'
const BLUE = '#0066ff'

export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}
/** 1つの作業の間合い。動きを減らす設定のときは、画面の描き直しを待つだけの短さ */
export function paceMs(): number { return reducedMotion() ? 60 : 320 }
export const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, reducedMotion() ? Math.min(ms, 60) : ms))
/** 画面が描き直されるのを待つ（値を入れたあとに、画面の今の値を読むため） */
export function nextFrames(n = 2): Promise<void> {
  return new Promise((resolve) => {
    const step = (i: number) => (i <= 0 ? resolve() : window.requestAnimationFrame(() => step(i - 1)))
    step(n)
  })
}

const isMobile = () => window.matchMedia?.('(max-width: 767px)').matches ?? false
const dockEl = () => document.getElementById('agent-dock-panel')
const fieldEl = (key: string) => document.querySelector<HTMLElement>(`[data-agent-field="${CSS.escape(key)}"]`)
const sourceEl = () => {
  const all = document.querySelectorAll<HTMLElement>('[data-agent-source]')
  return all.length ? all[all.length - 1] : null
}

/** 画面の見える領域（会話の欄に隠れる分を除く）の下端 */
function visibleBottom(): number {
  const d = dockEl()
  if (d && isMobile() && d.getAttribute('data-open') === 'true') {
    const r = d.getBoundingClientRect()
    if (r.height > 0) return Math.min(window.innerHeight, r.top)
  }
  return window.innerHeight
}
/** その要素が、いま見えているか（画面の中にあり、会話の欄に隠れていない） */
export function isSeen(el: Element | null): boolean {
  if (!el) return false
  const r = el.getBoundingClientRect()
  if (r.width < 4 || r.height < 4) return false
  if (r.bottom <= 0 || r.top >= visibleBottom() || r.right <= 0 || r.left >= window.innerWidth) return false
  const d = dockEl()
  if (d && d.getAttribute('data-open') === 'true' && !isMobile()) {
    const dr = d.getBoundingClientRect()
    if (r.left >= dr.left) return false
  }
  return true
}
function dockSeen(): boolean {
  const d = dockEl()
  if (!d || d.getAttribute('data-open') !== 'true') return false
  const r = d.getBoundingClientRect()
  return r.width > 40 && r.height > 40
}

/** 会話の値が、画面の欄へ飛ぶ。どちらかが見えていないときは何もしない */
export async function fly(text: string, key: string): Promise<void> {
  const from = sourceEl()
  const to = fieldEl(key)
  if (reducedMotion() || !dockSeen() || !isSeen(to)) return
  // 飛び出す元は、会話の中の依頼の吹き出し。会話を下まで読み進めて吹き出しが見えていないときは、会話の欄の上端から出す
  const body = document.querySelector('#agent-dock-panel [data-agent-body]')
  const br = body?.getBoundingClientRect()
  let a: DOMRect | null = from ? from.getBoundingClientRect() : null
  if (br && (!a || a.bottom < br.top + 8 || a.top > br.bottom - 8)) a = new DOMRect(br.left + br.width / 2 - 40, br.top + 12, 80, 24)
  if (!a) return
  const b = to!.getBoundingClientRect()
  const f = document.createElement('div')
  f.textContent = text
  Object.assign(f.style, {
    position: 'fixed', zIndex: '2147483000', left: '0', top: '0', padding: '6px 14px', borderRadius: '999px', background: BLUE, color: '#fff',
    fontWeight: '800', fontSize: '15px', boxShadow: '0 12px 30px rgba(10,15,60,.28)', whiteSpace: 'nowrap', pointerEvents: 'none', fontVariantNumeric: 'tabular-nums',
  })
  f.setAttribute('aria-hidden', 'true')
  document.body.appendChild(f)
  const fw = f.offsetWidth, fh = f.offsetHeight
  const sx = a.left + a.width / 2 - fw / 2, sy = a.top + a.height / 2 - fh / 2
  const ex = b.left + Math.min(b.width - fw / 2, 60), ey = b.top + b.height / 2 - fh / 2
  try {
    await f.animate([
      { transform: `translate(${sx}px,${sy}px) scale(.8)`, opacity: 0 },
      { transform: `translate(${sx}px,${sy}px) scale(1)`, opacity: 1, offset: 0.12 },
      { transform: `translate(${ex}px,${ey}px) scale(1)`, opacity: 1, offset: 0.88 },
      { transform: `translate(${ex}px,${ey}px) scale(.8)`, opacity: 0 },
    ], { duration: 440, easing: EASE, fill: 'both' }).finished
  } finally { f.remove() }
}

// ---- カーソルと「ドヤAI」の札 ----
let cursor: SVGSVGElement | null = null
let tag: HTMLElement | null = null
function ensureCursor(): SVGSVGElement {
  if (cursor && document.body.contains(cursor)) return cursor
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true')
  svg.innerHTML = `<path d="M4 2l15 11.5-6.6 1 3.7 7-3 1.5-3.6-7.1L5 20z" fill="${BLUE}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`
  Object.assign(svg.style, { position: 'fixed', zIndex: '2147483001', left: '0', top: '0', width: '22px', height: '22px', pointerEvents: 'none', opacity: '0', transition: `transform .3s ${EASE}, opacity .2s`, filter: 'drop-shadow(0 2px 4px rgba(10,15,60,.35))' })
  document.body.appendChild(svg)
  cursor = svg
  return svg
}
export function cursorTo(el: Element | null): void {
  if (reducedMotion() || !dockSeen() || !isSeen(el)) { cursorOff(); return }
  const r = el!.getBoundingClientRect()
  const c = ensureCursor()
  c.style.opacity = '1'
  c.style.transform = `translate(${r.left + Math.min(r.width - 24, 34)}px,${r.top + r.height * 0.55}px)`
}
export function cursorOff(): void { if (cursor) cursor.style.opacity = '0' }
function showTag(el: HTMLElement): void {
  hideTag()
  if (reducedMotion()) return
  const r = el.getBoundingClientRect()
  const t = document.createElement('div')
  t.textContent = 'ドヤAI'
  t.setAttribute('aria-hidden', 'true')
  Object.assign(t.style, {
    position: 'fixed', zIndex: '2147483000', left: `${Math.max(8, r.left)}px`, top: `${Math.max(4, r.top - 24)}px`, padding: '0 8px', lineHeight: '18px', borderRadius: '999px',
    background: '#e8f0ff', color: '#0047d6', fontWeight: '800', fontSize: '11px', pointerEvents: 'none', opacity: '0', transform: 'translateX(-4px)', transition: `opacity .2s, transform .3s ${EASE}`,
  })
  document.body.appendChild(t)
  window.requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'none' })
  tag = t
}
function hideTag(): void { tag?.remove(); tag = null }

/** 欄へスクロールして光らせ、「ドヤAI」の札とカーソルを出す。要素が無ければ false */
export async function focusField(key: string): Promise<boolean> {
  const el = fieldEl(key)
  if (!el) return false
  const r = el.getBoundingClientRect()
  const mid = (80 + visibleBottom()) / 2
  const delta = r.top + r.height / 2 - mid
  // すぐに動かす（なめらかなスクロールは、止まるまで欄が見えず、飛ぶ値とカーソルが出せない。見せる動きは、値が欄へ飛ぶほうで行う）
  if (Math.abs(delta) > 8) window.scrollBy({ top: delta, behavior: 'instant' as ScrollBehavior })
  el.setAttribute('data-agent-active', '')
  await sleep(120)
  showTag(el)
  cursorTo(el)
  return true
}
export function blurField(key: string): void {
  fieldEl(key)?.removeAttribute('data-agent-active')
  hideTag()
}
export function clearStage(): void {
  document.querySelectorAll('[data-agent-active]').forEach((e) => e.removeAttribute('data-agent-active'))
  hideTag(); cursorOff()
}

/** 値を1字ずつ入れる。入れるたびに onValue（画面の setValue）を呼ぶ。動きを減らす設定のときは1回で入れる。途中で止めたいときは alive が false を返す */
export async function typeInto(text: string, onValue: (partial: string) => void, alive: () => boolean): Promise<void> {
  if (reducedMotion() || text.length <= 1) { onValue(text); return }
  const per = Math.max(22, Math.min(46, 460 / text.length))
  for (let i = 1; i <= text.length; i++) {
    if (!alive()) return
    onValue(text.slice(0, i))
    await new Promise<void>((r) => window.setTimeout(r, per))
  }
}

/** 完了の短いお祝い（色の粒が広がる）。動きを減らす設定のときは出さない */
export function celebrate(el: Element | null): void {
  if (reducedMotion() || !el) return
  const r = el.getBoundingClientRect()
  if (r.width < 4) return
  const cols = ['#0066ff', '#ff1e72', '#ffd400', '#00e0ff', '#12b76a']
  for (let i = 0; i < 16; i++) {
    const b = document.createElement('i')
    Object.assign(b.style, { position: 'fixed', zIndex: '2147483000', left: '0', top: '0', width: '8px', height: '8px', borderRadius: '2px', pointerEvents: 'none', background: cols[i % cols.length] })
    document.body.appendChild(b)
    const a = (i / 16) * Math.PI * 2, d = 46 + (i % 3) * 22
    const sx = r.left + r.width / 2, sy = r.top + r.height / 2
    void b.animate([
      { transform: `translate(${sx}px,${sy}px) scale(1)`, opacity: 1 },
      { transform: `translate(${sx + Math.cos(a) * d * 1.6}px,${sy + Math.sin(a) * d}px) scale(.6) rotate(140deg)`, opacity: 0 },
    ], { duration: 480, easing: EASE, fill: 'both' }).finished.then(() => b.remove(), () => b.remove())
  }
}
