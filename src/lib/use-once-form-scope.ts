'use client'

import { useEffect, useRef } from 'react'
import { raceTimeout } from './fetch-timeout'

type ReadScope = () => Promise<string>

const SCOPE_READ_TIMEOUT_MS = 15_000

function readBeforeDeadline(read: ReadScope) {
  return raceTimeout('Submission scope', SCOPE_READ_TIMEOUT_MS, Promise.resolve().then(read))
}

export class SubmitOnceFormScopeError extends Error {}

const INITIAL_SCOPE_ERROR = 'フォームを開いたときのログイン情報を確認できませんでした。入力を控えてから、この画面を開き直してください。'
const CURRENT_SCOPE_ERROR = '送信前のログイン情報を確認できませんでした。通信状況を確認して、もう一度お試しください。内容は送信していません。'
const CHANGED_SCOPE_ERROR = 'フォームを開いたときのログイン情報または組織が変わりました。内容は送信していません。'

export function useOnceFormScope(readScope: ReadScope, enabled = true): ReadScope {
  const openingReader = useRef(readScope)
  const openingScope = useRef<Promise<string | null> | null>(null)

  useEffect(() => {
    if (!enabled || openingScope.current) return
    openingScope.current = readBeforeDeadline(openingReader.current)
      .then((scope) => /^[a-f0-9]{64}$/.test(scope) ? scope : null, () => null)
  }, [enabled])

  return async () => {
    const expected = await openingScope.current
    if (!expected) throw new SubmitOnceFormScopeError(INITIAL_SCOPE_ERROR)
    const actual = await readBeforeDeadline(readScope).catch(() => {
      throw new SubmitOnceFormScopeError(CURRENT_SCOPE_ERROR)
    })
    if (actual !== expected) throw new SubmitOnceFormScopeError(CHANGED_SCOPE_ERROR)
    return actual
  }
}
