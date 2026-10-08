'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import HrAuthenticatedScope from '@/components/hr/HrAuthenticatedScope'
import DepartmentListState from '@/components/hr/DepartmentListState'
import { useHrDepartmentList } from '@/lib/hr/use-department-list'
import { useHrPageLifetime } from '@/lib/hr/use-page-lifetime'

import Link from 'next/link'

interface Department {
  id: string
  name: string
}

interface FormState {
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  employeeNumber: string
  email: string
  phone: string
  departmentId: string
  position: string
  grade: string
  employmentType: string
  hireDate: string
  birthDate: string
  gender: string
}

const EMPLOYMENT_TYPES = [
  { value: 'FULL_TIME', label: '正社員' },
  { value: 'PART_TIME', label: 'パート・アルバイト' },
  { value: 'CONTRACT', label: '契約社員' },
  { value: 'INTERN', label: 'インターン' },
  { value: 'OUTSOURCE', label: '業務委託' },
]

const GENDERS = [
  { value: 'MALE', label: '男性' },
  { value: 'FEMALE', label: '女性' },
  { value: 'OTHER', label: 'その他' },
]

const inputCls =
  'w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all'

function toDateInput(v: any): string {
  if (!v) return ''
  try {
    return new Date(v).toISOString().slice(0, 10)
  } catch {
    return typeof v === 'string' ? v.slice(0, 10) : ''
  }
}

export default function EditEmployeePage() {
  const params = useParams()
  const id = params?.id as string
  return <HrAuthenticatedScope callbackUrl={'/hr/employees/' + encodeURIComponent(id) + '/edit'}>{actor => <EditEmployeeForActor key={id} actor={actor} />}</HrAuthenticatedScope>
}
function EditEmployeeForActor({ actor }: { actor: string }) {
  const params = useParams()
  const id = params?.id as string
  const { fetch, toast, router } = useHrPageLifetime()
  const departmentList = useHrDepartmentList('authenticated', actor)
  const departments = departmentList.rows

  const submitLock = useRef<object | null>(null)
  const currentId = useRef(id)
  currentId.current = id
  const editScope = useRef({ id, active: true })
  const photoRead = useRef(0)
  const [loadedVersion, setLoadedVersion] = useState<{ id: string; updatedAt: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [form, setForm] = useState<FormState>({
    lastName: '',
    firstName: '',
    lastNameKana: '',
    firstNameKana: '',
    employeeNumber: '',
    email: '',
    phone: '',
    departmentId: '',
    position: '',
    grade: '',
    employmentType: 'FULL_TIME',
    hireDate: '',
    birthDate: '',
    gender: '',
  })

  useEffect(() => {
    if (!id) return
    editScope.current.active = false
    const scope = { id, active: true }
    editScope.current = scope
    photoRead.current += 1
    submitLock.current = null
    setSaving(false)
    let active = true
    const controller = new AbortController()
    setLoading(true)
    setNotFound(false)
    setLoadedVersion(null)
    setPhotoFile(null)
    setPhotoPreview(null)
    async function load() {
      try {
        const empRes = await fetch(`/api/hr/employees/${encodeURIComponent(id)}`, { signal: controller.signal, cache: 'no-store' })
        if (!active) return
        if (!empRes.ok) {
          setNotFound(true)
          return
        }
        const data = await empRes.json()
        const e = data.employee ?? data
        if (!active) return
        const version = typeof e.updatedAt === 'string' ? new Date(e.updatedAt) : null
        if (e.id !== id || !version || !Number.isFinite(version.getTime()) || version.toISOString() !== e.updatedAt) {
          setNotFound(true)
          return
        }
        setLoadedVersion({ id, updatedAt: e.updatedAt })
        setForm({
          lastName: e.lastName ?? '',
          firstName: e.firstName ?? '',
          lastNameKana: e.lastNameKana ?? '',
          firstNameKana: e.firstNameKana ?? '',
          employeeNumber: e.employeeNumber ?? '',
          email: e.email ?? '',
          phone: e.phone ?? '',
          departmentId: e.departmentId ?? e.department?.id ?? '',
          position: e.position ?? '',
          grade: e.grade ?? '',
          employmentType: e.employmentType ?? 'FULL_TIME',
          hireDate: toDateInput(e.hireDate),
          birthDate: toDateInput(e.birthDate),
          gender: e.gender ?? '',
        })
        setPhotoUrl(e.photoUrl ?? '')

      } catch {
        if (active) setNotFound(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false; scope.active = false; controller.abort() }
  }, [id, fetch])

  const update = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const scope = editScope.current
    const sequence = ++photoRead.current
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      if (scope.active && editScope.current === scope && currentId.current === scope.id && photoRead.current === sequence) setPhotoPreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const removePhoto = () => {
    photoRead.current += 1
    setPhotoFile(null)
    setPhotoPreview(null)
    setPhotoUrl('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitLock.current || !loadedVersion || loadedVersion.id !== id || departmentList.status !== 'ready' || (form.departmentId && !departments.some(d => d.id === form.departmentId))) return
    if (!form.lastName || !form.firstName) {
      toast.error('姓名は必須項目です')
      return
    }
    const scope = editScope.current
    const isCurrent = () => scope.active && editScope.current === scope && currentId.current === scope.id
    const attempt = {}
    submitLock.current = attempt
    setSaving(true)
    try {
      // 新しい写真があれば先にアップロードしてURLを取得
      let finalPhotoUrl = photoUrl
      if (photoFile) {
        const fd = new FormData()
        fd.append('file', photoFile)
        const up = await fetch('/api/hr/upload', { method: 'POST', body: fd })
        if (!isCurrent()) return
        if (!up.ok) {
          const ed = await up.json().catch(() => ({}))
          throw new Error(ed.error || '写真のアップロードに失敗しました')
        }
        finalPhotoUrl = (await up.json()).url
        if (!isCurrent()) return
      }

      if (!isCurrent()) return
      const res = await fetch(`/api/hr/employees/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, photoUrl: finalPhotoUrl, expectedUpdatedAt: loadedVersion.updatedAt }),
      })
      if (!isCurrent()) return
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (!isCurrent()) return
        throw new Error(err.error || '更新に失敗しました')
      }
      const acknowledgement = await res.json().catch(() => null)
      if (!isCurrent()) return
      const saved = acknowledgement?.employee
      const savedAt = typeof saved?.updatedAt === 'string' ? new Date(saved.updatedAt) : null
      if (acknowledgement?.success !== true || saved?.id !== id || !savedAt
        || !Number.isFinite(savedAt.getTime()) || savedAt.toISOString() !== saved.updatedAt
        || savedAt.getTime() <= new Date(loadedVersion.updatedAt).getTime()) {
        throw new Error('保存結果を確認できませんでした。再読み込みして最新の従業員情報をご確認ください。')
      }
      toast.success('従業員情報を更新しました')
      router.push(`/hr/employees/${id}`)
    } catch (err: any) {
      if (isCurrent()) toast.error(err.message)
    } finally {
      if (submitLock.current === attempt) {
        submitLock.current = null
        if (isCurrent()) setSaving(false)
      }
    }
  }

  if (loading || (!notFound && loadedVersion?.id !== id)) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-slate-200 rounded" />
          <div className="h-96 bg-slate-100 rounded-3xl" />
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto">
        <div className="bg-white rounded-3xl shadow-md p-12 text-center text-slate-500">
          <span className="material-symbols-outlined text-5xl mb-3 block">error</span>
          <p className="text-lg font-medium">従業員が見つかりません</p>
          <Link href="/hr/employees" className="mt-4 inline-block text-blue-600 font-bold">
            従業員一覧に戻る
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Link
          href={`/hr/employees/${id}`}
          className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700 mb-4"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          従業員詳細
        </Link>

        <h1 className="text-3xl font-black text-slate-900 mb-6">従業員情報を編集</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-md p-6 space-y-6">
          {/* 顔写真 */}
          <div>
            <label className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-lg">photo_camera</span>
              顔写真
            </label>
            <div className="flex items-center gap-6">
              {photoPreview || photoUrl ? (
                <img
                  src={photoPreview || photoUrl}
                  alt="プレビュー"
                  className="w-24 h-24 rounded-full object-cover ring-4 ring-blue-100"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center border-2 border-dashed border-slate-300">
                  <span className="material-symbols-outlined text-4xl text-slate-400">person</span>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full text-sm font-bold cursor-pointer shadow-md hover:shadow-lg hover:bg-blue-700 transition-all">
                  <span className="material-symbols-outlined text-lg">upload</span>
                  {photoPreview || photoUrl ? '写真を変更' : '写真をアップロード'}
                  <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                </label>
                {(photoPreview || photoUrl) && (
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors text-left"
                  >
                    写真を削除
                  </button>
                )}
                <p className="text-xs text-slate-400">JPG, PNG, WebP 対応（5MB以下）</p>
              </div>
            </div>
          </div>

          {/* 氏名 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">姓 *</label>
              <input className={inputCls} value={form.lastName} onChange={(e) => update('lastName', e.target.value)} placeholder="山田" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">名 *</label>
              <input className={inputCls} value={form.firstName} onChange={(e) => update('firstName', e.target.value)} placeholder="太郎" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">姓（カナ）</label>
              <input className={inputCls} value={form.lastNameKana} onChange={(e) => update('lastNameKana', e.target.value)} placeholder="ヤマダ" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">名（カナ）</label>
              <input className={inputCls} value={form.firstNameKana} onChange={(e) => update('firstNameKana', e.target.value)} placeholder="タロウ" />
            </div>
          </div>

          {/* 基本情報 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">社員番号</label>
              <input className={inputCls} value={form.employeeNumber} onChange={(e) => update('employeeNumber', e.target.value)} placeholder="EMP-001" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">メールアドレス</label>
              <input className={inputCls} value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="taro@example.com" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">電話番号</label>
              <input className={inputCls} value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="090-1234-5678" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">部署</label>
              <DepartmentListState status={departmentList.status} error={departmentList.error} retry={departmentList.retry} />
              {departmentList.status === 'ready' && form.departmentId && !departments.some(d => d.id === form.departmentId) && <p role="alert" className="mb-2 text-sm text-amber-900">現在の所属部署を一覧で確認できませんでした。保存する場合は部署を選び直してください。未所属へ自動変更することはありません。</p>}
              <select disabled={departmentList.status !== 'ready' || saving} className={inputCls} value={form.departmentId} onChange={(e) => update('departmentId', e.target.value)}>
                {form.departmentId && !departments.some(d => d.id === form.departmentId) && <option value={form.departmentId}>現在の所属（部署一覧で未確認）</option>}
                <option value="">未所属</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">役職</label>
              <input className={inputCls} value={form.position} onChange={(e) => update('position', e.target.value)} placeholder="マネージャー" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">グレード</label>
              <input className={inputCls} value={form.grade} onChange={(e) => update('grade', e.target.value)} placeholder="M1" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">雇用形態</label>
              <select className={inputCls} value={form.employmentType} onChange={(e) => update('employmentType', e.target.value)}>
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">性別</label>
              <select className={inputCls} value={form.gender} onChange={(e) => update('gender', e.target.value)}>
                <option value="">未設定</option>
                {GENDERS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">入社日</label>
              <input type="date" className={inputCls} value={form.hireDate} onChange={(e) => update('hireDate', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">生年月日</label>
              <input type="date" className={inputCls} value={form.birthDate} onChange={(e) => update('birthDate', e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link
              href={`/hr/employees/${id}`}
              className="px-6 py-3.5 bg-white text-slate-700 rounded-full text-base font-bold shadow-md hover:shadow-lg transition-all"
            >
              キャンセル
            </Link>
            <button
              type="submit"
              disabled={saving || departmentList.status !== 'ready' || Boolean(form.departmentId && !departments.some(d => d.id === form.departmentId))}
              className="flex items-center gap-2 px-8 py-3.5 bg-blue-600 text-white rounded-full text-base font-bold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">save</span>
              {saving ? '保存中...' : '保存する'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
