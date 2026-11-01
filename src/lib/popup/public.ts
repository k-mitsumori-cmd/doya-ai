// ============================================
// ドヤポップアップ: 公開API（埋め込みタグから呼ばれる口）の共通処理
// ============================================
// ⚠️ ここはログイン無しで第三者のサイトから呼ばれる。返すもの・受けるものを最小にする。
// ⚠️ 呼び出し元のホスト（Origin、無ければ Referer）が登録ドメインでなければ応答しない。
//    他のドメインに勝手に貼られたタグでは、表示もしないし数えもしない。
// ⚠️ CORS は `*` にしない。照合に通った Origin だけを返す（Vary: Origin）。
import type { NextRequest } from 'next/server'
import { hostFromHeader, hostMatchesDomain } from './schema'

/** 呼び出し元のホスト。Origin を優先し、無ければ Referer */
export function callerHost(req: NextRequest): string | null {
  return hostFromHeader(req.headers.get('origin')) || hostFromHeader(req.headers.get('referer'))
}

export function callerAllowed(req: NextRequest, domain: string): boolean {
  const host = callerHost(req)
  return !!host && hostMatchesDomain(host, domain)
}

export function corsHeaders(req: NextRequest, allowed: boolean): Record<string, string> {
  const origin = req.headers.get('origin')
  const h: Record<string, string> = { Vary: 'Origin' }
  if (allowed && origin && origin !== 'null') {
    h['Access-Control-Allow-Origin'] = origin
    h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    h['Access-Control-Allow-Headers'] = 'Content-Type'
    h['Access-Control-Max-Age'] = '86400'
  }
  return h
}

/**
 * プリフライト。どのドメインかはこの時点で分からない（本文にキーがある）ので、
 * 許可するのは形式（メソッドとヘッダ）だけ。実際の照合は本体の処理で行う。
 */
export function preflightHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin')
  return {
    Vary: 'Origin',
    ...(origin && origin !== 'null'
      ? {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        }
      : {}),
  }
}

/** 設置確認の更新間隔（これより短い間隔では lastSeenAt を書かない） */
export const SEEN_INTERVAL_MS = 10 * 60 * 1000
