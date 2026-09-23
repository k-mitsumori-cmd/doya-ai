// Display compatibility is deliberately separate from the stricter new-generation specification.
// Old records may omit sections, but present values must be safe for React children and array methods.
type Rule = 'text' | 'scalar' | { [key: string]: Rule } | readonly [Rule]
const strings: Rule = ['text']
const shape: Rule = {
  persona: {
    name: 'text', age: 'scalar', gender: 'text', occupation: 'text', income: 'text', location: 'text',
    familyStructure: 'text', lifestyle: 'text', industry: 'text', companySize: 'text',
    challenges: strings, goals: strings, mediaUsage: strings, purchaseMotivation: strings,
    objections: strings, personalityTraits: strings, dayInLife: 'text', quote: 'text',
    painPoints: [{ point: 'text', episode: 'text', imagePrompt: 'text' }],
    alternativeMethods: [{ method: 'text', dissatisfaction: 'text' }],
    informationGathering: [{ source: 'text', behavior: 'text' }],
    triggerEvents: strings, resonatingMessages: strings, innerVoice: strings,
    schedule: [{ time: 'text', activity: 'text', detail: 'text', mood: 'text', imagePrompt: 'text' }],
    diary: { title: 'text', content: 'text', weather: 'text', imageScenes: strings },
  },
  deepDive: {
    objectionAnalysis: [{ objection: 'text', reassurance: 'text' }],
    adoptionStory: { trigger: 'text', competitors: strings, consultedPeople: 'text', trialActivities: 'text', decidingFactor: 'text', timeline: [{ phase: 'text', description: 'text', imagePrompt: 'text' }] },
    dayWithService: 'text',
  },
  summary: { oneLiner: 'text', topChallenges: [{ rank: 'scalar', challenge: 'text', episode: 'text' }], alternativesDissatisfaction: [{ alternative: 'text', dissatisfaction: 'text' }], customerJourney: [{ phase: 'text', description: 'text' }], decidingFactors: strings, catchphrases: strings, contentIdeas: [{ title: 'text', description: 'text' }] },
  creatives: { catchphrases: strings, lpStructure: { hero: 'text', problem: 'text', solution: 'text', benefits: strings, cta: 'text' }, adCopy: { google: strings, meta: strings }, emailDraft: { subject: 'text', body: 'text' } },
  marketingChecklist: [{ category: 'text', items: [{ task: 'text', priority: 'text' }] }],
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function matches(value: unknown, rule: Rule, optional = false): boolean {
  if (value == null) return optional
  if (rule === 'text') return typeof value === 'string' && value.length <= 40000
  if (rule === 'scalar') return (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.length <= 128)
  if (Array.isArray(rule)) return Array.isArray(value) && value.length <= 200 && value.every(item => matches(item, rule[0]))
  return object(value) && Object.entries(rule).every(([key, child]) => matches(value[key], child, true))
}

export function isPersonaDisplayData(value: unknown): boolean {
  if (!object(value) || !object(value.persona)) return false
  try {
    return JSON.stringify(value).length <= 1048576 && matches(value, shape)
  } catch { return false }
}

export function hasValidPersonaImages(value: { portrait?: unknown; sceneImages?: unknown }): boolean {
  if (value.portrait != null && (typeof value.portrait !== 'string' || value.portrait.length > 16777216)) return false
  return value.sceneImages == null || (object(value.sceneImages) && Object.keys(value.sceneImages).length <= 200 && Object.values(value.sceneImages).every(url => typeof url === 'string' && url.length <= 16777216))
}
