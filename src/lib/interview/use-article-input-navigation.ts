'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getArticleActorScope, ArticleProtocolError } from './article-operation-client'
import { rememberArticleInput, discardArticleInput, ArticleInputError } from './article-input-client'

type Input = {
  projectId: string; recipeId: string; displayFormat: string; customInstructions: string
  actorId: string | null; authStatus: 'loading' | 'authenticated' | 'unauthenticated'
}
/** Selection is explicit; this performs only an owned GET and never consumes generation quota. */
export function useArticleInputNavigation(input: Input) {
  const router = useRouter()
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const context = JSON.stringify(input)
  const contextRef = useRef(context); contextRef.current = context
  const active = useRef(false), pending = useRef<AbortController | null>(null)
  useEffect(() => {
    active.current = true; setBusy(false); setError('')
    return () => { active.current = false; pending.current?.abort(); pending.current = null }
  }, [context])
  const prepareArticle = async () => {
    if (!active.current || pending.current || input.authStatus === 'loading' || !input.recipeId) return
    const controller = new AbortController(); pending.current = controller
    const current = () => active.current && contextRef.current === context && pending.current === controller && !controller.signal.aborted
    setBusy(true); setError('')
    try {
      const scope = await getArticleActorScope(input.projectId, controller.signal)
      if (!current()) return
      const selectionId = rememberArticleInput(scope, input.recipeId, input.displayFormat, input.customInstructions)
      try {
        const query = new URLSearchParams({ recipeId: input.recipeId, displayFormat: input.displayFormat, selectionId })
        router.push(`/interview/projects/${input.projectId}/generate?${query}`)
      } catch (error) { discardArticleInput(scope, selectionId); throw error }
    } catch (error) {
      if (current()) setError(error instanceof ArticleInputError || error instanceof ArticleProtocolError
        ? error.message : '生成内容を確認できませんでした。入力内容を確認し、もう一度進んでください。')
    } finally {
      if (pending.current === controller) { pending.current = null; if (active.current) setBusy(false) }
    }
  }
  return { prepareArticle, busy, error }
}
