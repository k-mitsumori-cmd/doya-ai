// ============================================
// E2E で開く「ログインなしで開ける画面」の一覧
// ============================================
// サービスの LP は src/lib/services.ts の getPublicServices()（トップ・sitemap と同じ）から作る。
// ここにベタ書きしないので、公開するサービスが増減しても E2E がずれない。
// ⚠️ getPublicServices() は「提供終了・開発中」を除いた、未ログインの人の目に触れる一覧。
import { getPublicServices } from '../../src/lib/services'

export type PublicRoute = { path: string; label: string }

export const PUBLIC_ROUTES: PublicRoute[] = [
  { path: '/', label: 'トップ' },
  ...getPublicServices().map((s) => ({ path: s.href, label: `${s.name}（LP）` })),
  { path: '/pricing', label: '料金' },
]

/** 画面の切り替えを確かめる組み合わせ（ログインなしの LP の間） */
export function transitionPairs(): Array<[string, string]> {
  const lps = PUBLIC_ROUTES.filter((r) => r.path !== '/' && r.path !== '/pricing').map((r) => r.path)
  const [a, b] = lps
  return [
    ['/', a],
    [a, b],
    [b, '/pricing'],
    ['/pricing', '/'],
  ]
}

/** ファイル名に使える形にする（/ → top、/banner → banner） */
export function slug(path: string): string {
  return path === '/' ? 'top' : path.replace(/^\//, '').replace(/[^a-zA-Z0-9_-]+/g, '_')
}
