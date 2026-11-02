'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useOrgSettingsGuard } from '@/lib/use-org-settings-guard'
import { sfaJson, SfaClientRejection, sfaClientDate, sfaClientId } from '@/lib/sfa/client-response'

type Kind = 'account' | 'contact' | 'lead' | 'deal' | 'task'
type Access = { kind: Kind; id: string; updatedAt: string; assigneeMemberId: string | null; isShared?: boolean }
type Snapshot = { canEdit: boolean; canUnassign: boolean; members: { id: string; name: string | null }[]; access: Access }
const button = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50'
function snapshot(value: Record<string, unknown>, kind: Kind, id: string): Snapshot {
  const access = value.access as Access | null
  const members = value.members as Snapshot['members']
  if (value.state !== 'found' || !access || access.kind !== kind || access.id !== id || !sfaClientDate(access.updatedAt)
    || access.assigneeMemberId !== null && !sfaClientId(access.assigneeMemberId)
    || kind === 'account' && typeof access.isShared !== 'boolean'
    || typeof value.canEdit !== 'boolean' || typeof value.canUnassign !== 'boolean'
    || !Array.isArray(members) || !members.every(member => member && sfaClientId(member.id) && (member.name === null || typeof member.name === 'string'))
    || new Set(members.map(member => member.id)).size !== members.length) throw new Error('設定の応答を確認できませんでした。')
  return { access, members, canEdit: value.canEdit, canUnassign: value.canUnassign }
}

export default function RecordAccessSettings(props: { orgSlug: string; kind: Kind; id: string; onChanged: () => void }) {
  const guard = useOrgSettingsGuard(props.orgSlug)
  return <AccessForm key={JSON.stringify([guard.identity, props.kind, props.id])} {...props} guard={guard} />
}
function AccessForm({ orgSlug, kind, id, onChanged, guard }: { orgSlug: string; kind: Kind; id: string; onChanged: () => void; guard: ReturnType<typeof useOrgSettingsGuard> }) {
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<Snapshot | null>(null)
  const [loadedKey, setLoadedKey] = useState('')
  const phase = useRef<'read' | 'write' | null>(null)
  const [assignee, setAssignee] = useState('')
  const [shared, setShared] = useState(false)
  const [busy, setBusy] = useState<'read' | 'write' | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const currentData = loadedKey === guard.key && guard.allowed ? data : null
  useEffect(() => {
    if (phase.current === 'write') setUncertain(true)
    phase.current = null
    setBusy(null)
  }, [guard.key])
  const read = async (preserveDraft = false) => {
    const operation = guard.begin('record-access-read:' + kind + ':' + id)
    if (!operation) return
    phase.current = 'read'
    setBusy('read'); setError('')
    try {
      const response = await sfaJson('/api/sfa/record-access?kind=' + kind + '&id=' + encodeURIComponent(id), orgSlug, { signal: operation.signal })
      if (!operation.current()) return
      if (response.state === 'missing') { setData(null); setError('現在このデータを開けません。一覧を更新してください。'); return }
      const fresh = snapshot(response, kind, id)
      setData(fresh); setLoadedKey(guard.key)
      if (!preserveDraft) { setAssignee(fresh.access.assigneeMemberId || ''); setShared(fresh.access.isShared === true) }
      setUncertain(false)
      setMessage(preserveDraft ? '最新の設定を取得しました。入力内容と現在の設定を確認してください。' : '')
    } catch (failure) {
      if (!operation.current()) return
      if (failure instanceof SfaClientRejection && failure.status === 401) guard.rejectAuthentication()
      if (failure instanceof SfaClientRejection && failure.status === 403) setData(null)
      setError(failure instanceof SfaClientRejection ? failure.message : '設定を取得できませんでした。再度確認してください。')
    } finally { if (operation.current()) { phase.current = null; setBusy(null) }; operation.end() }
  }
  const dirty = !!currentData && (assignee !== (currentData.access.assigneeMemberId || '') || kind === 'account' && shared !== currentData.access.isShared)
  const assigneeValid = !!currentData && (assignee === '' ? currentData.canUnassign : currentData.members.some(member => member.id === assignee))
  const save = async () => {
    if (!currentData?.canEdit || !dirty || !assigneeValid || uncertain || busy) return
    const operation = guard.begin('record-access-write:' + kind + ':' + id)
    if (!operation) return
    phase.current = 'write'
    setBusy('write'); setError(''); setMessage('')
    const body = { kind, id, expectedUpdatedAt: currentData.access.updatedAt,
      ...(assignee !== (currentData.access.assigneeMemberId || '') ? { assigneeMemberId: assignee || null } : {}),
      ...(kind === 'account' && shared !== currentData.access.isShared ? { isShared: shared } : {}) }
    try {
      const response = await sfaJson('/api/sfa/record-access', orgSlug, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: operation.signal })
      if (!operation.current()) return
      if (response.ok !== true || response.id !== id || !sfaClientDate(response.updatedAt) || response.updatedAt <= currentData.access.updatedAt || typeof response.isReadable !== 'boolean') throw new Error('Unconfirmed access change')
      setMessage(response.isReadable ? '担当・共有の設定を保存しました。' : '設定を保存しました。現在の担当範囲から外れたため、一覧を更新します。')
      setOpen(false); onChanged()
    } catch (failure) {
      if (!operation.current()) return
      if (failure instanceof SfaClientRejection) {
        if (failure.status === 401) guard.rejectAuthentication()
        setError(failure.message)
      } else setError('保存結果を確認できませんでした。入力を保持しています。「最新の設定を確認」で確認してください。')
      // Neither a lost response nor a version conflict may trigger a blind write retry.
      setUncertain(true)
    } finally { if (operation.current()) { phase.current = null; setBusy(null) }; operation.end() }
  }
  if (!guard.allowed) return null
  return <div className="min-w-0 text-sm" onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
    <button type="button" className={button} aria-expanded={open} aria-controls={panelId} disabled={busy === 'write'} onClick={() => {
      if (!guard.active()) return
      setOpen(current => !current)
      if (!open && !data && !uncertain) void read()
    }}>担当{kind === 'account' ? '・共有' : ''}設定</button>
    {open && <section id={panelId} aria-label="担当・共有の設定" className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      {busy === 'read' && <p role="status">設定を読み込んでいます。</p>}
      {currentData && <>
        <p className="text-slate-600">現在の担当：{currentData.members.find(member => member.id === currentData.access.assigneeMemberId)?.name || (currentData.access.assigneeMemberId ? '登録済みの担当者' : '未割当')}{kind === 'account' ? `／共有：${currentData.access.isShared ? '組織内に共有' : '担当範囲のみ'}` : ''}</p>
        {!currentData.canEdit ? <p>共有された取引先は閲覧のみ可能です。</p> : <>
          <label className="block font-semibold">担当者<select className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" value={assignee} disabled={!!busy || uncertain} onChange={event => setAssignee(event.target.value)}>
            {currentData.canUnassign && <option value="">未割当</option>}
            {assignee && !currentData.members.some(member => member.id === assignee) && <option value={assignee}>現在の担当者（選び直してください）</option>}
            {!assignee && !currentData.canUnassign && <option value="" disabled>担当者を選択してください</option>}
            {currentData.members.map(member => <option key={member.id} value={member.id}>{member.name || '名前未登録のメンバー'}</option>)}
          </select></label>
          {kind === 'account' && <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={shared} disabled={!!busy || uncertain} onChange={event => setShared(event.target.checked)} />この取引先を組織内に共有する</label>}
          {kind === 'account' && <p className="text-slate-600">共有先には閲覧を許可します。関連する商談・連絡先・活動は、各担当範囲で制限されます。</p>}
          {currentData.canUnassign && <p className="text-slate-600">担当を変更すると、このデータを閲覧できなくなる場合があります。</p>}
          <button type="button" className={button} disabled={!dirty || !assigneeValid || !!busy || uncertain} onClick={() => void save()}>{busy === 'write' ? '保存しています' : '設定を保存'}</button>
        </>}
      </>}
      <button type="button" className={button} disabled={!!busy} onClick={() => void read(!!data)}>最新の設定を確認</button>
    </section>}
    {message && <p role="status" className="mt-2 text-slate-700">{message}</p>}
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
  </div>
}
