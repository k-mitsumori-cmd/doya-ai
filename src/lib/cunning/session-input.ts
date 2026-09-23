import { MODES, MODE_IDS } from './modes'
import type { CunningMode } from './types'

export function parseCunningSessionInput(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid session input')
  const value = body as Record<string, unknown>
  const mode = value.mode === undefined ? 'sales' : value.mode
  if (typeof mode !== 'string' || !MODE_IDS.includes(mode as CunningMode)) throw new Error('Invalid session mode')
  function optionalText(key: string, limit: number) {
    const raw = value[key]
    if (raw === undefined || raw === null || raw === '') return null
    if (typeof raw !== 'string' || raw.length > limit) throw new Error('Invalid session field')
    return raw.trim() || null
  }
  return {
    mode: mode as CunningMode,
    title: optionalText('title', 120) || `${MODES[mode as CunningMode].label}セッション`,
    personaNote: optionalText('personaNote', 1000),
    knowledgeBaseId: optionalText('knowledgeBaseId', 128),
    companyProfileId: optionalText('companyProfileId', 128),
    applicantProfileId: optionalText('applicantProfileId', 128),
  }
}
