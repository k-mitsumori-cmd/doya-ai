function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function extractLinks(markdown: string): string[] {
  const urls = new Set<string>()
  const re = /\[[^\]]*?\]\((https?:\/\/[^)\s]+)\)/g
  const text = markdown || ''
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m[1]) urls.add(m[1])
  }
  return Array.from(urls)
}

export function extractOutlineFromMarkdown(markdown: string): string {
  const lines = (markdown || '').replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  for (const raw of lines) {
    const m = raw.match(/^(#{2,4})\s+(.+?)\s*$/) // H2〜H4
    if (!m) continue
    const level = m[1].length
    const title = m[2].trim()
    const indent = level === 2 ? '' : level === 3 ? '  ' : '    '
    out.push(`${indent}- ${title}`)
  }
  return out.join('\n')
}

/**
 * Markdownでない“素の文章”を、最低限の見出し構造を持つMarkdownに寄せます。
 * - ルールは控えめ（誤爆しやすいので）
 * - 短め/句点なし/前後が空行、の行を見出し候補として `##` 化
 */
export function normalizePlaintextToMarkdown(input: string): string {
  const lines = (input || '').replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []

  const looksLikeHeading = (line: string, prev: string, next: string) => {
    const t = line.trim()
    if (!t) return false
    if (t.startsWith('#')) return false
    if (t.startsWith('- ') || t.match(/^\d+\.\s+/)) return false
    if (t.startsWith('|') || t.includes('http://') || t.includes('https://')) return false
    if (t.length > 40) return false
    if (/[。．\.：:]\s*$/.test(t)) return false
    // 連続URL断片（scalenut.com など）を弾く
    if (t.includes('.') && !/[\u3040-\u30ff\u4e00-\u9faf]/.test(t)) return false
    if (prev.trim() !== '' && next.trim() !== '') return false
    return true
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const prev = lines[i - 1] ?? ''
    const next = lines[i + 1] ?? ''
    if (looksLikeHeading(line, prev, next)) {
      out.push(`## ${line.trim()}`)
    } else {
      out.push(line)
    }
  }
  return out.join('\n')
}

// 依存追加なしの超軽量Markdown→HTML（最低限のプレビュー/エクスポート用）
export function markdownToHtmlBasic(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  let html = ''
  let inCode = false
  let inUl = false
  let inOl = false
  let inTable = false
  let tableLines: string[] = []
  const headingIdCounts = new Map<string, number>()

  function flushLists() {
    if (inUl) {
      html += '</ul>\n'
      inUl = false
    }
    if (inOl) {
      html += '</ol>\n'
      inOl = false
    }
  }

  // インラインMarkdownをHTMLに変換（表セル用）
  function inlineMarkdown(s: string): string {
    let result = escapeHtml(s)
    // **bold** → <strong>bold</strong>
    result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // *italic* → <em>italic</em>（ただし**の一部でないもの）
    result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    // `code` → <code>code</code>
    result = result.replace(/`([^`]+)`/g, '<code>$1</code>')
    // <br> タグはそのまま
    result = result.replace(/&lt;br&gt;/g, '<br/>')
    return result
  }

  function flushTable() {
    if (!inTable) return
    const rows = tableLines
      .filter((l) => l.trim().startsWith('|') && l.trim().endsWith('|'))
      .map((l) => l.trim().slice(1, -1).split('|').map((c) => c.trim()))
    if (rows.length >= 2) {
      const head = rows[0]
      const body = rows.slice(2) // 2行目は区切り想定
      html += '<div class="table-wrapper"><table>\n<thead><tr>'
      for (const c of head) html += `<th>${inlineMarkdown(c)}</th>`
      html += '</tr></thead>\n<tbody>\n'
      for (const r of body) {
        html += '<tr>'
        for (const c of r) html += `<td>${inlineMarkdown(c)}</td>`
        html += '</tr>\n'
      }
      html += '</tbody>\n</table></div>\n'
    }
    inTable = false
    tableLines = []
  }

  for (const raw of lines) {
    const line = raw

    if (line.startsWith('```')) {
      flushLists()
      flushTable()
      if (!inCode) {
        inCode = true
        html += '<pre><code>'
      } else {
        inCode = false
        html += '</code></pre>\n'
      }
      continue
    }

    if (inCode) {
      html += `${escapeHtml(line)}\n`
      continue
    }

    // table
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      flushLists()
      inTable = true
      tableLines.push(line)
      continue
    } else {
      flushTable()
    }

    // headings
    const hm = line.match(/^(#{1,4})\s+(.*)$/)
    if (hm) {
      flushLists()
      const lvl = hm[1].length
      const text = hm[2].trim()
      const base = slugifyHeading(text)
      const n = (headingIdCounts.get(base) || 0) + 1
      headingIdCounts.set(base, n)
      const id = n === 1 ? base : `${base}-${n}`
      html += `<h${lvl} id="${escapeHtml(id)}">${escapeHtml(text)}</h${lvl}>\n`
      continue
    }

    // images
    const im = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
    if (im) {
      flushLists()
      html += `<p><img src="${escapeHtml(im[2])}" alt="${escapeHtml(im[1])}"/></p>\n`
      continue
    }

    // links in paragraph
    const makeInline = (s: string) =>
      escapeHtml(s).replace(/\[([^\]]*?)\]\((https?:\/\/[^)\s]+)\)/g, (_m, t, u) => {
        return `<a href="${u}" target="_blank" rel="noopener noreferrer">${t || u}</a>`
      })

    // lists
    const ul = line.match(/^\-\s+(.*)$/)
    if (ul) {
      if (inOl) {
        html += '</ol>\n'
        inOl = false
      }
      if (!inUl) {
        html += '<ul>\n'
        inUl = true
      }
      html += `<li>${makeInline(ul[1].trim())}</li>\n`
      continue
    }
    const ol = line.match(/^\d+\.\s+(.*)$/)
    if (ol) {
      if (inUl) {
        html += '</ul>\n'
        inUl = false
      }
      if (!inOl) {
        html += '<ol>\n'
        inOl = true
      }
      html += `<li>${makeInline(ol[1].trim())}</li>\n`
      continue
    }

    // blank
    if (!line.trim()) {
      flushLists()
      html += '\n'
      continue
    }

    flushLists()
    html += `<p>${makeInline(line.trim())}</p>\n`
  }

  if (inCode) html += '</code></pre>\n'
  if (inUl) html += '</ul>\n'
  if (inOl) html += '</ol>\n'
  if (inTable) flushTable()

  return html
}

/**
 * 見出し用のidを作る（英数字はslug、日本語はそのままでもOK）
 * - 同名の重複は呼び出し側で -2, -3 を付ける
 */
export function slugifyHeading(input: string): string {
  const s = String(input || '').trim()
  if (!s) return 'section'
  // 記号を落として、スペースは - に寄せる
  const cleaned = s
    .replace(/[’'"]/g, '')
    .replace(/[「」『』【】（）()\[\]{}<>]/g, '')
    .replace(/[.,!?，．！？：:;；]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const lower = cleaned.toLowerCase()
  return lower || 'section'
}


