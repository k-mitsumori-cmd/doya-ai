// 組織を選ぶ前の画面（入口の「はじめに」と料金）か。組織の下・招待・見本は違う。
// ShellEntryFrame.tsx が使う（テストで読めるよう、画面の部品とは別のファイルにしている）
export function isEntryPath(serviceId: string, pathname: string): boolean {
  const base = `/${serviceId}`
  if (pathname !== base && !pathname.startsWith(`${base}/`)) return false
  const seg = pathname.slice(base.length).split('/')[1] || ''
  return seg === '' || seg === 'pricing'
}
