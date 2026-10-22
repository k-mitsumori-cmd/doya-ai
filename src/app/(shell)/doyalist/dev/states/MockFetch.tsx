'use client'
// ============================================
// ドヤリスト: 画面の状態の見本で使う、偽の API（開発時だけ）
// ============================================
// ⚠️ DB・ログイン・gBizINFO・AI には一切触れない。window.fetch を、子が描かれる前に差し替えて見本の JSON を返す。
//    ここに無い URL は、本物の fetch にそのまま渡す。
// ⚠️ 見本のデータは架空のもの（見本 株式会社・見本 花子）だけを使う。
import { useState, type ReactNode } from 'react'
import { SessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'
import { UiNextContext } from '@/components/shell/ui-next-context'

/** 状態ごとの、API の返し方 */
export type MockMode = 'ok' | 'empty' | 'error' | 'forbidden' | 'limit' | 'login'

const SESSION: Session = {
  user: { id: 'preview-user', name: '見本 太郎', email: 'sample@example.com', image: null } as Session['user'],
  expires: '2099-01-01T00:00:00.000Z',
}

const LISTS = [
  { id: 'list1', name: 'IT・ソフトウェア_関東_10/18 10:00', industry: 'IT・ソフトウェア', region: '関東', companyCount: 500, updatedAt: '2026-10-18T01:00:00.000Z', createdAt: '2026-10-18T01:00:00.000Z' },
  { id: 'list2', name: '製造_近畿_10/12 15:30', industry: '製造', region: '近畿', companyCount: 100, updatedAt: '2026-10-12T06:30:00.000Z', createdAt: '2026-10-12T06:30:00.000Z' },
]
const APPROACHES = [
  { id: 'appr1', type: 'form', subject: '業務効率化のご提案（見本 株式会社）', body: '見本 株式会社\nご担当者様\n\n突然のご連絡失礼いたします。見本 花子と申します。\n営業リストの作成にかかる時間を、半分にするご提案です。', status: 'done', createdAt: '2026-10-17T02:00:00.000Z' },
  { id: 'appr2', type: 'email', subject: '【ご相談】新規開拓の進め方について', body: '件名: 【ご相談】新規開拓の進め方について\n\n見本 株式会社 ご担当者様\n\nいつもお世話になっております。', status: 'done', createdAt: '2026-10-15T05:00:00.000Z' },
]

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function failure(mode: MockMode): Response | null {
  if (mode === 'error') return json({ error: 'Internal Server Error: prisma timeout' }, 500)
  if (mode === 'forbidden') return json({ error: 'Forbidden' }, 403)
  if (mode === 'limit') return json({ error: 'Too Many Requests' }, 429)
  if (mode === 'login') return json({ error: 'Unauthorized' }, 401)
  return null
}

function usage(mode: MockMode) {
  // limit のときは今月の枠を使い切った形にする
  const approachesUsed = mode === 'limit' ? 30 : 4
  return {
    success: true,
    plan: { tier: 'FREE', raw: 'FREE', periodEnd: null },
    limits: { maxProjects: 10, maxCompaniesPerMonth: 1000, maxApproachesPerMonth: 30 },
    usage: { monthStart: '2026-10-01T00:00:00.000Z', activeProjects: 2, companiesGenerated: mode === 'limit' ? 1000 : 600, approachesGenerated: approachesUsed },
    remaining: { projects: 8, companies: mode === 'limit' ? 0 : 400, approaches: 30 - approachesUsed },
  }
}

function respond(url: URL, mode: MockMode): Response | null {
  const path = url.pathname
  if (path === '/api/auth/session') return json(SESSION)
  if (!path.startsWith('/api/doyalist/')) return null
  if (path === '/api/doyalist/estimate') return json({ success: true, estimated: 1240, isApprox: false, note: '' })
  if (path === '/api/doyalist/usage') {
    // 利用枠は、limit のときも読み込み自体は成功させる（上限の表示を見るため）
    if (mode === 'limit') return json(usage(mode))
    return failure(mode) ?? json(usage(mode))
  }
  if (path === '/api/doyalist/projects') {
    const fail = failure(mode)
    if (fail) return fail
    const rows = mode === 'empty' || url.searchParams.get('search') ? [] : LISTS
    return json({ projects: rows, total: rows.length, nextCursor: null, summary: { allTotal: rows.length, thisMonth: rows.length, totalCompanies: rows.reduce((n, r) => n + r.companyCount, 0) } })
  }
  if (path === '/api/doyalist/approaches') {
    const fail = failure(mode)
    if (fail) return fail
    const type = url.searchParams.get('type')
    const all = mode === 'empty' || url.searchParams.get('search') ? [] : APPROACHES
    const rows = type ? all.filter((a) => a.type === type) : all
    const countsByType = { form: all.filter((a) => a.type === 'form').length, email: all.filter((a) => a.type === 'email').length }
    return json({ approaches: rows, total: rows.length, nextCursor: null, summary: { allTotal: all.length, thisMonth: all.length, countsByType } })
  }
  return json({ error: 'not mocked' }, 404)
}

let installed: { mode: MockMode } | null = null

function install(mode: MockMode) {
  if (typeof window === 'undefined') return
  if (installed) { installed.mode = mode; return }
  const state = { mode }
  installed = state
  const real = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(raw, window.location.origin)
    if (url.origin === window.location.origin) {
      const mocked = respond(url, state.mode)
      if (mocked) {
        // 読み込み中の表示が一瞬見えるよう、少しだけ待つ
        await new Promise((r) => setTimeout(r, 150))
        return mocked
      }
    }
    return real(input, init)
  }
}

export default function MockFetch({ mode, children }: { mode: MockMode; children: ReactNode }) {
  // 子の useEffect（最初の fetch）より前に差し替える
  useState(() => { install(mode); return null })
  // 新しい見た目で描く（サーバーの部品からは、クライアントの context の .Provider に触れないため、ここで包む）
  return (
    <UiNextContext.Provider value="all">
      <SessionProvider session={SESSION} refetchOnWindowFocus={false}>
        {children}
      </SessionProvider>
    </UiNextContext.Provider>
  )
}
