import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
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
  assert.ok(text.includes('テスト会社'), 'Japanese client text must survive PDF generation')
  assert.ok(text.includes('検証用項目'), 'Japanese line item must survive PDF generation')
  assert.ok(text.includes('社内確認用'), 'Draft watermark must remain')
  assert.ok(text.includes('1,100'), 'Synthetic 1000 yen + 10% tax total must remain')
})
