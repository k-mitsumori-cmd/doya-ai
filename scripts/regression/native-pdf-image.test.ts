import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { test } from 'node:test'
import sharp from 'sharp'
import { generateQuotePdf, type QuotePdfInput } from '../../src/lib/quote/pdf'
import { generateReportPdf, type ReportPdfInput } from '../../src/lib/mensetsu/pdf'


test('updated native image dependency decodes and resizes a synthetic image', async () => {
  const image = await sharp({ create: { width: 32, height: 20, channels: 4, background: '#123456' } }).png().toBuffer()
  const resized = await sharp(image).resize(16, 10).webp().toBuffer()
  const metadata = await sharp(resized).metadata()
  assert.equal(metadata.format, 'webp')
  assert.equal(metadata.width, 16)
  assert.equal(metadata.height, 10)
})

test('updated PDF dependency works with the bundled Chromium and Japanese fonts', { skip: process.platform !== 'linux', timeout: 90000 }, async () => {
  const input: QuotePdfInput = {
    quoteNo: 'Q-AUDIT-0001', title: '検証用見積', status: 'draft',
    issueDate: new Date('2026-10-01T00:00:00Z'), expiryDate: new Date('2026-10-31T00:00:00Z'),
    clientCompany: 'テスト会社', clientDept: null, clientPerson: null,
    issuer: { companyName: '検証用発行者', postalCode: null, address: null, tel: null, personName: null, invoiceNo: null },
    lineItems: [{ itemName: '検証用項目', spec: null, qty: 1, unit: '式', unitPrice: 1000, taxRate: 10, priceSource: 'manual' }],
    discountType: null, discountValue: 0, paymentTerms: null, deliveryTerms: null, notes: null,
  }
  const pdf = Buffer.from(await generateQuotePdf(input))
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
  assert.ok(pdf.byteLength > 5000)
  const text = execFileSync('pdftotext', ['-', '-'], { input: pdf, maxBuffer: 1024 * 1024 }).toString().replace(/\s/g, '')
  // Spatial sorting can interleave a rotated watermark with table text. Check its content-stream order too.
  const rawText = execFileSync('pdftotext', ['-raw', '-', '-'], { input: pdf, maxBuffer: 1024 * 1024 }).toString().replace(/\s/g, '')
  mkdirSync('/tmp/doya-native-pdf-audit', { recursive: true })
  writeFileSync('/tmp/doya-native-pdf-audit/synthetic-quote.pdf', pdf)
  writeFileSync('/tmp/doya-native-pdf-audit/text.json', JSON.stringify({ text, rawText }, null, 2))
  assert.ok(text.includes('テスト会社'), 'Japanese client text must survive PDF generation')
  assert.ok(text.includes('検証用項目'), 'Japanese line item must survive PDF generation')
  assert.ok(rawText.includes('社内確認用'), 'Draft watermark must remain in content-stream order')
  assert.ok(text.includes('1,100'), 'Synthetic 1000 yen + 10% tax total must remain')
})

test('quote pagination keeps the footer with content and preserves long estimates', { skip: process.platform !== 'linux', timeout: 180000 }, async () => {
  // Same layout pressure as the production one-item draft: full issuer, wrapping spec and three notes.
  // All content here is synthetic; do not load production records or call any AI provider.
  const input: QuotePdfInput = {
    quoteNo: 'Q-PAGINATION-0001', title: '検査用サイト制作のお見積り', status: 'draft',
    issueDate: new Date('2026-10-27T00:00:00Z'), expiryDate: new Date('2026-11-26T00:00:00Z'),
    clientCompany: null, clientDept: null, clientPerson: null,
    issuer: { companyName: '検査用発行会社', postalCode: '100-0000', address: '東京都検査区検査町1-2-3 検査ビル\n5F', tel: '03-0000-0000', personName: '検査担当者', invoiceNo: 'T1234567890123' },
    lineItems: [{ itemName: 'コーポレートサイト制作（小規模）', spec: 'ページ数10前後、レスポンシブデザイン、コーディング、基本的な情報設計を含む受託制作。大規模機能やCMS構築は含まない。', qty: 1, unit: '式', unitPrice: 300000, taxRate: 10, priceSource: 'manual' }],
    discountType: null, discountValue: 0, paymentTerms: '月末締め翌月末払い（銀行振込）', deliveryTerms: 'ご発注後、約2週間', notes: '検査用の下書きです。内容を確かめてから確定してください。',
  }
  for (const long of [false, true]) {
    const fixture = long ? { ...input, quoteNo: 'Q-PAGINATION-0045', lineItems: Array.from({ length: 45 }, (_, index) => ({ itemName: `検査明細${String(index + 1).padStart(3, '0')}`, spec: '明細の説明です。内容を省略せず次のページへ続けます。', qty: 1, unit: '式', unitPrice: 1000, taxRate: 10, priceSource: 'manual' })) } : input
    const pdf = Buffer.from(await generateQuotePdf(fixture))
    const info = execFileSync('pdfinfo', ['-'], { input: pdf }).toString()
    const pageCount = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1])
    const text = execFileSync('pdftotext', ['-', '-'], { input: pdf }).toString().replace(/\s/g, '')
    const raw = execFileSync('pdftotext', ['-raw', '-', '-'], { input: pdf }).toString().replace(/\s/g, '')
    const last = execFileSync('pdftotext', ['-f', String(pageCount), '-l', String(pageCount), '-', '-'], { input: pdf }).toString().replace(/\s/g, '')
    const prefix = `/tmp/doya-native-pdf-audit/pagination-${long ? 'long' : 'short'}`
    mkdirSync('/tmp/doya-native-pdf-audit', { recursive: true })
    writeFileSync(`${prefix}.pdf`, pdf)
    writeFileSync(`${prefix}.json`, JSON.stringify({ pageCount, text, raw, last }, null, 2))
    assert.ok(pageCount >= 1)
    if (!long) assert.equal(pageCount, 1, 'One complete line, issuer and three notes must fit one A4 page')
    else assert.ok(pageCount > 1, 'Long estimates must flow onto more pages, not clip or shrink all content')
    assert.ok(last.includes(input.title), 'Document title must remain in the footer')
    assert.ok(last.replace(input.title, '').length > 50, 'Last page must contain actual estimate content, not a lonely footer')
    assert.ok(raw.includes('社内確認用'), 'Draft watermark must remain')
    for (let page = 1; page <= pageCount; page++) {
      const pageText = execFileSync('pdftotext', ['-raw', '-f', String(page), '-l', String(page), '-', '-'], { input: pdf }).toString().replace(/\s/g, '')
      assert.ok(pageText.includes('社内確認用'), `Draft watermark must be present on page ${page}/${pageCount}`)
      if (long) {
        const itemNames = pageText.match(/検査明細\d{3}/g) ?? []
        if (itemNames.length > 0) {
          const boxes = execFileSync('pdftotext', ['-bbox', '-f', String(page), '-l', String(page), '-', '-'], { input: pdf }).toString()
          const heading = /<word[^>]*yMin="([\d.]+)"[^>]*>品目<\/word>/.exec(boxes)
          assert.ok(heading, `Column heading must be present on page ${page}/${pageCount}`)
          assert.ok(Number(heading[1]) >= 16 * 72 / 25.4, `Column heading must have a printable top margin on page ${page}/${pageCount}`)
        }
        const descriptions = pageText.match(/明細の説明です。内容を省略せず次のページへ続けます。/g) ?? []
        assert.equal(descriptions.length, itemNames.length, `Each line item and description must stay on the same page (${page}/${pageCount})`)
      }
    }
    assert.ok(text.includes(long ? '49,500' : '330,000'), 'Totals must remain correct')
    for (const item of fixture.lineItems) assert.ok(text.includes(item.itemName), `Missing item ${item.itemName}`)
  }
  const approvedPdf = Buffer.from(await generateQuotePdf({ ...input, status: 'approved' }))
  const approvedText = execFileSync('pdftotext', ['-raw', '-', '-'], { input: approvedPdf }).toString().replace(/\s/g, '')
  assert.equal(approvedText.includes('社内確認用'), false, 'Approved documents must not gain a draft watermark')
  writeFileSync('/tmp/doya-native-pdf-audit/pagination-approved.pdf', approvedPdf)
})

test('interview PDF preserves Japanese criteria and includes transcripts only on request', { skip: process.platform !== 'linux', timeout: 90000 }, async () => {
  const transcript = '逐語ログ検証用の発言です。'
  const rationale = '判断の根拠を検証しました。'
  const input: ReportPdfInput = {
    companyName: '検証用組織', jobTitle: '開発担当', levelLabel: '中途',
    candidateName: '検証用応募者', interviewedAt: new Date('2026-11-10T00:00:00Z'),
    durationMin: 30, verdict: 'recommend', average: 4,
    overallComment: '評価全体の確認です。', recruiterReport: '採用担当者向けの所見です。',
    criteria: Array.from({ length: 24 }, (_, index) => ({
      name: `評価項目${String(index + 1).padStart(2, '0')}`,
      description: '本人の役割と具体例です。', score: 4, insufficient: false,
      rationale, quotes: ['業務経験を説明しました。'],
    })),
    turns: [{ speaker: 'candidate', text: transcript }],
    includeTranscript: false,
  }

  let defaultPageCount = 0
  for (const includeTranscript of [false, true]) {
    const pdf = Buffer.from(await generateReportPdf({ ...input, includeTranscript }))
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
    const pages = execFileSync('pdftotext', ['-layout', '-', '-'], { input: pdf })
      .toString().split('\f').filter(page => page.trim()).map(page => page.replace(/\s/g, ''))
    const text = pages.join('')
    const fonts = execFileSync('pdffonts', ['-'], { input: pdf }).toString()
    assert.ok(fonts.split('\n').some(line => /NotoSansJP.*\byes\s+yes\s+yes\b/.test(line)), 'Noto Sans JP must be embedded with a Unicode mapping')
    assert.deepEqual(text.match(/評価項目\d{2}/g), input.criteria.map(criterion => criterion.name))
    for (const page of pages) {
      const headings = page.match(/評価項目\d{2}/g) ?? []
      assert.equal(page.split(rationale).length - 1, headings.length, 'Each criterion and rationale must stay on the same page')
    }
    for (const expected of [input.companyName, input.candidateName, input.recruiterReport]) {
      assert.ok(expected && text.includes(expected))
    }
    assert.equal(text.includes(transcript), includeTranscript)
    if (includeTranscript) {
      assert.equal(pages.length, defaultPageCount + 1)
      assert.ok(pages.at(-1)?.includes(transcript))
    } else {
      assert.ok(pages.length > 1)
      defaultPageCount = pages.length
    }
    mkdirSync('/tmp/doya-native-pdf-audit', { recursive: true })
    writeFileSync(`/tmp/doya-native-pdf-audit/mensetsu-${includeTranscript ? 'transcript' : 'default'}.pdf`, pdf)
  }
})
