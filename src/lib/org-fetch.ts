/** 組織スコープの一覧で取得失敗を空データと取り違えないための読み込み。 */
export async function fetchOrgJson<T = Record<string, any>>(url: string): Promise<T> {
  const response = await fetch(url)
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : '組織のデータを取得できませんでした')
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('組織のデータを確認できませんでした')
  }
  return data as T
}
