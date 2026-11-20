import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodeBody } from '@/lib/net/safe-fetch'
import {
  extractPageSignals, judgeReadability, buildServiceContext, readSiteForAio, pickSubpageCandidates, unreadableDetail,
  MAX_CONTEXT_CHARS, type PageFetcher,
} from './site-reader'
import { validateProfile, UNKNOWN, type ServiceProfile } from './service-profile'
import { analyzeSite } from './site-analysis'
import { buildSuggestPrompt } from './suggest'
import { allowAioPreview } from './preview-limit'

const fx = (name: string) => readFileSync(join(__dirname, 'fixtures', name))
const studio = fx('studio-switch-corporation.html').toString('utf8')
const URL_SW = 'https://switch-corporation.com/'
const page = (title: string, body = '', head = '') => `<html><head><title>${title}</title>${head}</head><body>${body}</body></html>`
const fakeFetcher = (map: Record<string, string | { status: number } | { type: string }>): PageFetcher => async (url) => {
  const hit = map[url]
  if (typeof hit === 'string') return { html: hit, finalUrl: url }
  if (hit && 'status' in hit) return { html: null, finalUrl: url, failure: { reason: 'http', status: hit.status } }
  if (hit && 'type' in hit) return { html: null, finalUrl: url, failure: { reason: 'content_type' } }
  return { html: null, finalUrl: url, failure: { reason: 'http', status: 404 } }
}

test('Studio（本文が空に近い）：meta から人材紹介・初回面談・面談率が取れ、読めたと判定される', async () => {
  const p = extractPageSignals(studio, URL_SW)
  assert.ok(p.bodyText.length < 30, `本文は空に近い: ${p.bodyText.length}`)
  const read = await readSiteForAio(URL_SW, fakeFetcher({ [URL_SW]: studio }))
  assert.equal(read.readability.sufficient, true)
  assert.ok(read.readability.sources.includes('meta'))
  for (const w of ['人材紹介', '初回面談', '面談率']) assert.ok(read.context.includes(w), `${w} が AI に渡る文章に入る`)
  assert.ok(read.context.length <= MAX_CONTEXT_CHARS)
})

test('本文も meta も無いページは「読み取れませんでした」になり、AI を呼ばない', async () => {
  const empty = page('初回面談くん', '<div id="app"></div>')
  const read = await readSiteForAio(URL_SW, fakeFetcher({ [URL_SW]: empty }))
  assert.equal(read.readability.sufficient, false)
  assert.equal(read.readability.reason, 'too_little')
  let called = false
  const r = await analyzeSite(URL_SW, { fetcher: fakeFetcher({ [URL_SW]: empty }), extract: async () => { called = true; return {} as ServiceProfile } })
  assert.equal(r.usable, false)
  assert.equal(called, false)
  assert.match(unreadableDetail(read), /0文字/)
})

test('ふつうの WordPress：本文が主の情報になる', async () => {
  const html = fx('wordpress-normal.html').toString('utf8')
  const read = await readSiteForAio('https://example.com/', fakeFetcher({ 'https://example.com/': html }))
  assert.equal(read.readability.sufficient, true)
  assert.ok(read.readability.sources.includes('body'))
  assert.equal(read.pages.length, 1) // 本文が足りるので下層は読まない
})

test('Shift_JIS：文字化けせずに読める', () => {
  const html = decodeBody(fx('shift-jis.html'), 'text/html')
  const p = extractPageSignals(html, 'https://example.jp/')
  assert.match(p.description, /切削加工/)
  assert.equal(judgeReadability([p]).sufficient, true)
})

test('取得失敗：403 と PDF は理由つきで「読み取れませんでした」', async () => {
  const r403 = await readSiteForAio('https://a.example/', fakeFetcher({ 'https://a.example/': { status: 403 } }))
  assert.equal(r403.readability.reason, 'fetch_failed')
  assert.match(unreadableDetail(r403), /HTTP 403/)
  const pdf = await readSiteForAio('https://b.example/', fakeFetcher({ 'https://b.example/': { type: 'pdf' } }))
  assert.match(unreadableDetail(pdf), /HTML ではない/)
})

test('リダイレクト：最終の URL を基準に内部リンクを選ぶ', async () => {
  const thin = page('Example', '<a href="/service/">サービス</a><a href="/price/">料金</a><a href="/privacy/">プライバシー</a>')
  const serviceBody = `<h1>サービス</h1><p>${'人事向けの研修を、オンラインで毎月提供します。'.repeat(15)}</p>`
  const fetcher: PageFetcher = async (url) => {
    if (url === 'http://old.example/') return { html: thin, finalUrl: 'https://new.example/' }
    if (url === 'https://new.example/service/') return { html: page('サービス', serviceBody), finalUrl: url }
    return { html: null, finalUrl: url, failure: { reason: 'http', status: 404 } }
  }
  const read = await readSiteForAio('http://old.example/', fetcher)
  assert.equal(read.pages[0].url, 'https://new.example/')
  assert.ok(read.pages.some(p => p.url === 'https://new.example/service/'))
  assert.equal(read.readability.sufficient, true)
  assert.ok(read.readability.sources.includes('subpages'))
  assert.ok(!read.pages.some(p => /privacy/.test(p.url)))
})

test('下層のページの候補：サービス・料金・会社を優先し、問い合わせ完了などは除く', () => {
  const top = extractPageSignals(page('T', '<a href="/contact-thanks">x</a><a href="/company">会社概要</a>'), 'https://x.example/')
  const picks = pickSubpageCandidates(top, ['https://x.example/service', 'https://x.example/blog/1', 'https://other.example/service'])
  assert.deepEqual(picks.sort(), ['https://x.example/company', 'https://x.example/service'].sort())
})

test('巨大なページでも文章量が制限される', () => {
  const huge = page('巨大', `<p>${'あ'.repeat(5_000_000)}</p>`, '<meta name="description" content="大量の文章を持つサイトの説明です。数十万文字の本文があります。">')
  const p = extractPageSignals(huge, 'https://h.example/')
  assert.ok(buildServiceContext([p]).length <= MAX_CONTEXT_CHARS)
})

test('JSON-LD・見出し・画像 alt・ナビを抜き出す', () => {
  const html = page('T', '<nav><a href="/a">導入事例</a></nav><h1>見出しその1です</h1><img alt="スタッフが面談する様子" src="/a.png">',
    '<script type="application/ld+json">{"@type":"Organization","name":"スイッチ","description":"人材紹介の面談設定を代行する会社"}</script>')
  const p = extractPageSignals(html, 'https://j.example/')
  assert.ok(p.jsonLd.some(x => x.includes('人材紹介')))
  assert.ok(p.headings.includes('見出しその1です'))
  assert.ok(p.imageAlts.some(x => x.includes('面談')))
  assert.ok(p.navTexts.includes('導入事例'))
})

test('プロフィール検証：根拠が読み取った文章に無い項目は「不明」になる', () => {
  const context = '説明: 人材紹介会社の応募から初回面談の設定までを専任で引き受け、面談率を上げるサービスです。'
  const p = validateProfile({
    summary: '人材紹介会社の面談設定を代行するサービス', audience: '営業チーム向け', industry: '人材紹介', competitorKind: 'CRM',
    evidence: { summary: '応募から初回面談の設定までを専任で引き受け', audience: '営業チームが使う', industry: '人材紹介会社の応募', competitorKind: '' },
  }, context)
  assert.equal(p.summary, '人材紹介会社の面談設定を代行するサービス')
  assert.equal(p.industry, '人材紹介')
  assert.equal(p.audience, UNKNOWN)
  assert.equal(p.competitorKind, UNKNOWN)
})

test('質問を作るプロンプト：サービス名からの推測を禁じ、読み取った内容を根拠にする', () => {
  const profile = validateProfile({ summary: '人材紹介会社の面談設定を代行するサービス', industry: '人材紹介', evidence: { summary: '初回面談の設定までを専任で引き受け', industry: '人材紹介会社' } },
    '人材紹介会社の応募から初回面談の設定までを専任で引き受け')
  const prompt = buildSuggestPrompt({ brandName: '初回面談くん', url: URL_SW, profile, siteContext: '人材紹介会社の応募から初回面談の設定まで' })
  assert.match(prompt, /推測してはいけない/)
  assert.match(prompt, /何のサービスか: 人材紹介会社の面談設定を代行するサービス/)
  assert.match(prompt, /誰向けか: 不明/)
})

test('確認画面の読み取りは、1人あたり10分に8回まで', () => {
  const t = 1_000_000
  for (let i = 0; i < 8; i++) assert.equal(allowAioPreview('u1', t + i), true)
  assert.equal(allowAioPreview('u1', t + 9), false)
  assert.equal(allowAioPreview('u2', t + 9), true)
  assert.equal(allowAioPreview('u1', t + 11 * 60 * 1000), true)
})
