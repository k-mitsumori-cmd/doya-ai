import { z } from 'zod'

export const SeoToneSchema = z.enum(['丁寧', 'フランク', 'ビジネス', '専門的'])

export const SeoLlmoOptionsSchema = z.object({
  tldr: z.boolean().default(true),
  conclusionFirst: z.boolean().default(true),
  faq: z.boolean().default(true),
  glossary: z.boolean().default(true),
  comparison: z.boolean().default(true),
  quotes: z.boolean().default(true),
  templates: z.boolean().default(true),
  objections: z.boolean().default(true),
})

export type SeoLlmoOptions = z.infer<typeof SeoLlmoOptionsSchema>

export const SeoCreateArticleInputSchema = z.object({
  title: z.string().min(1).max(200),
  keywords: z.array(z.string().min(1).max(100)).min(1).max(10),
  persona: z.string().max(5000).optional().default(''),
  searchIntent: z.string().max(5000).optional().default(''),
  targetChars: z.number().int().min(1000).max(60000),
  referenceUrls: z.array(z.string().url()).max(20).optional().default([]),
  tone: SeoToneSchema.default('丁寧'),
  forbidden: z.array(z.string().min(1).max(200)).max(50).optional().default([]),
  llmoOptions: SeoLlmoOptionsSchema.optional(),
})

export type SeoCreateArticleInput = z.infer<typeof SeoCreateArticleInputSchema>

export const SeoOutlineSchema = z.object({
  sections: z.array(
    z.object({
      h2: z.string().min(1),
      intentTag: z.string().min(1).optional().default(''),
      plannedChars: z.number().int().min(800).max(3500).optional().default(2000),
      h3: z.array(z.string().min(1)).optional().default([]),
      h4: z.record(z.array(z.string().min(1))).optional().default({}), // h3 -> h4[]
    })
  ).min(3),
  internalLinkIdeas: z.array(z.string()).optional().default([]),
  faq: z.array(z.string()).optional().default([]),
  glossary: z.array(z.string()).optional().default([]),
  diagramIdeas: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        insertionHint: z.string().optional().default(''),
      })
    )
    .optional()
    .default([]),
})

export type SeoOutline = z.infer<typeof SeoOutlineSchema>


