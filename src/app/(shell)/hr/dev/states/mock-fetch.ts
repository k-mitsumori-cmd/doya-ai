// ============================================
// ドヤHR 画面の見本: /api/hr/* の見本の応答（開発時だけ。DB・ログインには触れない）
// ============================================
// ⚠️ 見本のページ（./page.tsx → ./HrDevStates.tsx）からだけ使う。window.fetch を差し替えるので、本番の画面からは読み込まない。
// 見本のデータはすべて架空（見本 株式会社・見本 花子 など）。
// 状態（s）ごとに、画面が読む API の応答を変える:
//   home      … データあり
//   empty     … 0件（従業員・部署・評価期間・1on1 が空）
//   error     … 500（読み込めなかった）
//   forbidden … 403（権限が無い）
//   limit     … 429（上限）。従業員の登録・CSV の一括登録は「従業員数の上限」で失敗する
//   login     … 401（ログインし直す）
//   org-error … 組織の情報（/api/hr/usage）が 500（枠の中の読み込み失敗）

export type HrDevState = 'home' | 'empty' | 'error' | 'forbidden' | 'limit' | 'login' | 'org-error'

const ACTOR = 'dev-actor'
const ORG = 'dev-org'
const ORG_NAME = '見本 株式会社'
const REVISION = 'a'.repeat(64)

let current: HrDevState = 'home'
let installed = false

const SESSION = {
  user: { id: ACTOR, name: '見本 太郎', email: 'sample@example.com', plan: 'FREE' },
  expires: '2099-01-01T00:00:00.000Z',
}
export const DEV_SESSION = SESSION

const DEPARTMENTS = [
  { id: 'dep-sales', name: '営業部', code: 'SALES', parentId: null, managerId: 'emp-1', sortOrder: 1 },
  { id: 'dep-dev', name: '開発部', code: 'DEV', parentId: null, managerId: 'emp-3', sortOrder: 2 },
  { id: 'dep-cs', name: 'カスタマーサクセス部', code: 'CS', parentId: 'dep-sales', managerId: null, sortOrder: 3 },
]

const EMPLOYEES = [
  { id: 'emp-1', lastName: '見本', firstName: '花子', lastNameKana: 'ミホン', firstNameKana: 'ハナコ', employeeNumber: 'EMP-001', email: 'hanako@example.com', departmentId: 'dep-sales', position: '部長', status: 'ACTIVE', hireDate: '2019-04-01T00:00:00.000Z' },
  { id: 'emp-2', lastName: '見本', firstName: '太郎', lastNameKana: 'ミホン', firstNameKana: 'タロウ', employeeNumber: 'EMP-002', email: 'taro@example.com', departmentId: 'dep-sales', position: 'リーダー', status: 'ACTIVE', hireDate: '2021-10-01T00:00:00.000Z' },
  { id: 'emp-3', lastName: '試験', firstName: '一郎', lastNameKana: 'シケン', firstNameKana: 'イチロウ', employeeNumber: 'EMP-003', email: 'ichiro@example.com', departmentId: 'dep-dev', position: 'エンジニアリングマネージャー', status: 'ACTIVE', hireDate: '2020-04-01T00:00:00.000Z' },
  { id: 'emp-4', lastName: '例題', firstName: '由美子', lastNameKana: 'レイダイ', firstNameKana: 'ユミコ', employeeNumber: 'EMP-004', email: 'yumiko@example.com', departmentId: 'dep-cs', position: 'カスタマーサクセスマネージャー', status: 'ON_LEAVE', hireDate: '2022-07-01T00:00:00.000Z' },
  { id: 'emp-5', lastName: '仮名', firstName: '健', lastNameKana: 'カリナ', firstNameKana: 'ケン', employeeNumber: null, email: null, departmentId: null, position: null, status: 'RESIGNED', hireDate: null },
].map((e) => ({ ...e, phone: null, photoUrl: null, grade: null, employmentType: 'FULL_TIME', department: DEPARTMENTS.find((d) => d.id === e.departmentId) ? { id: e.departmentId as string, name: DEPARTMENTS.find((d) => d.id === e.departmentId)!.name } : null }))

const PERIODS = [
  { id: 'per-1', name: '2026年度 上期評価', startDate: '2026-04-01T00:00:00.000Z', endDate: '2026-09-30T00:00:00.000Z', status: 'IN_REVIEW', evaluationCount: 5, completedEvaluations: 3 },
  { id: 'per-2', name: '2025年度 下期評価（営業部・開発部・カスタマーサクセス部 合同）', startDate: '2025-10-01T00:00:00.000Z', endDate: '2026-03-31T00:00:00.000Z', status: 'CLOSED', evaluationCount: 4, completedEvaluations: 4 },
]

const ONE_ON_ONES = [
  { id: 'one-1', employeeId: 'emp-2', employee: { lastName: '見本', firstName: '太郎', photoUrl: null }, scheduledAt: '2026-10-20T01:00:00.000Z', conductedAt: null, duration: 30, status: 'SCHEDULED', agenda: [{}, {}], aiActionItems: [] },
  { id: 'one-2', employeeId: 'emp-4', employee: { lastName: '例題', firstName: '由美子', photoUrl: null }, scheduledAt: '2026-10-10T05:00:00.000Z', conductedAt: '2026-10-10T05:00:00.000Z', duration: 45, status: 'COMPLETED', agenda: [{}], aiActionItems: [{}, {}, {}] },
]

/** ページ分けの応答（部署・評価期間）の断片。1件を1つの断片にする */
function fragments(rows: { id: string }[]) {
  return rows.map((row) => ({ id: row.id, offset: 0, text: JSON.stringify(row), complete: true }))
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/** 一覧の API が、状態に応じて失敗するときのステータス */
function failure(state: HrDevState): number | null {
  if (state === 'error') return 500
  if (state === 'forbidden') return 403
  if (state === 'limit') return 429
  if (state === 'login') return 401
  return null
}

function respond(url: URL, method: string, state: HrDevState): Response | null {
  const path = url.pathname
  const empty = state === 'empty'
  const employees = empty ? [] : EMPLOYEES
  const departments = empty ? [] : DEPARTMENTS

  // ログインと組織（枠）。org-error 以外は常に成功
  if (path === '/api/auth/session') return json(SESSION)
  if (path === '/api/hr/organization' && url.searchParams.get('format') === 'choices') {
    const chunk = JSON.stringify([{ organizationId: ORG, memberId: 'dev-member', role: 'OWNER', name: ORG_NAME }])
    return json({ success: true, format: 'hr-organization-choices-v1', actor: ACTOR, revision: REVISION, totalCharacters: chunk.length, offset: 0, chunk, nextCursor: null })
  }
  if (path === '/api/hr/usage') {
    if (state === 'org-error') return json({ error: 'internal' }, 500)
    return json({ organizationId: ORG, plan: 'FREE', employeeCount: state === 'limit' ? 5 : employees.length, employeeLimit: 5, canManageEmployees: true, hasLinkedEmployee: true })
  }
  if (!path.startsWith('/api/hr/')) return null

  // 登録（従業員・CSV）。limit では「従業員数の上限」で失敗する
  if (method === 'POST' && (path === '/api/hr/employees' || path === '/api/hr/employees/import')) {
    if (state === 'limit') return json({ code: 'HR_ORG_EMPLOYEE_LIMIT', error: 'Employee limit reached (internal)', upgradeUrl: '/hr/pricing' }, 403)
    const status = failure(state)
    if (status) return json({ error: 'Prisma error P2002 (internal)' }, status)
    if (path === '/api/hr/employees/import') return json({ imported: 2, failed: 1, details: [{ row: 2, success: true }, { row: 3, success: true }, { row: 4, success: false, error: '姓が入力されていません' }] })
    return json({ employee: { id: 'emp-new' } }, 201)
  }

  const status = failure(state)
  if (status) return json({ error: 'internal detail that must not be shown' }, status)

  if (path === '/api/hr/dashboard') {
    return json({
      orgName: ORG_NAME, canManageEmployees: true, canCreatePeriods: true,
      employeeCount: employees.length, departmentCount: departments.length,
      activeEvaluations: empty ? 0 : 1, monthlyOneOnOnes: empty ? 0 : 2, recentOneOnOnes: [],
      evaluationPeriods: empty ? [] : PERIODS.map((p) => ({ id: p.id, name: p.name, progress: 0, total: p.evaluationCount, completed: p.completedEvaluations })),
    })
  }
  if (path === '/api/hr/employees') {
    const page = Number(url.searchParams.get('page') || 1)
    const pageSize = Number(url.searchParams.get('pageSize') || 20)
    const items = employees.slice((page - 1) * pageSize, page * pageSize)
    return json({ success: true, items, total: employees.length, page, pageSize, totalPages: Math.ceil(employees.length / pageSize) })
  }
  if (path === '/api/hr/departments') {
    if (url.searchParams.get('format') === 'pages') {
      const rows = departments.map((d) => ({ ...d, isActive: true, employeeCount: employees.filter((e) => e.departmentId === d.id).length }))
      return json({ success: true, format: 'hr-department-page-v1', organizationId: ORG, revision: REVISION, total: rows.length, fragments: fragments(rows), nextCursor: null })
    }
    return json({ success: true, flat: departments.map((d) => ({ id: d.id, name: d.name })) })
  }
  if (path === '/api/hr/evaluations/periods' && method === 'GET') {
    const rows = empty ? [] : PERIODS
    return json({ success: true, canCreatePeriods: true, format: 'hr-evaluation-period-page-v1', organizationId: ORG, revision: REVISION, total: rows.length, fragments: fragments(rows), nextCursor: null })
  }
  if (path === '/api/hr/one-on-one' && method === 'GET') {
    return json({ items: empty ? [] : ONE_ON_ONES, page: Number(url.searchParams.get('page') || 1), totalPages: empty ? 0 : 1, canCreateOneOnOne: true, creationManagerId: null })
  }
  if (path === '/api/hr/org-chart') {
    return json({
      success: true, format: 'hr-org-chart-page-v1', orgName: ORG_NAME, revision: REVISION, nextCursor: null,
      totals: { departments: departments.length, employees: employees.length },
      departments: departments.map(({ id, name, code, parentId, managerId, sortOrder }) => ({ id, name, code, parentId, managerId, sortOrder })),
      employees: employees.map(({ id, firstName, lastName, position, photoUrl, employeeNumber, departmentId }) => ({ id, firstName, lastName, position, photoUrl, employeeNumber, departmentId })),
    })
  }
  return json({ error: 'not found' }, 404)
}

/** 見本の状態を決め、window.fetch を差し替える（1回だけ）。描画中に呼んでよい（子の effect より先に効く） */
export function installHrDevFetch(state: HrDevState) {
  current = state
  if (typeof window === 'undefined' || installed) return
  installed = true
  const original = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(raw, window.location.origin)
    const method = (init?.method || (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase()
    const mocked = url.origin === window.location.origin ? respond(url, method, current) : null
    if (!mocked) return original(input, init)
    // 読み込み中の見た目が一瞬だけ見えるよう、少し待つ
    await new Promise((resolve) => setTimeout(resolve, 150))
    return mocked
  }
}
