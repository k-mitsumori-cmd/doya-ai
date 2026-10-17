// ============================================
// ドヤポップアップ: embed.js の動作確認用の模擬サーバ
// ============================================
// 使い方: node scripts/popup-embed-harness.cjs  → http://localhost:4817/
// - 実物の public/popup/embed.js を読ませ、設定API・計測APIだけを真似る（DB・課金APIは使わない）
// - /_mode?m=<案> で出す案を切り替える（計測の記録も消える）。/_log で送られた計測を見る
// - /spa はページを読み直さずに URL を変えるボタンを持つ（Studio・Wix・Next.js などの再現）
const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = Number(process.env.PORT || 4817)
const EMBED = path.join(__dirname, '..', 'public', 'popup', 'embed.js')
const KEY = 'TestSiteKey_abcdefghijkl'
const log = []
let mode = 'ask'

const C = { bg: '#ffffff', accent: '#0a58ca', text: '#1f2430' }
const base = {
  bubbles: [], note: '', links: [], image: null, colors: C,
  targeting: { device: 'all', pathMode: 'all', paths: [] },
  frequency: { hideDays: 7, oncePerSession: true },
}
const POPUPS = {
  ask: { ...base, id: 'popupaskaaaaaaaaaaaaaaaa', kind: 'ask', layout: 'modal', eyebrow: 'サンプル株式会社', headline: 'その疑問、AIに聞いてみよう。', sub: 'サービスのことを、会話でチェック。', bubbles: ['何を頼める？', 'どう使う？', '費用は？'], buttonLabel: 'AIに聞いてみる', buttonUrl: 'https://chatgpt.com/?q=%E3%83%86%E3%82%B9%E3%83%88&hints=search', note: 'ChatGPTが開きます', trigger: { type: 'scroll', scrollPct: 50, delaySec: 0 } },
  pages: { ...base, id: 'popuppagesaaaaaaaaaaaaaa', kind: 'pages', layout: 'slide', eyebrow: 'サンプル株式会社', headline: 'こちらのページもおすすめです', sub: '2ページ', links: [{ label: '導入事例', url: '/case' }, { label: '料金', url: '/pricing' }, { label: 'bad', url: 'javascript:alert(1)' }], buttonLabel: '', buttonUrl: '', trigger: { type: 'delay', delaySec: 1, scrollPct: 50 } },
  bar: { ...base, id: 'popupbaraaaaaaaaaaaaaaaa', kind: 'cta', layout: 'bar', eyebrow: '', headline: 'ご相談はこちら<img src=x onerror=alert(1)>', sub: 'お気軽にどうぞ', buttonLabel: '相談してみる', buttonUrl: '/contact', trigger: { type: 'delay', delaySec: 0, scrollPct: 50 } },
  spa: { ...base, id: 'popupspaaaaaaaaaaaaaaaaa', kind: 'cta', layout: 'modal', eyebrow: '', headline: '/target だけに出る案', sub: '', buttonLabel: '見る', buttonUrl: '/x', targeting: { device: 'all', pathMode: 'include', paths: ['/target'] }, frequency: { hideDays: 0, oncePerSession: false }, trigger: { type: 'delay', delaySec: 2, scrollPct: 50 } },
}

function page(pathname) {
  const filler = Array.from({ length: 60 }, (_, i) => `<p>本文の段落 ${i + 1}。サイトの内容がここに入ります。</p>`).join('')
  const spa = `<nav style="margin:24px;display:flex;gap:8px">
<button id="go-target" onclick="history.pushState({},'','/target')">/target へ（読み直さない）</button>
<button id="go-other" onclick="history.pushState({},'','/other')">/other へ（読み直さない）</button></nav>`
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>テスト</title>
<style>p{font:16px sans-serif;margin:24px}</style>
<script async src="/popup/embed.js" data-site="${KEY}"></script></head><body><h1 style="margin:24px">サイト（${pathname}）</h1>${spa}${filler}</body></html>`
}

http
  .createServer((req, res) => {
    const u = new URL(req.url, 'http://localhost')
    if (u.pathname === '/popup/embed.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' })
      return res.end(fs.readFileSync(EMBED))
    }
    if (u.pathname === '/api/popup/public/config') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      const popups = u.searchParams.get('k') === KEY ? [POPUPS[mode]] : []
      return res.end(JSON.stringify({ v: 1, track: `http://localhost:${PORT}/api/popup/public/track`, popups }))
    }
    if (u.pathname === '/api/popup/public/track') {
      let b = ''
      req.on('data', (d) => (b += d))
      return req.on('end', () => {
        try {
          log.push(JSON.parse(b))
        } catch {}
        res.writeHead(204)
        res.end()
      })
    }
    if (u.pathname === '/_log') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify(log))
    }
    if (u.pathname === '/_mode') {
      mode = POPUPS[u.searchParams.get('m')] ? u.searchParams.get('m') : 'ask'
      log.length = 0
      res.writeHead(200)
      return res.end(mode)
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(page(u.pathname))
  })
  .listen(PORT, () => console.log(`popup embed harness: http://localhost:${PORT}/`))
