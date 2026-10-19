// ============================================
// ドヤ営業管理: 画面の状態の見本で使う、偽の API（開発時だけ）
// ============================================
// このファイルを読み込むと、window.fetch を差し替える。/sfa/dev/states を開いているときの /api/sfa/* と /api/auth/session だけ見本の応答を返し、
// それ以外（ほかのページへ移ったあと等）は本物の fetch に渡す。DB・ログイン・AI には一切触れない。
// 状態は URL の ?s= で決める（home・empty・error・forbidden・login・limit）。
// ⚠️ 見本データは架空のもの（見本 株式会社・見本 花子）だけを使う。
'use client'

type Json = Record<string, unknown>

export const SAMPLE_ORG = 'mihon'
export const SAMPLE_SESSION = {
  user: { id: 'sample-user', name: '見本 太郎', email: 'mihon.taro@example.com', image: null, role: 'USER', plan: 'FREE' },
  expires: '2099-01-01T00:00:00.000Z',
}

// 日付は ISO（24文字）でないと受け付けないので、ここで作る
const day = 86_400_000
const now = Date.now()
const iso = (offsetDays: number) => new Date(now + offsetDays * day).toISOString()

const ACCOUNTS = [
  { id: 'acc1', name: '見本 株式会社', industry: '製造業', prefecture: '東京都', url: 'https://example.com', note: null, createdAt: iso(-60), updatedAt: iso(-3) },
  { id: 'acc2', name: '見本商事 株式会社', industry: '卸売', prefecture: '大阪府', url: null, note: null, createdAt: iso(-40), updatedAt: iso(-10) },
  { id: 'acc3', name: '見本ソフトウェア 合同会社', industry: 'IT', prefecture: '福岡県', url: null, note: null, createdAt: iso(-20), updatedAt: iso(-1) },
]
const CONTACTS = [
  { id: 'con1', name: '見本 花子', accountId: 'acc1', accountName: '見本 株式会社', title: '営業部長', department: '営業部', email: 'hanako@example.com', phone: '03-0000-0000', note: null, isKeyPerson: true, createdAt: iso(-50), updatedAt: iso(-2) },
  { id: 'con2', name: '見本 次郎', accountId: 'acc2', accountName: '見本商事 株式会社', title: '課長', department: '購買部', email: null, phone: null, note: null, isKeyPerson: false, createdAt: iso(-30), updatedAt: iso(-5) },
]
const STAGES = [
  { id: 'st1', name: '初回接触', order: 1, probability: 10, color: '#94a3b8', isWon: false, isLost: false },
  { id: 'st2', name: '提案', order: 2, probability: 40, color: '#38bdf8', isWon: false, isLost: false },
  { id: 'st3', name: '見積・交渉', order: 3, probability: 70, color: '#f59e0b', isWon: false, isLost: false },
  { id: 'st4', name: '受注', order: 4, probability: 100, color: '#10b981', isWon: true, isLost: false },
]
const deal = (id: string, name: string, amount: number, stageId: string, accountId: string | null, accountName: string | null, extra: Json = {}) => ({
  id, name, amount, stageId, probability: STAGES.find(s => s.id === stageId)!.probability, accountId, accountName, contactId: null, contactName: accountId === 'acc1' ? '見本 花子' : null,
  note: null, lostReason: null, status: stageId === 'st4' ? 'won' : 'open', startDate: iso(-30), expectedCloseDate: iso(20), wonAt: stageId === 'st4' ? iso(-2) : null, lostAt: null,
  lastActivityAt: iso(-1), createdAt: iso(-30), updatedAt: iso(-1), openTaskCount: 0, ...extra,
})
const DEALS = [
  deal('deal1', '基幹システム入れ替えのご提案', 3_200_000, 'st2', 'acc1', '見本 株式会社', { openTaskCount: 2 }),
  deal('deal2', '営業支援ツールの年間契約', 1_200_000, 'st3', 'acc2', '見本商事 株式会社'),
  deal('deal3', '新拠点のネットワーク工事', 850_000, 'st1', 'acc3', '見本ソフトウェア 合同会社', { lastActivityAt: iso(-20) }),
  deal('deal4', '保守契約の更新', 480_000, 'st4', 'acc1', '見本 株式会社'),
]
const TASKS = [
  { id: 'task1', title: '見本 株式会社に見積を送る', status: 'open', dueDate: iso(0), dealId: 'deal1', dealName: '基幹システム入れ替えのご提案', createdAt: iso(-3), updatedAt: iso(-3) },
  { id: 'task2', title: '提案資料の最終確認', status: 'open', dueDate: iso(-1), dealId: 'deal1', dealName: '基幹システム入れ替えのご提案', createdAt: iso(-4), updatedAt: iso(-4) },
  { id: 'task3', title: '見本商事の購買部へ折り返し電話', status: 'open', dueDate: iso(3), dealId: null, dealName: null, createdAt: iso(-2), updatedAt: iso(-2) },
  { id: 'task4', title: '先週の議事録を共有する', status: 'done', dueDate: null, dealId: null, dealName: null, createdAt: iso(-8), updatedAt: iso(-6) },
]
const ACTIVITIES = [
  { id: 'act1', type: 'meeting', subject: '見本 株式会社と初回の打ち合わせ', body: '基幹システムの入れ替え時期は来年4月の予定。', occurredAt: iso(-1), dealId: 'deal1' },
  { id: 'act2', type: 'call', subject: '見本商事の購買部へ電話', body: null, occurredAt: iso(-2), dealId: 'deal2' },
  { id: 'act3', type: 'email', subject: '提案資料を送付', body: null, occurredAt: iso(-4), dealId: 'deal1' },
  { id: 'act4', type: 'note', subject: '社内メモ', body: '見積の値引き幅は10%まで。', occurredAt: iso(-6), dealId: null },
]
const LEADS = [
  { id: 'lead1', name: '見本テック 株式会社', contactName: '見本 花子', email: null, phone: null, corporateNumber: null, note: null, status: 'new', score: 82, source: 'doyalist', convertedAccountId: null, updatedAt: iso(-1) },
  { id: 'lead2', name: '見本物産 株式会社', contactName: null, email: null, phone: null, corporateNumber: null, note: null, status: 'working', score: 55, source: 'csv', convertedAccountId: null, updatedAt: iso(-2) },
  { id: 'lead3', name: '見本ホールディングス 株式会社', contactName: '見本 三郎', email: null, phone: null, corporateNumber: null, note: null, status: 'qualified', score: null, source: 'manual', convertedAccountId: null, updatedAt: iso(-3) },
]
const MEMBERS = [
  { id: 'm1', name: '見本 太郎', role: 'owner', status: 'ACTIVE', inviteEmail: null, acceptedAt: iso(-90) },
  { id: 'm2', name: '見本 花子', role: 'manager', status: 'ACTIVE', inviteEmail: 'hanako@example.com', acceptedAt: iso(-30) },
  { id: 'm3', name: null, role: 'member', status: 'PENDING', inviteEmail: 'mihon.shinjin@example.com', acceptedAt: null },
]

function summary(empty: boolean) {
  if (empty) return { totalCount: 0, openCount: 0, staleCount: 0, openTaskCount: 0, openTotal: '0', weighted: '0', wonTotal: '0' }
  return { totalCount: 4, openCount: 3, staleCount: 1, openTaskCount: 3, openTotal: '5250000', weighted: '2205000', wonTotal: '480000' }
}

/** 見本の状態ごとの、GET の応答（本物の API と同じ形） */
function sampleGet(path: string, params: URLSearchParams, empty: boolean): Json | null {
  const page = Number(params.get('page') || '1')
  const q = (params.get('q') || '').trim()
  switch (path) {
    case '/api/sfa/usage':
      return { plan: 'FREE', memberships: [{ slug: SAMPLE_ORG, name: '見本 株式会社', role: 'owner' }] }
    case '/api/sfa/summary':
      return { summary: summary(empty) }
    case '/api/sfa/tasks': {
      const dealId = params.get('dealId')
      const rows = empty ? [] : TASKS.filter(t => !dealId || t.dealId === dealId)
      return { tasks: rows, hasMore: false, page }
    }
    case '/api/sfa/activities': {
      const dealId = params.get('dealId')
      const rows = empty ? [] : ACTIVITIES.filter(a => !dealId || a.dealId === dealId)
      return { activities: rows, totalCount: rows.length, nextCursor: null }
    }
    case '/api/sfa/deals': {
      const rows = empty ? [] : DEALS
      const stageSummary = STAGES.map(s => {
        const inStage = rows.filter(d => d.stageId === s.id)
        return { stageId: s.id, count: inStage.length, total: String(inStage.reduce((n, d) => n + d.amount, 0)) }
      })
      return { stages: STAGES, deals: rows, nextCursor: null, totalCount: rows.length, stageSummary }
    }
    case '/api/sfa/accounts': {
      const rows = empty ? [] : ACCOUNTS.filter(a => !q || a.name.includes(q))
      return { accounts: rows, totalCount: rows.length, nextCursor: null }
    }
    case '/api/sfa/contacts': {
      const rows = empty ? [] : CONTACTS.filter(c => !q || c.name.includes(q))
      return { contacts: rows, totalCount: rows.length, nextCursor: null }
    }
    case '/api/sfa/leads': {
      const status = params.get('status')
      const rows = empty ? [] : LEADS.filter(l => (!status || l.status === status) && (!q || l.name.includes(q)))
      return { leads: rows, totalCount: rows.length, nextCursor: null }
    }
    case '/api/sfa/members':
      return { members: empty ? MEMBERS.slice(0, 1) : MEMBERS, myRole: 'owner', myMemberId: 'm1' }
    default:
      return null
  }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function mockResponse(url: URL, method: string): Response | null {
  const state = new URLSearchParams(window.location.search).get('s') || 'home'
  if (url.pathname === '/api/auth/session') return json(SAMPLE_SESSION)
  if (!url.pathname.startsWith('/api/sfa/')) return null
  // 所属組織の一覧（枠の切り替え）は、どの状態でも見本を返す
  if (url.pathname === '/api/sfa/usage') return json(sampleGet(url.pathname, url.searchParams, false))
  if (method !== 'GET') {
    // 上限: 作る操作は 402（本物の sfaQuotaResponse と同じ形）
    if (state === 'limit') return json({ error: '商談の上限（50件）に達しました。プロプランで枠を広げられます。', code: 'SFA_LIMIT_REACHED', limitReached: true, canManageBilling: true, resource: 'deals', used: 50, limit: 50, upgradeUrl: '/sfa/pricing' }, 402)
    return json({ error: '見本の画面では保存できません。' }, 403)
  }
  if (state === 'error') return json({ error: 'internal' }, 500)
  if (state === 'forbidden') return json({ error: 'この組織へのアクセス権がありません' }, 403)
  if (state === 'login') return json({ error: 'ログイン/組織が必要です' }, 401)
  const body = sampleGet(url.pathname, url.searchParams, state === 'empty')
  return body ? json(body) : json({ error: 'not found' }, 404)
}

/** 差し替えを入れる（何度呼んでも1回だけ）。描画の前に同期で呼ぶ */
export function installSfaMockFetch() {
  if (typeof window === 'undefined') return
  const w = window as typeof window & { __sfaDevMockFetch?: boolean }
  if (w.__sfaDevMockFetch) return
  w.__sfaDevMockFetch = true
  const original = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    // 見本のページを離れたら、本物の fetch に戻す
    if (!window.location.pathname.startsWith('/sfa/dev/states')) return original(input, init)
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(raw, window.location.origin)
    if (url.origin !== window.location.origin) return original(input, init)
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const mocked = mockResponse(url, method)
    if (!mocked) return original(input, init)
    // 読み込み中の表示が一瞬見えるよう、少しだけ待つ
    await new Promise(resolve => setTimeout(resolve, 150))
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    return mocked
  }
}
