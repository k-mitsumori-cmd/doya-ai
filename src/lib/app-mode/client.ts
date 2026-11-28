'use client'
import { useSyncExternalStore } from 'react'
import { decideAppModeClient } from './detect'

/**
 * クライアント側の旗。process.env.NEXT_PUBLIC_… の書き方（リテラル）でないと、Next.js が値を埋めない。
 * next.config.js が APP_MODE_ENABLED から写す。
 */
const CLIENT_FLAG_ENABLED = process.env.NEXT_PUBLIC_APP_MODE_ENABLED === '1'

/** ブラウザで、いまアプリ表示モードか（同期）。サーバーでは false。 */
export function isAppModeClient(): boolean {
  if (typeof window === 'undefined') return false
  return decideAppModeClient({
    enabled: CLIENT_FLAG_ENABLED,
    userAgent: window.navigator?.userAgent,
    cookie: typeof document !== 'undefined' ? document.cookie : '',
  })
}

const subscribe = () => () => {}

/**
 * アプリ表示モードか。課金の導線と計測を出すかどうかは、これで決める。
 * - 旗オフ: 常に false（サーバーの描画も、ブラウザの描画も、導入前と同じ）。
 * - 旗オン: サーバーの描画と、ブラウザの最初の描画は true（「アプリかもしれない」側）。
 *   ブラウザでは、最初の描画のあとすぐ実際の判定（同期の読み取り）に切り替わる。課金の導線は、判定が終わるまで出ない。
 */
export function useAppMode(): boolean {
  return useSyncExternalStore(subscribe, isAppModeClient, () => CLIENT_FLAG_ENABLED)
}
