'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
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
  const router = useRouter()
  const id = params?.id as string

  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
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
    async function load() {
      try {
        const [empRes, deptRes] = await Promise.all([
          fetch(`/api/hr/employees/${id}`),
          fetch('/api/hr/departments'),
        ])
        if (!empRes.ok) {
          setNotFound(true)
          return
        }
        const data = await empRes.json()
        const e = data.employee ?? data
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
        if (deptRes.ok) {
          const dd = await deptRes.json()
          setDepartments(dd.flat ?? dd.departments ?? [])
        }
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const update = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.lastName || !form.firstName) {
      toast.error('姓名は必須項目です')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/hr/employees/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '更新に失敗しました')
      }
      toast.success('従業員情報を更新しました')
      router.push(`/hr/employees/${id}`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
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
              <select className={inputCls} value={form.departmentId} onChange={(e) => update('departmentId', e.target.value)}>
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
              disabled={saving}
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
