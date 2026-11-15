'use client'

import { useEffect, useRef } from 'react'

type ReadScope = () => Promise<string>

export class SubmitOnceFormScopeError extends Error {}

const INITIAL_SCOPE_ERROR = 'フォームを開いたときのログイン情報を確認できませんでした。入力を控えてから、この画面を開き直してください。'
const CHANGED_SCOPE_ERROR = 'フォームを開いたときのログイン情報または組織が変わりました。内容は送信していません。'

export function useOnceFormScope(readScope: ReadScope, enabled = true): ReadScope {
  const openingReader = useRef(readScope)
  const openingScope = useRef<Promise<string | null> | null>(null)

  useEffect(() => {
    if (!enabled || openingScope.current) return
    openingScope.current = Promise.resolve()
      .then(openingReader.current)
      .then((scope) => /^[a-f0-9]{64}$/.test(scope) ? scope : null, () => null)
  }, [enabled])

  return async () => {
    const expected = await openingScope.current
    if (!expected) throw new SubmitOnceFormScopeError(INITIAL_SCOPE_ERROR)
    const actual = await readScope()
    if (actual !== expected) throw new SubmitOnceFormScopeError(CHANGED_SCOPE_ERROR)
    return actual
  }
}
