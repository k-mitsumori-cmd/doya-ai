export const PERSONA_BANNER_SIZES: Record<string, { width: number; height: number; label: string }> = {
  'google-responsive': { width: 1200, height: 628, label: 'Google レスポンシブ' },
  'google-square': { width: 1200, height: 1200, label: 'Google スクエア' },
  'google-landscape': { width: 1200, height: 900, label: 'Google 横長' },
  'meta-feed': { width: 1080, height: 1080, label: 'Meta フィード' },
  'meta-story': { width: 1080, height: 1920, label: 'Meta ストーリー' },
  twitter: { width: 1200, height: 675, label: 'Twitter/X' },
  youtube: { width: 1280, height: 720, label: 'YouTube サムネイル' },
  'display-leaderboard': { width: 728, height: 90, label: 'リーダーボード' },
  'display-rectangle': { width: 300, height: 250, label: 'レクタングル' },
  'display-skyscraper': { width: 160, height: 600, label: 'スカイスクレイパー' },
}

/** Reject invalid sizes instead of silently changing a requested output. */
export function resolvePersonaBannerSize(body: { sizeKey?: unknown; customWidth?: unknown; customHeight?: unknown }) {
  const { sizeKey, customWidth, customHeight } = body
  if (sizeKey != null && sizeKey !== '' && sizeKey !== 'custom') {
    if (typeof sizeKey !== 'string' || !Object.prototype.hasOwnProperty.call(PERSONA_BANNER_SIZES, sizeKey)) throw new Error('Invalid banner preset')
    return PERSONA_BANNER_SIZES[sizeKey]
  }
  if (sizeKey !== 'custom' && customWidth == null && customHeight == null) return PERSONA_BANNER_SIZES['google-responsive']
  const dimension = (value: unknown) => {
    if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) throw new Error('Invalid banner dimension')
    const number = Number(value)
    if (!Number.isSafeInteger(number) || number < 200 || number > 2048) throw new Error('Invalid banner dimension')
    return number
  }
  return { width: dimension(customWidth), height: dimension(customHeight), label: 'カスタム' }
}
