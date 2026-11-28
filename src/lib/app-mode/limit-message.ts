/**
 * アプリ表示モードのとき、API が返した上限・契約のエラー文（「プロプラン契約が必要です」など）を、中立の文に差し替える。
 * アプリ表示モードでなければ、文をそのまま返す（Web のブラウザでは何も変わらない）。
 * 料金・プラン・契約・アップグレード・無料トライアル・追加購入の語を含む文だけを差し替える。含まない文（入力の誤りなど）は、アプリ表示モードでもそのまま返す。
 */
export const APP_NEUTRAL_LIMIT_MESSAGE = '上限に達しました。'
export const APP_NEUTRAL_UNAVAILABLE_MESSAGE = 'この機能はアプリではご利用になれません。'

const BILLING_WORDS = /アップグレード|プラン|料金|契約|初月無料|無料トライアル|追加購入|購入|お支払い|課金|サブスク/

export function mapLimitMessage(message: string | null | undefined, appMode: boolean, fallback: string = APP_NEUTRAL_LIMIT_MESSAGE): string {
  const text = message ?? ''
  if (!appMode) return text
  if (!text) return text
  return BILLING_WORDS.test(text) ? fallback : text
}
