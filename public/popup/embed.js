/*!
 * ドヤポップアップ 埋め込みスクリプト（仕様: reference/services/popup.md 3-3〜3-5）
 * 使い方: <script async src="https://doya-ai.surisuta.jp/popup/embed.js" data-site="サイトキー"></script>
 *
 * - 依存なし・ビルド工程なし。サイトのCSSと干渉しないよう Shadow DOM の中に描く
 * - 利用者の文字はすべて textContent で入れる（HTML文字列として解釈させない）
 * - リンク先は http(s) だけ（保存時にも検査しているが、ここでも止める）
 * - Cookie は使わない。頻度の記録は localStorage / sessionStorage
 * - 管理画面のプレビューも同じこのファイルで描く（window.__DOYA_POPUP_PREVIEW__）
 */
(function () {
  'use strict'
  if (window.__doyaPopupLoaded) return
  window.__doyaPopupLoaded = true

  var VERSION = '1'
  var DAY_MS = 86400000
  var Z = 2147483000

  var script =
    document.currentScript ||
    (function () {
      var list = document.querySelectorAll('script[src*="/popup/embed.js"]')
      return list[list.length - 1] || null
    })()
  var origin = ''
  try {
    origin = new URL(script && script.src ? script.src : '/', location.href).origin
  } catch (e) {
    return
  }
  var preview = window.__DOYA_POPUP_PREVIEW__ || null
  var siteKey = script && script.getAttribute('data-site')

  // ---------- 小物 ----------

  function safeUrl(u) {
    if (typeof u !== 'string' || !u) return ''
    try {
      var x = new URL(u, location.href)
      return x.protocol === 'https:' || x.protocol === 'http:' ? x.toString() : ''
    } catch (e) {
      return ''
    }
  }

  function isExternal(u) {
    try {
      return new URL(u, location.href).host !== location.host
    } catch (e) {
      return true
    }
  }

  function store(kind) {
    try {
      var s = kind === 'local' ? window.localStorage : window.sessionStorage
      var t = '__doyapop_t'
      s.setItem(t, '1')
      s.removeItem(t)
      return s
    } catch (e) {
      return null
    }
  }
  var local = store('local')
  var session = store('session')

  function isMobile() {
    return window.matchMedia ? window.matchMedia('(max-width: 767px)').matches : window.innerWidth < 768
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  /** schema.ts の pathMatches と同じ規則（前方一致、* は任意の文字列） */
  function matchPath(pattern, pathname) {
    var escaped = String(pattern)
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
    try {
      return new RegExp('^' + escaped).test(pathname)
    } catch (e) {
      return false
    }
  }

  function hexToRgb(hex) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex || '')
    if (!m) return null
    var n = parseInt(m[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }

  function rgba(hex, a, fallback) {
    var c = hexToRgb(hex)
    return c ? 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')' : fallback
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag)
    if (cls) e.className = cls
    if (text) e.textContent = text
    return e
  }

  // ---------- 計測 ----------

  var trackUrl = origin + '/api/popup/public/track'

  function track(popupId, event, target) {
    if (preview || !siteKey) return
    var body = JSON.stringify({ k: siteKey, p: popupId, e: event, t: target || 'main' })
    try {
      // text/plain はプリフライト無しで送れる。応答は読まない
      if (navigator.sendBeacon && navigator.sendBeacon(trackUrl, new Blob([body], { type: 'text/plain' }))) return
    } catch (e) {}
    try {
      fetch(trackUrl, { method: 'POST', body: body, keepalive: true, mode: 'cors', credentials: 'omit', headers: { 'Content-Type': 'text/plain' } })
    } catch (e) {}
  }

  // ---------- 表示してよいか ----------

  function eligible(p) {
    var t = p.targeting || {}
    var mobile = isMobile()
    if (t.device === 'pc' && mobile) return false
    if (t.device === 'sp' && !mobile) return false
    if (t.pathMode === 'include') {
      var paths = t.paths || []
      var ok = false
      for (var i = 0; i < paths.length; i++) if (matchPath(paths[i], location.pathname + location.search)) ok = true
      if (!ok) return false
    }
    var f = p.frequency || {}
    if (f.hideDays > 0 && local) {
      var closedAt = Number(local.getItem('doyapop:closed:' + p.id) || 0)
      if (closedAt && Date.now() - closedAt < f.hideDays * DAY_MS) return false
    }
    if (f.oncePerSession && session && session.getItem('doyapop:shown:' + p.id)) return false
    return true
  }

  // ---------- きっかけ ----------

  function arm(p, show) {
    var t = p.trigger || {}
    var done = false
    var cleanups = []
    function fire() {
      if (done) return
      done = true
      for (var i = 0; i < cleanups.length; i++) cleanups[i]()
      show()
    }
    function after(sec) {
      var id = setTimeout(fire, Math.max(0, sec) * 1000)
      cleanups.push(function () {
        clearTimeout(id)
      })
    }
    if (t.type === 'scroll') {
      var check = function () {
        var doc = document.documentElement
        var max = Math.max(doc.scrollHeight, document.body ? document.body.scrollHeight : 0) - window.innerHeight
        // スクロールできない短いページは、少し待ってから出す
        if (max <= 0) return
        var pct = ((window.scrollY || doc.scrollTop) / max) * 100
        if (pct >= (t.scrollPct || 50)) fire()
      }
      window.addEventListener('scroll', check, { passive: true })
      cleanups.push(function () {
        window.removeEventListener('scroll', check)
      })
      var doc0 = document.documentElement
      if (doc0.scrollHeight <= window.innerHeight + 10) after(5)
      else check()
      return
    }
    if (t.type === 'exit') {
      // スマホにはマウスが無いので、指定秒数に置き換える
      if (isMobile() || !window.matchMedia || window.matchMedia('(hover: none)').matches) {
        after(t.delaySec || 25)
        return
      }
      var onOut = function (e) {
        if (!e.relatedTarget && e.clientY <= 0) fire()
      }
      document.addEventListener('mouseout', onOut)
      cleanups.push(function () {
        document.removeEventListener('mouseout', onOut)
      })
      return
    }
    after(t.delaySec || 0)
  }

  // ---------- 見た目 ----------

  var CSS =
    ':host{all:initial}' +
    '*{box-sizing:border-box;margin:0;padding:0}' +
    '.root{position:fixed;inset:0;z-index:' + Z + ';pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",Meiryo,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.6}' +
    '.overlay{position:absolute;inset:0;background:rgba(15,23,42,.45);pointer-events:auto;opacity:0;transition:opacity .2s}' +
    '.card{position:absolute;pointer-events:auto;background:var(--bg);color:var(--text);border-radius:20px;box-shadow:0 24px 60px rgba(15,23,42,.28),0 2px 8px rgba(15,23,42,.08);padding:28px 24px 22px;opacity:0;transition:opacity .2s,transform .2s;max-height:calc(100vh - 32px);overflow:auto}' +
    '.show .overlay{opacity:1}.show .card{opacity:1;transform:none}' +
    '.modal .card{left:50%;top:50%;width:min(440px,calc(100vw - 32px));transform:translate(-50%,-46%)}' +
    '.show.modal .card{transform:translate(-50%,-50%)}' +
    '.slide .card{right:20px;bottom:20px;width:min(340px,calc(100vw - 24px));transform:translateY(16px);padding:22px 20px 18px}' +
    '.bar .card{left:0;right:0;bottom:0;border-radius:16px 16px 0 0;padding:14px 56px 14px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;transform:translateY(100%)}' +
    '.sheet .card{left:0;right:0;bottom:0;top:auto;width:100%;border-radius:20px 20px 0 0;transform:translateY(100%);padding:24px 20px calc(18px + env(safe-area-inset-bottom))}' +
    '.show.sheet .card,.show.slide .card,.show.bar .card{transform:none}' +
    '.mobile.slide .card{left:12px;right:12px;bottom:12px;width:auto}' +
    '.close{position:absolute;top:10px;right:10px;width:36px;height:36px;border:0;border-radius:999px;background:transparent;color:var(--text);opacity:.55;cursor:pointer;display:grid;place-items:center}' +
    '.close:hover{opacity:1;background:var(--tint)}.close:focus-visible{outline:2px solid var(--accent);outline-offset:2px;opacity:1}' +
    '.close svg{width:18px;height:18px}' +
    '.eyebrow{display:inline-block;font-size:12px;font-weight:700;color:var(--accent);letter-spacing:.04em;margin-bottom:6px;padding-right:28px}' +
    '.headline{font-size:22px;font-weight:800;line-height:1.35;letter-spacing:.01em;padding-right:24px}' +
    '.slide .headline{font-size:18px}.bar .headline{font-size:16px;padding-right:0}' +
    '.sub{margin-top:8px;font-size:14px;opacity:.8}.bar .sub{margin-top:0;font-size:13px}' +
    '.bar .texts{flex:1 1 260px;min-width:0}' +
    '.bubbles{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}' +
    '.bubble{position:relative;font-size:13px;font-weight:700;color:var(--accent);background:var(--tint);border-radius:14px;padding:6px 12px}' +
    '.bubble:after{content:"";position:absolute;left:14px;bottom:-5px;border:6px solid transparent;border-top-color:var(--tint);border-bottom:0}' +
    '.links{list-style:none;margin-top:14px;display:grid;gap:8px}' +
    '.links a{display:flex;align-items:center;justify-content:space-between;gap:8px;text-decoration:none;color:var(--text);font-size:14px;font-weight:700;border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--bg)}' +
    '.links a:hover{border-color:var(--accent);color:var(--accent)}' +
    '.links a:focus-visible,.btn:focus-visible,.imglink:focus-visible{outline:2px solid var(--accent);outline-offset:2px}' +
    '.arrow{flex:none;width:16px;height:16px}' +
    '.btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:18px;padding:13px 18px;border-radius:999px;background:var(--accent);color:#fff;font-size:15px;font-weight:800;text-decoration:none;box-shadow:0 6px 16px var(--shadow);transition:transform .15s,filter .15s}' +
    '.btn:hover{transform:translateY(-1px);filter:brightness(1.05)}' +
    '.bar .btn{width:auto;margin-top:0;flex:none;padding:10px 18px;font-size:14px}' +
    '.note{margin-top:8px;text-align:center;font-size:11px;opacity:.6}.bar .note{display:none}' +
    '.imgcard{padding:0;overflow:hidden;background:transparent;line-height:0}' +
    '.imgcard .close{background:rgba(255,255,255,.9);opacity:.9;color:#1f2430;box-shadow:0 1px 4px rgba(0,0,0,.2)}' +
    '.imglink{display:block}.imglink img{display:block;width:100%;height:auto}' +
    '.modal .imgcard{width:min(var(--imgw,480px),calc(100vw - 32px))}' +
    '.slide .imgcard{width:min(var(--imgw,320px),340px,calc(100vw - 24px))}' +
    '.noanim .overlay,.noanim .card{transition:none}'

  var SVG_NS = 'http://www.w3.org/2000/svg'
  /** 固定の線画アイコン（DOM API で組み立てる。文字列のHTMLは使わない） */
  function icon(d, cls) {
    var svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-width', '2.4')
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')
    svg.setAttribute('aria-hidden', 'true')
    if (cls) svg.setAttribute('class', cls)
    var path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', d)
    svg.appendChild(path)
    return svg
  }
  var CLOSE_D = 'M6 6l12 12M18 6L6 18'
  var ARROW_D = 'M5 12h14M13 6l6 6-6 6'

  var current = null

  function render(p) {
    if (current) return
    var colors = p.colors || {}
    var bg = /^#[0-9a-f]{6}$/i.test(colors.bg || '') ? colors.bg : '#ffffff'
    var accent = /^#[0-9a-f]{6}$/i.test(colors.accent || '') ? colors.accent : '#ff5a36'
    var text = /^#[0-9a-f]{6}$/i.test(colors.text || '') ? colors.text : '#1f2430'
    var mobile = isMobile()
    var layout = p.layout === 'slide' || p.layout === 'bar' ? p.layout : 'modal'
    var isImage = p.kind === 'image' && p.image && safeUrl(p.image.url)

    var host = document.createElement('div')
    host.setAttribute('data-doya-popup', p.id)
    var shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host
    var style = document.createElement('style')
    style.textContent = CSS
    shadow.appendChild(style)

    var root = el('div', 'root ' + (layout === 'modal' && mobile && !isImage ? 'sheet' : layout) + (mobile ? ' mobile' : '') + (reducedMotion() ? ' noanim' : ''))
    root.style.setProperty('--bg', bg)
    root.style.setProperty('--accent', accent)
    root.style.setProperty('--text', text)
    root.style.setProperty('--tint', rgba(accent, 0.1, 'rgba(0,0,0,.05)'))
    root.style.setProperty('--line', rgba(text, 0.12, 'rgba(0,0,0,.12)'))
    root.style.setProperty('--shadow', rgba(accent, 0.3, 'rgba(0,0,0,.15)'))

    var overlay = null
    if (layout === 'modal') {
      overlay = el('div', 'overlay')
      root.appendChild(overlay)
    }

    var card = el('div', 'card' + (isImage ? ' imgcard' : ''))
    var headId = 'doyapop-h-' + p.id
    card.setAttribute('role', 'dialog')
    if (layout === 'modal') card.setAttribute('aria-modal', 'true')
    var labelText = p.headline || (p.image && p.image.alt) || 'お知らせ'
    card.setAttribute('aria-label', labelText)

    var closeBtn = el('button', 'close')
    closeBtn.type = 'button'
    closeBtn.setAttribute('aria-label', '閉じる')
    closeBtn.appendChild(icon(CLOSE_D))

    var prevFocus = document.activeElement
    var closed = false
    function teardown() {
      document.removeEventListener('keydown', onKey, true)
      root.className = root.className.replace(' show', '')
      setTimeout(function () {
        if (host.parentNode) host.parentNode.removeChild(host)
      }, reducedMotion() ? 0 : 220)
      current = null
      if (prevFocus && prevFocus.focus && layout === 'modal') {
        try {
          prevFocus.focus()
        } catch (e) {}
      }
    }
    function remember() {
      if (local && !preview) local.setItem('doyapop:closed:' + p.id, String(Date.now()))
    }
    function close() {
      if (closed) return
      closed = true
      remember()
      track(p.id, 'close', 'main')
      teardown()
    }
    function onKey(e) {
      if (e.key === 'Escape' || e.key === 'Esc') close()
    }
    function linkTo(a, url, target) {
      a.href = url
      // 別サイト（ChatGPT など）は新しいタブ。同じサイト内は同じタブで移動
      if (preview || isExternal(url)) {
        a.target = '_blank'
        a.rel = 'noopener'
      }
      a.addEventListener('click', function () {
        if (closed) return
        closed = true
        remember()
        track(p.id, 'click', target)
        if (a.target === '_blank') teardown()
      })
    }
    closeBtn.addEventListener('click', close)
    if (overlay) overlay.addEventListener('click', close)

    if (isImage) {
      var url = safeUrl(p.buttonUrl)
      var img = document.createElement('img')
      img.src = safeUrl(p.image.url)
      img.alt = p.image.alt || ''
      if (p.image.width && p.image.height) {
        img.width = p.image.width
        img.height = p.image.height
        root.style.setProperty('--imgw', p.image.width + 'px')
      }
      if (url) {
        var a = el('a', 'imglink')
        linkTo(a, url, 'main')
        a.appendChild(img)
        card.appendChild(a)
      } else {
        card.appendChild(img)
      }
      card.appendChild(closeBtn)
    } else {
      var texts = el('div', 'texts')
      if (p.eyebrow && layout !== 'bar') texts.appendChild(el('span', 'eyebrow', p.eyebrow))
      var h = el('h2', 'headline', p.headline || '')
      h.id = headId
      texts.appendChild(h)
      if (p.sub) texts.appendChild(el('p', 'sub', p.sub))
      card.appendChild(texts)

      if (layout !== 'bar' && p.bubbles && p.bubbles.length) {
        var bubbles = el('div', 'bubbles')
        for (var i = 0; i < p.bubbles.length && i < 3; i++) bubbles.appendChild(el('span', 'bubble', p.bubbles[i]))
        card.appendChild(bubbles)
      }
      if (layout !== 'bar' && p.links && p.links.length) {
        var ul = el('ul', 'links')
        for (var j = 0; j < p.links.length && j < 3; j++) {
          var lu = safeUrl(p.links[j].url)
          if (!lu) continue
          var li = el('li')
          var la = el('a')
          la.appendChild(el('span', '', p.links[j].label))
          la.appendChild(icon(ARROW_D, 'arrow'))
          linkTo(la, lu, 'link:' + j)
          li.appendChild(la)
          ul.appendChild(li)
        }
        card.appendChild(ul)
      }
      var bu = safeUrl(p.buttonUrl)
      if (bu && p.buttonLabel) {
        var btn = el('a', 'btn')
        btn.appendChild(el('span', '', p.buttonLabel))
        btn.appendChild(icon(ARROW_D, 'arrow'))
        linkTo(btn, bu, 'main')
        card.appendChild(btn)
        if (p.note) card.appendChild(el('p', 'note', p.note))
      }
      card.appendChild(closeBtn)
    }

    root.appendChild(card)
    shadow.appendChild(root)
    ;(document.body || document.documentElement).appendChild(host)
    current = host
    document.addEventListener('keydown', onKey, true)

    // 表示状態へ移す。⚠️ requestAnimationFrame は背面のタブで止まるので使わない。
    //    一度レイアウトを確定させて（offsetWidth を読む）から次のタスクでクラスを付けると、トランジションも効く
    void card.offsetWidth
    setTimeout(function () {
      root.className += ' show'
      if (layout === 'modal') {
        try {
          closeBtn.focus({ preventScroll: true })
        } catch (e) {}
      }
    }, 20)

    if (session && !preview) session.setItem('doyapop:shown:' + p.id, '1')
    track(p.id, 'impression', 'main')
  }

  // ---------- 起動 ----------

  function start(popups) {
    for (var i = 0; i < popups.length; i++) {
      var p = popups[i]
      if (!p || !p.id || !eligible(p)) continue
      // 1ページに出すのは1つだけ（並び順が先のもの）
      arm(p, (function (x) {
        return function () {
          render(x)
        }
      })(p))
      return
    }
  }

  if (preview) {
    // 管理画面のプレビュー: 条件・頻度を見ずにすぐ出す。計測しない
    var show = function () {
      render(preview.popup)
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show)
    else show()
    window.DoyaPopup = { version: VERSION, preview: true }
    return
  }

  if (!siteKey || !/^[A-Za-z0-9_-]{20,40}$/.test(siteKey) || !window.fetch) return

  var configUrl = origin + '/api/popup/public/config?k=' + encodeURIComponent(siteKey) + '&h=' + encodeURIComponent(location.hostname)
  fetch(configUrl, { credentials: 'omit', mode: 'cors' })
    .then(function (r) {
      return r.ok ? r.json() : null
    })
    .then(function (cfg) {
      if (!cfg || !cfg.popups || !cfg.popups.length) return
      if (cfg.track && safeUrl(cfg.track)) trackUrl = cfg.track
      start(cfg.popups)
    })
    .catch(function () {})

  window.DoyaPopup = { version: VERSION }
})()
