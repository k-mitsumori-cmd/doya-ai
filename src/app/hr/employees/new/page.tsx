'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

interface Department {
  id: string
  name: string
}

const EMPLOYMENT_TYPES = [
  { value: 'FULL_TIME', label: '正社員' },
  { value: 'PART_TIME', label: 'パート・アルバイト' },
  { value: 'CONTRACT', label: '契約社員' },
  { value: 'INTERN', label: 'インターン' },
  { value: 'OTHER', label: 'その他' },
]

export default function NewEmployeePage() {
  const router = useRouter()
  const [departments, setDepartments] = useState<Department[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  const [form, setForm] = useState({
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
  })

  useEffect(() => {
    fetch('/api/hr/departments')
      .then((r) => r.json())
      .then((data) => setDepartments(data.departments ?? data ?? []))
      .catch(() => {})
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      const reader = new FileReader()
      reader.onload = (ev) => setPhotoPreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      // Validate required fields
      if (!form.lastName || !form.firstName) {
        throw new Error('姓名は必須項目です')
      }

      // Upload photo first if present
      let photoUrl: string | undefined
      if (photoFile) {
        const formData = new FormData()
        formData.append('file', photoFile)
        const uploadRes = await fetch('/api/hr/upload', {
          method: 'POST',
          body: formData,
        })
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json()
          photoUrl = uploadData.url
        }
      }

      // Create employee
      const res = await fetch('/api/hr/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          photoUrl,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || '従業員の登録に失敗しました')
      }

      router.push('/hr/employees')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            戻る
          </button>
          <h1 className="text-2xl font-black text-slate-900">従業員を追加</h1>
          <p className="text-sm text-slate-500 mt-1">新しい従業員の情報を登録します</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Photo Upload */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-sky-500">photo_camera</span>
              顔写真
            </h2>
            <div className="flex items-center gap-6">
              {photoPreview ? (
                <img src={photoPreview} alt="プレビュー" className="w-24 h-24 rounded-full object-cover border-2 border-sky-200" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center border-2 border-dashed border-slate-300">
                  <span className="material-symbols-outlined text-3xl text-slate-400">person</span>
                </div>
              )}
              <div>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-sky-50 text-sky-600 rounded-xl text-sm font-semibold cursor-pointer hover:bg-sky-100 transition-colors">
                  <span className="material-symbols-outlined text-lg">upload</span>
                  写真をアップロード
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-slate-400 mt-2">JPG, PNG, WebP 対応（5MB以下）</p>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-sky-500">person</span>
              基本情報
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  姓 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                  placeholder="山田"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                  placeholder="太郎"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">姓（カナ）</label>
                <input
                  type="text"
                  name="lastNameKana"
                  value={form.lastNameKana}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                  placeholder="ヤマダ"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">名（カナ）</label>
                <input
                  type="text"
                  name="firstNameKana"
                  value={form.firstNameKana}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                  placeholder="タロウ"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">社員番号</label>
                <input
                  type="text"
                  name="employeeNumber"
                  value={form.employeeNumber}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                  placeholder="EMP-001"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">メールアドレス</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                  placeholder="taro@example.com"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">電話番号</label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                  placeholder="090-1234-5678"
                />
              </div>
            </div>
          </div>

          {/* Job Info */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-sky-500">work</span>
              職務情報
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">部署</label>
                <select
                  name="departmentId"
                  value={form.departmentId}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                >
                  <option value="">選択してください</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">役職</label>
                <input
                  type="text"
                  name="position"
                  value={form.position}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                  placeholder="マネージャー"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">等級</label>
                <input
                  type="text"
                  name="grade"
                  value={form.grade}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                  placeholder="M1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">雇用形態</label>
                <select
                  name="employmentType"
                  value={form.employmentType}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                >
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">入社日</label>
                <input
                  type="date"
                  name="hireDate"
                  value={form.hireDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <span className="material-symbols-outlined text-lg align-middle mr-1">error</span>
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-sky-500/20 transition-all disabled:opacity-50"
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
