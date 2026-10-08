'use client'

import type { ArticleIntentScope } from './article-operation-client'

/** Private instructions live only in this browser page's memory, never in URLs or persistent storage. */
type Selection = ArticleIntentScope & {
  recipeId: string; displayFormat: 'MONOLOGUE' | 'QA'; customInstructions: string; expiresAt: number
}
const selections = new Map<string, Selection>()
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const id = /^[A-Za-z0-9_-]{1,128}$/
const MAX_SELECTIONS = 32
const TTL = 60 * 60 * 1000
export class ArticleInputError extends Error {
  constructor() {
    super('生成内容を引き継げませんでした。スキル選択に戻り、追加指示を確認してから進んでください。まだ新しい生成は開始していません。')
  }
}
function validate(scope: ArticleIntentScope, recipeId: string, displayFormat: string) {
  if (typeof window === 'undefined' || !scope || typeof scope.actorScope !== 'string' || !/^[a-f0-9]{64}$/.test(scope.actorScope)
    || typeof scope.projectId !== 'string' || !id.test(scope.projectId)
    || typeof recipeId !== 'string' || !id.test(recipeId) || !['MONOLOGUE', 'QA'].includes(displayFormat)) throw new ArticleInputError()
}
function purge(now: number) {
  for (const [key, value] of selections) if (value.expiresAt <= now) selections.delete(key)
}
export function rememberArticleInput(scope: ArticleIntentScope, recipeId: string, displayFormat: string, customInstructions: string): string {
  validate(scope, recipeId, displayFormat)
  if (typeof customInstructions !== 'string' || customInstructions.length > 20_000) throw new ArticleInputError()
  const now = Date.now(); purge(now)
  if (selections.size >= MAX_SELECTIONS) throw new ArticleInputError()
  const key = crypto.randomUUID()
  if (!uuid.test(key) || selections.has(key)) throw new ArticleInputError()
  selections.set(key, { actorScope: scope.actorScope, projectId: scope.projectId, recipeId,
    displayFormat: displayFormat as Selection['displayFormat'], customInstructions, expiresAt: now + TTL })
  return key
}
export function readArticleInput(scope: ArticleIntentScope, key: string, recipeId: string, displayFormat: string): string {
  validate(scope, recipeId, displayFormat)
  purge(Date.now())
  const value = uuid.test(key) ? selections.get(key) : undefined
  if (!value || value.actorScope !== scope.actorScope || value.projectId !== scope.projectId
    || value.recipeId !== recipeId || value.displayFormat !== displayFormat) throw new ArticleInputError()
  return value.customInstructions
}
/** Only the producing page uses this when navigation itself fails. */
export function discardArticleInput(scope: ArticleIntentScope, key: string): void {
  const value = selections.get(key)
  if (value?.actorScope === scope.actorScope && value.projectId === scope.projectId) selections.delete(key)
}
