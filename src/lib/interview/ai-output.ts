import { z } from 'zod'

const text = z.string().trim().min(1)
const score = z.number().finite().int().min(0).max(100)

const proofread = z.object({
  score,
  summary: text,
  suggestions: z.array(z.object({
    type: text,
    original: text,
    suggested: text,
    reason: text,
    severity: text,
  })).max(100).default([]),
  checks: z.record(z.boolean()).default({}),
})

const factCheck = z.object({
  reliability: score,
  summary: text,
  claims: z.array(z.object({
    text,
    category: text,
    // The model only sees the article. It cannot verify an external fact.
    status: z.enum(['verified', 'suspicious', 'error', 'unverifiable'])
      .transform((status) => status === 'verified' ? 'unverifiable' : status),
    detail: text,
    severity: text,
  })).max(100).default([]),
  warnings: z.array(z.string()).max(100).default([]),
})

const titles = z.array(z.object({
  title: text,
  type: text,
  reason: text,
})).min(1).max(10)

const snsPosts = z.object({
  posts: z.array(z.object({
    platform: text,
    content: text,
    hashtags: z.array(z.string()).max(30).default([]),
    tip: z.string().default(''),
  })).min(1).max(12),
})

const translation = z.object({
  title: text,
  content: text,
  seoTitle: z.string().default(''),
  seoDescription: z.string().default(''),
})

function parseJson(rawText: unknown): unknown {
  if (typeof rawText !== 'string') return null
  const trimmed = rawText.trim()
  if (!trimmed) return null
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(withoutFence)
  } catch {
    const first = withoutFence.search(/[\[{]/)
    const last = Math.max(withoutFence.lastIndexOf(']'), withoutFence.lastIndexOf('}'))
    if (first < 0 || last <= first) return null
    try {
      return JSON.parse(withoutFence.slice(first, last + 1))
    } catch {
      return null
    }
  }
}

function parseOutput<T extends z.ZodTypeAny>(rawText: unknown, schema: T): z.infer<T> | null {
  const result = schema.safeParse(parseJson(rawText))
  return result.success ? result.data : null
}

export const parseProofreadOutput = (rawText: unknown) => parseOutput(rawText, proofread)
export const parseFactCheckOutput = (rawText: unknown) => parseOutput(rawText, factCheck)
export const parseTitleOutput = (rawText: unknown) => parseOutput(rawText, titles)
export const parseSnsOutput = (rawText: unknown) => parseOutput(rawText, snsPosts)
export const parseTranslationOutput = (rawText: unknown) => parseOutput(rawText, translation)
