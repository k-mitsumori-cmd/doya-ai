// ============================================
// POST /api/tenkai/outputs/[outputId]/export
// ============================================
// Markdown/HTML/プレーンテキスト/JSON形式でエクスポート

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ outputId: string }> | { outputId: string } }

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const outputId = p.outputId

    const body = await req.json()
    const { format } = body as { format: 'markdown' | 'html' | 'text' | 'json' }

    if (!format || !['markdown', 'html', 'text', 'json'].includes(format)) {
      return NextResponse.json(
        { error: 'format は markdown, html, text, json のいずれかです' },
        { status: 400 }
      )
    }

    const output = await prisma.tenkaiOutput.findUnique({
      where: { id: outputId },
      include: {
        project: { select: { userId: true, title: true } },
      },
    })

    if (!output || output.project.userId !== userId) {
      return NextResponse.json({ error: '出力が見つかりません' }, { status: 404 })
    }

    const content = output.content as Record<string, unknown>
    let exported: string
    let contentType: string
    let fileName: string

    switch (format) {
      case 'json':
        exported = JSON.stringify(content, null, 2)
        contentType = 'application/json'
        fileName = `${output.platform}_v${output.version}.json`
        break

      case 'markdown':
        exported = convertToMarkdown(output.platform, content)
        contentType = 'text/markdown'
        fileName = `${output.platform}_v${output.version}.md`
        break

      case 'html':
        exported = convertToHtml(output.platform, content)
        contentType = 'text/html'
        fileName = `${output.platform}_v${output.version}.html`
        break

      case 'text':
        exported = convertToPlainText(output.platform, content)
        contentType = 'text/plain'
        fileName = `${output.platform}_v${output.version}.txt`
        break

      default:
        exported = JSON.stringify(content, null, 2)
        contentType = 'application/json'
        fileName = `${output.platform}_v${output.version}.json`
    }

    const sanitizedFileName = fileName.replace(/[^a-z0-9._-]/gi, '_')
    return new NextResponse(exported, {
      headers: {
        'Content-Type': `${contentType}; charset=utf-8`,
        'Content-Disposition': `attachment; filename="${sanitizedFileName}"`,
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] export error:', message)
    return NextResponse.json(
      { error: message || 'エクスポートに失敗しました' },
      { status: 500 }
    )
  }
}

function convertToMarkdown(platform: string, content: Record<string, unknown>): string {
  switch (platform) {
    case 'note':
      return `# ${content.title || ''}\n\n${content.body || ''}\n\n---\nタグ: ${(content.tags as string[] || []).join(', ')}`
    case 'blog':
      return `# ${(content.seo as Record<string, unknown>)?.title || ''}\n\n${content.body_markdown || ''}`
    case 'x':
      return ((content.tweets as Record<string, unknown>[]) || [])
        .map((t, i) => `**ツイート ${t.index ?? i + 1}** (${t.char_count ?? String(t.text || '').length}文字)\n${t.text}`)
        .join('\n\n---\n\n')
    case 'instagram':
      return `${content.caption || ''}\n\n---\nハッシュタグ: ${((content.hashtags as string[]) || []).map((h: string) => `#${h}`).join(' ')}`
    case 'line':
      return ((content.messages as Record<string, unknown>[]) || [])
        .map((m, i: number) => `**メッセージ ${i + 1}**\n${m.text}`)
        .join('\n\n---\n\n')
    case 'facebook':
      return (content.post_text as string) || ''
    case 'linkedin':
      return `${content.post_text || ''}\n\n${((content.hashtags as string[]) || []).join(' ')}`
    case 'newsletter':
      return `**件名:** ${content.subject_line || ''}\n\n${content.body_text || content.body_html || ''}`
    case 'press_release':
      return `# ${content.headline || ''}\n\n*${content.sub_headline || ''}*\n\n${content.dateline || ''}\n\n${content.lead_paragraph || ''}\n\n${content.body || ''}`
    default:
      return JSON.stringify(content, null, 2)
  }
}

function convertToHtml(platform: string, content: Record<string, unknown>): string {
  switch (platform) {
    case 'blog':
      if (content.body_html) return content.body_html as string
      const seoTitle = (content.seo as Record<string, unknown>)?.title || ''
      return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><h1>${escapeHtml(String(seoTitle))}</h1><pre>${escapeHtml(String(content.body_markdown || ''))}</pre></body></html>`
    case 'newsletter':
      return (content.body_html as string) || (content.body_text as string) || ''
    default: {
      const md = convertToMarkdown(platform, content)
      return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><pre>${escapeHtml(md)}</pre></body></html>`
    }
  }
}

function convertToPlainText(platform: string, content: Record<string, unknown>): string {
  switch (platform) {
    case 'note':
      return `${content.title || ''}\n\n${((content.body as string) || '').replace(/[#*_`]/g, '')}`
    case 'blog':
      return `${(content.seo as Record<string, unknown>)?.title || ''}\n\n${((content.body_markdown as string) || '').replace(/[#*_`]/g, '')}`
    case 'x':
      return ((content.tweets as Record<string, unknown>[]) || []).map((t) => t.text).join('\n\n')
    case 'instagram':
      return `${content.caption || ''}\n\n${((content.hashtags as string[]) || []).map((h: string) => `#${h}`).join(' ')}`
    case 'line':
      return ((content.messages as Record<string, unknown>[]) || []).map((m) => m.text).join('\n\n')
    case 'facebook':
      return (content.post_text as string) || ''
    case 'linkedin':
      return `${content.post_text || ''}\n\n${((content.hashtags as string[]) || []).join(' ')}`
    case 'newsletter':
      return `件名: ${content.subject_line || ''}\n\n${content.body_text || ''}`
    case 'press_release':
      return `${content.headline || ''}\n${content.sub_headline || ''}\n\n${content.dateline || ''}\n\n${content.lead_paragraph || ''}\n\n${content.body || ''}`
    default:
      return JSON.stringify(content, null, 2)
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
