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
  for (const m of markdown.matchAll(re)) {
    if (m[1]) urls.add(m[1])
  }
  return Array.from(urls)
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

  function flushTable() {
    if (!inTable) return
    const rows = tableLines
      .filter((l) => l.trim().startsWith('|') && l.trim().endsWith('|'))
      .map((l) => l.trim().slice(1, -1).split('|').map((c) => c.trim()))
    if (rows.length >= 2) {
      const head = rows[0]
      const body = rows.slice(2) // 2行目は区切り想定
      html += '<table>\n<thead><tr>'
      for (const c of head) html += `<th>${escapeHtml(c)}</th>`
      html += '</tr></thead>\n<tbody>\n'
      for (const r of body) {
        html += '<tr>'
        for (const c of r) html += `<td>${escapeHtml(c)}</td>`
        html += '</tr>\n'
      }
      html += '</tbody>\n</table>\n'
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
      html += `<h${lvl}>${escapeHtml(hm[2].trim())}</h${lvl}>\n`
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


