'use client'

// 依存なしの軽量Markdownレンダラ（提案資料表示用）。
// 対応: # 〜 ###、**強調**、- / * 箇条書き、1. 番号付き、--- 区切り、| 表 |、段落。
import React from 'react'

function inline(text: string, keyPrefix: string): React.ReactNode[] {
  // **bold** のみ対応
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      return (
        <strong key={`${keyPrefix}-b-${i}`} className="font-black text-slate-900">
          {p.slice(2, -2)}
        </strong>
      )
    }
    return <React.Fragment key={`${keyPrefix}-t-${i}`}>{p}</React.Fragment>
  })
}

export default function Markdown({ source }: { source: string }) {
  const lines = (source || '').replace(/\r\n/g, '\n').split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0
  let key = 0
  const nk = () => `md-${key++}`

  while (i < lines.length) {
    const line = lines[i]

    // 空行
    if (!line.trim()) { i++; continue }

    // 区切り
    if (/^---+$/.test(line.trim())) { blocks.push(<hr key={nk()} className="my-5 border-slate-200" />); i++; continue }

    // 見出し
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      const level = h[1].length
      const content = inline(h[2].trim(), nk())
      const cls =
        level === 1 ? 'text-2xl font-black text-slate-900 mt-2 mb-3'
        : level === 2 ? 'text-xl font-black text-slate-900 mt-6 mb-2 pb-1 border-b-2 border-purple-100'
        : level === 3 ? 'text-base font-black text-purple-700 mt-4 mb-1'
        : 'text-sm font-black text-slate-700 mt-3 mb-1'
      blocks.push(React.createElement(`h${level}`, { key: nk(), className: cls }, content))
      i++; continue
    }

    // 表（| ... | 形式。次行が区切り --- なら見出し行扱い）
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const tbl: string[] = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { tbl.push(lines[i]); i++ }
      const rows = tbl.map((r) => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()))
      const sepIdx = rows.findIndex((r) => r.every((c) => /^:?-{2,}:?$/.test(c)))
      const header = sepIdx === 1 ? rows[0] : null
      const bodyRows = rows.filter((_, idx) => idx !== 0 || sepIdx !== 1).filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)))
      blocks.push(
        <div key={nk()} className="my-3 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            {header && (
              <thead>
                <tr>{header.map((c, ci) => <th key={ci} className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-black text-slate-700">{inline(c, nk())}</th>)}</tr>
              </thead>
            )}
            <tbody>
              {bodyRows.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => <td key={ci} className="border border-slate-200 px-3 py-2 text-slate-700">{inline(c, nk())}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    // 箇条書き（- / *）
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++ }
      blocks.push(
        <ul key={nk()} className="list-disc pl-6 my-2 space-y-1 text-slate-700">
          {items.map((it, idx) => <li key={idx}>{inline(it, nk())}</li>)}
        </ul>
      )
      continue
    }

    // 番号付き
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++ }
      blocks.push(
        <ol key={nk()} className="list-decimal pl-6 my-2 space-y-1 text-slate-700">
          {items.map((it, idx) => <li key={idx}>{inline(it, nk())}</li>)}
        </ol>
      )
      continue
    }

    // 段落（連続行をまとめる）
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,4})\s|^\s*[-*]\s|^\s*\d+\.\s|^\s*\|.*\|\s*$|^---+$/.test(lines[i])) {
      para.push(lines[i]); i++
    }
    blocks.push(<p key={nk()} className="my-2 leading-relaxed text-slate-700">{inline(para.join(' '), nk())}</p>)
  }

  return <div className="shodan-md">{blocks}</div>
}
