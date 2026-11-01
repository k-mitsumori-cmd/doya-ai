'use client'

import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import HrOrganizationScope from './HrOrganizationScope'
import { loadHrOrganizationChoices, type HrOrganizationChoice } from '@/lib/hr/organization-choices-client'
import { HR_SELECTED_ORGANIZATION_HEADER, HR_SELECTED_ACTOR_HEADER } from '@/lib/hr/organization-selection'
import { readBillingResponse } from '@/lib/billing-response-client'
import HrOnboarding from './HrOnboarding'
import { ErrorNotice, Skeleton } from '@/components/ds'

interface HrLayoutProps {
  children: React.ReactNode
  /**
   * 共通の枠に載せたときの外側（HrShellFrame が ToolFrame を渡す）。省略時（未ログインの紹介・料金・招待）は中身だけ。
   * 組織の切り替え（<select>）は switcher として渡し、中身（sessionStorage・ヘッダー）はここで持ったまま変えない
   */
  renderFrame?: (frame: { switcher: ReactNode; canManageEmployees: boolean; usage: { employeeCount: number; employeeLimit: number; plan: string } | null; children: ReactNode }) => ReactNode
}

export default function HrLayout({ children, renderFrame }: HrLayoutProps) {
  const { data: session, status } = useSession()
  const pathname = usePathname(), router = useRouter()
  const [selection, setSelection] = useState<{ actor: string; organizationId?: string; revision: number }>({ actor: '', revision: 0 })
  const [selectionError, setSelectionError] = useState('')
  const [choices, setChoices] = useState<{ actor: string; rows: HrOrganizationChoice[]; error: string; loading: boolean }>({ actor: '', rows: [], error: '', loading: true })
  const choiceRequest = useRef(0), choiceController = useRef<AbortController | null>(null)
  const pinnedOrganization = useRef<{ key: string; organizationId: string } | null>(null)
  const [confirmedOrganization, setConfirmedOrganization] = useState('')
  // SessionProvider.update temporarily retains its previous data while loading.
  const isSessionLoading = status === 'loading'
  const isSignedOut = status === 'unauthenticated'
  const [usage, setUsage] = useState({ employeeCount: 0, employeeLimit: 5, plan: 'FREE', canManageEmployees: false })
  const [hasOrg, setHasOrg] = useState<boolean | null>(null)
  const [usageError, setUsageError] = useState(false)
  const usageRequest = useRef(0)
  const actor = status === 'unauthenticated' ? '' : session?.user?.id || ''
  const globalPlan = (session?.user as { plan?: string } | undefined)?.plan
  const allowed = status === 'authenticated' && Boolean(actor)
  const epoch = useRef({ actor, version: 0 })
  if (epoch.current.actor !== actor) epoch.current = { actor, version: epoch.current.version + 1 }
  const selectionReady = selection.actor === actor && Boolean(actor)
  const scopeKey = JSON.stringify([actor, epoch.current.version, selectionReady ? selection.revision : -1])
  const activeScope = useRef({ key: scopeKey, allowed })
  activeScope.current = { key: scopeKey, allowed }
  const [loadedScope, setLoadedScope] = useState('')
  const confirmedScope = useRef(loadedScope)
  confirmedScope.current = loadedScope
  const pendingUsage = useRef<AbortController | null>(null)
  const knownScope = Boolean(actor) && loadedScope === scopeKey
  const previousPathname = useRef(pathname)

  const isLandingPage = pathname === '/hr'
  const isPricingPage = pathname === '/hr/pricing'
  const isInvitePage = pathname?.startsWith('/hr/invite/')
  // 開発時だけの画面の見本（/hr/dev/states）。ログインなしで開けるよう、外側の旧来のレイアウトは中身をそのまま返す。
  // ⚠️ 本番ではページ自体が 404（hr/dev/states/page.tsx が NODE_ENV で notFound）なので、ここは道筋だけで判定する
  //    （この部品はクライアントで動き、検証でもそのまま描くため process.env を読まない）。見本の中の HrShellFrame（renderFrame あり）は通常どおり動かす
  const isDevPreview = !renderFrame && Boolean(pathname?.startsWith('/hr/dev/'))
  const isPublicPage = isLandingPage || isPricingPage || isInvitePage || isDevPreview

  const loadUsage = useCallback(async (preserveView = false) => {
    if (!selectionReady || !activeScope.current.allowed || activeScope.current.key !== scopeKey) return
    pendingUsage.current?.abort()
    const controller = new AbortController()
    pendingUsage.current = controller
    const request = ++usageRequest.current
    const current = () => !controller.signal.aborted && request === usageRequest.current && activeScope.current.allowed && activeScope.current.key === scopeKey
    if (!preserveView) {
      setHasOrg(null)
      setUsageError(false)
    }
    try {
      await Promise.resolve()
      if (!current()) return
      const requestedOrganization = selection.organizationId || (pinnedOrganization.current?.key === scopeKey ? pinnedOrganization.current.organizationId : undefined)
      const response = await readBillingResponse('/api/hr/usage', { method: 'GET', ...(requestedOrganization ? { headers: {
        [HR_SELECTED_ORGANIZATION_HEADER]: requestedOrganization, [HR_SELECTED_ACTOR_HEADER]: actor, 'X-HR-Organization-Id': requestedOrganization,
      } } : {}) }, controller.signal)
      if (!current()) return
      if ((response.status === 401 || response.status === 403) && requestedOrganization) {
        // Authority rejection differs from a temporary outage: stop displaying private children.
        // Retain the pinned selection so retries cannot silently fall back to another organization.
        setLoadedScope('')
        throw Error('選択した組織の所属を確認できませんでした。')
      }
      if (response.status === 401) {
        setHasOrg(false)
        setUsageError(false)
        setLoadedScope(scopeKey)
        return
      }
      if (!response.ok) throw new Error('使用状況を取得できませんでした')
      const data = response.data
      if (typeof data.organizationId !== 'string' || !data.organizationId || (requestedOrganization && data.organizationId !== requestedOrganization) || typeof data.plan !== 'string' ||
        !Number.isSafeInteger(data.employeeCount) || (data.employeeCount as number) < 0 ||
        !Number.isSafeInteger(data.employeeLimit) || (data.employeeLimit as number) < -1 ||
        typeof data.canManageEmployees !== 'boolean') throw new Error('使用状況の応答が不正です')
      pinnedOrganization.current = { key: scopeKey, organizationId: data.organizationId }
      setConfirmedOrganization(data.organizationId)
      setUsage({ employeeCount: data.employeeCount as number, employeeLimit: data.employeeLimit as number,
        plan: data.plan, canManageEmployees: data.canManageEmployees })
      setHasOrg(true)
      setUsageError(false)
      setLoadedScope(scopeKey)
    } catch {
      if (current()) setUsageError(true)
    } finally {
      if (pendingUsage.current === controller) pendingUsage.current = null
      controller.abort()
    }
  }, [scopeKey, selectionReady, selection.organizationId, actor])

  useEffect(() => {
    if (!actor) { setSelection({ actor: '', revision: 0 }); setConfirmedOrganization(''); pinnedOrganization.current = null; return }
    try {
      const raw = window.sessionStorage.getItem('hr-selected-organization:v1:' + actor)
      if (raw !== null && (!raw || raw.length > 512 || /[\s\u0000-\u001f\u007f]/.test(raw))) throw Error()
      setSelection({ actor, organizationId: raw ?? undefined, revision: 1 }); setSelectionError('')
    } catch { setSelectionError('選択した組織を安全に確認できません。ブラウザの設定を確認してください。') }
  }, [actor])

  const loadChoices = useCallback(async () => {
    if (!allowed) return
    choiceController.current?.abort()
    const controller = new AbortController(); choiceController.current = controller
    const request = ++choiceRequest.current
    setChoices(old => ({ actor, rows: old.actor === actor ? old.rows : [], error: '', loading: true }))
    try {
      const rows = await loadHrOrganizationChoices(actor, controller.signal)
      if (!controller.signal.aborted && request === choiceRequest.current) setChoices({ actor, rows, error: '', loading: false })
    } catch { if (!controller.signal.aborted && request === choiceRequest.current) setChoices(old => ({ actor, rows: old.actor === actor ? old.rows : [], error: '所属組織を取得できませんでした。', loading: false })) }
  }, [allowed, actor])
  useEffect(() => {
    if (allowed && !isLandingPage && !isInvitePage) void loadChoices()
    const refresh = () => { if (!isLandingPage && !isInvitePage) void loadChoices() }
    window.addEventListener('focus', refresh)
    return () => { choiceRequest.current++; choiceController.current?.abort(); window.removeEventListener('focus', refresh) }
  }, [allowed, isLandingPage, isInvitePage, loadChoices])

  const selectOrganization = (organizationId: string) => {
    if (!allowed || choices.actor !== actor || choices.loading || choices.error || !choices.rows.some(row => row.organizationId === organizationId)) return
    if (organizationId === confirmedOrganization && knownScope) return
    if (knownScope && !window.confirm('組織を切り替えますか？入力中の未保存内容は破棄されます。未確認の操作記録は保存され、元の組織で確認できます。')) return
    try { window.sessionStorage.setItem('hr-selected-organization:v1:' + actor, organizationId) }
    catch { setSelectionError('組織の選択を保存できませんでした。現在の組織は変更していません。'); return }
    usageRequest.current++; pendingUsage.current?.abort(); pinnedOrganization.current = null
    setHasOrg(null); setLoadedScope(''); setConfirmedOrganization(''); setUsageError(false); setSelectionError('')
    setSelection(old => ({ actor, organizationId, revision: old.revision + 1 }))
    if (/^\/hr\/(employees|evaluations|one-on-one)\/.+/.test(pathname || '') && pathname !== '/hr/employees/new') router.push('/hr/dashboard')
  }
  const requestedPickerOrganization = confirmedOrganization || selection.organizationId || ''
  const pickerOrganization = choices.rows.some(row => row.organizationId === requestedPickerOrganization) ? requestedPickerOrganization : ''
  const organizationPickerBody = allowed && choices.actor === actor && <>
    <label className="flex flex-wrap items-center gap-2 text-sm font-bold">表示する組織<select aria-label="表示する組織" className="min-w-0 max-w-full rounded-lg border p-2" value={pickerOrganization} disabled={choices.loading || Boolean(choices.error)} onChange={event => selectOrganization(event.target.value)}>
      <option value="" disabled>組織を選択してください</option>{choices.rows.map(row => <option key={row.memberId} value={row.organizationId}>{row.name}</option>)}
    </select></label>
    {choices.loading && <p role="status" className="text-sm">所属組織を確認しています。</p>}
    {choices.error && <p role="alert">{choices.error}<button type="button" onClick={() => void loadChoices()} className="ml-2 underline">再取得する</button></p>}
    {selectionError && <p role="alert">{selectionError}</p>}
  </>
  const organizationPicker = organizationPickerBody && <div className="border-b border-slate-200 bg-white px-4 py-3">{organizationPickerBody}</div>
  // 共通の枠では、組織の切り替えを ToolFrame の switcher（パンくずの右）に出し、本文には出さない
  const framed = (node: ReactNode) => renderFrame
    ? <>{renderFrame({ switcher: organizationPickerBody ? <div>{organizationPickerBody}</div> : null, canManageEmployees: usage.canManageEmployees, usage: hasOrg && !usageError ? { employeeCount: usage.employeeCount, employeeLimit: usage.employeeLimit, plan: usage.plan } : null, children: node })}</>
    : <>{node}</>
  const inlinePicker = renderFrame ? null : organizationPicker

  useEffect(() => {
    const requestCounter = usageRequest
    if (allowed && selectionReady) void loadUsage(confirmedScope.current === scopeKey)
    else if (status === 'unauthenticated') {
      requestCounter.current++
      setUsageError(false)
      setHasOrg(false)
    }
    return () => { requestCounter.current++; pendingUsage.current?.abort() }
  }, [allowed, selectionReady, actor, status, globalPlan, scopeKey, loadUsage])

  useEffect(() => {
    if (!allowed) return
    const refresh = () => { void loadUsage(confirmedScope.current === scopeKey) }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [allowed, scopeKey, loadUsage])

  useEffect(() => {
    if (previousPathname.current === pathname) return
    previousPathname.current = pathname
    if (allowed && selectionReady) void loadUsage(confirmedScope.current === scopeKey)
  }, [pathname, allowed, scopeKey, loadUsage])

  if (isPublicPage) {
    // 枠の中では、料金のページもほかのタブと同じ枠（renderFrame）で包む。組織の切り替えは枠の switcher に出す。
    // ⚠️ ほかのタブと同じ包み方にするので、料金とほかのタブを移っても、組織の読み込みをやり直さない（2026-10-23）
    const pricingFramed = isPricingPage && Boolean(renderFrame)
    const wrap = (node: ReactNode) => pricingFramed ? framed(node) : <>{node}</>
    const picker = pricingFramed ? null : organizationPicker
    if (isPricingPage && allowed) {
      if (usageError || selectionError) return wrap(<>{picker}<div role="alert" className="p-6">組織のプランを確認できませんでした。<button type="button" onClick={() => void loadUsage()} className="ml-2 underline">再取得する</button></div></>)
      if (!knownScope) return wrap(<p role="status" className="p-6">組織のプランを確認しています。</p>)
      if (hasOrg) return wrap(<>{picker}<HrOrganizationScope key={JSON.stringify([actor, confirmedOrganization, selection.revision])} actor={actor} organizationId={confirmedOrganization} enabled={allowed && knownScope}>{children}</HrOrganizationScope></>)
    }
    return wrap(children)
  }

  if (status === 'authenticated' && !actor) return <div role="alert" className="p-6 text-center">ログイン情報を確認できません。<a href="/auth/signin" className="ml-2 underline">再度ログインする</a></div>

  if ((usageError || selectionError) && session?.user && !knownScope && renderFrame) {
    return framed(<div className="p-4 sm:p-6"><ErrorNotice what="組織の情報を読み込めませんでした。組織の状態は変わっていません。" how={selectionError || '時間をおいて、もう一度お試しください。'} onRetry={() => void loadUsage()} retryLabel="再読み込み" /></div>)
  }
  if ((usageError || selectionError) && session?.user && !knownScope) {
    return framed(<div role="alert" className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">{inlinePicker}<p className="font-bold text-rose-700">組織情報を取得できませんでした。組織の状態は変更されていません。</p><button type="button" onClick={() => void loadUsage()} className="rounded-xl bg-sky-600 px-5 py-3 font-bold text-white">再読み込み</button></div>)
  }

  if (!knownScope && (isSessionLoading || (session?.user && hasOrg === null) || allowed) && renderFrame) {
    return framed(<div className="grid gap-4 p-4 sm:p-6" aria-busy="true" aria-label="読み込み中"><Skeleton lines={1} height={28} delayMs={0} /><Skeleton lines={4} height={18} delayMs={0} /></div>)
  }
  if (!knownScope && (isSessionLoading || (session?.user && hasOrg === null) || allowed)) {
    return framed(
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-sky-200 border-t-sky-500 animate-spin" />
          <p className="text-sm text-slate-400">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!session?.user || isSignedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-blue-50 p-6">
        <div className="text-center bg-white rounded-3xl border border-slate-200 shadow-xl p-12 max-w-md">
          <img src="/hr/logo.png" alt="ドヤHR" className="w-56 mx-auto mb-6 drop-shadow" />
          <p className="text-slate-500 mb-6">ログインしてタレントマネジメントを始めましょう</p>
          <a
            href="/auth/signin?callbackUrl=/hr/dashboard"
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all"
          >
            <span className="material-symbols-outlined">login</span>
            ログイン
          </a>
        </div>
      </div>
    )
  }

  if (!hasOrg) {
    return framed(<HrOnboarding />)
  }

  if ((pathname === '/hr/employees/new' || /^\/hr\/employees\/[^/]+\/edit$/.test(pathname || '')) && !usage.canManageEmployees) {
    return framed(<div role="alert" className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center font-bold text-slate-700">従業員の登録・編集は管理者のみ利用できます。</div>)
  }

  if (renderFrame) {
    // 共通の枠: サイドバーとモバイルのヘッダーは出さない（ToolFrame のタブと、枠の左のメニューが同じ役目をする）
    return framed(<>
      {isSessionLoading && <div role="status" className="p-6 text-center">認証情報を確認しています。</div>}
      {usageError && <div role="alert" className="bg-amber-50 p-3 text-center text-sm">組織情報を再確認できませんでした。入力内容は保持しています。<button type="button" onClick={() => void loadUsage(true)} className="ml-2 underline">再取得する</button></div>}
      <div ref={element => { if (element) element.inert = isSessionLoading || usageError }} style={isSessionLoading ? { display: 'none' } : undefined}><HrOrganizationScope key={JSON.stringify([actor, confirmedOrganization, selection.revision])} actor={actor} organizationId={confirmedOrganization} enabled={allowed && !usageError && knownScope}>{children}</HrOrganizationScope></div>
    </>)
  }

  // 共通の枠の外（サーバーでログインを確かめられなかったときだけ）。旧来のサイドバーは出さず、中身だけを出す
  return (
    <>
      {organizationPicker}
      {isSessionLoading && <div role="status" className="p-6 text-center">認証情報を確認しています。</div>}
      {usageError && <div role="alert" className="bg-amber-50 p-3 text-center text-sm">組織情報を再確認できませんでした。入力内容は保持しています。<button type="button" onClick={() => void loadUsage(true)} className="ml-2 underline">再取得する</button></div>}
      <div ref={element => { if (element) element.inert = isSessionLoading || usageError }} style={isSessionLoading ? { display: 'none' } : undefined}><HrOrganizationScope key={JSON.stringify([actor, confirmedOrganization, selection.revision])} actor={actor} organizationId={confirmedOrganization} enabled={allowed && !usageError && knownScope}>{children}</HrOrganizationScope></div>
    </>
  )
}
