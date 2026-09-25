import { z } from 'zod'

export const SwipeAnswersSchema = z.array(z.object({
  questionId: z.string().max(100).optional(),
  question: z.string().min(1).max(500),
  answer: z.enum(['yes', 'no']),
  category: z.string().max(100).optional(),
})).max(30)

export const SwipeQuestionSchema = z.object({
  sessionId: z.string().uuid(),
  answers: SwipeAnswersSchema,
})

export const SwipeLogsSchema = z.array(z.object({
  questionId: z.string().min(1).max(100),
  decision: z.enum(['yes', 'no', 'hold']),
})).max(100)
