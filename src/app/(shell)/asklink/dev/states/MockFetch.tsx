'use client'
// ============================================
// ドヤAI質問リンク 状態の見本: /api/asklink/* の見本の返事（開発時だけ）
// ============================================
// ⚠️ DB・ログイン・AI には触れない。window.fetch を差し替えて、見本データか失敗の状態を返す。
// ⚠️ 子の部品が描かれる前に差し替える（モジュールの読み込み時に1回だけ。状態は描画のたびに更新する）
import { useEffect, useState, type ReactNode } from 'react'
import { buildLink } from '@/lib/asklink/link'
import type { RunDto } from '@/lib/asklink/dto'

const ALLOWED = ['https://mihon.example.jp/', 'https://mihon.example.jp/contact', 'https://mihon.example.jp/price']

function sampleRun(): RunDto {
  return {
    id: 'sample1',
    sourceUrl: 'https://mihon.example.jp/',
    source: 'site',
    audience: 'b2b',
    detectedAudience: 'b2b',
    site: {
      name: '見本 株式会社｜クラウド勤怠管理「ミホンタイム」',
      summary: '中小企業向けのクラウド勤怠管理サービス。打刻・残業の集計・有給の管理をまとめて行えます。',
      strengths: ['初期費用なし', 'スマホで打刻', '導入時の設定を代行'],
      target: '従業員10〜300名の企業の人事・総務担当',
      contactUrl: 'https://mihon.example.jp/contact',
      downloadUrl: null,
      pricingUrl: 'https://mihon.example.jp/price',
      pages: [
        { label: '機能一覧', url: 'https://mihon.example.jp/features' },
        { label: '導入事例', url: 'https://mihon.example.jp/cases' },
      ],
      colors: ['#0066ff'],
    },
    allowedUrls: ALLOWED,
    links: [
      buildLink('understand', 'サービスを知る', 'ミホンタイムで何ができる？',
        '見本 株式会社のクラウド勤怠管理「ミホンタイム」について教えてください。https://mihon.example.jp/ を参考に、どんな会社に向いているか、何ができるかを、人事担当の目線で分かりやすく説明してください。', ALLOWED),
      buildLink('prepare', '相談の準備をする', '無料相談の前に整理する',
        '勤怠管理の見直しを考えています。見本 株式会社の無料相談（https://mihon.example.jp/contact）の前に、自社の状況として整理しておくとよい点を、質問形式で一緒に洗い出してください。', ALLOWED),
    ],
    bannerCopy: { headline: '勤怠のこと、AIに聞いてみる', sub: 'ミホンタイムの使い方を、その場で相談', bubbles: ['料金は？', '導入期間は？', 'スマホで打刻できる？'] },
    banners: [
      { kind: 'landscape', label: '横長', use: 'PCの中央ポップアップ', w: 1200, h: 672, status: 'done', url: '/asklink/sample-landscape.webp', verify: { ok: true, needsReview: false, missing: [] }, remaining: 1 },
      { kind: 'square', label: '正方形', use: 'スライドイン・SNS兼用', w: 1088, h: 1088, status: 'done', url: '/asklink/sample-square.webp', verify: { ok: false, needsReview: true, missing: ['AIに聞く'] }, remaining: 1 },
      { kind: 'portrait', label: '縦長', use: 'スマホのポップアップ', w: 1152, h: 1536, status: 'none', url: null, verify: null, remaining: 2 },
    ],
    createdAt: '2026-10-18T09:30:00.000Z',
  }
}

const ROWS = [
  { id: 'sample1', sourceUrl: 'https://mihon.example.jp/', audience: 'b2b', name: '見本 株式会社｜クラウド勤怠管理「ミホンタイム」', bannersDone: 2, createdAt: '2026-10-18T09:30:00.000Z' },
  { id: 'sample2', sourceUrl: 'https://mihon-hanako.example.jp/lessons/online/very-long-path-for-375px-check', audience: 'b2c', name: '見本 花子のオンライン料理教室', bannersDone: 3, createdAt: '2026-10-12T02:10:00.000Z' },
]

let state = 'home'
const realFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : null

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
}

// 失敗の状態（一覧・詳細・作成で共通）
function failure(): Promise<Response> | null {
  switch (state) {
    case 'error': return json({ error: 'PrismaClientKnownRequestError: (技術的な文言。画面には出さない)' }, 500)
    case 'forbidden': return json({ error: 'Forbidden' }, 403)
    case 'loading': return new Promise<Response>(() => {})
    default: return null
  }
}

if (typeof window !== 'undefined' && realFetch) {
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    const method = (init?.method || 'GET').toUpperCase()
    if (!path.startsWith('/api/asklink/')) return realFetch(input, init)

    // 作成（Tool の「作成する」）
    if (path === '/api/asklink/runs' && method === 'POST') {
      if (state === 'limit') return json({ error: '今月の上限（5回）に達しました。', limitReached: true, used: 5, limit: 5, upgradeUrl: '/asklink/pricing' }, 429)
      if (state === 'unreadable') return json({ error: 'fetch failed: ECONNREFUSED', code: 'WEBSITE_UNREADABLE', canUseManualInput: true }, 422)
      if (state === 'create-error') return json({ error: 'Gemini 503 UNAVAILABLE' }, 500)
      return json({ run: sampleRun() })
    }
    // 一覧
    if (path === '/api/asklink/runs') {
      return failure() ?? json({ runs: state === 'empty' ? [] : ROWS })
    }
    // バナーの作成（見本では作り直しの上限）
    if (/\/banners\/[a-z]+$/.test(path)) {
      return json({ error: 'このバナーを作り直せる回数の上限に達しました。', run: sampleRun() }, 429)
    }
    // ToB / ToC の切り替え（見本では失敗にする）
    if (path.endsWith('/links')) return json({ error: 'internal error' }, 500)
    // 詳細・保存
    if (state === 'notfound') return json({ error: '見つかりません。' }, 404)
    if (method === 'PATCH') return json({ run: sampleRun() })
    return failure() ?? json({ run: sampleRun() })
  }
}

/**
 * 見本の状態を fetch の差し替えに伝える（描画のたびに更新）。新しい見た目も強制する。
 */
export default function MockFetch({ s, children }: { s: string; children: ReactNode }) {
  state = s
  // useState の初期化で、子より先に状態を確定させる（初回の描画）
  useState(() => {
    state = s
    return null
  })
  return <>{children}</>
}

/**
 * 作成画面の失敗（上限・読み取れない・作成の失敗）を見せるため、URLを入れて「作成する」を押す。
 * ⚠️ 見本の画面だけで使う。本番の画面の動きは変えない
 */
export function AutoSubmit({ url = 'https://mihon.example.jp/' }: { url?: string }) {
  useEffect(() => {
    const t = setTimeout(() => {
      const input = document.getElementById('asklink-url') as HTMLInputElement | null
      if (!input) return
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, url)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      setTimeout(() => input.form?.requestSubmit(), 50)
    }, 100)
    return () => clearTimeout(t)
  }, [url])
  return null
}
