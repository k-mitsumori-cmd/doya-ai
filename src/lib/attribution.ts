// ============================================
// ユーザー獲得アトリビューション
// GoogleAnalytics.tsx がCookieに記録した「最後に見ていたサービス」と
// 「初回流入元」を、NextAuthのログイン/登録処理から読み取るためのユーティリティ。
// Slack通知（ログイン・新規登録・日次レポート）で使用する。
// ============================================

import { getServiceById } from './services'

// Cookie名（クライアント側 GoogleAnalytics.tsx と対で管理）
export const ATTR_COOKIE = 'doya_attr' // 初回流入元 {r: referrer, l: landing, s: utm_source, m: utm_medium}
export const LAST_SVC_COOKIE = 'doya_last_svc' // 最後に閲覧したサービスのパスセグメント

export interface Attribution {
  service: string | null // パスセグメント（banner, seo, portal...）
  serviceLabel: string // 表示名（ドヤバナーAI 等）
  source: string // 流入経路の表示文字列
}

// リクエストスコープのCookieからアトリビューションを解決する。
// next/headers はリクエスト外で呼ぶと throw するため動的importにし、失敗時は不明扱い。
export async function readAttributionFromCookies(): Promise<Attribution> {
  let service: string | null = null
  let source = '不明'
  try {
    const { cookies } = await import('next/headers')
    const jar = cookies()

    const svc = jar.get(LAST_SVC_COOKIE)?.value || null
    service = svc && /^[a-z0-9_-]{1,32}$/.test(svc) ? svc : null

    const attrRaw = jar.get(ATTR_COOKIE)?.value
    if (attrRaw) {
      const attr = JSON.parse(decodeURIComponent(attrRaw)) as {
        r?: string; l?: string; s?: string; m?: string
      }
      source = classifySource(attr.r || '', attr.s || '', attr.m || '', attr.l || '')
    }
  } catch {
    // Cookie未設定・リクエスト外・パース失敗 → 不明のまま
  }
  return { service, serviceLabel: serviceLabelOf(service), source }
}

// パスセグメント → サービス表示名
export function serviceLabelOf(seg: string | null): string {
  if (!seg) return '不明'
  if (seg === 'portal' || seg === '') return 'ポータル（トップ）'
  const svc = getServiceById(seg)
  if (svc) return svc.name
  // services.ts に無い独立ルート
  const extra: Record<string, string> = {
    cunning: 'ドヤカンニング',
    doyaslide: 'ドヤスライド',
    doyalist: 'ドヤリスト',
    sfa: 'ドヤ営業管理',
    promane: 'ドヤプロマネ',
    aio: 'ドヤAIO',
    adbanner: 'ドヤ広告バナーAI',
    shodan: 'ドヤ商談準備',
    auth: 'ログインページ',
  }
  return extra[seg] || seg
}

// リファラ/UTMから流入経路の表示文字列を作る
export function classifySource(referrer: string, utmSource: string, utmMedium: string, landing: string): string {
  const lp = landing ? `（LP: ${truncatePath(landing)}）` : ''
  if (utmSource) {
    return `${utmSource}${utmMedium ? `/${utmMedium}` : ''}${lp}`
  }
  if (!referrer) return `直接アクセス${lp}`
  try {
    const host = new URL(referrer).hostname
    if (/google\.|bing\.com|search\.yahoo/.test(host)) return `検索エンジン（${host}）${lp}`
    if (host === 'doyamarke.surisuta.jp') return `ドヤマーケ記事${lp}`
    if (/(^|\.)t\.co$|twitter\.com|x\.com/.test(host)) return `X（Twitter）${lp}`
    if (/chatgpt\.com|openai\.com|perplexity\.ai|gemini\.google/.test(host)) return `AIアシスタント（${host}）${lp}`
    if (host.endsWith('surisuta.jp') || host.includes('doya')) return `自社サイト（${host}）${lp}`
    return `参照元: ${host}${lp}`
  } catch {
    return `参照元: ${referrer.slice(0, 60)}${lp}`
  }
}

function truncatePath(p: string): string {
  return p.length > 40 ? p.slice(0, 40) + '…' : p
}
