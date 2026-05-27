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
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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

      setSuccessMessage('従業員を登録しました')
      setTimeout(() => setSuccessMessage(null), 3000)
      setTimeout(() => {
        router.push('/hr/employees')
      }, 1500)
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
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-slate-900">従業員を追加</h1>
            <img
              src="/hr/characters/working_作業中.png"
              alt="白くまキャラクター"
              className="w-16 opacity-70"
            />
          </div>
          <p className="text-sm text-slate-500 mt-1">新しい従業員の情報を登録します</p>
        </div>

        {/* Step Indicator */}
        <div className="mb-6 bg-white rounded-3xl shadow-md p-4">
          <div className="flex items-center justify-between">
            {[
              { step: 1, label: '基本情報', icon: 'person' },
              { step: 2, label: '職務情報', icon: 'work' },
              { step: 3, label: '入社情報', icon: 'calendar_month' },
            ].map((item, i) => (
              <div key={item.step} className="flex items-center flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-xs font-black text-blue-600">{item.step}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">{item.label}</p>
                  </div>
                </div>
                {i < 2 && (
                  <div className="flex-1 mx-3 h-0.5 bg-slate-200 rounded-full" />
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-3xl shadow-lg p-8 space-y-8">
            {/* Photo Upload */}
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">photo_camera</span>
                顔写真
              </h2>
              <div className="h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-400 rounded-full w-16 mb-4" />
              <div className="flex items-center gap-6">
                {photoPreview ? (
                  <img src={photoPreview} alt="プレビュー" className="w-28 h-28 rounded-full object-cover ring-4 ring-blue-100" />
                ) : (
                  <div className="w-28 h-28 rounded-full bg-slate-50 flex items-center justify-center border-2 border-dashed border-slate-300">
                    <span className="material-symbols-outlined text-4xl text-slate-400">person</span>
                  </div>
                )}
                <div>
                  <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full text-sm font-bold cursor-pointer shadow-md hover:shadow-lg hover:bg-blue-700 transition-all">
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
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">person</span>
                基本情報
              </h2>
              <div className="h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-400 rounded-full w-16 mb-2" />
              <p className="text-sm text-slate-400 mb-4">姓名は必須です。社員番号は後から設定できます。</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    姓 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="山田"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="太郎"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">姓（カナ）</label>
                  <input
                    type="text"
                    name="lastNameKana"
                    value={form.lastNameKana}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="ヤマダ"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">名（カナ）</label>
                  <input
                    type="text"
                    name="firstNameKana"
                    value={form.firstNameKana}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="タロウ"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">社員番号</label>
                  <input
                    type="text"
                    name="employeeNumber"
                    value={form.employeeNumber}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="EMP-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">メールアドレス</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="taro@example.com"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1">電話番号</label>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="090-1234-5678"
                  />
                </div>
              </div>
            </div>

            {/* Job Info */}
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">work</span>
                職務情報
              </h2>
              <div className="h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-400 rounded-full w-16 mb-2" />
              {departments.length === 0 ? (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
                  <span className="material-symbols-outlined text-amber-500">info</span>
                  <p className="text-sm text-amber-800 flex-1">
                    部署がまだ登録されていません。先に部署を追加すると従業員の配属先を選べます。
                  </p>
                  <a
                    href="/hr/settings"
                    className="flex items-center gap-1 px-4 py-2 bg-amber-500 text-white rounded-full text-sm font-bold hover:bg-amber-600 transition-colors whitespace-nowrap shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">apartment</span>
                    部署を追加
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </a>
                </div>
              ) : (
                <p className="text-sm text-slate-400 mb-4">部署がまだ作成されていない場合は、<a href="/hr/settings" className="text-blue-600 underline hover:text-blue-700">設定画面</a>から追加できます。</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">部署</label>
                  <select
                    name="departmentId"
                    value={form.departmentId}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  >
                    <option value="">選択してください</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">役職</label>
                  <input
                    type="text"
                    name="position"
                    value={form.position}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="マネージャー"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">等級</label>
                  <input
                    type="text"
                    name="grade"
                    value={form.grade}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="M1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">雇用形態</label>
                  <select
                    name="employmentType"
                    value={form.employmentType}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  >
                    {EMPLOYMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1">入社日</label>
                  <input
                    type="date"
                    name="hireDate"
                    value={form.hireDate}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">入社日を設定すると在籍年数が自動計算されます。</p>
                </div>
              </div>
            </div>

            {/* Success Toast */}
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-emerald-50 rounded-2xl text-sm text-emerald-700 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">check_circle</span>
                {successMessage}
                <img
                  src="/hr/characters/jump_大喜び.png"
                  alt="白くまキャラクター"
                  className="w-12 inline-block ml-1"
                />
              </motion.div>
            )}

            {/* Error */}
            {error && (
              <div className="p-4 bg-red-50 rounded-2xl text-sm text-red-700">
                <span className="material-symbols-outlined text-lg align-middle mr-1">error</span>
                {error}
                <span className="text-red-500 ml-1">もう一度お試しください。</span>
              </div>
            )}

            {/* Actions (desktop) */}
            <div className="hidden sm:flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3.5 bg-white text-slate-700 rounded-full text-base font-bold shadow-md hover:shadow-lg transition-all"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={saving || !!successMessage}
                className="flex items-center gap-2 px-8 py-3.5 bg-blue-600 text-white rounded-full text-base font-bold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">save</span>
                {saving ? '保存中...' : '保存する'}
              </button>
            </div>
          </div>

          {/* Sticky bottom save bar (mobile) */}
          <div className="sm:hidden sticky bottom-0 bg-white/80 backdrop-blur-md p-4 border-t border-slate-200 -mx-6 mt-4 flex gap-3 z-30">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 px-4 py-3 bg-white text-slate-700 rounded-full text-base font-bold shadow-md transition-all"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving || !!successMessage}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-full text-base font-bold shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
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
