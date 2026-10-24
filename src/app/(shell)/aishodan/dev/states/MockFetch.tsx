'use client'

// ============================================
// ドヤAI商談: 画面の状態の見本で使う、見本の応答（開発時だけ）
// ============================================
// 画面が /api/aishodan/... を読みに行く前に、window.fetch を差し替えて見本の JSON を返す。
// ⚠️ 子の画面より先に差し替える必要がある（子の useEffect は親より先に走る）。そのため useState の初期化で差し替える。
// ⚠️ 見本のデータは架空のもの（見本 株式会社・見本 花子）。DB・ログイン・AI には一切触れない。
// ⚠️ /api/aishodan 以外の URL は、本物の fetch にそのまま渡す。
import { useEffect, useState, type ReactNode } from 'react'
import { PathParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime'

const ORG = { slug: 'mihon', name: '見本 株式会社', role: 'owner' }

const PRODUCTS = [
  { id: 'prod1', name: '見本クラウド勤怠', sourceUrl: 'https://example.com/kintai', scenarios: [{ id: 'scn1', name: '見本クラウド勤怠 一次商談' }], _count: { chunks: 48, sources: 12 } },
  { id: 'prod2', name: '見本 請求書の自動作成サービス（中小企業向けプラン）', sourceUrl: 'https://example.com/invoice', scenarios: [{ id: 'scn2', name: '請求書 一次商談' }], _count: { chunks: 21, sources: 5 } },
]

const ROOMS = [
  {
    id: 'room1', name: '見本クラウド勤怠 一次商談', token: 'sample-token-1234567890', isActive: true, expiresAt: null,
    createdAt: '2026-10-15T01:20:00.000Z', sessionCount: 3, maxSessions: 100,
    scenario: { id: 'scn1', name: '見本クラウド勤怠 一次商談', product: { name: '見本クラウド勤怠' } }, _count: { sessions: 3 },
  },
  {
    id: 'room2', name: '請求書 一次商談', token: 'sample-token-abcdef', isActive: false, expiresAt: '2026-11-30T00:00:00.000Z',
    createdAt: '2026-10-10T05:00:00.000Z', sessionCount: 0, maxSessions: 100,
    scenario: { id: 'scn2', name: '請求書 一次商談', product: { name: '見本 請求書の自動作成サービス（中小企業向けプラン）' } }, _count: { sessions: 0 },
  },
]

const SESSIONS = [
  { id: 'sess1', guestName: '見本 花子', guestCompany: '見本 株式会社', status: 'evaluated', createdAt: '2026-10-18T02:00:00.000Z', startedAt: '2026-10-18T02:00:00.000Z', endedAt: '2026-10-18T02:14:00.000Z', room: { name: '見本クラウド勤怠 一次商談', isPreview: false }, schedulingClickedAt: '2026-10-18T02:14:00.000Z', outcome: { fitScore: 82, verdict: 'hot' }, _count: { turns: 26 } },
  { id: 'sess2', guestName: '見本 次郎', guestCompany: '見本商事 株式会社 東日本営業本部', status: 'evaluated', createdAt: '2026-10-17T06:30:00.000Z', startedAt: '2026-10-17T06:30:00.000Z', endedAt: '2026-10-17T06:41:00.000Z', room: { name: '見本クラウド勤怠 一次商談', isPreview: false }, schedulingClickedAt: null, outcome: { fitScore: 58, verdict: 'warm' }, _count: { turns: 18 } },
  { id: 'sess3', guestName: null, guestCompany: null, status: 'completed', createdAt: '2026-10-16T09:10:00.000Z', startedAt: '2026-10-16T09:10:00.000Z', endedAt: '2026-10-16T09:15:00.000Z', room: { name: '練習モード', isPreview: true }, schedulingClickedAt: null, outcome: null, _count: { turns: 6 } },
]

const STATS = {
  total: 3, evaluated: 2, completionRate: 67, scheduled: 1, schedulingRate: 33, avgMin: 10,
  byVerdict: { hot: 1, warm: 1 },
  unanswered: [
    { id: 'q1', text: '既存の給与計算ソフトとのデータ連携はできますか', count: 2 },
    { id: 'q2', text: '導入時の初期設定は代行してもらえますか', count: 1 },
  ],
}

const DETAIL = {
  id: 'sess1', guestName: '見本 花子', guestCompany: '見本 株式会社', guestEmail: 'hanako@example.com', status: 'evaluated', evaluationStatus: 'ready',
  startedAt: '2026-10-18T02:00:00.000Z', endedAt: '2026-10-18T02:14:00.000Z', schedulingClickedAt: '2026-10-18T02:14:00.000Z',
  roomName: '見本クラウド勤怠 一次商談', isPreview: false, productName: '見本クラウド勤怠',
  turns: [
    { id: 't1', speaker: 'ai', text: '本日はお時間をいただきありがとうございます。まず、いまの勤怠管理の方法を教えていただけますか。', phase: 'opening' },
    { id: 't2', speaker: 'guest', text: '紙のタイムカードを月末に集計しています。従業員は80名ほどです。', phase: 'hearing' },
    { id: 't3', speaker: 'ai', text: '集計にはどのくらいの時間がかかっていますか。', phase: 'hearing' },
    { id: 't4', speaker: 'guest', text: '毎月まる2日です。https://example.com/very-long-url-for-testing-overflow-in-narrow-screens を見て問い合わせました。', phase: 'hearing' },
  ],
  slots: [
    { key: 'size', label: '従業員数', required: true, value: '80名' },
    { key: 'current', label: '今の勤怠管理の方法', required: true, value: '紙のタイムカードを月末に集計（毎月2日かかる）' },
    { key: 'timing', label: '導入したい時期', required: false, value: null },
  ],
  questions: [{ id: 'q1', text: '既存の給与計算ソフトとのデータ連携はできますか', unanswered: true }],
  outcome: {
    fitScore: 82, verdict: 'hot', reason: '従業員規模と課題（集計の手間）が理想の顧客像に合っており、導入時期も半年以内と伺えました。', nextAction: '給与計算ソフトとの連携可否を確認し、3日以内にご連絡する。', overriddenAt: null,
    summary: {
      headline: ['紙のタイムカードの集計に毎月2日かかっている', '80名規模で、半年以内の導入を検討'],
      challenge: '月末の集計作業の負担と、打刻漏れの確認。',
      proposed: 'スマホ打刻と自動集計、給与計算ソフトへの書き出し。',
      objections: ['既存の給与計算ソフトとつながるか'],
      conditions: [
        { label: '従業員30名以上', met: true, weight: 30, note: '80名と伺いました' },
        { label: '勤怠の集計に課題がある', met: true, weight: 40, note: '毎月2日かかっている' },
        { label: '半年以内に導入したい', met: false, weight: 30, note: '時期ははっきりしませんでした' },
      ],
    },
  },
}

const SCENARIO = {
  id: 'scn1', name: '見本クラウド勤怠 一次商談',
  product: { id: 'prod1', name: '見本クラウド勤怠', profile: { oneLiner: 'スマホで打刻し、月末の集計を自動にする勤怠管理', valueProp: '紙の集計作業をなくし、打刻漏れをその日のうちに気づけます。', pricing: '', doNotMention: ['未発表の機能'] } },
  phases: [
    { key: 'opening', name: 'あいさつと目的の確認', goal: '商談の目的と時間を伝える', exitCondition: '', maxTurns: 4 },
    { key: 'hearing', name: '今の勤怠管理の聞き取り', goal: '規模・今の方法・困りごとを聞く', exitCondition: '', maxTurns: 12 },
    { key: 'closing', name: '次の打ち合わせの案内', goal: '日程調整のリンクを案内する', exitCondition: '', maxTurns: 4 },
  ],
  slots: [
    { key: 'size', label: '従業員数', type: 'text', required: true, questionHint: '何名くらいの会社ですか' },
    { key: 'current', label: '今の勤怠管理の方法', type: 'text', required: true, questionHint: 'いまはどのように勤怠を集計していますか' },
  ],
  icp: { conditions: [
    { key: 'c1', label: '従業員30名以上', weight: 30, match: '従業員数が30名以上と分かった' },
    { key: 'c2', label: '勤怠の集計に課題がある', weight: 40, match: '集計に時間がかかる・ミスがあると話した' },
  ] },
  guardrails: { pricePolicy: 'rough', competitorPolicy: 'neutral', prohibitedTopics: ['係争中の案件'], noEvidenceBehavior: 'defer' },
  persona: { tone: 'ていねいで、短く話す', firstPerson: 'わたくし', maxCharsPerUtterance: 120 },
  durationMin: 15, schedulingUrl: 'https://example.com/booking', schedulingLabel: null,
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** 状態ごとの見本の応答。null は本物の fetch に渡す */
function respond(state: string, method: string, path: string, query: URLSearchParams): Response | Promise<Response> | null {
  if (!path.startsWith('/api/aishodan')) return null
  if (state === 'loading') return new Promise<Response>(() => {})

  if (path === '/api/aishodan/organizations') {
    if (state === 'error') return json({ error: 'PrismaClientKnownRequestError: P1001' }, 500)
    if (state === 'onboarding') return json({ memberships: [], current: null })
    return json({ memberships: [ORG], current: ORG })
  }

  const empty = state === 'empty' || state === 'sessions-empty'
  if (path === '/api/aishodan/products') {
    if (method === 'POST' && state === 'limit') return json({ error: 'LIMIT_REACHED: monthly quota exceeded', code: 'LIMIT_REACHED', upgradeUrl: '/aishodan/pricing' }, 402)
    if (state === 'forbidden') return json({ error: 'FORBIDDEN_ROLE' }, 403)
    return json({ products: empty ? [] : PRODUCTS, total: empty ? 0 : PRODUCTS.length, nextCursor: null })
  }
  if (path === '/api/aishodan/rooms') return json({ rooms: empty ? [] : ROOMS, total: empty ? 0 : ROOMS.length, nextCursor: null })
  if (path === '/api/aishodan/stats') return json(empty ? { ...STATS, total: 0, evaluated: 0, completionRate: 0, scheduled: 0, schedulingRate: 0, avgMin: 0, byVerdict: {}, unanswered: [] } : STATS)
  if (path === '/api/aishodan/sessions') {
    if (state === 'sessions-error') return json({ error: 'TypeError: fetch failed' }, 500)
    if (state === 'sessions-forbidden') return json({ error: 'FORBIDDEN' }, 403)
    const verdict = query.get('verdict')
    const rows = empty ? [] : SESSIONS.filter((s) => !verdict || s.outcome?.verdict === verdict)
    return json({ sessions: rows, total: rows.length, nextCursor: null })
  }
  if (path.startsWith('/api/aishodan/sessions/')) {
    if (state === 'detail-error') return json({ error: 'Not found' }, 404)
    if (state === 'detail-pending') return json({ session: { ...DETAIL, status: 'completed', evaluationStatus: 'stopped', outcome: null } })
    return json({ session: DETAIL })
  }
  if (path.startsWith('/api/aishodan/scenarios/')) {
    if (state === 'scenario-error') return json({ error: 'Internal Server Error' }, 500)
    return json({ scenario: SCENARIO })
  }
  return json({})
}

let currentState = 'home'

function install() {
  if (typeof window === 'undefined') return
  const w = window as typeof window & { __aishodanMock?: typeof fetch }
  if (w.__aishodanMock) return
  const real = window.fetch.bind(window)
  w.__aishodanMock = real
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(raw, window.location.origin)
    const method = (init?.method || (typeof input === 'object' && 'method' in input ? input.method : 'GET') || 'GET').toUpperCase()
    const res = url.origin === window.location.origin ? respond(currentState, method, url.pathname, url.searchParams) : null
    return res ? Promise.resolve(res) : real(input, init)
  }) as typeof fetch
}

/**
 * params を渡すと、useParams() が返す値（商談詳細・シナリオの [id]）も見本にする。
 * act は、操作したあとの状態（上限・絞り込みゼロ件）を見せるため、読み込み後に1回だけ押す操作。
 */
export default function MockFetch({ state, params, act, children }: {
  state: string
  params?: Record<string, string>
  act?: 'import-limit' | 'filter-empty'
  children: ReactNode
}) {
  // ⚠️ 子の useEffect より先に差し替えるため、描画中（useState の初期化）で行う
  useState(() => {
    currentState = state
    install()
    try {
      // 端末に残った組織の選択は使わない（見本の組織だけを見せる）
      window.localStorage.removeItem('doya.aishodan.org')
    } catch {
      // 読めない環境では何もしない
    }
    return null
  })
  currentState = state

  useEffect(() => {
    if (!act) return
    let tries = 0
    const timer = window.setInterval(() => {
      tries++
      if (act === 'import-limit') {
        const input = document.getElementById('aishodan-import-url') as HTMLInputElement | null
        if (input) {
          // React の入力欄に値を入れる（value を直接書くだけでは onChange が呼ばれない）
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'https://example.com/service')
          input.dispatchEvent(new Event('input', { bubbles: true }))
          window.setTimeout(() => {
            const button = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === '取り込む')
            button?.click()
          }, 50)
          window.clearInterval(timer)
        }
      } else {
        const button = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === '不適合')
        if (button) {
          button.click()
          window.clearInterval(timer)
        }
      }
      if (tries > 50) window.clearInterval(timer)
    }, 100)
    return () => window.clearInterval(timer)
  }, [act])

  const body = <>{children}</>
  return params ? <PathParamsContext.Provider value={params}>{body}</PathParamsContext.Provider> : body
}
