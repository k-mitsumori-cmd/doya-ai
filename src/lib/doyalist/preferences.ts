import { AREAS, INDUSTRIES } from './constants'

export const DOYALIST_PREFERENCES_KEY = 'doyalist:settings'

export interface DoyalistPreferences {
  defaultIndustry: string
  defaultRegion: string
}

export const DEFAULT_DOYALIST_PREFERENCES: DoyalistPreferences = {
  defaultIndustry: '',
  defaultRegion: '',
}

export function readDoyalistPreferences(storage?: Pick<Storage, 'getItem'>): DoyalistPreferences {
  try {
    const raw = (storage ?? window.localStorage).getItem(DOYALIST_PREFERENCES_KEY)
    if (!raw) return { ...DEFAULT_DOYALIST_PREFERENCES }
    const value = JSON.parse(raw)
    return {
      defaultIndustry: INDUSTRIES.includes(value?.defaultIndustry) ? value.defaultIndustry : '',
      defaultRegion: AREAS.includes(value?.defaultRegion) ? value.defaultRegion : '',
    }
  } catch {
    return { ...DEFAULT_DOYALIST_PREFERENCES }
  }
}

export function saveDoyalistPreferences(storage: Pick<Storage, 'setItem'>, value: DoyalistPreferences): void {
  storage.setItem(DOYALIST_PREFERENCES_KEY, JSON.stringify(value))
}
