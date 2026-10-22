// SSR と hydrate は、同じスナップショットの時刻を日本時間で表示する。
// 無効な時刻を現在時刻で補うと初回表示が再び環境に依存するため、未取得として扱う。
const JST_OFFSET = 9 * 60 * 60 * 1000
const pad = (n: number) => String(n).padStart(2, '0')

function jstDate(iso: string, allowDateOnly = false): Date | null {
  // 時刻を含む入力はZかoffsetが必須。タイムゾーンなしの日時を環境の現地時刻で解釈しない。
  // 予定のYYYY-MM-DDは従来どおりUTCの日付として扱う。
  if (!/T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso) && !(allowDateOnly && /^\d{4}-\d{2}-\d{2}$/.test(iso))) return null
  const epoch = Date.parse(iso)
  if (!Number.isFinite(epoch)) return null
  const date = new Date(epoch + JST_OFFSET)
  return Number.isFinite(date.getTime()) ? date : null
}

export function homeJstDateKey(iso: string): string | null {
  const date = jstDate(iso, true)
  return date ? `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` : null
}

export function homeSnapshotEpoch(iso: string): number | null {
  const date = jstDate(iso)
  return date ? date.getTime() - JST_OFFSET : null
}

export function homeContractDate(iso: string | null): string | null {
  const date = iso ? jstDate(iso) : null
  return date ? `${date.getUTCFullYear()}/${date.getUTCMonth() + 1}/${date.getUTCDate()}` : null
}

export function homeSnapshotClock(iso: string) {
  const date = jstDate(iso)
  const hour = date?.getUTCHours()
  return {
    epoch: date ? date.getTime() - JST_OFFSET : null,
    today: date ? homeJstDateKey(iso) : null,
    greeting: hour == null ? 'こんにちは' : hour < 11 ? 'おはようございます' : hour < 18 ? 'こんにちは' : 'おつかれさまです',
    updated: date ? `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}` : '—',
  }
}
