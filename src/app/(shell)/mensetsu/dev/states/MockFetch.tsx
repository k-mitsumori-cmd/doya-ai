'use client'
// ============================================
// ドヤ面接官 状態の見本: /api/mensetsu/* の見本の返事（開発時だけ）
// ============================================
// ⚠️ DB・ログイン・AI には触れない。window.fetch を差し替えて、見本データか失敗の状態を返す。
// ⚠️ 子の部品が描かれる前に差し替える（モジュールの読み込み時に1回だけ。状態は描画のたびに更新する）
// ⚠️ 見本の名前・会社はすべて架空（見本 株式会社・見本 花子）。
import { useEffect, useState, type ReactNode } from 'react'
import { UiNextContext } from '@/components/shell/ui-next-context'

const ORG = { id: 'org1', name: '見本 株式会社', slug: 'mihon', role: 'owner', retentionDays: 180, recordAudio: false, discloseToCandidate: false }

const PROFILE = {
  id: 'p1',
  companyName: '見本 株式会社',
  business: '中小企業向けのクラウド勤怠管理サービス「ミホンタイム」を開発・提供しています。',
  valueProp: '打刻から給与計算の手前までを、設定の代行つきで1か月で立ち上げられます。',
  culture: 'お客様の声を週に一度、全員で読み合わせる文化があります。',
  idealProfile: '相手の話を最後まで聞き、課題を自分の言葉で言い直せる方。',
  sourceUrl: 'https://mihon.example.jp/',
}

const CRITERIA = [
  { id: 'c1', key: 'listening', name: '傾聴力', description: '相手の話を遮らずに聞き、要点を言い直せるか', rubric: { '1': '話を遮る', '3': '要点を拾える', '5': '言外の意図まで確かめる' }, weight: 1 },
  { id: 'c2', key: 'proposal', name: '提案力', description: '課題に合わせて解決策を組み立てられるか', rubric: { '1': '一般論に留まる', '3': '課題に沿う', '5': '数字と根拠で示す' }, weight: 1 },
  { id: 'c3', key: 'grit', name: 'やり抜く力', description: '難しい状況で最後まで取り組んだ経験があるか', rubric: { '1': '経験がない', '3': '具体例がある', '5': '再現性のある工夫がある' }, weight: 1 },
]

const QUESTIONS = [
  { id: 'q1', ord: 1, text: 'これまでのお仕事で、お客様の課題を聞き出して提案につなげた経験を教えてください。', targetMin: 4, followUpHint: '数字や結果を具体的に', criterionKeys: ['listening', 'proposal'], branches: [] },
  { id: 'q2', ord: 2, text: '思うように進まなかった案件で、最後までやり抜くために工夫したことは何ですか。', targetMin: 3, followUpHint: null, criterionKeys: ['grit'], branches: [] },
  { id: 'q3', ord: 3, text: '当社のサービスを、初めて聞く方に1分で説明するとしたら、どう伝えますか。', targetMin: 3, followUpHint: null, criterionKeys: ['proposal'], branches: [] },
]

const TEMPLATES = [
  {
    id: 't1', name: 'フィールドセールス（中途）', jobTitle: 'フィールドセールス', level: 'mid', durationMin: 10, status: 'active',
    _count: { questions: 3, criteria: 3, sessions: 4 },
    questions: QUESTIONS.map(({ id, ord, text, targetMin }) => ({ id, ord, text, targetMin })),
    criteria: CRITERIA.map(({ id, name }) => ({ id, name })),
  },
  {
    id: 't2', name: 'カスタマーサクセス（新卒・とても長い職種名の折り返しを確かめるための見本）', jobTitle: 'カスタマーサクセス', level: 'newgrad', durationMin: 10, status: 'draft',
    _count: { questions: 2, criteria: 2, sessions: 0 },
    questions: QUESTIONS.slice(0, 2).map(({ id, ord, text, targetMin }) => ({ id, ord, text, targetMin })),
    criteria: CRITERIA.slice(0, 2).map(({ id, name }) => ({ id, name })),
  },
]

const SESSIONS = [
  { id: 's1', token: 'tok1', candidateName: '見本 花子', status: 'evaluated', verdict: 'recommend', expiresAt: '2026-11-30T00:00:00.000Z', template: { name: TEMPLATES[0].name, jobTitle: 'フィールドセールス' } },
  { id: 's2', token: 'tok2', candidateName: '見本 一郎', status: 'evaluated', verdict: 'hold', expiresAt: '2026-11-30T00:00:00.000Z', template: { name: TEMPLATES[0].name, jobTitle: 'フィールドセールス' } },
  { id: 's3', token: 'tok3', candidateName: '見本 次郎', status: 'completed', verdict: null, expiresAt: '2026-11-30T00:00:00.000Z', template: { name: TEMPLATES[0].name, jobTitle: 'フィールドセールス' } },
  { id: 's4', token: 'tok4', candidateName: '見本 三奈', status: 'pending', verdict: null, expiresAt: '2026-11-30T00:00:00.000Z', template: { name: TEMPLATES[0].name, jobTitle: 'フィールドセールス' } },
  { id: 's5', token: 'tok5', candidateName: '見本 四郎', status: 'aborted', verdict: null, expiresAt: '2026-11-30T00:00:00.000Z', template: { name: TEMPLATES[0].name, jobTitle: 'フィールドセールス' } },
]

function sessionDetail(evaluated: boolean) {
  return {
    session: {
      id: 's1',
      candidateName: '見本 花子',
      status: evaluated ? 'evaluated' : 'completed',
      verdict: evaluated ? 'recommend' : null,
      overallComment: evaluated ? 'お客様の課題を自分の言葉で言い直してから提案に入る姿勢が一貫していました。数字での裏付けはやや少なめです。' : null,
      startedAt: '2026-10-18T01:00:00.000Z',
      endedAt: '2026-10-18T01:10:00.000Z',
      updatedAt: '2026-10-18T01:12:00.000Z',
      evaluatedAt: evaluated ? '2026-10-18T01:12:00.000Z' : null,
      recordingPath: evaluated ? 'mihon/recording.webm' : null,
      recruiterReport: evaluated ? '傾聴の姿勢は強み。提案の場面で、効果を数字で示す練習をすると伸びる見込みです。' : null,
      candidateFeedback: evaluated ? 'お客様の話を丁寧に聞き取る姿勢がよく伝わりました。提案の際に数字を添えると、さらに説得力が増します。' : null,
      template: { jobTitle: 'フィールドセールス', durationMin: 10, criteria: CRITERIA },
      scores: evaluated ? [
        { criterionId: 'c1', score: 5, insufficient: false, rationale: '相手の発言を要約して確かめる場面が3回ありました。', quotes: ['つまり、打刻の手間よりも集計のほうが負担だということですね'] },
        { criterionId: 'c2', score: 4, insufficient: false, rationale: '課題に沿った提案ができていますが、数字の裏付けは一部でした。', quotes: ['まずは1部署だけで1か月試していただく形をご提案しました'] },
        { criterionId: 'c3', score: null, insufficient: true, rationale: '具体的な経験を聞き取れませんでした。', quotes: [] },
      ] : [],
      turns: evaluated ? [
        { id: 'u1', speaker: 'interviewer', text: QUESTIONS[0].text },
        { id: 'u2', speaker: 'candidate', text: '前職では、勤怠の集計に毎月3日かかっていたお客様に、まず集計の手順を一緒に書き出していただきました。' },
        { id: 'u3', speaker: 'interviewer', text: 'その結果、どのような提案につながりましたか。' },
        { id: 'u4', speaker: 'candidate', text: 'まずは1部署だけで1か月試していただく形をご提案し、翌月に全社へ広げていただきました。' },
      ] : [],
    },
    average: evaluated ? 4.5 : null,
  }
}

const COMPARE = {
  template: { criteria: CRITERIA.map(({ key, name, weight }) => ({ key, name, weight })) },
  candidates: [
    { id: 's1', name: '見本 花子', jobTitle: 'フィールドセールス', verdict: 'recommend', endedAt: '2026-10-18T01:10:00.000Z', overallComment: null, average: 4.5, scores: { listening: 5, proposal: 4, grit: null } },
    { id: 's2', name: '見本 一郎', jobTitle: 'フィールドセールス', verdict: 'hold', endedAt: '2026-10-17T05:00:00.000Z', overallComment: null, average: 3, scores: { listening: 3, proposal: 3, grit: 3 } },
    { id: 's6', name: '見本 とても長い名前の候補者さん', jobTitle: 'カスタマーサクセス', verdict: 'conditional', endedAt: '2026-10-16T05:00:00.000Z', overallComment: null, average: 2.7, scores: { listening: 2, proposal: 3, grit: 3 } },
  ],
  medians: { listening: 3, proposal: 3, grit: 3 },
  total: 3,
  nextCursor: null,
  revision: 'a'.repeat(43),
}

let state = 'home'
const realFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : null

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
}

/** 読み込みの失敗。prefix 付きの状態（template-error など）は、その画面の読み込みだけを失敗させる */
function failure(prefix = ''): Promise<Response> | null {
  if (prefix && !state.startsWith(prefix)) return null
  switch (state.slice(prefix.length)) {
    case 'error': return json({ error: 'PrismaClientKnownRequestError: (技術的な文言。画面には出さない)' }, 500)
    case 'forbidden': return json({ error: 'Forbidden' }, 403)
    case 'limit-load': return json({ error: 'Too Many Requests' }, 429)
    case 'loading': return new Promise<Response>(() => {})
    default: return null
  }
}

if (typeof window !== 'undefined' && realFetch) {
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const full = url.replace(/^https?:\/\/[^/]+/, '')
    const path = full.split('?')[0]
    const method = (init?.method || 'GET').toUpperCase()
    if (!path.startsWith('/api/mensetsu/')) return realFetch(input, init)

    const empty = state === 'empty' || state === 'compare-empty' || state === 'compare-notemplates'
    // 組織（ダッシュボード・設定の入口）
    if (path === '/api/mensetsu/organizations') {
      if (state === 'onboarding' || state === 'settings-noorg') return json({ current: null, memberships: [] })
      return failure() ?? failure('settings-') ?? json({ current: ORG, memberships: [ORG] })
    }
    if (path === '/api/mensetsu/company') return json({ profile: empty ? null : PROFILE })
    // 面接の発行（上限の見本）
    if (path === '/api/mensetsu/sessions' && method === 'POST') {
      if (state === 'limit') return json({ error: '無料プランの面接の上限（3件）に達しました。プロプランにすると上限が広がります。', code: 'LIMIT_REACHED', canManageBilling: true, used: 3, limit: 3, upgradeUrl: '/mensetsu/pricing' }, 402)
      return json({ url: `${window.location.origin}/mensetsu/live/tok-new` })
    }
    if (path === '/api/mensetsu/sessions') {
      const rows = empty || state === 'no-sessions' ? [] : SESSIONS
      return json({ sessions: rows, total: rows.length, nextCursor: null })
    }
    if (path === '/api/mensetsu/templates' && method === 'GET') {
      if (state === 'compare-forbidden') return json({ error: 'Forbidden' }, 403)
      return json({ templates: empty && state !== 'compare-empty' ? [] : TEMPLATES })
    }
    // 質問セットの編集
    const tpl = /^\/api\/mensetsu\/templates\/[^/]+$/.exec(path)
    if (tpl) {
      if (state === 'template-notfound') return json({ error: '見つかりません' }, 404)
      if (method === 'GET') return failure('template-') ?? json({ template: { ...TEMPLATES[0], intro: '本日はお時間をいただきありがとうございます。10分ほどの面接です。', closing: '以上で面接は終わりです。ありがとうございました。', questions: QUESTIONS, criteria: CRITERIA } })
      return json({ ok: true })
    }
    // 比較
    if (path === '/api/mensetsu/compare') {
      if (state === 'compare-error') return json({ error: 'internal error' }, 500)
      const filtered = !/templateId=all/.test(full)
      if (state === 'compare-empty' || filtered) return json({ ...COMPARE, candidates: [], total: 0 })
      return json(COMPARE)
    }
    // 評価レポート
    if (/\/hr-handoff$/.test(path)) return json({ canHandoff: false })
    if (/^\/api\/mensetsu\/sessions\/[^/]+$/.test(path)) {
      if (state === 'detail-notfound') return json({ error: '見つかりません' }, 404)
      return failure('detail-') ?? json(sessionDetail(state !== 'detail-pending'))
    }
    // 設定のメンバー
    if (path === '/api/mensetsu/members') {
      return json({
        members: [
          { id: 'm1', name: '見本 太郎', inviteEmail: null, role: 'owner', status: 'ACTIVE', userId: 'u-me' },
          { id: 'm2', name: '見本 花子', inviteEmail: null, role: 'admin', status: 'ACTIVE', userId: 'u2' },
          { id: 'm3', name: null, inviteEmail: 'mihon-very-long-address-for-375px@example.jp', role: 'member', status: 'PENDING', userId: null },
        ],
        myRole: 'owner',
        myUserId: 'u-me',
      })
    }
    return json({ error: 'not mocked' }, 500)
  }
}

/**
 * 見本の状態を fetch の差し替えに伝える（描画のたびに更新）。新しい見た目も強制する。
 * ⚠️ UiNextContext.Provider はサーバーの部品からは使えない（クライアントの参照になる）ため、ここで包む
 */
export default function MockFetch({ s, children }: { s: string; children: ReactNode }) {
  state = s
  // useState の初期化で、子より先に状態を確定させる（初回の描画）
  useState(() => {
    state = s
    return null
  })
  return <UiNextContext.Provider value="all">{children}</UiNextContext.Provider>
}

/**
 * 発行の上限を見せるため、応募者名を入れて「面接URLを発行する」を押す。
 * ⚠️ 見本の画面だけで使う。本番の画面の動きは変えない
 */
export function AutoIssue() {
  useEffect(() => {
    let tries = 0
    const timer = setInterval(() => {
      tries++
      const input = document.querySelector<HTMLInputElement>('input[placeholder="山田 太郎"]')
      if (!input) { if (tries > 40) clearInterval(timer); return }
      clearInterval(timer)
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, '見本 花子')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      setTimeout(() => {
        const button = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === '面接URLを発行する')
        button?.click()
      }, 100)
    }, 100)
    return () => clearInterval(timer)
  }, [])
  return null
}
