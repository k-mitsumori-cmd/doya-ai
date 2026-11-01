'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { loadHrDepartmentList } from '@/lib/hr/department-list-client'
import { parseSettingsDepartmentList, confirmSettingsDepartmentDeletion, readDepartmentSettingsResponse } from '@/lib/hr/department-settings-client'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useHrDepartmentCreation, type DepartmentCreationResult } from '@/lib/hr/use-department-creation'
import { motion } from 'framer-motion'
import rawToast from 'react-hot-toast'

interface AuditLog {
  id: string
  action: string
  actor: string
  target?: string
  timestamp: string
}

interface OrgSettings {
  id?: string
  name: string
  industry: string
  employeeScale: string
  fiscalYearStart: string
}

interface OrgMember {
  id: string
  name: string
  email: string
  role: string
  joinedAt: string
  employeeId?: string | null
}

interface EmployeeOption {
  id: string
  lastName: string
  firstName: string
  email?: string | null
}

/** 権限の表示名。API の HrMemberRole と対応させること */
const ROLE_LABELS: Record<string, string> = {
  OWNER: 'オーナー',
  ADMIN: '管理者',
  MANAGER: 'マネージャー',
  MEMBER: 'メンバー',
}
const ROLE_RANK: Record<string, number> = { OWNER: 4, ADMIN: 3, MANAGER: 2, MEMBER: 1 }
const ROLE_STYLE: Record<string, string> = {
  OWNER: 'bg-amber-100 text-amber-800',
  ADMIN: 'bg-purple-100 text-purple-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  MEMBER: 'bg-slate-100 text-slate-600',
}

interface Department {
  id: string
  name: string
  code: string | null
  sortOrder: number
  employeeCount: number
}

const MEMBER_AVATAR_COLORS = [
  'from-blue-500 to-blue-600',
  'from-red-400 to-red-500',
  'from-emerald-500 to-emerald-600',
  'from-amber-400 to-amber-500',
  'from-purple-500 to-purple-600',
  'from-pink-400 to-pink-500',
]

const DEPT_COLOR_BARS = [
  'bg-blue-500',
  'bg-red-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
]

function getColorByIndex(arr: string[], name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return arr[Math.abs(hash) % arr.length]
}

export default function HrSettingsPage() {
  const { data: session, status } = useSession()
  const actor = (session?.user as { id?: string } | undefined)?.id ?? ''
  const scope = JSON.stringify([status, actor])
  const epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  if (status === 'loading') return <div role="status">認証情報を確認しています。</div>
  if (status !== 'authenticated' || !actor) return <div role="alert">設定を確認するにはログインしてください。<Link href="/auth/signin?callbackUrl=/hr/settings">ログインする</Link></div>
  return <HrSettingsForActor key={JSON.stringify([actor, epoch.current.version])} actor={actor} />
}

/** Each authentication scope owns its form, authority, pending requests and notifications. */
function HrSettingsForActor({ actor }: { actor: string }) {
  const lifetime = useRef<{ generation: number; controller: AbortController | null }>({ generation: 0, controller: null })
  useLayoutEffect(() => {
    const controller = new AbortController()
    lifetime.current = { generation: lifetime.current.generation + 1, controller }
    return () => { controller.abort() }
  }, [])
  const live = () => Boolean(lifetime.current.controller && !lifetime.current.controller.signal.aborted)
  const toast = Object.assign((...args: Parameters<typeof rawToast>) => { if (live()) return rawToast(...args) }, {
    success: (...args: Parameters<typeof rawToast.success>) => { if (live()) return rawToast.success(...args) },
    error: (...args: Parameters<typeof rawToast.error>) => { if (live()) return rawToast.error(...args) },
  })
  const fetch = async (url: string, init: RequestInit = {}) => {
    const captured = lifetime.current
    if (!captured.controller || captured.controller.signal.aborted) throw Error('操作が中断されました。')
    const controller = new AbortController()
    const abort = () => controller.abort()
    const signals = [captured.controller.signal, init.signal].filter((signal): signal is AbortSignal => Boolean(signal))
    for (const signal of signals) { signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort() }
    const current = () => lifetime.current === captured && !captured.controller?.signal.aborted && !controller.signal.aborted
    try {
      const response = await readDepartmentSettingsResponse(url, init, controller.signal)
      if (!current()) throw Error('操作が中断されました。')
      return { status: response.status, ok: response.status >= 200 && response.status < 300, json: async () => {
        if (!current()) throw Error('操作が中断されました。')
        return response.data as any
      } }
    } finally { for (const signal of signals) signal.removeEventListener('abort', abort) }
  }

  const [settings, setSettings] = useState<OrgSettings>({
    name: '',
    industry: '',
    employeeScale: '',
    fiscalYearStart: '04',
  })
  const departmentCreation = useHrDepartmentCreation('authenticated', actor, settings.id ?? '')
  const [members, setMembers] = useState<OrgMember[]>([])
  /** 自分の権限。誰にどの操作を出すかの判断に使う */
  const [myRole, setMyRole] = useState<string>('MEMBER')
  const [myMemberId, setMyMemberId] = useState<string>('')
  const [memberBusy, setMemberBusy] = useState<string | null>(null)
  const [memberMsg, setMemberMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null)
  const [linkingMemberId, setLinkingMemberId] = useState<string | null>(null)
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([])
  const [searchingEmployees, setSearchingEmployees] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [auditLogsError, setAuditLogsError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteLimitNotice, setInviteLimitNotice] = useState<{ message: string; upgradeUrl?: string; contactUrl?: string; canManageBilling: boolean } | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [showDeptModal, setShowDeptModal] = useState(false)
  const [newDeptName, setNewDeptName] = useState('')
  const [newDeptCode, setNewDeptCode] = useState('')
  const [newDeptSortOrder, setNewDeptSortOrder] = useState(0)
  const [creatingDept, setCreatingDept] = useState(false)
  const [deletingDeptId, setDeletingDeptId] = useState<string | null>(null)
  const [departmentListWarning, setDepartmentListWarning] = useState<string | null>(null)
  const [refreshingDepartments, setRefreshingDepartments] = useState(false)
  const departmentMutationBusy = useRef(false)
  const departmentRefreshBusy = useRef(false)
  const departmentLife = useRef(0)
  const departmentNetwork = useRef<AbortController | null>(null)
  useEffect(() => {
    const life = ++departmentLife.current
    const controller = new AbortController()
    departmentNetwork.current = controller
    return () => { controller.abort(); if (departmentLife.current === life) departmentLife.current++ }
  }, [])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [inviteUrl, setInviteUrl] = useState('')
  const [inviteEmailSent, setInviteEmailSent] = useState(false)
  const [inviteUrlCopied, setInviteUrlCopied] = useState(false)
  const [generatingInviteUrl, setGeneratingInviteUrl] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferEmail, setTransferEmail] = useState('')
  const [transferring, setTransferring] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    async function fetchSettings() {
      setLoading(true)
      setLoadError(false)
      setAuditLogsError(false)
      try {
        const settingsRes = await fetch('/api/hr/settings', { cache: 'no-store', signal: controller.signal })
        if (!settingsRes.ok) throw new Error('設定を取得できませんでした')
        const data = await settingsRes.json()
        if (typeof data?.settings?.id !== 'string' || !data.settings.id) throw new Error('設定の応答が不正です')
        const listing = await loadHrDepartmentList(controller.signal, data.settings.id)
        const deptData = { success: true, organizationId: listing.organizationId, flat: listing.rows }
        if (
          !data?.settings || typeof data.settings.name !== 'string' ||
          !Array.isArray(data.members) || !ROLE_RANK[data.myRole] ||
          typeof data.myMemberId !== 'string' ||
          !deptData?.success || !Array.isArray(deptData.flat) ||
          typeof data.settings.id !== 'string' || !data.settings.id || deptData.organizationId !== data.settings.id
        ) throw new Error('設定の応答が不正です')
        const departmentRows = parseSettingsDepartmentList(deptData, data.settings.id)
        if (controller.signal.aborted) return
        setSettings(data.settings)
        setMembers(data.members)
        setMyRole(data.myRole)
        setMyMemberId(data.myMemberId)
        setDepartments(departmentRows)
        // Fetch audit logs
        try {
          const logRes = await fetch('/api/hr/audit-logs?pageSize=10', { cache: 'no-store', signal: controller.signal })
          if (!logRes.ok) throw new Error('監査ログを取得できませんでした')
          const logData = await logRes.json()
          const rawLogs = logData.items ?? logData.logs
          if (!Array.isArray(rawLogs)) throw new Error('監査ログの応答が不正です')
          if (!controller.signal.aborted) setAuditLogs(rawLogs.map((l: any) => ({
            id: l.id,
            action: l.action,
            actor: l.userName || l.actor || '',
            target: l.target || '',
            timestamp: l.createdAt || l.timestamp || '',
          })))
        } catch {
          if (!controller.signal.aborted) setAuditLogsError(true)
        }
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void fetchSettings()
    return () => controller.abort()
  }, [retryKey])

  /** メンバー一覧を読み直す */
  const reloadMembers = async () => {
    const res = await fetch('/api/hr/settings')
    if (!res.ok) return
    const d = await res.json()
    if (d.members) setMembers(d.members)
    if (d.myRole) setMyRole(d.myRole)
    if (d.myMemberId) setMyMemberId(d.myMemberId)
  }

  useEffect(() => {
    if (!linkingMemberId) return
    const controller = new AbortController()
    setSearchingEmployees(true)
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: employeeSearch.trim(), pageSize: '20' })
        const res = await fetch(`/api/hr/employees?${params}`, { signal: controller.signal })
        if (!res.ok) throw new Error('従業員候補を取得できませんでした')
        const data = await res.json()
        setEmployeeOptions(data.items ?? [])
      } catch (error) {
        if (!controller.signal.aborted) {
          setEmployeeOptions([])
          toast.error(error instanceof Error ? error.message : '従業員候補を取得できませんでした')
        }
      } finally {
        if (!controller.signal.aborted) setSearchingEmployees(false)
      }
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [linkingMemberId, employeeSearch])

  const changeEmployeeLink = async (member: OrgMember, employeeId: string | null) => {
    setMemberBusy(member.id)
    setMemberMsg(null)
    try {
      const res = await fetch(`/api/hr/organization/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || '従業員との紐付けを変更できませんでした')
      await reloadMembers()
      setMemberMsg({ id: member.id, ok: true, text: employeeId ? '従業員情報を紐付けました。' : '従業員情報の紐付けを解除しました。' })
      setLinkingMemberId(null)
    } catch (error) {
      setMemberMsg({ id: member.id, ok: false, text: error instanceof Error ? error.message : '従業員との紐付けを変更できませんでした' })
    } finally {
      setMemberBusy(null)
    }
  }

  /**
   * 権限の変更。
   * ⚠️ APIは自分より上の権限を付与できない。UIでも選択肢を自分の権限までに絞る。
   */
  const changeRole = async (member: OrgMember, role: string) => {
    if (role === member.role) return
    setMemberBusy(member.id)
    setMemberMsg(null)
    try {
      const res = await fetch(`/api/hr/organization/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) {
        setMemberMsg({ id: member.id, ok: false, text: d?.error || '権限を変更できませんでした' })
        return
      }
      setMemberMsg({
        id: member.id,
        ok: true,
        text: `${member.name || member.email} の権限を「${ROLE_LABELS[role] || role}」に変更しました。`,
      })
      await reloadMembers()
    } catch (error) {
      if (live()) setMemberMsg({ id: member.id, ok: false, text: error instanceof Error ? error.message : 'メンバー情報を更新できませんでした' })
    } finally {
      setMemberBusy(null)
    }
  }

  /**
   * メンバーの削除。
   * ⚠️ 取り消せない操作なので必ず確認を挟む。
   *    APIはオーナーと自分自身の削除を拒否する。
   */
  const removeMember = async (member: OrgMember) => {
    const label = member.name || member.email
    if (!window.confirm(`${label} をこの組織から外します。よろしいですか。\n\n従業員データは残りますが、この方はドヤHRにアクセスできなくなります。`)) {
      return
    }
    setMemberBusy(member.id)
    setMemberMsg(null)
    try {
      const res = await fetch(`/api/hr/organization/members/${member.id}`, { method: 'DELETE' })
      const d = await res.json().catch(() => null)
      if (!res.ok) {
        setMemberMsg({ id: member.id, ok: false, text: d?.error || 'メンバーを外せませんでした' })
        return
      }
      setMemberMsg({ id: member.id, ok: true, text: `${label} を組織から外しました。` })
      await reloadMembers()
    } catch (error) {
      if (live()) setMemberMsg({ id: member.id, ok: false, text: error instanceof Error ? error.message : 'メンバー情報を更新できませんでした' })
    } finally {
      setMemberBusy(null)
    }
  }

  /** メンバーを管理できるか（APIは ADMIN 以上を要求する） */
  const canManageMembers = ROLE_RANK[myRole] >= ROLE_RANK.ADMIN
  /**
   * 付与できる権限。
   * ⚠️ 自分より上は選ばせない。ADMIN が他人を OWNER に上げられると、
   *    実質オーナーを増やせてしまう（APIでも拒否している）。
   */
  const assignableRoles = ['ADMIN', 'MANAGER', 'MEMBER'].filter(
    (r) => ROLE_RANK[r] <= ROLE_RANK[myRole]
  )

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/hr/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error('設定の保存に失敗しました')
      toast.success('設定を保存しました')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail) return
    setInviting(true)
    try {
      const res = await fetch('/api/hr/organization/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      })
      const data = await res.json()
      if (res.status === 403 && data.code === 'HR_ORG_MEMBER_LIMIT') {
        setInviteLimitNotice({
          message: data.error || 'メンバー数の上限に達しています。',
          upgradeUrl: data.upgradeUrl,
          contactUrl: data.contactUrl,
          canManageBilling: data.canManageBilling === true,
        })
        return
      }
      if (!res.ok) throw new Error(data.error || '招待の送信に失敗しました')
      setInviteLimitNotice(null)
      setInviteEmail('')
      setInviteEmailSent(data.emailSent === true)
      setInviteUrlCopied(false)
      if (data.emailSent === true) toast.success('招待メールを送信しました')
      else toast.error('招待リンクを作成しましたが、メールを送信できませんでした。リンクをコピーして共有してください。')
      if (data.inviteUrl) {
        setInviteUrl(data.inviteUrl)
      }
      const settingsRes = await fetch('/api/hr/settings')
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        if (settingsData.members) setMembers(settingsData.members)
        if (settingsData.myRole) setMyRole(settingsData.myRole)
        if (settingsData.myMemberId) setMyMemberId(settingsData.myMemberId)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setInviting(false)
    }
  }

  const fetchDepartments = async () => {
    if (departmentRefreshBusy.current) return false
    const life = departmentLife.current
    departmentRefreshBusy.current = true
    setRefreshingDepartments(true)
    try {
      const listing = await loadHrDepartmentList(departmentNetwork.current?.signal, settings.id ?? '')
      const rows = parseSettingsDepartmentList({ success: true, organizationId: listing.organizationId, flat: listing.rows }, settings.id ?? '')
      if (departmentLife.current !== life) return false
      setDepartments(rows)
      setDepartmentListWarning(null)
      return true
    } catch {
      if (departmentLife.current === life) setDepartmentListWarning('部署一覧を更新できませんでした。表示が最新ではない可能性があります。作成・削除を繰り返さず、一覧を再取得してください。')
      return false
    } finally {
      departmentRefreshBusy.current = false
      if (departmentLife.current === life) setRefreshingDepartments(false)
    }
  }

  const applyDepartmentCreation = async (result: DepartmentCreationResult) => {
    if (result.state !== 'created') return
    const department = result.department
    setDepartments(rows => [...rows.filter(row => row.id !== department.id), department].sort((a, b) => a.sortOrder - b.sortOrder))
    setNewDeptName('')
    setNewDeptCode('')
    setNewDeptSortOrder(0)
    setShowDeptModal(false)
    toast.success('部署を作成しました')
    await fetchDepartments()
  }

  const handleCreateDept = async () => {
    if (!newDeptName.trim() || !departmentCreation.ready || departmentCreation.intent || departmentCreation.busy ||
      departmentMutationBusy.current || departmentRefreshBusy.current || departmentListWarning) return
    const life = departmentLife.current, current = departmentCreation.isCurrent
    departmentMutationBusy.current = true
    setCreatingDept(true)
    try {
      const result = await departmentCreation.create({ name: newDeptName, code: newDeptCode || null, sortOrder: newDeptSortOrder })
      if (departmentLife.current !== life || !current()) return
      if (result) await applyDepartmentCreation(result)
      else toast.error('部署の作成結果を確認できませんでした。結果確認から再確認してください。')
    } finally {
      departmentMutationBusy.current = false
      if (departmentLife.current === life) setCreatingDept(false)
    }
  }

  const handleDepartmentRecovery = async (action: 'check' | 'retry' | 'cancel') => {
    if (departmentMutationBusy.current || departmentRefreshBusy.current) return
    const life = departmentLife.current, current = departmentCreation.isCurrent
    const result = await (action === 'retry' ? departmentCreation.retry() : departmentCreation.recover(action === 'cancel'))
    if (departmentLife.current === life && current() && result) await applyDepartmentCreation(result)
  }

  const handleDeleteDept = async (id: string) => {
    if (departmentMutationBusy.current || departmentRefreshBusy.current || departmentListWarning) return
    const life = departmentLife.current
    departmentMutationBusy.current = true
    setDeletingDeptId(id)
    try {
      const res = await readDepartmentSettingsResponse(`/api/hr/departments/${encodeURIComponent(id)}`, { method: 'DELETE' }, departmentNetwork.current?.signal)
      if (res.status !== 200) throw new Error('部署の削除結果を確認できませんでした。部署一覧を再取得してください。')
      confirmSettingsDepartmentDeletion(res.data)
      if (departmentLife.current !== life) return
      setDepartments(rows => rows.filter(row => row.id !== id))
      toast.success('部署を削除しました')
      await fetchDepartments()
    } catch (e: unknown) {
      if (departmentLife.current === life) {
        toast.error(e instanceof Error ? e.message : '部署の削除結果を確認できませんでした。部署一覧を確認してください。')
        setDepartmentListWarning('部署の削除結果を確認できませんでした。削除を繰り返さず、部署一覧を再取得してください。')
      }
    } finally {
      departmentMutationBusy.current = false
      if (departmentLife.current === life) setDeletingDeptId(null)
    }
  }

  const handleGenerateInviteUrl = () => {
    toast('招待URLを取得するには、まずメールアドレスで招待を送信してください。送信後にURLが表示されます。')
  }

  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (copiedTimer.current !== null) clearTimeout(copiedTimer.current) }, [])
  const handleCopyInviteUrl = async () => {
    if (!inviteUrl || !live()) return
    const copied = () => {
      if (!live()) return
      setInviteUrlCopied(true)
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => { if (live()) setInviteUrlCopied(false) }, 2000)
    }
    try {
      await navigator.clipboard.writeText(inviteUrl)
      copied()
    } catch {
      if (!live()) return
      const ta = document.createElement('textarea')
      ta.value = inviteUrl
      try {
        document.body.appendChild(ta)
        ta.select()
        if (!document.execCommand('copy')) throw Error('コピーできませんでした')
        copied()
      } catch {
        if (live()) toast.error('招待リンクをコピーできませんでした。リンクを選択して手動でコピーしてください。')
      } finally { ta.remove() }
    }
  }

  const handleTransferOwnership = async () => {
    if (!transferEmail) return
    setTransferring(true)
    try {
      // メールアドレスから対象メンバーを特定
      const targetMember = members.find((m) => m.email === transferEmail)
      if (!targetMember) {
        throw new Error('指定されたメールアドレスのメンバーが見つかりません')
      }
      const res = await fetch('/api/hr/organization/transfer-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetMemberId: targetMember.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'オーナー移譲に失敗しました')
      }
      setShowTransferModal(false)
      setTransferEmail('')
      await reloadMembers()
      toast.success('オーナーを移譲しました')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setTransferring(false)
    }
  }

  const departmentRecoveryPanel = (departmentCreation.intent || departmentCreation.message) && (
    <section aria-label="前回の部署作成" className="my-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-bold">前回の部署作成</p>
      {departmentCreation.intent && <p className="mt-1 break-words">部署名：{departmentCreation.intent.input.name}</p>}
      <p className="mt-2">{departmentCreation.message || '前回の作成結果を確認してください。作成処理は自動で再実行されません。'}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        {departmentCreation.intent && <button type="button" disabled={departmentCreation.busy || creatingDept || refreshingDepartments} onClick={() => void handleDepartmentRecovery('check')} className="font-bold underline disabled:opacity-50">作成結果を確認する</button>}
        {departmentCreation.result?.state === 'not_received' && <>
          <button type="button" disabled={departmentCreation.busy || creatingDept || refreshingDepartments} onClick={() => void handleDepartmentRecovery('retry')} className="font-bold underline disabled:opacity-50">同じ内容で作成を再開する</button>
          <button type="button" disabled={departmentCreation.busy || creatingDept || refreshingDepartments} onClick={() => void handleDepartmentRecovery('cancel')} className="font-bold underline disabled:opacity-50">未受付の操作を終了する</button>
        </>}
        {departmentCreation.result && departmentCreation.result.state !== 'not_received' && <button type="button" disabled={departmentCreation.busy || creatingDept || refreshingDepartments || departmentListWarning !== null} onClick={() => void departmentCreation.acknowledge()} className="font-bold underline disabled:opacity-50">確認して次の部署作成へ進む</button>}
        {departmentCreation.loginRequired && <Link href="/auth/signin?callbackUrl=/hr/settings" className="font-bold underline">ログインして結果を確認する</Link>}
      </div>
    </section>
  )

  const AUDIT_ACTION_MAP: Record<string, { icon: string; color: string; label: string }> = {
    INVITE_SENT: { icon: 'mail', color: 'text-blue-600', label: '招待メール送信' },
    INVITE_CREATED: { icon: 'link', color: 'text-amber-600', label: '招待リンク作成（メール未送信）' },
    MEMBER_INVITED: { icon: 'person_add', color: 'text-blue-600', label: 'メンバー招待' },
    MEMBER_JOINED: { icon: 'group_add', color: 'text-emerald-600', label: 'メンバー参加' },
    MEMBER_REMOVED: { icon: 'person_remove', color: 'text-red-500', label: 'メンバー削除' },
    SETTINGS_UPDATED: { icon: 'settings', color: 'text-slate-600', label: '設定変更' },
    DEPARTMENT_CREATED: { icon: 'apartment', color: 'text-amber-600', label: '部署作成' },
    DEPARTMENT_DELETED: { icon: 'delete', color: 'text-red-500', label: '部署削除' },
    EVALUATION_CREATED: { icon: 'assessment', color: 'text-red-500', label: '評価作成' },
    ROLE_CHANGED: { icon: 'admin_panel_settings', color: 'text-purple-600', label: '権限変更' },
    OWNER_TRANSFERRED: { icon: 'swap_horiz', color: 'text-amber-600', label: 'オーナー移譲' },
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-32 bg-slate-200 rounded" />
          <div className="h-64 bg-slate-100 rounded-3xl" />
          <div className="h-40 bg-slate-100 rounded-3xl" />
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div role="alert" className="p-6 lg:p-10 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <h1 className="text-xl font-black text-rose-800">組織設定を取得できませんでした</h1>
          <p className="mt-2 text-sm font-bold text-rose-700">設定や部署の情報は変更されていません。時間をおいて再試行してください。</p>
          <button type="button" onClick={() => setRetryKey((key) => key + 1)} className="mt-4 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700">
            再試行する
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-slate-900">設定</h1>
            <img
              src="/hr/characters/thumbsup_%E3%81%84%E3%81%84%E3%81%AD.png"
              alt="白くまキャラクター"
              className="w-14"
            />
          </div>
          <p className="text-sm text-slate-500 mt-1">組織情報とメンバーを管理</p>
        </div>

        {/* 1. Department Management — most frequently used */}
        <div className="bg-white rounded-3xl shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-amber-500">apartment</span>
              </div>
              部署管理
            </h2>
            {canManageMembers && (
              <button
                onClick={() => setShowDeptModal(true)}
                disabled={!departmentCreation.ready || Boolean(departmentCreation.intent) || creatingDept || departmentCreation.busy || deletingDeptId !== null || refreshingDepartments || departmentListWarning !== null}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full text-sm font-bold shadow-md hover:shadow-lg hover:bg-blue-700 transition-all"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                部署を追加
              </button>
            )}
          </div>

          {!showDeptModal && departmentRecoveryPanel}

          {departmentListWarning && (
            <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <p>{departmentListWarning}</p>
              <button type="button" onClick={() => void fetchDepartments()} disabled={refreshingDepartments} className="mt-2 font-bold underline disabled:opacity-50">
                {refreshingDepartments ? '一覧を取得中...' : '部署一覧を再取得する'}
              </button>
            </div>
          )}

          {departments.length > 0 ? (
            <div className="space-y-2">
              {departments.map((dept) => {
                const barColor = getColorByIndex(DEPT_COLOR_BARS, dept.name)
                return (
                  <div key={dept.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-10 rounded-full ${barColor}`} />
                      <div className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center">
                        <span className="material-symbols-outlined text-sm text-slate-500">apartment</span>
                      </div>
                      <div>
                        <p className="text-base font-bold text-slate-900">{dept.name}</p>
                        <p className="text-xs text-slate-500">
                          {dept.code ? `${dept.code} / ` : ''}表示順: {dept.sortOrder} / {dept.employeeCount}名
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1.5 rounded-full text-sm font-bold bg-blue-100 text-blue-700">
                        {dept.employeeCount}名
                      </span>
                      {canManageMembers && dept.employeeCount === 0 && (
                        <button
                          onClick={() => handleDeleteDept(dept.id)}
                          disabled={creatingDept || departmentCreation.busy || deletingDeptId !== null || refreshingDepartments || departmentListWarning !== null}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="削除"
                        >
                          <span className="material-symbols-outlined text-lg">
                            {deletingDeptId === dept.id ? 'hourglass_empty' : 'delete'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <span className="material-symbols-outlined text-4xl mb-2 block text-amber-300">apartment</span>
              <p className="text-sm font-bold text-slate-700">まだ部署が作成されていません</p>
              {canManageMembers && <p className="text-xs mt-1">「部署を追加」ボタンから作成してください</p>}
            </div>
          )}
        </div>

        {/* Department Create Modal */}
        {canManageMembers && showDeptModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={() => { if (!creatingDept && !departmentCreation.busy) setShowDeptModal(false) }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md mx-4"
            >
              <h2 className="text-lg font-bold text-slate-900 mb-4">部署を追加</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    部署名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newDeptName}
                    disabled={creatingDept || departmentCreation.busy}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="例: 営業部"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">部署コード</label>
                    <input
                      type="text"
                      value={newDeptCode}
                      disabled={creatingDept || departmentCreation.busy}
                      onChange={(e) => setNewDeptCode(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                      placeholder="例: SALES"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">表示順</label>
                    <input
                      type="number"
                      min={0}
                      value={newDeptSortOrder}
                      disabled={creatingDept || departmentCreation.busy}
                      onChange={(e) => setNewDeptSortOrder(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
              {departmentRecoveryPanel}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => { if (!creatingDept && !departmentCreation.busy) setShowDeptModal(false) }}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleCreateDept}
                  disabled={!departmentCreation.ready || Boolean(departmentCreation.intent) || departmentCreation.busy || creatingDept || deletingDeptId !== null || refreshingDepartments || departmentListWarning !== null || !newDeptName.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-bold shadow-md hover:shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  {creatingDept ? '作成中...' : '作成'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* 2. Members */}
        <div className="bg-white rounded-3xl shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-600">group</span>
            </div>
            メンバー管理
          </h2>

          {/* Invite by email */}
          {canManageMembers && <div className="flex gap-2 mb-4">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="メールアドレスで招待"
              className="flex-1 px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full text-sm font-bold shadow-md hover:shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">send</span>
              {inviting ? '送信中...' : '招待'}
            </button>
          </div>}

          {inviteLimitNotice && (
            <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-bold">{inviteLimitNotice.message}</p>
              {inviteLimitNotice.canManageBilling && inviteLimitNotice.upgradeUrl && (
                <Link href={inviteLimitNotice.upgradeUrl} className="mt-2 inline-block font-bold underline">プランを確認する</Link>
              )}
              {inviteLimitNotice.canManageBilling && inviteLimitNotice.contactUrl && (
                <a href={inviteLimitNotice.contactUrl} className="mt-2 inline-block font-bold underline">追加枠を相談する</a>
              )}
              {!inviteLimitNotice.canManageBilling && <p className="mt-2">組織のオーナーにプランの変更を依頼してください。</p>}
            </div>
          )}

          {/* Invite URL（メール招待後に表示） */}
          {canManageMembers && inviteUrl && (
            <div className={`mb-4 p-4 rounded-2xl border ${inviteEmailSent ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`material-symbols-outlined text-sm ${inviteEmailSent ? 'text-emerald-600' : 'text-amber-600'}`}>{inviteEmailSent ? 'check_circle' : 'info'}</span>
                <span className={`text-sm font-bold ${inviteEmailSent ? 'text-emerald-700' : 'text-amber-800'}`}>{inviteEmailSent ? '招待メールを送信しました。以下のURLを共有することもできます。' : '招待メールを送信できませんでした。以下のURLをコピーして共有してください。'}</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white border border-emerald-200 rounded-xl text-sm text-slate-600 truncate"
                />
                <motion.button
                  onClick={handleCopyInviteUrl}
                  whileTap={{ scale: 0.95 }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                    inviteUrlCopied
                      ? 'bg-emerald-500 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {inviteUrlCopied ? 'check' : 'content_copy'}
                  </span>
                  {inviteUrlCopied ? 'コピー済み!' : 'コピー'}
                </motion.button>
              </div>
            </div>
          )}

          {/* Member List */}
          {members.length > 0 ? (
            <div className="space-y-2">
              {members.map((member) => {
                const avatarColor = getColorByIndex(MEMBER_AVATAR_COLORS, member.name || member.email)
                return (
                  <div key={member.id} className="rounded-2xl bg-slate-50">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white text-xs font-bold`}>
                        {member.name?.[0] || member.email[0]}
                      </div>
                      <div>
                        <p className="text-base font-bold text-slate-900">{member.name || member.email}</p>
                        <p className="text-xs text-slate-500">{member.email}</p>
                        {canManageMembers && member.role !== 'OWNER' && (
                          <p className="text-xs text-slate-500">{member.employeeId ? '従業員連携済み' : '従業員未連携'}</p>
                        )}
                      </div>
                    </div>
                    {/* ⚠️ 権限の変更・削除は管理者以上のみ。
                         オーナーの行と自分自身の行では操作を出さない
                         （APIも拒否するが、押せる形で見せない）。 */}
                    {canManageMembers && member.role !== 'OWNER' && member.id !== myMemberId ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={member.role}
                          disabled={memberBusy === member.id}
                          onChange={(e) => void changeRole(member, e.target.value)}
                          className="px-3 py-1.5 rounded-full text-sm font-bold bg-slate-100 text-slate-700 border-0 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                        >
                          {assignableRoles.map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => { setEmployeeOptions([]); setLinkingMemberId(member.id); setEmployeeSearch(member.email) }}
                          disabled={memberBusy === member.id}
                          className="rounded-full border border-blue-200 px-3 py-1.5 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                        >
                          従業員連携
                        </button>
                        <button
                          onClick={() => void removeMember(member)}
                          disabled={memberBusy === member.id}
                          title="この組織から外す"
                          className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
                        >
                          <span className="material-symbols-outlined text-lg">person_remove</span>
                        </button>
                      </div>
                    ) : (
                      <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                        ROLE_STYLE[member.role] || ROLE_STYLE.MEMBER
                      }`}>
                        {ROLE_LABELS[member.role] || member.role}
                        {member.id === myMemberId && <span className="ml-1 font-normal">（あなた）</span>}
                      </span>
                    )}
                  </div>
                  {memberMsg?.id === member.id && (
                    <p className={`px-3 pb-2 text-sm font-bold ${memberMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                      {memberMsg.text}
                    </p>
                  )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-lg font-bold text-slate-500 text-center py-4">まだメンバーはいません</p>
          )}
        </div>

        {linkingMemberId && members.find(member => member.id === linkingMemberId) && (
          <div role="dialog" aria-modal="true" aria-label="従業員情報の紐付け" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">従業員情報を紐付ける</h3>
                <button type="button" onClick={() => setLinkingMemberId(null)} className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100" aria-label="閉じる">✕</button>
              </div>
              <p className="mb-3 text-sm text-slate-600">{members.find(member => member.id === linkingMemberId)?.email} が閲覧する従業員を選んでください。</p>
              <input
                value={employeeSearch}
                onChange={event => setEmployeeSearch(event.target.value)}
                placeholder="氏名・メール・社員番号で検索"
                className="mb-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {employeeOptions.map(employee => (
                  <button
                    key={employee.id}
                    type="button"
                    disabled={memberBusy === linkingMemberId}
                    onClick={() => void changeEmployeeLink(members.find(member => member.id === linkingMemberId)!, employee.id)}
                    className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-sm hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50"
                  >
                    <span className="font-bold">{employee.lastName} {employee.firstName}</span>
                    {employee.email && <span className="ml-2 text-slate-500">{employee.email}</span>}
                  </button>
                ))}
                {searchingEmployees && <p className="py-4 text-center text-sm text-slate-500">検索中...</p>}
                {!searchingEmployees && employeeOptions.length === 0 && <p className="py-4 text-center text-sm text-slate-500">候補がありません。検索語を変えてください。</p>}
              </div>
              {members.find(member => member.id === linkingMemberId)?.employeeId && (
                <button
                  type="button"
                  disabled={memberBusy === linkingMemberId}
                  onClick={() => void changeEmployeeLink(members.find(member => member.id === linkingMemberId)!, null)}
                  className="mt-4 text-sm font-bold text-rose-600 disabled:opacity-50"
                >
                  紐付けを解除
                </button>
              )}
              {memberMsg?.id === linkingMemberId && !memberMsg.ok && <p role="alert" className="mt-3 text-sm text-rose-700">{memberMsg.text}</p>}
            </div>
          </div>
        )}

        {/* 3. Organization Info */}
        <div className="bg-white rounded-3xl shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600">apartment</span>
            </div>
            組織情報
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">組織名</label>
              <input
                type="text"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                placeholder="株式会社サンプル"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">業種</label>
                <input
                  type="text"
                  value={settings.industry}
                  onChange={(e) => setSettings({ ...settings, industry: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  placeholder="IT・ソフトウェア"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">従業員規模</label>
                <select
                  value={settings.employeeScale}
                  onChange={(e) => setSettings({ ...settings, employeeScale: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                >
                  <option value="">選択してください</option>
                  <option value="1-10">1〜10名</option>
                  <option value="11-30">11〜30名</option>
                  <option value="31-50">31〜50名</option>
                  <option value="51-100">51〜100名</option>
                  <option value="101-300">101〜300名</option>
                  <option value="301+">301名以上</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">期首月</label>
              <select
                value={settings.fiscalYearStart}
                onChange={(e) => setSettings({ ...settings, fiscalYearStart: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const month = String(i + 1).padStart(2, '0')
                  return (
                    <option key={month} value={month}>{i + 1}月</option>
                  )
                })}
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full text-base font-bold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">save</span>
              {saving ? '保存中...' : '保存する'}
            </button>
          </div>
        </div>

        {/* Evaluation Templates */}
        <div className="bg-white rounded-3xl shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-red-500">description</span>
            </div>
            評価テンプレート
          </h2>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-blue-600">target</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">標準のMBO形式で評価を運用できます</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  評価期間ごとに目標（業績目標・行動目標）を設定し、本人評価・上司評価・最終評価の3段階で運用します。
                  AIによる評価コメント生成にも対応しています。評価は
                  <span className="font-bold text-slate-700">「評価」</span>メニューから作成できます。
                </p>
              </div>
            </div>
            <Link
              href="/hr/evaluations"
              className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-700"
            >
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
              評価期間を作成する
            </Link>
          </div>
        </div>

        {/* Audit Logs */}
        <div className="bg-white rounded-3xl shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-indigo-600">history</span>
            </div>
            監査ログ
          </h2>
          {auditLogsError ? (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
              監査ログを取得できませんでした。<button type="button" onClick={() => setRetryKey((key) => key + 1)} className="ml-2 underline">再試行する</button>
            </div>
          ) : auditLogs.length > 0 ? (
            <div className="space-y-2">
              {auditLogs.map((log) => {
                const actionInfo = AUDIT_ACTION_MAP[log.action] ?? {
                  icon: 'info',
                  color: 'text-slate-500',
                  label: log.action,
                }
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50"
                  >
                    <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                      <span className={`material-symbols-outlined text-sm ${actionInfo.color}`}>
                        {actionInfo.icon}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900">{actionInfo.label}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {log.actor}
                        {log.target && <> → {log.target}</>}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {log.timestamp && !isNaN(new Date(log.timestamp).getTime())
                        ? new Date(log.timestamp).toLocaleDateString('ja-JP', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <span className="material-symbols-outlined text-4xl mb-2 block text-indigo-200">history</span>
              <p className="text-sm font-bold text-slate-700">監査ログはまだありません</p>
              <p className="text-xs mt-1">組織での操作が記録されます</p>
            </div>
          )}
        </div>

        {/* Danger Zone: Owner Transfer */}
        <div className="bg-white rounded-3xl shadow-md p-6 border border-red-100">
          <h2 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-red-500">warning</span>
            </div>
            危険な操作
          </h2>
          <div className="flex items-center justify-between p-4 rounded-2xl bg-red-50">
            <div>
              <p className="text-sm font-bold text-slate-900">オーナー権限の移譲</p>
              <p className="text-xs text-slate-500 mt-0.5">
                組織のオーナー権限を別のメンバーに移譲します。この操作は取り消せません。
              </p>
            </div>
            <button
              onClick={() => setShowTransferModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-full text-sm font-bold hover:bg-red-50 transition-all"
            >
              <span className="material-symbols-outlined text-sm">swap_horiz</span>
              移譲する
            </button>
          </div>
        </div>

        {/* Owner Transfer Modal */}
        {showTransferModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowTransferModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md mx-4"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-red-500">warning</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">オーナー権限の移譲</h2>
                  <p className="text-xs text-red-500 font-bold">この操作は取り消せません</p>
                </div>
              </div>
              <div className="mb-4 p-3 bg-red-50 rounded-xl">
                <p className="text-sm text-red-700">
                  オーナー権限を移譲すると、あなたの権限は「管理者」に変更されます。
                  新しいオーナーは組織の全設定を変更できるようになります。
                </p>
                <p className="text-sm text-red-700 mt-2">
                  組織の利用上限は新しいオーナーの契約プランで判定されます。
                  現在のオーナーの有料契約は引き継がれません。移譲先のプランを事前に確認してください。
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  新しいオーナーのメールアドレス
                </label>
                <input
                  type="email"
                  value={transferEmail}
                  onChange={(e) => setTransferEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-red-500 focus:bg-white transition-all"
                  placeholder="example@company.com"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleTransferOwnership}
                  disabled={transferring || !transferEmail}
                  className="flex items-center gap-2 px-6 py-2.5 bg-red-500 text-white rounded-full text-sm font-bold shadow-md hover:shadow-lg hover:bg-red-600 transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">swap_horiz</span>
                  {transferring ? '処理中...' : '移譲を実行'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
