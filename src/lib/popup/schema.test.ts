// 実行: npm run test:popup
// 保存する値の検査・ドメイン照合・パス照合・提案の組み立て。
// ⚠️ embed.js のパス照合は schema.ts と同じ規則でなければならない（両方を同じ表で確かめる）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import {
  ctr,
  hostMatchesDomain,
  isSiteKey,
  jstDay,
  parseDomain,
  pathMatches,
  publishIssues,
  sanitizeColor,
  sanitizeCreative,
  sanitizeFrequency,
  sanitizeLinkUrl,
  sanitizePath,
  sanitizeTarget,
  sanitizeTargeting,
  sanitizeTrigger,
  targetingMatches,
} from './schema'
import { buildProposals, contrastRatio, pickColors, pickCta, recommendedLinks } from './proposals'
import type { AskLink, SiteProfile } from '../asklink/types'

test('リンク先は http(s) だけ', () => {
  assert.equal(sanitizeLinkUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1')
  assert.equal(sanitizeLinkUrl('http://example.com'), 'http://example.com/')
  assert.equal(sanitizeLinkUrl('javascript:alert(1)'), '')
  assert.equal(sanitizeLinkUrl('JAVASCRIPT:alert(1)'), '')
  assert.equal(sanitizeLinkUrl('data:text/html,<script>alert(1)</script>'), '')
  assert.equal(sanitizeLinkUrl('//evil.example.com'), '')
  assert.equal(sanitizeLinkUrl('https://user:pass@example.com'), '')
  assert.equal(sanitizeLinkUrl(123), '')
  assert.equal(sanitizeLinkUrl('https://example.com/' + 'a'.repeat(5000)), '')
})

test('色は #rgb / #rrggbb だけ（CSS に入るので他は通さない）', () => {
  assert.equal(sanitizeColor('#FF5A36', '#000000'), '#ff5a36')
  assert.equal(sanitizeColor('#abc', '#000000'), '#aabbcc')
  assert.equal(sanitizeColor('red', '#000000'), '#000000')
  assert.equal(sanitizeColor('#fff;background:url(x)', '#000000'), '#000000')
  assert.equal(sanitizeColor('expression(alert(1))', '#123456'), '#123456')
})

test('文言は上限で切り、制御文字を落とす', () => {
  const c = sanitizeCreative({ headline: 'あ'.repeat(100), sub: 'a\u0000b', bubbles: ['x', 'y', 'z', 'w'], layout: 'evil' })
  assert.equal(Array.from(c.headline).length, 30)
  assert.equal(c.sub, 'ab')
  assert.equal(c.bubbles.length, 3)
  assert.equal(c.layout, 'modal')
})

test('リンク一覧は3件まで・URLが不正なものは落とす', () => {
  const c = sanitizeCreative({
    links: [
      { label: 'A', url: 'https://a.example.com' },
      { label: 'B', url: 'javascript:alert(1)' },
      { label: '', url: 'https://c.example.com' },
      { label: 'D', url: 'https://d.example.com' },
      { label: 'E', url: 'https://e.example.com' },
      { label: 'F', url: 'https://f.example.com' },
    ],
  })
  assert.deepEqual(c.links.map((l) => l.label), ['A', 'D', 'E'])
})

test('画像パスは利用者の入力から受けない（アップロードAPIだけが設定する）', () => {
  const c = sanitizeCreative({ imagePath: 'otheruser/otherpopup/0123456789abcdef0123.png', imageWidth: 10 })
  assert.equal(c.imagePath, null)
  assert.equal(c.imageWidth, null)
  const kept = sanitizeCreative({ imagePath: 'x' }, { imagePath: 'u/p/0123456789abcdef0123.png', imageWidth: 600, imageHeight: 400 })
  assert.equal(kept.imagePath, 'u/p/0123456789abcdef0123.png')
  assert.equal(kept.imageWidth, 600)
})

test('部分更新では、送られていない項目は元の値を残す', () => {
  const base = sanitizeCreative({ headline: '見出し', sub: '説明', buttonUrl: 'https://example.com', colors: { accent: '#112233' } })
  const c = sanitizeCreative({ sub: '新しい説明' }, base)
  assert.equal(c.headline, '見出し')
  assert.equal(c.sub, '新しい説明')
  assert.equal(c.buttonUrl, 'https://example.com/')
  assert.equal(c.colors.accent, '#112233')
})

test('表示条件は範囲に収める', () => {
  assert.deepEqual(sanitizeTrigger({ type: 'scroll', scrollPct: 500, delaySec: -3 }), { type: 'scroll', scrollPct: 100, delaySec: 0 })
  assert.equal(sanitizeTrigger({ type: 'hack' }).type, 'delay')
  assert.deepEqual(sanitizeFrequency({ hideDays: 9999, oncePerSession: 'yes' }), { hideDays: 365, oncePerSession: true })
})

test('ページ指定が空なら「すべてのページ」に戻す', () => {
  assert.equal(sanitizeTargeting({ pathMode: 'include', paths: [] }).pathMode, 'all')
  const t = sanitizeTargeting({ pathMode: 'include', paths: ['service', 'https://example.com/blog/a?x=1', '', 'service'] })
  assert.equal(t.pathMode, 'include')
  assert.deepEqual(t.paths, ['/service', '/blog/a?x=1'])
  assert.equal(sanitizePath('  /a b '), '/ab')
})

test('ドメインの照合: 同じホストとサブドメインだけ', () => {
  assert.equal(parseDomain('https://www.Example.co.jp/path'), 'example.co.jp')
  assert.equal(parseDomain('example.com'), 'example.com')
  assert.equal(parseDomain('localhost'), null)
  assert.equal(parseDomain(''), null)
  assert.ok(hostMatchesDomain('example.com', 'example.com'))
  assert.ok(hostMatchesDomain('www.example.com', 'example.com'))
  assert.ok(hostMatchesDomain('shop.example.com', 'example.com'))
  assert.ok(hostMatchesDomain('EXAMPLE.com:443', 'example.com'))
  assert.ok(!hostMatchesDomain('evil-example.com', 'example.com'))
  assert.ok(!hostMatchesDomain('example.com.evil.net', 'example.com'))
  assert.ok(!hostMatchesDomain('co.jp', 'example.co.jp'))
  assert.ok(!hostMatchesDomain('', 'example.com'))
})

const PATH_CASES: [string, string, boolean][] = [
  ['/service', '/service', true],
  ['/service', '/service/a', true],
  ['/service', '/services', true],
  ['/service/', '/service', false],
  ['/blog/*/', '/blog/2026/', true],
  ['/blog/*/', '/blog/', false],
  ['/a.b', '/axb', false],
  ['/a.b', '/a.b/c', true],
  ['/p?x=1', '/p?x=1&y=2', true],
  ['/(x)', '/(x)', true],
  ['/', '/anything', true],
]

test('パス照合（前方一致・* は任意）', () => {
  for (const [pattern, path, expected] of PATH_CASES) assert.equal(pathMatches(pattern, path), expected, `${pattern} vs ${path}`)
  assert.ok(targetingMatches({ device: 'all', pathMode: 'all', paths: [] }, '/x'))
  assert.ok(!targetingMatches({ device: 'all', pathMode: 'include', paths: ['/a'] }, '/b'))
})

test('embed.js のパス照合が schema.ts と同じ結果になる', () => {
  const src = readFileSync(join(process.cwd(), 'public/popup/embed.js'), 'utf8')
  const m = src.match(/function matchPath\(pattern, pathname\) \{[\s\S]*?\n  \}/)
  assert.ok(m, 'embed.js に matchPath が見つからない')
  // リポジトリ内の embed.js の関数だけを、何も持たない別の実行環境で評価する
  const matchPath = runInNewContext(`(${m[0].replace(/^function matchPath/, 'function')})`, {}) as (p: string, s: string) => boolean
  for (const [pattern, path, expected] of PATH_CASES) assert.equal(matchPath(pattern, path), expected, `embed: ${pattern} vs ${path}`)
})

test('embed.js は利用者の文字をHTMLとして解釈させない', () => {
  const src = readFileSync(join(process.cwd(), 'public/popup/embed.js'), 'utf8')
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/.test(code))
})

test('embed.js はサイトの history を書き換えない（ルーターと衝突させない）', () => {
  const src = readFileSync(join(process.cwd(), 'public/popup/embed.js'), 'utf8')
  assert.ok(!/history\.(pushState|replaceState)\s*=/.test(src))
  assert.ok(/function watchUrl\(/.test(src), 'ページ内遷移の再判定が無い')
})

test('計測の target は main と link:0〜2 だけ', () => {
  assert.equal(sanitizeTarget(undefined), 'main')
  assert.equal(sanitizeTarget('link:2'), 'link:2')
  assert.equal(sanitizeTarget('link:3'), null)
  assert.equal(sanitizeTarget('main;drop'), null)
})

test('JST の日付・クリック率・サイトキー', () => {
  assert.equal(jstDay(new Date('2026-10-16T15:30:00Z')).toISOString().slice(0, 10), '2026-10-17')
  assert.equal(jstDay(new Date('2026-10-16T14:59:00Z')).toISOString().slice(0, 10), '2026-10-16')
  assert.equal(ctr(0, 0), null)
  assert.equal(ctr(1, 3), 33.3)
  assert.ok(isSiteKey('AbCdEfGhIjKlMnOpQrStUvWx'))
  assert.ok(!isSiteKey('short'))
  assert.ok(!isSiteKey('abc/def/ghi/jkl/mno/pqr'))
})

// ---------- 提案 ----------

const SITE: SiteProfile = {
  name: 'サンプル株式会社',
  summary: '中小企業向けの経理代行',
  strengths: ['月額制'],
  target: '中小企業',
  contactUrl: 'https://example.com/contact',
  downloadUrl: 'https://example.com/download',
  pricingUrl: null,
  pages: [
    { label: '導入事例', url: 'https://example.com/case' },
    { label: 'サービス', url: 'https://example.com/service' },
  ],
  colors: ['#ffffff', '#f5f5f5', '#0a58ca'],
}

function link(key: AskLink['key'], ok = true): AskLink {
  return {
    key,
    title: key,
    buttonLabel: 'AIに聞く',
    question: '気になっています。https://example.com/case も教えてください。',
    url: 'https://chatgpt.com/?q=x&hints=search',
    check: { ok, issues: ok ? [] : ['x'], chars: 10, urlLength: 40, unknownUrls: [] },
    needsReview: !ok,
  }
}

const COPY = { headline: 'その疑問、AIに聞いてみよう。', sub: 'サービスのことを、会話でチェック。', bubbles: ['何を頼める？', 'どう使う？', '費用は？'] as [string, string, string] }

test('色はボタンの白文字が読めるものだけを選ぶ', () => {
  assert.equal(pickColors(SITE.colors).accent, '#0a58ca')
  assert.equal(pickColors(['#ffffff', '#eeeeee']).accent, '#0066ff')
  assert.ok(contrastRatio('#0066ff', '#ffffff') >= 3)
})

test('3案を作る。リンク先はサイトで見つかったURLだけ', () => {
  const ps = buildProposals(SITE, 'b2b', [link('understand'), link('prepare')], COPY)
  assert.deepEqual(ps.map((p) => p.kind), ['ask', 'cta', 'pages'])
  const allowed = new Set([SITE.contactUrl, SITE.downloadUrl, ...SITE.pages.map((p) => p.url)])
  assert.equal(ps[1].creative.buttonUrl, SITE.contactUrl)
  for (const l of ps[2].creative.links) assert.ok(allowed.has(l.url), l.url)
  assert.equal(ps[0].creative.buttonUrl, 'https://chatgpt.com/?q=x&hints=search')
  assert.equal(ps[0].trigger.type, 'scroll')
  assert.equal(ps[1].trigger.type, 'exit')
  assert.equal(ps[2].creative.layout, 'slide')
  for (const p of ps) assert.deepEqual(publishIssues(p.kind, p.creative), [], p.name)
})

test('行き先が無いサイトでは B・C 案を作らない', () => {
  const bare: SiteProfile = { ...SITE, contactUrl: null, downloadUrl: null, pricingUrl: null, pages: [] }
  assert.equal(pickCta(bare, 'b2b'), null)
  assert.deepEqual(recommendedLinks(bare), [])
  assert.deepEqual(buildProposals(bare, 'b2b', [link('understand')], COPY).map((p) => p.kind), ['ask'])
})

test('要確認の2本目の質問リンクは、おすすめページ案のボタンに使わない', () => {
  const ps = buildProposals(SITE, 'b2c', [link('choose'), link('reassure', false)], COPY)
  const pages = ps.find((p) => p.kind === 'pages')!
  assert.equal(pages.creative.buttonUrl, '')
  assert.deepEqual(publishIssues('pages', pages.creative), [])
})

test('公開に足りないものを示す', () => {
  assert.deepEqual(publishIssues('image', sanitizeCreative({})), ['画像をアップロードしてください', '画像を押したときのリンク先URLを入れてください'])
  assert.ok(publishIssues('cta', sanitizeCreative({ headline: 'x' })).length > 0)
})
