export type SeoClientSettings = {
  completionPopupEnabled: boolean
}

export const SEO_CLIENT_SETTINGS_KEY = 'doyaSeo.clientSettings.v1'

export const DEFAULT_SEO_CLIENT_SETTINGS: SeoClientSettings = {
  completionPopupEnabled: true,
}

export function readSeoClientSettings(): SeoClientSettings {
  if (typeof window === 'undefined') return DEFAULT_SEO_CLIENT_SETTINGS
  try {
    const raw = window.localStorage.getItem(SEO_CLIENT_SETTINGS_KEY)
    if (!raw) return DEFAULT_SEO_CLIENT_SETTINGS
    const json = JSON.parse(raw) as Partial<SeoClientSettings>
    return {
      ...DEFAULT_SEO_CLIENT_SETTINGS,
      ...json,
      completionPopupEnabled:
        typeof json.completionPopupEnabled === 'boolean'
          ? json.completionPopupEnabled
          : DEFAULT_SEO_CLIENT_SETTINGS.completionPopupEnabled,
    }
  } catch {
    return DEFAULT_SEO_CLIENT_SETTINGS
  }
}

export function writeSeoClientSettings(next: SeoClientSettings) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SEO_CLIENT_SETTINGS_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

export function patchSeoClientSettings(patch: Partial<SeoClientSettings>) {
  const cur = readSeoClientSettings()
  const next: SeoClientSettings = { ...cur, ...patch }
  writeSeoClientSettings(next)
  return next
}


