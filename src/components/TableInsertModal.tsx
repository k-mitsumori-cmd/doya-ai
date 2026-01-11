'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Table2, X, Plus, Trash2 } from 'lucide-react'

export function TableInsertModal({
  open,
  onClose,
  onInsert,
}: {
  open: boolean
  onClose: () => void
  onInsert: (tableMarkdown: string) => void
}) {
  const [rows, setRows] = useState(3)
  const [cols, setCols] = useState(3)
  const [tableData, setTableData] = useState<string[][]>(() => {
    const data: string[][] = []
    for (let i = 0; i < 3; i++) {
      data.push(Array(3).fill(''))
    }
    return data
  })

  const updateTableSize = (newRows: number, newCols: number) => {
    const newData: string[][] = []
    for (let i = 0; i < newRows; i++) {
      const row: string[] = []
      for (let j = 0; j < newCols; j++) {
        row.push(tableData[i]?.[j] || '')
      }
      newData.push(row)
    }
    setTableData(newData)
    setRows(newRows)
    setCols(newCols)
  }

  const updateCell = (row: number, col: number, value: string) => {
    const newData = [...tableData]
    if (!newData[row]) newData[row] = []
    newData[row][col] = value
    setTableData(newData)
  }

  const generateMarkdown = () => {
    // ヘッダー行
    const header = `| ${tableData[0]?.map((cell) => cell || ' ').join(' | ')} |`
    const separator = `| ${Array(cols).fill('---').join(' | ')} |`
    // データ行
    const dataRows = tableData.slice(1).map(
      (row) => `| ${row.map((cell) => cell || ' ').join(' | ')} |`
    )
    return [header, separator, ...dataRows].join('\n')
  }

  const handleInsert = () => {
    const markdown = generateMarkdown()
    onInsert(markdown)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl shadow-2xl border-2 border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center">
                    <Table2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">表を挿入</h3>
                    <p className="text-sm text-slate-600 font-bold">リッチな表を作成して記事に追加</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/50 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* サイズ調整 */}
              <div className="mb-6 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-bold text-slate-700">行数:</label>
                  <input
                    type="number"
                    min="2"
                    max="10"
                    value={rows}
                    onChange={(e) => updateTableSize(parseInt(e.target.value) || 2, cols)}
                    className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-bold text-slate-700">列数:</label>
                  <input
                    type="number"
                    min="2"
                    max="10"
                    value={cols}
                    onChange={(e) => updateTableSize(rows, parseInt(e.target.value) || 2)}
                    className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold"
                  />
                </div>
              </div>

              {/* テーブルエディタ */}
              <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-500 to-indigo-600">
                      {Array(cols)
                        .fill(0)
                        .map((_, colIdx) => (
                          <th key={colIdx} className="border border-slate-300 p-3">
                            <input
                              type="text"
                              value={tableData[0]?.[colIdx] || ''}
                              onChange={(e) => updateCell(0, colIdx, e.target.value)}
                              placeholder={`ヘッダー ${colIdx + 1}`}
                              className="w-full bg-transparent text-white placeholder-white/70 font-black text-sm outline-none"
                            />
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array(rows - 1)
                      .fill(0)
                      .map((_, rowIdx) => (
                        <tr key={rowIdx} className="bg-white hover:bg-slate-50">
                          {Array(cols)
                            .fill(0)
                            .map((_, colIdx) => (
                              <td key={colIdx} className="border border-slate-300 p-3">
                                <input
                                  type="text"
                                  value={tableData[rowIdx + 1]?.[colIdx] || ''}
                                  onChange={(e) => updateCell(rowIdx + 1, colIdx, e.target.value)}
                                  placeholder={`セル ${rowIdx + 1}-${colIdx + 1}`}
                                  className="w-full bg-transparent text-slate-700 font-medium text-sm outline-none"
                                />
                              </td>
                            ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-6 py-3 rounded-xl bg-white border-2 border-slate-300 text-slate-700 font-black hover:bg-slate-50 transition-all"
              >
                キャンセル
              </button>
              <button
                onClick={handleInsert}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-black shadow-lg hover:shadow-xl transition-all"
              >
                表を挿入
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

