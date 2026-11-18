import { NextResponse } from 'next/server'

/**
 * アプリ版の認証（トークン API・Bearer の置き換え・退会 API）の旗。環境変数 APP_AUTH_ENABLED が '1' のときだけオン。
 * 既定はオフ。オフのあいだは、追加した API は 404 を返し、middleware は何も変えない。
 * 本番の値はコードに書かない（環境変数で決める。三森さんの承認のあと）。
 */
export function isAppAuthEnabled(env: { APP_AUTH_ENABLED?: string | undefined } = process.env): boolean {
  return env.APP_AUTH_ENABLED === '1'
}

/** 旗がオフなら 404 の応答を返す。オンなら null（続きを処理する）。 */
export function appAuthOffResponse(env: { APP_AUTH_ENABLED?: string | undefined } = process.env): NextResponse | null {
  if (isAppAuthEnabled(env)) return null
  return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 })
}
