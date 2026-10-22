'use client'
import { useHrOrganizationRequest } from '@/components/hr/HrOrganizationScope'

import { useEffect, useId, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useHrPageLifetime } from '@/lib/hr/use-page-lifetime'
import Link from 'next/link'
import { useToolUiNext } from './ui-next'
import { hrErrorKind } from './HrLoadError'

interface ImportResultRow {
  row: number
  success: boolean
  error?: string
}

interface ImportResult {
  imported: number
  failed: number
  details: ImportResultRow[]
  limitNotice?: { message: string; upgradeUrl?: string; contactUrl?: string }
}

const SAMPLE_CSV = `lastName,firstName,lastNameKana,firstNameKana,employeeNumber,email,phone,departmentCode,position,grade,employmentType,hireDate,birthDate,gender
山田,太郎,ヤマダ,タロウ,EMP-001,taro@example.com,090-1234-5678,SALES,マネージャー,M1,FULL_TIME,2022-04-01,1990-05-10,male
佐藤,花子,サトウ,ハナコ,EMP-002,hanako@example.com,,DEV,エンジニア,G3,FULL_TIME,2023-10-01,1995-11-22,female`

const COLUMNS: { label: string; required?: boolean }[] = [
  { label: '姓', required: true },
  { label: '名', required: true },
  { label: '姓(カナ)' },
  { label: '名(カナ)' },
  { label: '社員番号' },
  { label: 'メール' },
  { label: '電話番号' },
  { label: '部署コード' },
  { label: '役職' },
  { label: 'グレード' },
  { label: '雇用形態' },
  { label: '入社日' },
  { label: '生年月日' },
  { label: '性別' },
]

export default function CsvImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean
  onClose: () => void
  onImported: () => void
}) {
  const { request: fetch } = useHrOrganizationRequest()
  const { toast, router, live } = useHrPageLifetime()
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const uiNext = useToolUiNext()
  const titleId = useId(), textareaId = useId()
  // 新しい見た目: 押せる場所を 44px 以上にし、キーボードの選択を輪郭で示す
  const tap = uiNext ? ' min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue,#0066ff)]' : ''
  // 新しい見た目: 失敗をトーストだけでなく、ダイアログの中にも残す（サーバーの文言はそのまま出さない）
  const [importError, setImportError] = useState<{ message: string; pricing: boolean } | null>(null)

  const reset = () => {
    setImportError(null)
    setCsvText('')
    setFileName(null)
    setResult(null)
    setImporting(false)
  }

  const handleClose = () => {
    if (importing) return
    reset()
    onClose()
  }

  // Esc で閉じる・開いたらダイアログに移り、閉じたら元のボタンに戻す（キーボードで操作できるように）
  const closeRef = useRef(handleClose)
  closeRef.current = handleClose
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = requestAnimationFrame(() => dialogRef.current?.focus())
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current() }
      // Tab をダイアログの中に留める
      if (e.key === 'Tab' && dialogRef.current) {
        const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),textarea,select,input:not([type="file"])'))
        if (!items.length) return
        const first = items[0], last = items[items.length - 1]
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', onKey); opener?.focus() }
  }, [open])

  const handleFile = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setCsvText(String(reader.result ?? ''))
    reader.onerror = () => toast.error('ファイルの読み込みに失敗しました')
    reader.readAsText(file, 'UTF-8')
  }

  const downloadSample = () => {
    const blob = new Blob(['﻿' + SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'doya-hr-import-sample.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async () => {
    if (!csvText.trim()) {
      toast.error('CSVデータを入力するか、ファイルを選択してください')
      return
    }
    setImporting(true)
    setResult(null)
    setImportError(null)
    try {
      const res = await fetch('/api/hr/employees/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (uiNext) {
          const kind = hrErrorKind(res.status, data?.code === 'HR_ORG_EMPLOYEE_LIMIT')
          const message = kind === 'login' ? 'ログインの有効期限が切れた可能性があります。ログインし直してから、もう一度お試しください。'
            : kind === 'forbidden' ? '従業員を登録する権限がありません。組織の管理者に依頼してください。'
            : kind === 'limit' ? '登録できる従業員数の上限に達しました。料金プランを見直すと、さらに登録できます。'
            : res.status === 400 ? 'CSVの内容を読み取れませんでした。1行目の列名と、姓・名が入っているかを確認してください。'
            : '一括登録できませんでした。時間をおいて、もう一度お試しください。'
          setImportError({ message, pricing: kind === 'limit' })
          toast.error(message)
          return
        }
        toast.error(data.error || 'インポートに失敗しました')
        return
      }
      const imported = data.imported ?? 0
      const failed = data.failed ?? 0
      setResult({ imported, failed, details: data.details ?? [], limitNotice: data.limitNotice })
      if (imported > 0) {
        toast.success(`${imported}名を登録しました`)
        onImported()
      } else if (failed > 0) {
        toast.error('登録できた従業員はありませんでした')
      }
    } catch {
      if (uiNext) setImportError({ message: '一括登録できませんでした。通信状態を確認して、もう一度お試しください。', pricing: false })
      toast.error('インポートに失敗しました')
    } finally {
      setImporting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto focus:outline-none"
          >
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-3xl">
              <h3 id={titleId} className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span aria-hidden className="material-symbols-outlined text-blue-600">upload_file</span>
                CSVで一括登録
              </h3>
              <button
                type="button"
                onClick={handleClose}
                aria-label="閉じる"
                className={uiNext
                  ? 'inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue,#0066ff)]'
                  : 'p-1 rounded-lg text-slate-400 hover:bg-slate-100'}
              >
                <span aria-hidden className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className={uiNext ? 'p-4 sm:p-6 space-y-5' : 'p-6 space-y-5'}>
              {importError && (
                <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">
                  <p>{importError.message}</p>
                  {importError.pricing && <Link href="/hr/pricing" className="mt-2 inline-flex min-h-11 items-center underline underline-offset-2">料金プランを見る</Link>}
                </div>
              )}
              {result ? (
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1 bg-emerald-50 rounded-2xl p-4 text-center">
                      <p className="text-3xl font-black text-emerald-600">{result.imported}</p>
                      <p className="text-sm font-bold text-emerald-700">登録成功</p>
                    </div>
                    <div className="flex-1 bg-red-50 rounded-2xl p-4 text-center">
                      <p className="text-3xl font-black text-red-500">{result.failed}</p>
                      <p className="text-sm font-bold text-red-600">失敗</p>
                    </div>
                  </div>
                  {result.limitNotice && (
                    <div role="alert" className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                      <p className="font-bold">{result.limitNotice.message}</p>
                      <Link href={result.limitNotice.upgradeUrl || result.limitNotice.contactUrl || '/hr/pricing'} className="mt-2 inline-block font-bold underline underline-offset-2">
                        {result.limitNotice.upgradeUrl ? 'プランと料金を見る' : 'お問い合わせ'} →
                      </Link>
                    </div>
                  )}
                  {result.failed > 0 && (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-500">エラー詳細</div>
                      <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {result.details
                          .filter((d) => !d.success)
                          .map((d, i) => (
                            <div key={i} className="px-4 py-2 text-sm flex items-start gap-2">
                              <span className="font-bold text-slate-700 shrink-0">{d.row}行目</span>
                              <span className="text-red-600">{d.error}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 mt-5">
                    <button
                      onClick={reset}
                      className={`px-5 py-2.5 rounded-full text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all${tap}`}
                    >
                      続けて登録
                    </button>
                    <button
                      onClick={handleClose}
                      className={`px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-bold shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-all${tap}`}
                    >
                      完了
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-blue-50 rounded-2xl p-4">
                    <p className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-base text-blue-600">info</span>
                      CSV形式について
                    </p>
                    <p className="text-xs text-slate-600 mb-2">
                      1行目はヘッダー（列名）です。
                      <span className="font-bold">姓(lastName)・名(firstName)は必須</span>
                      、その他の列は任意です。部署はコードで指定できます。
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {COLUMNS.map((c) => (
                        <span
                          key={c.label}
                          className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                            c.required ? 'bg-blue-100 text-blue-700' : 'bg-white text-slate-500'
                          }`}
                        >
                          {c.label}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={downloadSample}
                      className={`mt-3 inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-700${tap}`}
                    >
                      <span className="material-symbols-outlined text-lg">download</span>
                      サンプルCSVをダウンロード
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex shrink-0 items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:border-blue-400 hover:text-blue-600 transition-all${tap}`}
                    >
                      <span className="material-symbols-outlined text-lg">attach_file</span>
                      CSVファイルを選択
                    </button>
                    {fileName && <span className="min-w-0 text-sm text-slate-500 truncate">{fileName}</span>}
                    <input
                      ref={fileInputRef}
                      tabIndex={-1}
                      aria-hidden
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleFile(f)
                      }}
                    />
                  </div>

                  <div>
                    <label htmlFor={textareaId} className="block text-sm font-bold text-slate-700 mb-2">
                      または、CSVデータを直接貼り付け
                    </label>
                    <textarea
                      id={textareaId}
                      value={csvText}
                      onChange={(e) => {
                        setCsvText(e.target.value)
                        setFileName(null)
                      }}
                      rows={8}
                      placeholder={SAMPLE_CSV}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    />
                  </div>
                </>
              )}
            </div>

            {!result && (
              <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex justify-end gap-2 rounded-b-3xl">
                <button
                  onClick={handleClose}
                  className={`px-5 py-2.5 rounded-full text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all${tap}`}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className={`flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-bold shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-all disabled:opacity-50${tap}`}
                >
                  <span className="material-symbols-outlined text-lg">{importing ? 'hourglass_top' : 'upload'}</span>
                  {importing ? 'インポート中...' : 'インポート実行'}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
