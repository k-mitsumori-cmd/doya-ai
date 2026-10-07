'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { withOrg } from '@/lib/sfa/client'
import { isSfaCrmPage, sfaClientDate, sfaClientId, sfaJson, type SfaClientAccount, type SfaClientContact } from '@/lib/sfa/client-response'
import { useSfaClientMutations, useSfaDraftSnapshot } from '@/lib/sfa/use-client-mutations'
import MutationRecovery from './MutationRecovery'

type Kind = 'account' | 'contact'
type Row = SfaClientAccount | SfaClientContact
type Values = Record<string, string | boolean>
const fields = {
  account: [['name', '会社名（必須）', 200], ['industry', '業界', 80], ['prefecture', '都道府県', 40], ['url', 'URL', 300], ['note', 'メモ', 2000]],
  contact: [['name', '氏名（必須）', 80], ['title', '役職', 80], ['department', '部署', 80], ['email', 'メール', 200], ['phone', '電話', 40], ['note', 'メモ', 2000]],
} as const
const emptyValues = (kind: Kind): Values => Object.fromEntries([...fields[kind].map(([key]) => [key, '']), ...(kind === 'contact' ? [['accountId', ''], ['isKeyPerson', false]] : [])])
const inputClass = 'w-full rounded-xl border border-slate-200 px-4 py-3 font-bold'
const buttonClass = 'rounded-xl border border-slate-200 bg-white px-4 py-2 font-bold text-green-700 disabled:opacity-50'

export default function CrmRecordsPage({ kind }: { kind: Kind }) {
  const orgSlug = (useParams().orgSlug as string) || ''
  const label = kind === 'account' ? '取引先' : '担当者'
  const path = '/api/sfa/' + kind + 's'
  const reload = useRef<() => void>(() => {})
  const mutations = useSfaClientMutations(orgSlug, () => reload.current())
  const [q, setQ] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [list, setList] = useState<{ key: string; query: string; rows: Row[]; total: number; cursor: string | null }>({ key: '', query: '', rows: [], total: 0, cursor: null })
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(false)
  const [moreError, setMoreError] = useState(false)
  const [moreLoading, setMoreLoading] = useState(false)
  const requestVersion = useRef(0)
  const listController = useRef<AbortController | null>(null)
  const moreController = useRef<AbortController | null>(null)
  const moreFlight = useRef('')
  const pageCursors = useRef(new Set<string>())
  const [form, setForm] = useState<{ identity: string; open: boolean; row: Row | null; values: Values }>({ identity: '', open: false, row: null, values: emptyValues(kind) })
  const [formMessage, setFormMessage] = useState('')
  const [deletion, setDeletion] = useState<{ identity: string; row: Row } | null>(null)
  const draft = useSfaDraftSnapshot(form)
  const deleteDraft = useSfaDraftSnapshot(deletion)
  const [switchTarget, setSwitchTarget] = useState<{ identity: string; row: Row | null } | null>(null)
  const ready = mutations.allowed
  const currentList = ready && list.key === mutations.key && list.query === q.trim()
  const currentForm = ready && form.identity === mutations.identity && form.open
  const currentDeletion = ready && deletion?.identity === mutations.identity ? deletion.row : null
  const createLane = kind + ':create'
  const formLane = form.row ? kind + ':' + form.row.id : createLane
  const [options, setOptions] = useState<{ key: string; rows: { id: string; name: string }[]; loading: boolean; error: boolean }>({ key: '', rows: [], loading: true, error: false })
  const [optionsRefresh, setOptionsRefresh] = useState(0)
  const currentOptions = options.key === mutations.key && ready

  const load = useCallback(() => {
    if (!ready || !mutations.active()) return
    const version = ++requestVersion.current
    listController.current?.abort(); moreController.current?.abort(); moreFlight.current = ''; pageCursors.current = new Set()
    const controller = new AbortController(); listController.current = controller
    setLoading(true); setListError(false); setMoreError(false); setMoreLoading(false)
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    void sfaJson(path + '?' + params, orgSlug, { signal: controller.signal }).then(data => {
      if (!isSfaCrmPage(data, kind)) throw new Error('Invalid CRM page')
      if (version !== requestVersion.current || controller.signal.aborted || !mutations.active()) return
      setList({ key: mutations.key, query: q.trim(), rows: (kind === 'account' ? data.accounts : data.contacts)!, total: data.totalCount, cursor: data.nextCursor })
    }).catch(() => {
      if (version === requestVersion.current && !controller.signal.aborted && mutations.active()) { setList({ key: mutations.key, query: q.trim(), rows: [], total: 0, cursor: null }); setListError(true) }
    }).finally(() => { if (version === requestVersion.current && !controller.signal.aborted && mutations.active()) setLoading(false) })
    // Requests keep the actor/org epoch captured when they started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mutations.key, q, kind, path, orgSlug])
  reload.current = load
  useEffect(() => {
    const timer = setTimeout(load, q ? 200 : 0)
    return () => { clearTimeout(timer); listController.current?.abort(); moreController.current?.abort() }
  }, [load, q, refresh])

  useEffect(() => {
    if (kind !== 'contact' || !ready) return
    const controller = new AbortController()
    setOptions({ key: mutations.key, rows: [], loading: true, error: false })
    void (async () => {
      const rows: { id: string; name: string }[] = [], ids = new Set<string>(), cursors = new Set<string>()
      let cursor: string | null = null
      do {
        if (cursors.size >= 1000) throw new Error('Too many account option pages')
        const params = new URLSearchParams({ options: '1' }); if (cursor) params.set('cursor', cursor)
        const data = await sfaJson('/api/sfa/accounts?' + params, orgSlug, { signal: controller.signal })
        if (!Array.isArray(data.accounts) || data.accounts.length > 200 || !Number.isSafeInteger(data.totalCount) || (data.totalCount as number) < data.accounts.length
          || !(data.nextCursor === null || typeof data.nextCursor === 'string' && data.nextCursor.length > 0 && data.nextCursor.length <= 512)) throw new Error('Invalid account options')
        for (const row of data.accounts) {
          if (!row || !sfaClientId(row.id) || typeof row.name !== 'string' || !row.name.trim() || row.name.length > 10000 || !sfaClientDate(row.updatedAt)) throw new Error('Invalid account option')
          if (!ids.has(row.id)) { ids.add(row.id); rows.push({ id: row.id, name: row.name }) }
        }
        cursor = data.nextCursor as string | null
        if (cursor) { if (cursors.has(cursor)) throw new Error('Repeated account cursor'); cursors.add(cursor) }
      } while (cursor)
      if (!controller.signal.aborted && mutations.active()) setOptions({ key: mutations.key, rows, loading: false, error: false })
    })().catch(() => { if (!controller.signal.aborted && mutations.active()) setOptions({ key: mutations.key, rows: [], loading: false, error: true }) })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, ready, mutations.key, orgSlug, optionsRefresh])

  const loadMore = async () => {
    if (!currentList || !list.cursor || moreFlight.current || !mutations.active()) return
    const version = requestVersion.current, cursor = list.cursor, token = mutations.key + ':' + version + ':' + cursor
    moreFlight.current = token
    const controller = new AbortController(); moreController.current = controller
    setMoreLoading(true); setMoreError(false)
    try {
      const params = new URLSearchParams({ cursor }); if (q.trim()) params.set('q', q.trim())
      const data = await sfaJson(path + '?' + params, orgSlug, { signal: controller.signal })
      if (!isSfaCrmPage(data, kind) || data.nextCursor === cursor || data.nextCursor && pageCursors.current.has(data.nextCursor)) throw new Error('Invalid CRM page')
      if (version !== requestVersion.current || controller.signal.aborted || !mutations.active()) return
      const rows = (kind === 'account' ? data.accounts : data.contacts)!
      if (data.totalCount < new Set([...list.rows, ...rows].map(row => row.id)).size) throw new Error('CRM list changed during pagination')
      pageCursors.current.add(cursor)
      setList(current => {
        const ids = new Set(current.rows.map(row => row.id))
        return { ...current, rows: [...current.rows, ...rows.filter(row => !ids.has(row.id))], cursor: data.nextCursor, total: data.totalCount }
      })
    } catch { if (version === requestVersion.current && !controller.signal.aborted && mutations.active()) setMoreError(true) }
    finally { if (moreFlight.current === token) { moreFlight.current = ''; if (mutations.active()) setMoreLoading(false) } }
  }
  const replaceForm = (row: Row | null) => {
    if (!mutations.active()) return
    if (row && mutations.blocked(kind + ':' + row.id)) return
    const values = emptyValues(kind)
    if (row) for (const key of Object.keys(values)) values[key] = (row as unknown as Record<string, string | boolean | null>)[key] ?? (key === 'isKeyPerson' ? false : '')
    setForm({ identity: mutations.identity, open: true, row, values }); setFormMessage('')
  }
  const openForm = (row: Row | null) => {
    if (!mutations.active()) return
    if (form.identity === mutations.identity && form.row?.id === row?.id) { setForm(current => ({ ...current, open: true })); return }
    const changed = form.identity === mutations.identity && Object.entries(form.values).some(([key, value]) => value !== (form.row ? (form.row as unknown as Record<string, unknown>)[key] ?? (key === 'isKeyPerson' ? false : '') : emptyValues(kind)[key]))
    if (changed) { setSwitchTarget({ identity: mutations.identity, row }); return }
    replaceForm(row)
  }
  const save = async () => {
    if (!currentForm || !mutations.active() || (!form.row && mutations.creationBlocked(kind)) || mutations.blocked(formLane)) return
    const revision = draft.current.revision
    setFormMessage('')
    const body = { ...form.values }
    // Preserve untouched legacy fields instead of resending values above today's write limits.
    if (form.row) for (const key of Object.keys(body)) {
      const before = (form.row as unknown as Record<string, unknown>)[key] ?? (key === 'isKeyPerson' ? false : '')
      if (body[key] === before) delete body[key]
    }
    if (fields[kind].some(([key, , max]) => key in body && (typeof body[key] !== 'string' || (key === 'name' ? String(body[key]).trim() : String(body[key])).length > max)) || (!form.row || 'name' in body) && !String(body.name).trim()) { setFormMessage('必須項目と各項目の文字数をご確認ください。'); return }
    if (form.row && !Object.keys(body).length) { setFormMessage('変更内容がありません。'); return }
    const result = form.row ? await mutations.mutateCrm(kind, form.row, body) : await mutations.create(kind, createLane, body)
    if (!result || !mutations.active()) return
    if (draft.current.revision === revision) setForm({ identity: mutations.identity, open: false, row: null, values: emptyValues(kind) })
    else {
      if (form.row) { const saved = (result as Record<string, unknown>)[kind] as Row; setForm(current => current.identity === mutations.identity && current.row?.id === form.row?.id ? { ...current, row: saved } : current) }
      setFormMessage('保存しました。送信後に変更した入力は保持しています。同じ内容を重ねて送信しないでください。')
    }
    toast.success(label + 'を保存しました'); reload.current()
  }
  const remove = async () => {
    if (!currentDeletion || !mutations.active()) return
    const revision = deleteDraft.current.revision
    const result = await mutations.mutateCrm(kind, currentDeletion, null)
    if (!result || !mutations.active()) return
    if (deleteDraft.current.revision === revision) setDeletion(null)
    toast.success(label + 'を削除しました'); reload.current()
  }

  return <div className="p-6 lg:p-10 max-w-5xl mx-auto">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div><h1 className="text-2xl font-black text-slate-900">{label}</h1><p className="text-slate-500 font-bold text-sm">{kind === 'account' ? '会社・顧客を一元管理' : '取引先のキーマン・連絡先を管理'}</p></div>
      <div className="flex gap-2">
        {kind === 'account' && ready && <a href={withOrg('/api/sfa/export?type=accounts', orgSlug)} className={buttonClass}>CSV出力</a>}
        <button type="button" className={buttonClass} disabled={!ready || loading} onClick={() => setRefresh(v => v + 1)}>一覧を更新</button>
        <button type="button" onClick={() => openForm(null)} disabled={!ready || mutations.creationBlocked(kind) || currentForm && mutations.busy.includes(formLane)} className={buttonClass}>新規登録</button>
      </div>
    </div>
    <MutationRecovery mutations={mutations} />
    {ready && switchTarget?.identity === mutations.identity && <div role="alertdialog" aria-label="入力の切り替え確認" className="mb-4 rounded-xl border border-amber-200 p-4">
      <p>未保存の入力を破棄して、別の入力に切り替えますか？</p>
      <button type="button" className={buttonClass} onClick={() => { replaceForm(switchTarget.row); setSwitchTarget(null) }}>入力を破棄して切り替える</button>
      <button type="button" className={buttonClass} onClick={() => setSwitchTarget(null)}>入力を保持する</button>
    </div>}
    {currentForm && <div className="bg-white rounded-2xl shadow-sm p-5 mb-6 space-y-3">
      <h2 className="font-bold">{label}の{form.row ? '編集' : '登録'}</h2>
      {fields[kind].map(([key, placeholder, max]) => <label key={key} className="block text-sm text-slate-700">{placeholder}（{max}文字以内）
        {key === 'note' ? <textarea aria-label={placeholder} value={String(form.values[key])} onChange={e => setForm(current => ({ ...current, values: { ...current.values, [key]: e.target.value } }))} className={inputClass} />
          : <input aria-label={placeholder} placeholder={placeholder} value={String(form.values[key])} onChange={e => setForm(current => ({ ...current, values: { ...current.values, [key]: e.target.value } }))} className={inputClass} />}
      </label>)}
      {kind === 'contact' && <>
        <label className="block text-sm text-slate-700">取引先<select aria-label="取引先" value={String(form.values.accountId)} disabled={!currentOptions || options.loading || options.error} onChange={e => setForm(current => ({ ...current, values: { ...current.values, accountId: e.target.value } }))} className={inputClass}>
          <option value="">取引先なし</option>
          {currentOptions && String(form.values.accountId) && !options.rows.some(row => row.id === form.values.accountId) && <option value={String(form.values.accountId)}>現在の取引先（再選択できます）</option>}
          {currentOptions && options.rows.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
        </select></label>
        {(!currentOptions || options.loading) && <p>取引先の選択肢を読み込み中です。</p>}
        {currentOptions && options.error && <p role="alert">取引先の選択肢を読み込めませんでした。<button type="button" className="underline" onClick={() => setOptionsRefresh(v => v + 1)}>選択肢を再試行</button></p>}
        <label className="flex gap-2"><input type="checkbox" checked={Boolean(form.values.isKeyPerson)} onChange={e => setForm(current => ({ ...current, values: { ...current.values, isKeyPerson: e.target.checked } }))} />キーマン（決裁者）</label>
      </>}
      {formMessage && <p role="status">{formMessage}</p>}
      {form.row && <div className="text-sm text-slate-600"><p>更新が競合した場合は「一覧を更新」し、保存済みの内容を開き直してください。入力の破棄前に確認します。</p><button type="button" className={buttonClass} disabled={!currentList || loading || mutations.blocked(formLane) || !list.rows.some(row => row.id === form.row?.id)} onClick={() => { const row = list.rows.find(row => row.id === form.row?.id); if (row && mutations.active()) setSwitchTarget({ identity: mutations.identity, row }) }}>最新の内容で開き直す</button></div>}
      <div className="flex gap-2"><button type="button" onClick={save} disabled={mutations.blocked(formLane) || !form.row && mutations.creationBlocked(kind)} className={buttonClass}>{mutations.busy.includes(formLane) ? '保存中…' : form.row ? '変更を保存する' : '登録する'}</button>
        <button type="button" onClick={() => setForm(current => ({ ...current, open: false }))} className={buttonClass}>入力を閉じる</button></div>
    </div>}
    {currentDeletion && <div role="alertdialog" aria-label={label + 'の削除確認'} className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="break-words">「{currentDeletion.name}」を削除しますか？ 関連する商談・担当者が残る場合は削除できません。過去の活動は保持します。</p>
      {kind === 'contact' && <p className="my-2 text-sm">商談に紐づく場合は、商談の詳細で「担当者レコードとの紐づけを解除」を選び、保存してください。商談と担当者名は保持されます。<a className="ml-2 underline" href={'/sfa/' + encodeURIComponent(orgSlug) + '/deals'}>商談を開く</a></p>}
      <button type="button" className={buttonClass} disabled={mutations.blocked(kind + ':' + currentDeletion.id)} onClick={remove}>削除を確定する</button>
      <button type="button" className={buttonClass} onClick={() => setDeletion(null)}>戻る</button>
    </div>}
    <label className="block mb-4">{kind === 'account' ? '会社名で検索' : '氏名で検索'}<input aria-label="検索" value={q} maxLength={100} onChange={e => { requestVersion.current++; setQ(e.target.value) }} className={inputClass} /></label>
    {ready && (loading || !currentList) && <p>{label}を読み込み中です...</p>}
    {currentList && listError && <p role="alert">{label}を読み込めませんでした。<button type="button" className="underline" onClick={() => setRefresh(v => v + 1)}>再試行</button></p>}
    {currentList && !loading && !listError && <>
      <p className="mb-3 text-xs text-slate-500">{list.total}件中{list.rows.length}件を表示</p>
      {!list.rows.length && <p>{label}がありません。「新規登録」から追加できます。</p>}
      <div className="space-y-2">{list.rows.map(row => <div key={row.id} className="bg-white rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1"><p className="font-bold break-words">{row.name}</p><p className="text-xs text-slate-500 break-words">{'industry' in row ? [row.industry, row.prefecture].filter(Boolean).join(' · ') : [row.accountName, row.title, row.email, row.phone, row.isKeyPerson ? 'キーマン' : ''].filter(Boolean).join(' · ')}</p></div>
        <button type="button" disabled={mutations.blocked(kind + ':' + row.id)} className={buttonClass} onClick={() => openForm(row)}>編集</button>
        <button type="button" disabled={mutations.blocked(kind + ':' + row.id)} className={buttonClass} onClick={() => { if (mutations.active()) setDeletion({ identity: mutations.identity, row }) }}>削除</button>
      </div>)}</div>
      {list.cursor && <div className="mt-4"><button type="button" onClick={loadMore} disabled={moreLoading} className={buttonClass}>さらに表示</button>{moreError && <p role="alert">追加の{label}を読み込めませんでした。再度お試しください。</p>}</div>}
    </>}
  </div>
}
