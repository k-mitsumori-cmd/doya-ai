// ============================================
// ドヤ社内インタビュー Word（.docx）出力
// ============================================
// ⚠️ Googleドキュメントへは、この .docx をドライブにアップロードして開くと変換される
//    （Google API 連携は持たない）。
import { AlignmentType, BorderStyle, Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } from 'docx'
import sharp from 'sharp'
import type { ArticleBlock } from './types'

const FONT = 'Noto Sans JP'

export interface DocxInput {
  title: string
  lead: string
  blocks: ArticleBlock[]
  intervieweeName: string
  profileLine: string
  companyName: string
  thumbnail: Buffer | null
  photos: { data: Buffer; caption: string }[]
}

async function imageRun(data: Buffer, maxWidth: number) {
  const jpg = await sharp(data).rotate().resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()
  const meta = await sharp(jpg).metadata()
  const w = meta.width || maxWidth
  const h = meta.height || Math.round(maxWidth * 0.66)
  const width = Math.min(maxWidth, w)
  return new ImageRun({ type: 'jpg', data: jpg, transformation: { width, height: Math.round((h / w) * width) } })
}

function text(t: string, opts: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) {
  return new TextRun({ text: t, font: FONT, bold: opts.bold, size: opts.size, color: opts.color, italics: opts.italics })
}

function paragraphs(body: string, opts: { indent?: boolean } = {}) {
  return body
    .split(/\n{1,}/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => new Paragraph({ children: [text(line, { size: 22 })], spacing: { after: 160, line: 360 }, ...(opts.indent ? { indent: { left: 240 } } : {}) }))
}

export async function buildArticleDocx(input: DocxInput): Promise<Buffer> {
  const children: Paragraph[] = []

  if (input.thumbnail) {
    children.push(new Paragraph({ children: [await imageRun(input.thumbnail, 600)], spacing: { after: 240 } }))
  }
  children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [text(input.title, { bold: true, size: 40 })], spacing: { after: 200 } }))
  if (input.profileLine) children.push(new Paragraph({ children: [text(input.profileLine, { size: 20, color: '555555' })], spacing: { after: 240 } }))
  if (input.lead) {
    children.push(
      new Paragraph({
        children: [text(input.lead, { size: 22 })],
        spacing: { after: 320, line: 360 },
        border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'C026D3', space: 12 } },
        indent: { left: 240 },
      })
    )
  }

  // 本文の写真は章見出しの直後に1枚ずつ差し込む
  const photos = [...input.photos]
  let headingCount = 0
  for (const b of input.blocks) {
    if (b.type === 'heading') {
      headingCount++
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [text(b.heading || '', { bold: true, size: 30 })], spacing: { before: 360, after: 200 } }))
      if (headingCount >= 2 && photos.length > 0) {
        const p = photos.shift()!
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [await imageRun(p.data, 480)], spacing: { after: 80 } }))
        if (p.caption) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [text(p.caption, { size: 18, color: '777777' })], spacing: { after: 240 } }))
      }
      continue
    }
    if (b.type === 'qa') {
      if (b.question) children.push(new Paragraph({ children: [text('― ' + b.question, { bold: true, size: 22, color: '7E22CE' })], spacing: { before: 120, after: 120 } }))
      children.push(...paragraphs(b.body))
      continue
    }
    if (b.type === 'quote') {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [text(`「${b.body.replace(/^[「『]|[」』]$/g, '')}」`, { bold: true, size: 30, color: '7E22CE' })],
          spacing: { before: 280, after: 280 },
        })
      )
      continue
    }
    if (b.type === 'company') {
      children.push(...paragraphs(b.body, { indent: true }))
      continue
    }
    children.push(...paragraphs(b.body))
  }

  for (const p of photos) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [await imageRun(p.data, 480)], spacing: { before: 200, after: 80 } }))
    if (p.caption) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [text(p.caption, { size: 18, color: '777777' })], spacing: { after: 240 } }))
  }

  if (input.companyName) {
    children.push(new Paragraph({ children: [text(input.companyName, { size: 18, color: '777777' })], spacing: { before: 480 } }))
  }

  const doc = new Document({
    creator: 'ドヤ社内インタビュー',
    title: input.title,
    styles: { default: { document: { run: { font: FONT } } } },
    sections: [{ properties: { page: { margin: { top: 1200, bottom: 1200, left: 1300, right: 1300 } } }, children }],
  })
  return Buffer.from(await Packer.toBuffer(doc))
}
