/** Build grants only from server-generated persona data, never from an image request body. */
export type IncludedPersonaImage = {
  key: string
  kind: 'portrait' | 'scene'
  prompt: string | null
}

type PersonaImageSource = {
  persona: {
    age?: number
    gender?: string
    occupation?: string
    schedule?: { imagePrompt?: string }[]
    diary?: { imageScenes?: string[] }
    painPoints?: { imagePrompt?: string }[]
  }
  deepDive?: { adoptionStory?: { timeline?: { imagePrompt?: string }[] } }
  summary?: unknown
}

export const MAX_INCLUDED_PERSONA_IMAGES = 16

export function includedPersonaImages(data: PersonaImageSource): IncludedPersonaImage[] {
  if (!data?.persona || typeof data.persona !== 'object') throw new Error('Persona is required')
  const slots: IncludedPersonaImage[] = [{ key: 'portrait', kind: 'portrait', prompt: null }]
  const add = (key: string, prompt: unknown) => {
    if (typeof prompt !== 'string' || !prompt.trim()) return
    if (prompt.length > 8000) throw new Error('Persona image prompt is too long')
    slots.push({ key, kind: 'scene', prompt })
  }
  const group = (values: unknown, prefix: string, limit: number, textOnly = false) => {
    if (values == null) return
    if (!Array.isArray(values)) throw new Error('Invalid persona image source')
    let included = 0
    values.forEach((value, index) => {
      if (included >= limit) return
      const before = slots.length
      add(`${prefix}-${index}`, textOnly ? value : value?.imagePrompt)
      if (slots.length > before) included++
    })
  }
  group(data.persona.schedule, 'schedule', 3)
  group(data.persona.diary?.imageScenes, 'diary', 2, true)
  group(data.persona.painPoints, 'painpoint', 3)
  group(data.deepDive?.adoptionStory?.timeline, 'adoption', 6)
  if (data.summary) {
    const { age, gender, occupation } = data.persona
    add('summary-hero', `Professional portrait photo of a ${age}-year-old Japanese ${gender === '男性' ? 'man' : 'woman'} who works as ${occupation}, confident and professional, standing in a modern office, warm lighting, editorial magazine style`)
  }
  return slots
}

/**
 * 無料プランで付属枠として作れるシーン画像の枚数（1ペルソナあたり）。
 * 付属枠は「肖像1枚＋シーン2枚」まで。残りのシーンは追加枠（1日の上限あり）で作る。
 * 以前は1ペルソナで最大16枚を自動で作っており、無料の上限まで使うと1人月約1.5万円の原価になっていた。
 */
export const PERSONA_FREE_INCLUDED_SCENES = 2

type SlotRef = { key?: unknown; kind?: unknown }

/** 付属枠に入る画像か。有料プランは全スロット、無料プランは肖像と先頭のシーン2枚だけ。 */
export function personaSlotIncludedForPlan(slots: readonly unknown[], slotKey: string, paid: boolean): boolean {
  let scenes = 0
  for (const value of slots) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const slot = value as SlotRef
    if (slot.kind === 'scene') scenes++
    if (slot.key !== slotKey) continue
    if (paid || slot.kind === 'portrait') return true
    return slot.kind === 'scene' && scenes <= PERSONA_FREE_INCLUDED_SCENES
  }
  return false
}

export type PersonaImageIntent = 'included' | 'extra' | 'regenerate'

/** シーン画像のボタンが送る意図。画像があれば再生成、付属枠の内なら included、外なら extra。 */
export function personaSceneIntent(data: PersonaImageSource | null | undefined, sceneKey: string, hasImage: boolean, paid: boolean): PersonaImageIntent {
  if (hasImage) return 'regenerate'
  try { return data && personaSlotIncludedForPlan(includedPersonaImages(data), sceneKey, paid) ? 'included' : 'extra' }
  catch { return 'extra' }
}

/** A retry does not silently turn an included image into a paid/extra request. */
export function personaImageAllowance(intent: PersonaImageIntent, slot: IncludedPersonaImage | undefined, hasSavedImage: boolean): 'included' | 'extra' | 'cached' {
  if (intent === 'included') {
    if (!slot) throw new Error('Included image grant not found')
    return hasSavedImage ? 'cached' : 'included'
  }
  if (intent === 'regenerate') {
    if (!hasSavedImage) throw new Error('Regeneration requires an existing image')
    return 'extra'
  }
  if (intent === 'extra') return 'extra'
  throw new Error('Invalid image intent')
}
