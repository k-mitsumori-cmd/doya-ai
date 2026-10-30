'use client'

import { useEffect, useRef, useState } from 'react'
import { useOrgSettingsGuard } from '@/lib/use-org-settings-guard'
import { useSfaClientMutations, useSfaDraftSnapshot } from '@/lib/sfa/use-client-mutations'
import { isSfaClientTeam, sfaClientId, sfaJson, type SfaClientTeam } from '@/lib/sfa/client-response'
import MutationRecovery from './MutationRecovery'

type Member = { id: string; name: string | null; role: string }
type Listing = { key: string; teams: SfaClientTeam[]; members: Member[]; canManage: boolean }
const button = 'inline-flex min-w-0 max-w-full break-all whitespace-normal text-left min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50'
const roles: Record<string, string> = { owner: 'オーナー', admin: '管理者', manager: 'マネージャー', member: 'メンバー' }

export default function TeamManagement({ orgSlug }: { orgSlug: string }) {
  const guard = useOrgSettingsGuard(orgSlug)
  return <TeamPanel key={guard.identity} orgSlug={orgSlug} />
}
function TeamPanel({ orgSlug }: { orgSlug: string }) {
  const reload = useRef<() => void>(() => {})
  const mutations = useSfaClientMutations(orgSlug, () => reload.current())
  const [refresh, setRefresh] = useState(0)
  reload.current = () => setRefresh(value => value + 1)
  const [listing, setListing] = useState<Listing | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<SfaClientTeam | null>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [deleting, setDeleting] = useState<SfaClientTeam | null>(null)
  const [message, setMessage] = useState('')
  const draft = useSfaDraftSnapshot([name, selected, editing?.id])
  const ready = mutations.allowed && listing?.key === mutations.key
  const canManage = ready && listing.canManage
  const lane = editing ? 'team:' + editing.id : 'team:create'
  const busy = mutations.busy.includes(lane)
  const dirty = !!name || selected.length > 0
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setLoadError(false); setListing(null)
    if (!mutations.allowed) return () => controller.abort()
    void sfaJson('/api/sfa/teams', orgSlug, { signal: controller.signal }).then(data => {
      if (controller.signal.aborted || !mutations.active()) return
      const teams = data.teams, members = data.members
      if (typeof data.canManage !== 'boolean' || !Array.isArray(teams) || !teams.every(isSfaClientTeam) || new Set(teams.map(team => team.id)).size !== teams.length
        || !Array.isArray(members) || !members.every(member => member && typeof member === 'object' && sfaClientId(member.id) && (member.name === null || typeof member.name === 'string') && typeof member.role === 'string' && Object.hasOwn(roles, member.role))
        || new Set(members.map(member => member.id)).size !== members.length || data.canManage === false && members.length > 0) throw new Error('Invalid teams response')
      setListing({ key: mutations.key, canManage: data.canManage, teams, members })
    }).catch(() => { if (!controller.signal.aborted && mutations.active()) setLoadError(true) })
      .finally(() => { if (!controller.signal.aborted && mutations.active()) setLoading(false) })
    return () => controller.abort()
    // The key captures actor, organization and authentication generation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, mutations.key, mutations.allowed, refresh])
  const choose = (team: SfaClientTeam | null) => {
    if (!canManage || !mutations.active() || busy) return
    if (open && dirty) { setMessage('編集中の入力を保持しています。別のチームを開く前に保存するか、「入力を破棄して閉じる」を押してください。'); return }
    setEditing(team); setName(team?.name || ''); setSelected(team?.members.map(member => member.memberId) || []); setOpen(true); setMessage('')
  }
  const save = async () => {
    if (!canManage || !mutations.active() || busy || mutations.blocked(lane) || !name.trim() || name.trim().length > 80 || selected.length > 500) return
    const revision = draft.current.revision
    const body = { name: name.trim(), memberIds: [...selected].sort() }
    const result = editing ? await mutations.mutateTeam(editing, body) : await mutations.create('team', 'team:create', body)
    if (!mutations.active()) return
    if (!result) { reload.current(); return }
    const saved = editing ? (result as { team: SfaClientTeam }).team : result as SfaClientTeam
    if (draft.current.revision === revision) { setOpen(false); setEditing(null); setName(''); setSelected([]) }
    else { setEditing(saved); setMessage('設定を保存しました。送信後に変更した入力は保持しています。') }
    reload.current()
  }
  const remove = async () => {
    if (!canManage || !deleting || !mutations.active()) return
    const result = await mutations.mutateTeam(deleting, null)
    if (!mutations.active()) return
    if (!result) { reload.current(); return }
    if (editing?.id === deleting.id) { setOpen(false); setEditing(null); setName(''); setSelected([]) }
    setDeleting(null); reload.current()
  }
  if (!mutations.allowed) return null
  return <section aria-labelledby="sfa-teams-heading" className="mt-8 space-y-4">
    <h2 id="sfa-teams-heading" className="text-xl font-semibold text-slate-900">営業チーム</h2>
    <p className="text-sm text-slate-600">マネージャーは所属チームの担当データを閲覧・割当できます。チームの変更は管理者・オーナーが行います。</p>
    <MutationRecovery mutations={mutations} />
    {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
    {loading && <p role="status" className="text-sm">チームを読み込んでいます。</p>}
    {loadError && <p role="alert" className="text-sm text-red-700">チームを取得できませんでした。<button type="button" className={button} onClick={() => setRefresh(value => value + 1)}>チームを再読み込み</button></p>}
    {ready && !loading && !loadError && <>
      <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={() => setRefresh(value => value + 1)}>チーム一覧を更新</button>{canManage && <button type="button" className={button} disabled={mutations.creationBlocked('team') || busy} onClick={() => choose(null)}>チームを作成</button>}</div>
      {!listing.teams.length && <p className="text-sm text-slate-600">{canManage ? 'チームはまだありません。「チームを作成」から担当範囲を設定できます。' : '所属しているチームはありません。担当範囲は管理者にご確認ください。'}</p>}
      {listing.teams.map(team => <article key={team.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="break-words text-base font-semibold">{team.name}</h3>
        <p className="break-words text-sm text-slate-600">{team.members.length ? team.members.map(item => `${item.member.name || '名前未登録'}（${roles[item.member.role]}）`).join('、') : '所属メンバーなし'}</p>
        {canManage && <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={mutations.blocked('team:' + team.id)} onClick={() => choose(team)}>「{team.name}」のチーム設定</button><button type="button" className={button} disabled={mutations.blocked('team:' + team.id)} onClick={() => { if (mutations.active()) setDeleting(team) }}>「{team.name}」を削除</button></div>}
      </article>)}
    </>}
    {canManage && open && <form className="space-y-4 rounded-xl border border-slate-200 bg-white p-4" onSubmit={event => { event.preventDefault(); void save() }}>
      <h3 className="text-base font-semibold">{editing ? 'チーム設定を変更' : '新しいチーム'}</h3>
      <label className="block text-sm font-semibold">チーム名<input className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" value={name} maxLength={80} required disabled={busy || mutations.blocked(lane)} onChange={event => setName(event.target.value)} /></label>
      <fieldset disabled={busy || mutations.blocked(lane)} className="space-y-2"><legend className="text-sm font-semibold">所属メンバー</legend>
        {listing.members.map(member => <label key={member.id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(member.id)} onChange={event => setSelected(ids => event.target.checked ? [...ids, member.id] : ids.filter(id => id !== member.id))} />{member.name || '名前未登録'}（{roles[member.role]}）</label>)}
        {selected.filter(id => !listing.members.some(member => member.id === id)).map(id => <label key={id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked onChange={() => setSelected(ids => ids.filter(value => value !== id))} />現在は参加していないメンバー（外して保存してください）</label>)}
      </fieldset>
      <p className="text-sm text-slate-600">メンバーを外すと、その担当データはチーム内のマネージャーから閲覧できなくなります。</p>
      <div className="flex flex-wrap gap-2"><button type="submit" className={button} disabled={busy || mutations.blocked(lane) || !name.trim()}>{busy ? '保存しています' : 'チーム設定を保存'}</button><button type="button" className={button} disabled={busy} onClick={() => { setOpen(false); setEditing(null); setName(''); setSelected([]); setMessage('') }}>入力を破棄して閉じる</button></div>
    </form>}
    {canManage && deleting && <div role="alertdialog" aria-label="チームの削除確認" className="space-y-3 rounded-xl border border-red-200 bg-white p-4">
      <p className="text-sm">「{deleting.name}」を削除しますか？ 所属メンバーの担当データは削除されません。チーム単位の閲覧権限が解除されます。</p>
      <button type="button" className={button} disabled={mutations.blocked('team:' + deleting.id)} onClick={() => void remove()}>チームの削除を確定</button><button type="button" className={button} disabled={mutations.busy.includes('team:' + deleting.id)} onClick={() => setDeleting(null)}>削除せず戻る</button>
    </div>}
  </section>
}
