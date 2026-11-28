import { classifyBlockedPath } from './blocked-routes'

/**
 * アプリ表示モードのとき、止める経路（料金・契約・プランの管理の画面）へのナビ項目を除く。
 * 止める経路の判定は blocked-routes.ts の1か所。アプリ表示モードでなければ、渡された配列をそのまま返す（同じ参照。見た目も動きも変わらない）。
 */
export function navForMode<T extends { href: string }>(items: readonly T[], appMode: boolean): readonly T[] {
  if (!appMode) return items
  return items.filter((item) => classifyBlockedPath(item.href) !== 'page')
}
