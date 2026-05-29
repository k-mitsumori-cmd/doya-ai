'use client'

import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

interface ImportResultRow {
  row: number
  success: boolean
  error?: string
}

interface ImportResult {
  imported: number
  failed: number
  details: ImportResultRow[]
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
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
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
    try {
      const res = await fetch('/api/hr/employees/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'インポートに失敗しました')
        return
      }
      const imported = data.imported ?? 0
      const failed = data.failed ?? 0
      setResult({ imported, failed, details: data.details ?? [] })
      if (imported > 0) {
        toast.success(`${imported}名を登録しました`)
        onImported()
      } else if (failed > 0) {
        toast.error('登録できた従業員はありませんでした')
      }
    } catch {
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
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-3xl">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">upload_file</span>
                CSVで一括登録
              </h3>
              <button onClick={handleClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-5">
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
                      className="px-5 py-2.5 rounded-full text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all"
                    >
                      続けて登録
                    </button>
                    <button
                      onClick={handleClose}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-bold shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-all"
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
                      className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-700"
                    >
                      <span className="material-symbols-outlined text-lg">download</span>
                      サンプルCSVをダウンロード
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:border-blue-400 hover:text-blue-600 transition-all"
                    >
                      <span className="material-symbols-outlined text-lg">attach_file</span>
                      CSVファイルを選択
                    </button>
                    {fileName && <span className="text-sm text-slate-500 truncate">{fileName}</span>}
                    <input
                      ref={fileInputRef}
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
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      または、CSVデータを直接貼り付け
                    </label>
                    <textarea
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
                  className="px-5 py-2.5 rounded-full text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-bold shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-all disabled:opacity-50"
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
