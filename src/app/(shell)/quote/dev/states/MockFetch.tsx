'use client'
// ============================================
// ドヤ見積もりAI: 画面の状態の見本で使う、偽の API 応答（開発時だけ）
// ============================================
// window.fetch を差し替え、/api/quote/* と /api/auth/session に見本データ（または失敗の状態コード）を返す。
// ⚠️ 子が描かれる前に差し替える（useState の初期化で同期的に入れる）。DB・ログイン・AI には一切触れない。
// ⚠️ 見本データはすべて架空（見本 株式会社・見本 花子）。
import { useState, type ReactNode } from 'react'

const ORG = { slug: 'mihon', name: '見本 株式会社', role: 'owner' }
export const PREVIEW_USER_ID = 'preview-user'
export const PREVIEW_SESSION = {
  user: { id: PREVIEW_USER_ID, name: '見本 太郎', email: 'mihon@example.com', role: 'USER', plan: 'FREE' },
  expires: '2099-01-01T00:00:00.000Z',
}

const PRODUCTS = [
  { id: 'prod1', name: '見本 SEOコンサルティング', sourceUrl: 'https://example.com/seo', profile: { companyName: '見本 株式会社', summary: '検索流入を伸ばすための伴走支援。' } },
  { id: 'prod2', name: '見本 広告運用代行', sourceUrl: 'https://example.com/ads', profile: { companyName: '見本 株式会社' } },
]

const DOCUMENTS = [
  { id: 'sample1', quoteNo: 'Q-2026-0012', title: '見本 SEOコンサルティング お見積り', clientCompany: '見本 商事 株式会社（とても長い会社名の例：東日本営業本部 第二営業部）', status: 'draft', issueDate: '2026-10-18T00:00:00.000Z', expiryDate: '2026-11-17T00:00:00.000Z', totalInclTax: 1650000, createdAt: '2026-10-18T00:00:00.000Z' },
  { id: 'sample2', quoteNo: 'Q-2026-0011', title: '見本 広告運用代行 お見積り', clientCompany: '見本 工業', status: 'confirmed', issueDate: '2026-10-10T00:00:00.000Z', expiryDate: '2026-11-09T00:00:00.000Z', totalInclTax: 330000, createdAt: '2026-10-10T00:00:00.000Z' },
  { id: 'sample3', quoteNo: 'Q-2026-0010', title: 'お見積り', clientCompany: null, status: 'sent', issueDate: '2026-10-01T00:00:00.000Z', expiryDate: '2026-10-31T00:00:00.000Z', totalInclTax: 88000, createdAt: '2026-10-01T00:00:00.000Z' },
]

const ISSUER = { companyName: '見本 株式会社', postalCode: '100-0000', address: '東京都千代田区見本町1-2-3', tel: '03-0000-0000', personName: '見本 花子', invoiceNo: 'T0000000000000', deliveryTerms: 'ご発注後、約2週間', paymentTerms: '月末締め翌月末払い', notes: '' }

const DETAIL = {
  id: 'sample1', revision: 'a'.repeat(64), quoteNo: 'Q-2026-0012', title: '見本 SEOコンサルティング お見積り', status: 'draft',
  clientCompany: '見本 商事 株式会社', clientDept: null, clientPerson: '見本 花子',
  issueDate: '2026-10-18T00:00:00.000Z', expiryDate: '2026-11-17T00:00:00.000Z',
  paymentTerms: '月末締め翌月末払い（銀行振込）', deliveryTerms: 'ご発注後、約2週間', notes: '',
  discountType: null, discountValue: 0, totalExclTax: 1500000, taxAmount: 150000, totalInclTax: 1650000,
  lineItems: [
    { id: 'line1', itemName: 'サイト診断・キーワード設計', spec: '現状分析、競合調査、狙うキーワードの一覧', qty: 1, unit: '式', unitPrice: 500000, taxRate: 10, priceSource: 'market', sourceRef: '同規模の支援の相場（見本）', rangeMin: 400000, rangeMax: 700000 },
    { id: 'line2', itemName: '記事制作（月4本）', spec: '構成・執筆・校正', qty: 4, unit: '本', unitPrice: 250000, taxRate: 10, priceSource: 'own_price', sourceRef: '自社の料金表（見本）', rangeMin: null, rangeMax: null },
    { id: 'line3', itemName: '外部リンクの調査', spec: null, qty: 1, unit: '式', unitPrice: 0, taxRate: 10, priceSource: 'unknown', sourceRef: null, rangeMin: null, rangeMax: null },
  ],
}

const MEMBERS = {
  members: [
    { id: 'member1', role: 'owner', status: 'ACTIVE', name: '見本 太郎', inviteEmail: null, userId: PREVIEW_USER_ID },
    { id: 'member2', role: 'member', status: 'ACTIVE', name: '見本 花子', inviteEmail: null, userId: 'preview-user-2' },
  ],
  myUserId: PREVIEW_USER_ID,
  myRole: 'owner',
}

const SUGGESTED = [
  { itemName: '初期設計', spec: '現状分析とキーワード設計', qty: 1, unit: '式', unitPrice: 300000, taxRate: 10, priceSource: 'market', sourceRef: '相場（見本）', rangeMin: 200000, rangeMax: 400000 },
  { itemName: '月次レポート', spec: '順位と流入の報告', qty: 3, unit: '月', unitPrice: null, taxRate: 10, priceSource: 'unknown', sourceRef: '', rangeMin: 50000, rangeMax: 80000 },
]

let currentState = 'home'
let installed = false

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function respond(path: string, method: string): Response | null {
  const s = currentState
  if (path === '/api/auth/session') return json(PREVIEW_SESSION)
  if (!path.startsWith('/api/')) return null

  // 読み込みの失敗（一覧・詳細・設定で共通）
  if (method === 'GET') {
    if (s === 'error' || s === 'detail-error' || s === 'settings-error') return json({}, 500)
    if (s === 'forbidden' && path === '/api/quote/products') return json({ error: '組織へのアクセス権がありません。再読み込みしてください' }, 403)
    if (s === 'limit' && path === '/api/quote/products') return json({ error: 'Too Many Requests' }, 429)
    if (s === 'settings-forbidden' && path === '/api/quote/issuer') return json({ error: '権限がありません' }, 403)
    if (s === 'detail-forbidden' && path.startsWith('/api/quote/documents/')) return json({ error: '組織へのアクセス権がありません。再読み込みしてください' }, 403)
    if (s === 'detail-missing' && path.startsWith('/api/quote/documents/')) return json({ error: '見積書が見つかりません' }, 404)
  }

  switch (path) {
    case '/api/quote/organizations':
      return json(s === 'onboarding' ? { current: null, memberships: [] } : { current: ORG, memberships: [ORG] })
    case '/api/quote/products':
      if (method === 'POST') return json({ error: '無料プランで登録できる商材は3件までです。プランをご確認ください。', code: 'LIMIT_REACHED', canManageBilling: true, upgradeUrl: '/quote/pricing' }, 402)
      return json(s === 'empty' ? { products: [], total: 0, nextCursor: null } : { products: PRODUCTS, total: PRODUCTS.length, nextCursor: null })
    case '/api/quote/documents':
      if (method === 'POST') return json({ error: '無料プランで作れる見積書は3件までです。', code: 'LIMIT_REACHED', canManageBilling: true, upgradeUrl: '/quote/pricing', used: 3, limit: 3 }, 402)
      return json(s === 'empty' ? { documents: [], total: 0, nextCursor: null } : { documents: DOCUMENTS, total: DOCUMENTS.length, nextCursor: null })
    case '/api/quote/issuer':
      return json({ issuer: s === 'empty' ? null : ISSUER })
    case '/api/quote/members':
      return json(MEMBERS)
    case '/api/quote/documents/suggest':
      return json({ items: SUGGESTED })
    case '/api/quote/products/analyze':
      return json({ profile: { companyName: '見本 株式会社', summary: '検索流入を伸ばすための伴走支援。', deliveryModel: '月額の伴走', pricingAxis: '月額', publishedPrices: [] }, sourceUrl: 'https://example.com/seo' })
  }
  if (path === '/api/quote/documents/sample1') return json({ document: DETAIL, issuer: s === 'detail-no-issuer' ? null : ISSUER })
  // それ以外の API（会社情報・利用状況など）は「無い」として返す
  return json({}, 404)
}

function install() {
  if (installed || typeof window === 'undefined') return
  installed = true
  const original = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(raw, window.location.origin)
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const mocked = url.origin === window.location.origin ? respond(url.pathname, method) : null
    return mocked ?? original(input, init)
  }
}

export default function MockFetch({ state, children }: { state: string; children: ReactNode }) {
  currentState = state
  // 子の effect より先に差し替える（useState の初期化は描画中に同期で走る）
  useState(() => { install(); return true })
  return <>{children}</>
}
