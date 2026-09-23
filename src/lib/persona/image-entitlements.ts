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

export type PersonaImageIntent = 'included' | 'extra' | 'regenerate'

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
