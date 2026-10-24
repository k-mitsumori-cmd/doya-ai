'use client'

// ============================================
// ドヤ社内インタビュー: 画面の状態の見本の土台（開発時だけ）
// ============================================
// - window.fetch を差し替え、/api/shanai/* に見本データ（または状態ごとの失敗）を返す
// ⚠️ 差し替えは最初の描画の前（useState の初期化）に行う。子の画面の読み込み（useEffect）より先に効く
// ⚠️ /api/shanai/ 以外の通信は、そのまま本物の fetch に渡す
import { useState, type ReactNode } from 'react'
import { ActionError, Button, Card, describeError, SectionTitle } from '@/components/shanai/ui'
import { COMPANY, COMPANY_EMPTY, DETAIL_READY, DETAIL_SURVEY, DETAIL_VOICE, LIMIT_BODY, ROWS } from './fixtures'

type Reply = { status: number; body: unknown } | 'hang'

// 画面の中で ?s= を切り替えても効くように、いまの状態はモジュールに持つ
let current = 'home'
let installed = false

const ok = (body: unknown): Reply => ({ status: 200, body: { success: true, ...(body as object) } })
const fail = (status: number, error: string, extra: object = {}): Reply => ({ status, body: { error, ...extra } })

function reply(state: string, path: string, method: string): Reply {
  const isList = path === '/api/shanai/interviews'
  const isCompany = path === '/api/shanai/company'
  const detail = /^\/api\/shanai\/interviews\/[^/]+$/.test(path)

  if (state === 'loading') return 'hang'
  // 一覧の読み込み失敗（生の文が画面に出ないことを確かめるため、技術的な文を返す）
  if (state === 'error' && (isList || isCompany) && method === 'GET') return fail(500, 'PrismaClientKnownRequestError: connection timeout')
  if (state === 'detail-error' && detail && method === 'GET') return fail(500, 'Internal Server Error')
  if (state === 'forbidden' && detail) return fail(403, 'Forbidden')
  if (state === 'company-error' && isCompany && method === 'GET') return fail(503, 'upstream unavailable')
  // 上限: 記事を作る・事実を抽出する・文字起こしを押すと 429（料金プランへの道が出る）
  if (state === 'detail-limit' && method === 'POST' && /\/(article|facts|transcribe)$/.test(path)) return { status: 429, body: LIMIT_BODY }
  // 作成の失敗（作成して次へ を押すと 500）
  if (state === 'new-error' && isList && method === 'POST') return fail(500, 'TypeError: Cannot read properties of undefined')

  if (isList && method === 'GET') return ok({ interviews: state === 'empty' || state === 'home-empty' ? [] : ROWS })
  if (isList && method === 'POST') return ok({ id: 'sample1' })
  if (isCompany && method === 'GET') return ok({ company: state === 'empty' || state === 'home-empty' ? null : state === 'company-empty' ? COMPANY_EMPTY : COMPANY })
  if (isCompany) return ok({ company: state === 'company-empty' ? COMPANY_EMPTY : COMPANY })
  if (detail && method === 'GET') {
    const d = state === 'detail-survey' ? DETAIL_SURVEY : state === 'detail-limit' ? DETAIL_READY : DETAIL_VOICE
    return ok({ interview: d })
  }
  return ok({ interview: DETAIL_VOICE })
}

function install() {
  if (installed || typeof window === 'undefined') return
  installed = true
  const original = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(raw, window.location.origin)
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/shanai/')) return original(input, init)
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const r = reply(current, url.pathname, method)
    if (r === 'hang') return new Promise<Response>(() => {})
    // 本物らしく少し待つ（300ms 未満だと骨組みが出ない）
    await new Promise((res) => setTimeout(res, 400))
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } })
  }
}

export default function DevRoot({ state, children }: { state: string; children: ReactNode }) {
  current = state
  useState(() => {
    install()
    return null
  })
  return <>{children}</>
}

/** 上限に達したときの見本（詳細の「④ 記事」に出る形。押さなくても見えるように、失敗を最初から出す） */
export function LimitPreview() {
  return (
    <Card>
      <SectionTitle step="ステップ4" title="記事" desc="チェックを入れた事実だけを使って記事を書きます。会社の事実は、ご本人の仕事とつなげて紹介します。" />
      <Button>記事を作る</Button>
      <div className="mt-3">
        <ActionError error={describeError({ status: 429, data: LIMIT_BODY })} />
      </div>
    </Card>
  )
}
