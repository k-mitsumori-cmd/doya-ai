'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { getSession, useSession } from 'next-auth/react'
import { createTrialEligibilityReader, type TrialPrincipal } from '@/lib/trial-eligibility-client'

type Snapshot = { scope: string; life: number; value: boolean; expires: number }
type Scope = { key: string; principal: TrialPrincipal | null }
const TrialContext = createContext(false)

function sessionScope(status: string, user: { id?: string; email?: string | null; plan?: string } | undefined): Scope {
  if (status === 'unauthenticated') return { key: 'guest', principal: { kind: 'guest' } }
  if (status !== 'authenticated' || typeof user?.id !== 'string' || !user.id.trim() || !user.email?.trim()) {
    return { key: JSON.stringify([status, user?.id, user?.email, user?.plan]), principal: null }
  }
  return {
    key: JSON.stringify(['authenticated', user.id, user.email, user.plan]),
    principal: { kind: 'authenticated', actorId: user.id },
  }
}

export function TrialEligibilityProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status, update } = useSession()
  const user = session?.user as { id?: string; email?: string | null; plan?: string } | undefined
  const scope = sessionScope(status, user)
  const [owner, setOwner] = useState<{ key: string; life: number; blocked: boolean }>({ key: scope.key, life: 0, blocked: false })
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const readerRef = useRef<ReturnType<typeof createTrialEligibilityReader> | null>(null)
  const verifyRef = useRef(0)
  const verifyingRef = useRef(false)
  const awayRef = useRef(false)
  const verificationNeededRef = useRef(false)
  const firstReauthRef = useRef(false)
  const verificationScopeRef = useRef<string | null>(null)
  const allowUpdateLoadingRef = useRef(false)
  const verifiedRef = useRef<string | null>(null)
  const sdkRef = useRef(scope.key)
  const committedScopeRef = useRef(scope.key)
  const updateRef = useRef(update)

  // A committed SDK scope change must hide the old result in the same render.
  if (owner.key !== scope.key) {
    setOwner({ key: scope.key, life: owner.life + 1, blocked: owner.blocked })
    setSnapshot(null)
  }
  const current = owner.key === scope.key ? owner : { key: scope.key, life: owner.life + 1, blocked: owner.blocked }
  const visible = !current.blocked && !!scope.principal && snapshot?.scope === scope.key &&
    snapshot.life === current.life && snapshot.value && snapshot.expires > Date.now()

  useEffect(() => {
    const changed = committedScopeRef.current !== scope.key
    committedScopeRef.current = scope.key
    sdkRef.current = scope.key
    updateRef.current = update
    if (changed && current.blocked) {
      const loadingIdentity = user ? sessionScope('authenticated', user).key : null
      const sameUpdateRoundtrip = allowUpdateLoadingRef.current &&
        (scope.key === verificationScopeRef.current ||
          (status === 'loading' && (!loadingIdentity || loadingIdentity === verificationScopeRef.current)))
      if (!sameUpdateRoundtrip) {
        // A different actor, plan, or email retires the old proof, including ABA.
        verifyRef.current++
        verifyingRef.current = false
        verifiedRef.current = null
        verificationScopeRef.current = null
        allowUpdateLoadingRef.current = false
        firstReauthRef.current = false
        if (scope.principal && document.visibilityState !== 'hidden') blockAndVerify()
      }
    }
  // The scope key is the committed SDK generation boundary.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.key, update])

  useEffect(() => {
    if (current.blocked || !scope.principal) return
    const reader = createTrialEligibilityReader(scope.principal)
    readerRef.current = reader
    let alive = true
    let retryCount = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const key = scope.key, life = current.life
    const clear = () => { if (timer) clearTimeout(timer); timer = undefined }
    const run = async () => {
      if (!alive || document.visibilityState === 'hidden') return
      clear()
      const result = await reader.read()
      if (!alive || readerRef.current !== reader || sdkRef.current !== key) return
      if (result.kind === 'confirmed') {
        retryCount = 0
        setSnapshot({ scope: key, life, value: result.value, expires: result.expires })
        timer = setTimeout(() => {
          if (!alive) return
          setSnapshot(null)
          if (document.visibilityState !== 'hidden') void run()
        }, Math.max(0, result.expires - Date.now()))
      } else if (result.kind === 'reauth') {
        setSnapshot(null)
        blockAndVerify(true)
      } else if (retryCount < 2) {
        timer = setTimeout(() => {
          if (document.visibilityState !== 'hidden') void run()
        }, ++retryCount === 1 ? 5_000 : 15_000)
      }
    }
    // StrictMode's first setup retires before this starts. One committed life owns the read.
    const start = Promise.resolve().then(() => { if (alive) void run() })
    void start
    return () => {
      alive = false
      clear()
      reader.retire()
      if (readerRef.current === reader) readerRef.current = null
    }
  // Scope/life is the owner; a fresh session object does not invalidate it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.key, current.life, current.blocked])

  function blockAndVerify(reauth = false) {
    if (reauth) firstReauthRef.current = true
    verificationNeededRef.current = true
    readerRef.current?.retire()
    readerRef.current = null
    setSnapshot(null)
    setOwner(previous => ({ ...previous, life: previous.life + 1, blocked: true }))
    if (verifyingRef.current) return
    verifyingRef.current = true
    const verify = ++verifyRef.current
    verificationScopeRef.current = sdkRef.current
    // NextAuth update() itself emits loading with the previous session data.
    allowUpdateLoadingRef.current = true
    void Promise.resolve().then(async () => {
      try {
        // NextAuth update() returns undefined for guests. getSession() performs
        // a fresh session read; only the trial API can finally confirm guest.
        const fresh = verificationScopeRef.current === 'guest'
          ? await getSession()
          : await updateRef.current()
        if (verify !== verifyRef.current) return
        const freshUser = fresh?.user as { id?: string; email?: string | null; plan?: string } | undefined
        const freshScope = fresh === null
          ? sessionScope('unauthenticated', undefined)
          : fresh === undefined ? { key: 'unknown', principal: null } : sessionScope('authenticated', freshUser)
        verifiedRef.current = freshScope.principal ? freshScope.key : null
        if (firstReauthRef.current && verifiedRef.current === verificationScopeRef.current) {
          // A 409 cannot immediately retry the same SDK principal forever.
          firstReauthRef.current = false
          verifiedRef.current = null
          return
        }
        firstReauthRef.current = false
        // SDK state may arrive later. The effect below unblocks only on exact agreement.
        if (verifiedRef.current && sdkRef.current === verifiedRef.current) {
          verifiedRef.current = null
          verificationNeededRef.current = false
          setOwner(previous => ({ ...previous, life: previous.life + 1, blocked: false }))
        }
      } catch { verifiedRef.current = null } finally {
        if (verify === verifyRef.current) verifyingRef.current = false
      }
    })
  }

  useEffect(() => {
    if (!current.blocked || !verifiedRef.current || scope.key !== verifiedRef.current || !scope.principal) return
    verifiedRef.current = null
    verificationNeededRef.current = false
    setOwner(previous => ({ ...previous, life: previous.life + 1, blocked: false }))
  }, [current.blocked, scope.key, scope.principal])

  useEffect(() => {
    const verificationSequence = verifyRef
    const hide = () => {
      awayRef.current = true
      firstReauthRef.current = false
      verificationNeededRef.current = true
      verifyRef.current++
      verifyingRef.current = false
      verifiedRef.current = null
      verificationScopeRef.current = null
      allowUpdateLoadingRef.current = false
      readerRef.current?.retire()
      readerRef.current = null
      flushSync(() => {
        setSnapshot(null)
        setOwner(previous => ({ ...previous, life: previous.life + 1, blocked: true }))
      })
    }
    const resume = () => {
      if (document.visibilityState === 'hidden' || (!awayRef.current && !verificationNeededRef.current)) return
      awayRef.current = false
      blockAndVerify()
    }
    const onVisibility = () => document.visibilityState === 'hidden' ? hide() : resume()
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) { hide(); resume() } }
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('blur', hide)
    window.addEventListener('focus', resume)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      verificationSequence.current++
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('blur', hide)
      window.removeEventListener('focus', resume)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  // A single provider owns all page lifecycle listeners.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <TrialContext.Provider value={!!visible}>{children}</TrialContext.Provider>
}

export function useTrialEligibilitySnapshot() { return useContext(TrialContext) }
