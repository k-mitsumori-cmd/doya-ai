'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useSession } from 'next-auth/react'
import { readProjectDetailResponse, type ProjectDetailResponse } from './project-detail-mode'

export type SavedDetailPhase = 'checking_auth' | 'loading' | 'ready_partial' | 'not_found' | 'error' | 'unauthenticated' | 'auth_changed'
type ReadState = { phase: SavedDetailPhase; epoch: number; detail: ProjectDetailResponse | null }

/** 保存値は現在のactor・project・世代と一致するrenderでだけ外に出す。 */
export function useSavedProjectDetail(projectId: string) {
  const { data: session, status, update } = useSession()
  const actor = status === 'authenticated' && typeof session?.user?.id === 'string' ? session.user.id : ''
  const scopeRef = useRef({ actor, status, projectId, epoch: 0 })
  const verificationRef = useRef<{ stamp: number } | null>(null)
  const confirmedRef = useRef<{ actor: string; life: number } | null>(null)
  const restoreAfterSdk = useRef(false)
  const verifySeq = useRef(0)
  if (scopeRef.current.actor !== actor || scopeRef.current.status !== status || scopeRef.current.projectId !== projectId) {
    if (verificationRef.current || confirmedRef.current) {
      // update中またはSDK反映待ちの確認はscope変更で失効。新actorはserver GETで再確認する。
      if (verificationRef.current) verifySeq.current++
      verificationRef.current = null
      confirmedRef.current = null
      restoreAfterSdk.current = true
    }
    scopeRef.current = { actor, status, projectId, epoch: scopeRef.current.epoch + 1 }
  }
  const epoch = scopeRef.current.epoch
  const [state, setState] = useState<ReadState>({ phase: 'loading', epoch, detail: null })
  const [attempt, setAttempt] = useState(0)
  const [blocked, setBlocked] = useState(false)
  const blockedRef = useRef(false)
  const mountedRef = useRef(false)
  const requestSeq = useRef(0)
  const lifecycle = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    const lifeRef = lifecycle
    const readRef = requestSeq
    const checkRef = verifySeq
    return () => {
      mountedRef.current = false
      lifeRef.current++
      readRef.current++
      checkRef.current++
      confirmedRef.current = null
      verificationRef.current = null
      restoreAfterSdk.current = false
    }
  }, [])

  const verifySession = useCallback(async () => {
    const stamp = ++verifySeq.current
    const life = ++lifecycle.current
    verificationRef.current = { stamp }
    restoreAfterSdk.current = false
    requestSeq.current++
    blockedRef.current = true
    confirmedRef.current = null
    setBlocked(true)
    setState({ phase: 'checking_auth', epoch: scopeRef.current.epoch, detail: null })
    try {
      const checked = await update()
      if (!mountedRef.current || verifySeq.current !== stamp || lifecycle.current !== life) return
      if (verificationRef.current?.stamp !== stamp) return
      verificationRef.current = null
      const currentEpoch = scopeRef.current.epoch
      const provenActor = typeof checked?.user?.id === 'string' ? checked.user.id : ''
      if (!provenActor.trim() || scopeRef.current.status === 'unauthenticated') {
        setState({ phase: 'unauthenticated', epoch: currentEpoch, detail: null })
      } else if (scopeRef.current.status === 'authenticated' && scopeRef.current.actor === provenActor) {
        blockedRef.current = false
        setBlocked(false)
        setAttempt(value => value + 1)
      } else if (scopeRef.current.status === 'loading' || scopeRef.current.actor !== provenActor) {
        confirmedRef.current = { actor: provenActor, life }
        setState({ phase: 'auth_changed', epoch: currentEpoch, detail: null })
      }
    } catch {
      if (mountedRef.current && verifySeq.current === stamp && lifecycle.current === life) {
        verificationRef.current = null
        setState({ phase: 'auth_changed', epoch: scopeRef.current.epoch, detail: null })
      }
    }
  }, [update])

  useEffect(() => {
    const proof = confirmedRef.current
    if (blockedRef.current && proof && proof.life === lifecycle.current && status === 'authenticated' && actor === proof.actor) {
      confirmedRef.current = null
      blockedRef.current = false
      setBlocked(false)
      setAttempt(value => value + 1)
    }
  }, [actor, status, blocked])

  useEffect(() => {
    if (restoreAfterSdk.current && blockedRef.current && status === 'authenticated' && actor.trim()) {
      restoreAfterSdk.current = false
      blockedRef.current = false
      setBlocked(false)
      setState({ phase: 'loading', epoch, detail: null })
      setAttempt(value => value + 1)
    }
  }, [actor, status, epoch])

  useEffect(() => {
    const onHide = () => {
      blockedRef.current = true
      confirmedRef.current = null
      verificationRef.current = null
      restoreAfterSdk.current = false
      lifecycle.current++
      requestSeq.current++
      flushSync(() => {
        setBlocked(true)
        setState({ phase: 'checking_auth', epoch: scopeRef.current.epoch, detail: null })
      })
    }
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) flushSync(() => { void verifySession() })
    }
    window.addEventListener('pagehide', onHide)
    window.addEventListener('pageshow', onShow)
    return () => {
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('pageshow', onShow)
    }
  }, [verifySession])

  useEffect(() => {
    if (status !== 'authenticated' || !actor.trim() || blockedRef.current || blocked) return
    const seq = ++requestSeq.current
    const readRef = requestSeq
    const life = lifecycle.current
    const controller = new AbortController()
    const current = () => mountedRef.current && !blockedRef.current && !controller.signal.aborted
      && requestSeq.current === seq && lifecycle.current === life
      && scopeRef.current.epoch === epoch && scopeRef.current.actor === actor && scopeRef.current.projectId === projectId
    setState({ phase: 'loading', epoch, detail: null })
    const query = new URLSearchParams({ expectedActor: actor })
    const url = `/api/tenjikai/projects/${encodeURIComponent(projectId)}?${query.toString()}`
    void (async () => {
      try {
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
        if (!current()) return
        if (response.status === 401 || response.status === 409) {
          blockedRef.current = true
          setBlocked(true)
          setState({ phase: response.status === 401 ? 'unauthenticated' : 'auth_changed', epoch, detail: null })
          return
        }
        if (response.status === 404) { setState({ phase: 'not_found', epoch, detail: null }); return }
        if (!response.ok) { setState({ phase: 'error', epoch, detail: null }); return }
        const body: unknown = await response.json()
        if (!current()) return
        const detail = readProjectDetailResponse(body, actor, projectId)
        setState(detail ? { phase: 'ready_partial', epoch, detail } : { phase: 'error', epoch, detail: null })
      } catch {
        if (current()) setState({ phase: 'error', epoch, detail: null })
      }
    })()
    return () => { controller.abort(); readRef.current++ }
  }, [actor, status, projectId, epoch, attempt, blocked])

  const phase: SavedDetailPhase = blockedRef.current
    ? state.epoch === epoch && (state.phase === 'unauthenticated' || state.phase === 'auth_changed') ? state.phase : 'checking_auth'
    : status === 'loading' ? 'checking_auth'
    : status !== 'authenticated' ? 'unauthenticated'
    : !actor.trim() ? 'auth_changed'
    : state.epoch === epoch ? state.phase : 'loading'
  const detail = phase === 'ready_partial' && state.epoch === epoch ? state.detail : null

  const reload = useCallback(() => {
    if (blockedRef.current || state.phase === 'unauthenticated' || state.phase === 'auth_changed') {
      void verifySession()
      return
    }
    setState({ phase: 'loading', epoch: scopeRef.current.epoch, detail: null })
    setAttempt(value => value + 1)
  }, [state.phase, verifySession])

  return { phase, detail, reload }
}
