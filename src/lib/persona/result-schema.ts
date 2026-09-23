import { z } from 'zod'

const text = z.string().trim().min(1).max(8000)
const label = z.string().trim().min(1).max(1000)
const texts = z.array(text).min(1).max(40)
const scene = z.object({ time: label, activity: text, detail: text, mood: label, imagePrompt: text.optional() })

/** Match the generated deliverable and its renderable fields; never fill missing content with invented defaults. */
export const personaResultSchema = z.object({
  persona: z.object({
    name: label, age: z.number().int().min(0).max(120), gender: label, occupation: label,
    income: label, location: label, familyStructure: text, lifestyle: text,
    // These fields are optional in the UI and may not apply to consumer personas.
    industry: z.string().max(1000).optional(), companySize: z.string().max(1000).optional(),
    challenges: texts, goals: texts, mediaUsage: texts, purchaseMotivation: texts, objections: texts,
    personalityTraits: texts, dayInLife: text, quote: text,
    painPoints: z.array(z.object({ point: text, episode: text, imagePrompt: text.optional() })).min(5).max(40),
    alternativeMethods: z.array(z.object({ method: text, dissatisfaction: text })).min(3).max(40),
    informationGathering: z.array(z.object({ source: label, behavior: text })).min(4).max(40),
    triggerEvents: texts.min(3), resonatingMessages: texts.min(5), innerVoice: texts.min(5),
    schedule: z.array(scene).min(8).max(10),
    diary: z.object({ title: label, content: text, weather: label, imageScenes: z.array(text).length(2) }),
  }),
  deepDive: z.object({
    objectionAnalysis: z.array(z.object({ objection: text, reassurance: text })).length(10),
    adoptionStory: z.object({
      trigger: text, competitors: texts, consultedPeople: text, trialActivities: text, decidingFactor: text,
      timeline: z.array(z.object({ phase: label, description: text, imagePrompt: text })).length(6),
    }),
    dayWithService: text,
  }),
  summary: z.object({
    oneLiner: text,
    topChallenges: z.array(z.object({ rank: z.number().int().min(1).max(3), challenge: text, episode: text })).length(3),
    alternativesDissatisfaction: z.array(z.object({ alternative: text, dissatisfaction: text })).min(1).max(40),
    customerJourney: z.array(z.object({ phase: label, description: text })).length(4),
    decidingFactors: texts, catchphrases: z.array(text).length(5),
    contentIdeas: z.array(z.object({ title: label, description: text })).length(3),
  }),
  creatives: z.object({
    catchphrases: texts,
    lpStructure: z.object({ hero: text, problem: text, solution: text, benefits: texts, cta: text }),
    adCopy: z.object({ google: texts, meta: texts }), emailDraft: z.object({ subject: label, body: text }),
  }),
  marketingChecklist: z.array(z.object({ category: label, items: z.array(z.object({ task: text, priority: z.enum(['high', 'medium', 'low']) })).min(1).max(40) })).min(1).max(40),
}).superRefine((result, context) => {
  if (result.persona.schedule.filter(item => item.imagePrompt).length !== 3 || result.persona.painPoints.slice(0, 3).some(item => !item.imagePrompt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Missing required image prompts' })
  }
  if (result.summary.topChallenges.some((item, index) => item.rank !== index + 1)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid challenge ranking' })
  }
})

export type PersonaResult = z.infer<typeof personaResultSchema>
export class PersonaResultValidationError extends Error {
  constructor() { super('Invalid persona result'); this.name = 'PersonaResultValidationError' }
}

export function parsePersonaResult(value: unknown): PersonaResult {
  // Limit the complete output, including unknown fields, before traversing its individual fields.
  let serialized: string | undefined
  try { serialized = JSON.stringify(value) } catch { throw new PersonaResultValidationError() }
  if (!serialized || serialized.length > 262144) throw new PersonaResultValidationError()
  const parsed = personaResultSchema.safeParse(value)
  if (!parsed.success) throw new PersonaResultValidationError()
  return parsed.data
}
