/**
 * 「ログイン中の端末」の画面の文言と並べ方（純粋関数。React に依存しない）。
 * 画面: src/app/(shell)/settings/devices/page.tsx
 */

export type DeviceItem = {
  id: string
  deviceLabel: string | null
  platform: string
  lastUsedAt: string
  createdAt: string
  isCurrent: boolean
}

export function platformLabel(platform: string): string {
  return platform === 'ios' ? 'iPhone・iPad' : platform === 'android' ? 'Android' : 'アプリ'
}

/** 端末の名前。未設定のときは、種類の名前にする */
export function deviceName(d: Pick<DeviceItem, 'deviceLabel' | 'platform'>): string {
  const label = (d.deviceLabel ?? '').trim()
  return label || platformLabel(d.platform)
}

/** 「最後に使った日時」の文。1分未満・時間・日の順に、相対で出す。日付は日本時間 */
export function lastUsedText(iso: string, now: Date): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return '最後に使った日時は不明です'
  const diff = Math.max(0, now.getTime() - t)
  const min = Math.floor(diff / 60_000)
  if (min < 1) return '最後に使ったのは、たったいまです'
  if (min < 60) return `最後に使ったのは、${min}分前です`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `最後に使ったのは、${hours}時間前です`
  const date = new Date(t).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric' })
  return `最後に使ったのは、${date}です`
}

/** いまの端末を先頭に、残りは最後に使った日時の新しい順 */
export function sortDevices<T extends Pick<DeviceItem, 'isCurrent' | 'lastUsedAt'>>(list: T[]): T[] {
  return [...list].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime())
}

/** 失効の確認の文 */
export function revokeConfirmText(d: Pick<DeviceItem, 'deviceLabel' | 'platform' | 'isCurrent'>): string {
  const name = deviceName(d)
  return d.isCurrent
    ? `いまお使いの端末（${name}）からログアウトします。よろしいですか。`
    : `${name}からログアウトします。この端末では、もう一度ログインが必要になります。よろしいですか。`
}

/** API のエラーコードから、画面に出す文 */
export function revokeErrorText(status: number, code?: string): string {
  if (status === 401) return 'ログインの有効期限が切れています。もう一度ログインしてください。'
  if (status === 404 || code === 'NOT_FOUND') return 'この端末はすでにログアウトされています。一覧を更新しました。'
  return 'ログアウトできませんでした。しばらくしてからもう一度お試しください。'
}
