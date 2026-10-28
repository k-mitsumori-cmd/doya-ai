'use client'

import { PageTitle } from '@/components/hr/ui-next'
import { Button, ErrorNotice } from '@/components/ds'
import { hrErrorKind } from '@/components/hr/HrLoadError'
import { HR_EMPLOYEE_NUMBER_CONFLICT } from '@/lib/hr/employee-number'
import HrAuthenticatedScope from '@/components/hr/HrAuthenticatedScope'
import DepartmentListState from '@/components/hr/DepartmentListState'
import { useHrDepartmentList } from '@/lib/hr/use-department-list'
import { useHrPageLifetime } from '@/lib/hr/use-page-lifetime'


import { useId, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

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
  return <HrAuthenticatedScope callbackUrl="/hr/employees/new">{actor => <NewEmployeeForActor actor={actor} />}</HrAuthenticatedScope>
}
function NewEmployeeForActor({ actor }: { actor: string }) {
  const { fetch, toast, router, live } = useHrPageLifetime()
  const departmentList = useHrDepartmentList('authenticated', actor)
  const departments = departmentList.rows
  const [saving, setSaving] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [limitNotice, setLimitNotice] = useState<{ message: string; href: string; label: string } | null>(null)
  // 新しい見た目: 入力の誤りは欄の下に出し、欄と aria-describedby で結ぶ。保存の失敗はフォームの上に出す（サーバーの文言はそのまま出さない）
  const [fieldErrors, setFieldErrors] = useState<{ lastName?: string; firstName?: string }>({})
  const [formError, setFormError] = useState('')
  const formErrorRef = useRef<HTMLDivElement>(null)
  const uid = useId()
  const fid = (name: string) => `${uid}-${name}`
  const describe = (name: 'lastName' | 'firstName') => fieldErrors[name]
    ? { 'aria-invalid': true as const, 'aria-describedby': `${fid(name)}-error` }
    : {}
  const focusRing = ' focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue,#0066ff)] focus-visible:ring-offset-2'

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    // 直したらその欄の誤りを消す
    if ((e.target.name === 'lastName' || e.target.name === 'firstName') && e.target.value.trim()) {
      setFieldErrors(old => ({ ...old, [e.target.name]: undefined }))
    }
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      const reader = new FileReader()
      reader.onload = (ev) => { if (live()) setPhotoPreview(ev.target?.result as string) }
      reader.readAsDataURL(file)
    }
  }

  // ⚠️ 本体は scripts/security-regression が取り出して単体で動かす。新しい見た目の処理は引数（onRejected）と handleSubmitNext に置き、ここで新しい名前を参照しない
  const handleSubmit = async (e: React.FormEvent, onRejected?: (status: number, code?: string) => void) => {
    e.preventDefault()
    if (departmentList.status !== 'ready' || saving || submitted) return
    setLimitNotice(null)
    setSaving(true)

    try {
      // Validate required fields
      if (!form.lastName || !form.firstName) {
        throw new Error('姓名は必須項目です')
      }

      // 上限確認と登録を先に確定し、上限到達時に写真だけ保存されるのを防ぐ。
      const res = await fetch('/api/hr/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        if (onRejected && errData.code !== 'HR_ORG_EMPLOYEE_LIMIT') {
          onRejected(res.status, typeof errData.code === 'string' ? errData.code : undefined)
          return
        }
        if (errData.code === 'HR_ORG_EMPLOYEE_LIMIT') {
          setLimitNotice({
            message: errData.error || '従業員数の上限に達しました。',
            href: errData.upgradeUrl || errData.contactUrl || '/hr/pricing',
            label: errData.upgradeUrl ? 'プランと料金を見る' : 'お問い合わせ',
          })
          return
        }
        throw new Error(errData.error || '従業員の登録に失敗しました')
      }
      const created = await res.json().catch(() => null)
      const employeeId = created?.employee?.id
      if (!employeeId || typeof employeeId !== 'string') {
        toast.error('登録結果を確認できませんでした。従業員一覧で確認してください。')
        router.push('/hr/employees')
        return
      }

      if (photoFile) {
        try {
          const formData = new FormData()
          formData.append('file', photoFile)
          const uploadRes = await fetch('/api/hr/upload', { method: 'POST', body: formData })
          if (!uploadRes.ok) throw new Error('写真のアップロードに失敗しました')
          const uploadData = await uploadRes.json()
          if (typeof uploadData.url !== 'string' || !uploadData.url) throw new Error('写真のURLを確認できません')
          const attachRes = await fetch(`/api/hr/employees/${encodeURIComponent(employeeId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photoUrl: uploadData.url }),
          })
          if (!attachRes.ok) throw new Error('写真の保存に失敗しました')
        } catch {
          toast.error('従業員は登録済みですが、写真を保存できませんでした。編集画面から再試行してください。')
          router.push(`/hr/employees/${encodeURIComponent(employeeId)}/edit`)
          return
        }
      }

      toast.success('従業員を登録しました')
      setSubmitted(true)
      setTimeout(() => {
        router.push('/hr/employees')
      }, 1200)
    } catch (e: any) {
      // ⚠️ 通信の失敗（英語の TypeError など）はそのまま出さない。日本語の文だけを通す
      const message = typeof e?.message === 'string' ? e.message : ''
      toast.error(/[\u3040-\u30ff\u3400-\u9fff]/.test(message) && !/[A-Za-z]{4,}/.test(message) ? message : '従業員を登録できませんでした。通信を確かめて、もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  // 新しい見た目: 欄の下に誤りを出してから送る。断られたときは、生の文ではなく日本語の案内をフォームの上に出す
  const handleSubmitNext = async (e: React.FormEvent) => {
    e.preventDefault()
    if (departmentList.status !== 'ready' || saving || submitted) return
    const errors = {
      lastName: form.lastName.trim() ? undefined : '姓を入力してください。',
      firstName: form.firstName.trim() ? undefined : '名を入力してください。',
    }
    setFieldErrors(errors)
    setFormError('')
    if (errors.lastName || errors.firstName) {
      // 最初の誤りの欄に移る
      document.getElementById(fid(errors.lastName ? 'lastName' : 'firstName'))?.focus()
      return
    }
    await handleSubmit(e, (status, code) => {
      const kind = hrErrorKind(status)
      setFormError(status === 409 && code === HR_EMPLOYEE_NUMBER_CONFLICT.code ? HR_EMPLOYEE_NUMBER_CONFLICT.error
        : kind === 'login' ? 'ログインの有効期限が切れた可能性があります。入力内容はそのままです。ログインし直してから、もう一度保存してください。'
        : kind === 'forbidden' ? '従業員を登録する権限がありません。組織の管理者に依頼してください。'
        : kind === 'limit' ? '登録できる従業員数の上限に達しました。料金プランを見直すと、さらに登録できます。'
        : status === 400 ? '入力内容を確認できませんでした。メールアドレスや日付の形式を確認して、もう一度保存してください。'
        : '保存できませんでした。入力内容はそのままです。時間をおいて、もう一度お試しください。')
      requestAnimationFrame(() => formErrorRef.current?.scrollIntoView({ block: 'center' }))
    })
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.back()}
            className={`flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors${' min-h-11 rounded-lg pr-2' + focusRing}`}
          >
            <span aria-hidden className="material-symbols-outlined text-lg">arrow_back</span>
            戻る
          </button>
          <div className="flex items-center gap-3">
            <PageTitle className="text-3xl font-black text-slate-900">従業員を追加</PageTitle>
            <img
              src="/hr/characters/working_%E4%BD%9C%E6%A5%AD%E4%B8%AD.png"
              alt="白くまキャラクター"
              className="w-16 opacity-70"
            />
          </div>
          <p className="text-sm text-slate-500 mt-1">新しい従業員の情報を登録します</p>
        </div>
        {limitNotice && (
          <div className="mb-6">
            <ErrorNotice what="登録できる従業員数の上限に達しました。" how="料金プランを見直すと、さらに登録できます。入力内容はそのままです。" />
            <div className="mt-3"><Button href={limitNotice.href.startsWith('/') ? limitNotice.href : '/hr/pricing'} icon="Tag">{limitNotice.label === 'お問い合わせ' ? 'お問い合わせ' : '料金プランを見る'}</Button></div>
          </div>
        )}
        {formError && (
          <div ref={formErrorRef} className="mb-6">
            <ErrorNotice what={formError} />
            {formError.startsWith('登録できる従業員数') && <div className="mt-3"><Button href="/hr/pricing" icon="Tag">料金プランを見る</Button></div>}
          </div>
        )}

        {/* Step Indicator */}
        <div className="mb-6 bg-white rounded-3xl shadow-md p-4">
          <div className="flex items-center justify-between">
            {[
              { step: 1, label: '基本情報', icon: 'person' },
              { step: 2, label: '職務情報', icon: 'work' },
              { step: 3, label: '入社情報', icon: 'calendar_month' },
            ].map((item, i) => (
              <div key={item.step} className="flex items-center flex-1 min-w-0 last:flex-none">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-xs font-black text-blue-600">{item.step}</span>
                  </div>
                  <div>
                    <p className="whitespace-nowrap text-xs sm:text-sm font-bold text-slate-700">{item.label}</p>
                  </div>
                </div>
                {i < 2 && (
                  <div aria-hidden className="flex-1 mx-1.5 sm:mx-3 min-w-2 h-0.5 bg-slate-200 rounded-full" />
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmitNext} noValidate={true}>
          <div className="bg-white rounded-3xl shadow-lg p-5 sm:p-8 space-y-8">
            {/* Photo Upload */}
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">photo_camera</span>
                顔写真
              </h2>
              <div className="h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-400 rounded-full w-16 mb-4" />
              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                {photoPreview ? (
                  <img src={photoPreview} alt="プレビュー" className="w-28 h-28 rounded-full object-cover ring-4 ring-blue-100" />
                ) : (
                  <div className="w-28 h-28 rounded-full bg-slate-50 flex items-center justify-center border-2 border-dashed border-slate-300">
                    <span className="material-symbols-outlined text-4xl text-slate-400">person</span>
                  </div>
                )}
                <div>
                  <label className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap px-5 py-2.5 bg-blue-600 text-white rounded-full text-sm font-bold cursor-pointer shadow-md hover:shadow-lg hover:bg-blue-700 transition-all focus-within:ring-2 focus-within:ring-[var(--blue,#0066ff)] focus-within:ring-offset-2">
                    <span aria-hidden className="material-symbols-outlined text-lg">upload</span>
                    写真をアップロード
                    {/* 新しい見た目では、見えないだけでキーボードから選べる入力にする */}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="sr-only"
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
                  <label htmlFor={fid('lastName')} className="block text-sm font-bold text-slate-700 mb-1">
                    姓 <span aria-hidden className="text-red-500">*</span><span className="sr-only">（必須）</span>
                  </label>
                  <input
                    id={fid('lastName')}
                    {...describe('lastName')}
                    aria-required="true"
                    type="text"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="山田"
                  />
                  {fieldErrors.lastName && <p id={`${fid('lastName')}-error`} role="alert" className="mt-1 text-sm font-bold text-rose-700">{fieldErrors.lastName}</p>}
                </div>
                <div>
                  <label htmlFor={fid('firstName')} className="block text-sm font-bold text-slate-700 mb-1">
                    名 <span aria-hidden className="text-red-500">*</span><span className="sr-only">（必須）</span>
                  </label>
                  <input
                    id={fid('firstName')}
                    {...describe('firstName')}
                    aria-required="true"
                    type="text"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="太郎"
                  />
                  {fieldErrors.firstName && <p id={`${fid('firstName')}-error`} role="alert" className="mt-1 text-sm font-bold text-rose-700">{fieldErrors.firstName}</p>}
                </div>
                <div>
                  <label htmlFor={fid('lastNameKana')} className="block text-sm font-bold text-slate-700 mb-1">姓（カナ）</label>
                  <input
                    type="text"
                    id={fid('lastNameKana')}
                    name="lastNameKana"
                    value={form.lastNameKana}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="ヤマダ"
                  />
                </div>
                <div>
                  <label htmlFor={fid('firstNameKana')} className="block text-sm font-bold text-slate-700 mb-1">名（カナ）</label>
                  <input
                    type="text"
                    id={fid('firstNameKana')}
                    name="firstNameKana"
                    value={form.firstNameKana}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="タロウ"
                  />
                </div>
                <div>
                  <label htmlFor={fid('employeeNumber')} className="block text-sm font-bold text-slate-700 mb-1">社員番号</label>
                  <input
                    type="text"
                    id={fid('employeeNumber')}
                    name="employeeNumber"
                    value={form.employeeNumber}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="EMP-001"
                  />
                </div>
                <div>
                  <label htmlFor={fid('email')} className="block text-sm font-bold text-slate-700 mb-1">メールアドレス</label>
                  <input
                    type="email"
                    id={fid('email')}
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="taro@example.com"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor={fid('phone')} className="block text-sm font-bold text-slate-700 mb-1">電話番号</label>
                  <input
                    type="tel"
                    id={fid('phone')}
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
              <DepartmentListState status={departmentList.status} error={departmentList.error} retry={departmentList.retry} />
              {departmentList.status === 'ready' && (departments.length === 0 ? (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-wrap items-center gap-3">
                  <span aria-hidden className="material-symbols-outlined text-amber-500">info</span>
                  <p className="text-sm text-amber-800 flex-1 min-w-[12rem]">
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
              ))}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={fid('departmentId')} className="block text-sm font-bold text-slate-700 mb-1">部署</label>
                  <select
                    disabled={departmentList.status !== 'ready' || saving}
                    id={fid('departmentId')}
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
                  <label htmlFor={fid('position')} className="block text-sm font-bold text-slate-700 mb-1">役職</label>
                  <input
                    type="text"
                    id={fid('position')}
                    name="position"
                    value={form.position}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="マネージャー"
                  />
                </div>
                <div>
                  <label htmlFor={fid('grade')} className="block text-sm font-bold text-slate-700 mb-1">等級</label>
                  <input
                    type="text"
                    id={fid('grade')}
                    name="grade"
                    value={form.grade}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="M1"
                  />
                </div>
                <div>
                  <label htmlFor={fid('employmentType')} className="block text-sm font-bold text-slate-700 mb-1">雇用形態</label>
                  <select
                    id={fid('employmentType')}
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
                  <label htmlFor={fid('hireDate')} className="block text-sm font-bold text-slate-700 mb-1">入社日</label>
                  <input
                    type="date"
                    id={fid('hireDate')}
                    aria-describedby={`${fid('hireDate')}-hint`}
                    name="hireDate"
                    value={form.hireDate}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                  <p id={`${fid('hireDate')}-hint`} className="text-xs text-slate-500 mt-1.5">入社日を設定すると在籍年数が自動計算されます。</p>
                </div>
              </div>
            </div>

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
                disabled={saving || submitted || departmentList.status !== 'ready'}
                className="flex items-center gap-2 px-8 py-3.5 bg-blue-600 text-white rounded-full text-base font-bold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">save</span>
                {saving ? '保存中...' : '保存する'}
              </button>
            </div>
          </div>

          {/* Sticky bottom save bar (mobile) */}
          <div className="sm:hidden sticky bottom-[var(--shell-mobile-bottom-inset,0px)] bg-white/80 backdrop-blur-md p-4 border-t border-slate-200 -mx-6 mt-4 flex gap-3 z-30">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 px-4 py-3 bg-white text-slate-700 rounded-full text-base font-bold shadow-md transition-all"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving || submitted || departmentList.status !== 'ready'}
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
