import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { test } from 'node:test'
import sharp from 'sharp'
import { generateQuotePdf, type QuotePdfInput } from '../../src/lib/quote/pdf'

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
    assert.ok(text.includes(long ? '49,500' : '330,000'), 'Totals must remain correct')
    for (const item of fixture.lineItems) assert.ok(text.includes(item.itemName), `Missing item ${item.itemName}`)
  }
})
