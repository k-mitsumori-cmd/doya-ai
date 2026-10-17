// ============================================
// ドヤポップアップ: 画面の見本データ（開発時の目視確認だけで使う。/popup/dev/states）
// ============================================
// ⚠️ 実在の会社・数字ではない。本番の画面からは読まない。
// ⚠️ 色の値（ポップアップの色＝利用者のデータ）があるので src/app/popup ではなくここに置く（D-2）。
import type { PopupDto, SiteDto } from './dto'
import type { EditSiteInfo, SiteDetail } from './popup-read'
import { sanitizeCreative, sanitizeFrequency, sanitizeTargeting, sanitizeTrigger } from './schema'

export const SITE: SiteDto = {
  id: 'devsiteaaaaaaaaaaaaaaaaaa',
  name: 'サンプル株式会社',
  sourceUrl: 'https://example.com/',
  domain: 'example.com',
  siteKey: 'DevSiteKey_abcdefghijklm',
  embedCode: '<script async src="https://doya-ai.surisuta.jp/popup/embed.js" data-site="DevSiteKey_abcdefghijklm"></script>',
  audience: 'b2b',
  site: { name: 'サンプル株式会社', summary: '中小企業向けのマーケティング支援', strengths: [], target: '中小企業', contactUrl: 'https://example.com/contact', downloadUrl: 'https://example.com/download', pricingUrl: null, pages: [{ label: '導入事例', url: 'https://example.com/case' }], colors: ['#1c00f1'] },
  lastSeenAt: '2026-10-18T03:00:00.000Z',
  createdAt: '2026-10-17T03:00:00.000Z',
  liveCount: 1,
  totals: { impressions: 1240, clicks: 93, closes: 310, ctr: 7.5 },
}

function popup(id: string, kind: PopupDto['kind'], status: PopupDto['status'], c: Record<string, unknown>, extra: Partial<PopupDto> = {}): PopupDto {
  const creative = sanitizeCreative({ colors: { bg: '#ffffff', accent: '#1c00f1', text: '#1f2430' }, eyebrow: 'サンプル株式会社', ...c })
  return {
    id,
    siteId: SITE.id,
    name: { ask: 'A. AIに聞く', cta: 'B. 相談・申し込み', pages: 'C. おすすめページ', image: '画像のポップアップ' }[kind],
    kind,
    status,
    sortOrder: 0,
    creative,
    imageUrl: null,
    trigger: sanitizeTrigger({ type: kind === 'ask' ? 'scroll' : kind === 'cta' ? 'exit' : 'delay', scrollPct: 50, delaySec: 15 }),
    targeting: sanitizeTargeting({}),
    frequency: sanitizeFrequency({}),
    reason: 'ページを半分まで読んだ訪問者に出します。サイトのことを、その場でChatGPTに相談できるボタンです。',
    issues: [],
    totals: { impressions: 1240, clicks: 93, closes: 310, ctr: 7.5 },
    updatedAt: '2026-10-18T03:00:00.000Z',
    ...extra,
  }
}

export const POPUPS: PopupDto[] = [
  popup('devpopupaskaaaaaaaaaaaaaa', 'ask', 'live', {
    headline: 'サンプルで何ができる？',
    sub: 'マーケティングの悩みをAIに相談',
    bubbles: ['施策の選び方は？', 'AI活用例は？', '事例を知りたい？'],
    buttonLabel: 'AIに使い方を聞く',
    buttonUrl: 'https://chatgpt.com/?q=test&hints=search',
    note: 'ChatGPTが開きます',
    question: '気になっています。',
  }),
  popup('devpopupctaaaaaaaaaaaaaaa', 'cta', 'draft', { headline: 'ご相談・お問い合わせはこちら', sub: 'お気軽にご相談ください。', buttonLabel: '相談してみる', buttonUrl: 'https://example.com/contact' }, { totals: { impressions: 0, clicks: 0, closes: 0, ctr: null }, reason: null }),
  popup('devpopupimgaaaaaaaaaaaaaa', 'image', 'draft', {}, { issues: ['画像をアップロードしてください', '画像を押したときのリンク先URLを入れてください'], totals: { impressions: 0, clicks: 0, closes: 0, ctr: null }, reason: null }),
]

export const DETAIL: SiteDetail = { days: 30, site: SITE, popups: POPUPS }

export const EDIT_SITE: EditSiteInfo = {
  id: SITE.id,
  name: SITE.name,
  domain: SITE.domain,
  sourceUrl: SITE.sourceUrl,
  embedCode: SITE.embedCode,
  lastSeenAt: SITE.lastSeenAt,
  colors: ['#1c00f1', '#ff4c00'],
  pages: [
    { label: 'お問い合わせ・相談', url: 'https://example.com/contact' },
    { label: '導入事例', url: 'https://example.com/case' },
  ],
  allowedUrls: ['https://example.com/'],
}

export const SITES: SiteDto[] = [
  SITE,
  { ...SITE, id: 'devsite2aaaaaaaaaaaaaaaaa', name: 'ブログ', domain: 'blog.example.com', lastSeenAt: null, liveCount: 0, totals: { impressions: 0, clicks: 0, closes: 0, ctr: null } },
]
