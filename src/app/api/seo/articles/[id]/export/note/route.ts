import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * note記事向けに最適化されたMarkdownをエクスポート
 * - noteはMarkdown対応だが、一部の記法に制限がある
 * - 見出しは ## と ### のみ使用（#は使わない）
 * - コードブロックは``` で囲む
 * - 画像はnoteにアップロード後に差し替える必要がある
 * - リンクは [テキスト](URL) 形式
 * - 箇条書きは - を使用
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const article = await (prisma as any).seoArticle.findUnique({
      where: { id: params.id },
      select: { title: true, finalMarkdown: true },
    })

    if (!article) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    const markdown = article.finalMarkdown || ''

    // note向けに最適化
    let noteMarkdown = markdown
      // # 見出しを ## に変換（noteでは#が大きすぎる）
      .replace(/^# (.+)$/gm, '## $1')
      // #### 以降を ### に統一（noteでは####が目立たない）
      .replace(/^#{4,} (.+)$/gm, '### $1')
      // HTMLコメントを削除
      .replace(/<!--[\s\S]*?-->/g, '')
      // 画像パスをプレースホルダーに（noteは外部画像を直接表示できない）
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '【画像: $1 ※noteにアップロード後に差し替え】')
      // テーブルをシンプルな形式に変換（noteはテーブルに対応していない）
      .replace(/\|([^|\n]+)\|/g, (match: string) => {
        // ヘッダー行や区切り行を検出
        if (match.includes('---') || match.includes(':-')) {
          return ''
        }
        // セルを抽出してリスト形式に変換
        const cells = match
          .split('|')
          .filter((c: string) => c.trim())
          .map((c: string) => c.trim())
        return cells.length > 0 ? cells.map((c) => `- ${c}`).join('\n') : match
      })
      // 連続する空行を1つに
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    // note用のヘッダーを追加
    const noteHeader = `---
【noteに投稿する際の注意】
1. 画像はnoteにアップロード後、【画像: ○○】の部分を差し替えてください
2. テーブルはリスト形式に変換しています
3. コードブロックはそのまま使えます
---

`

    const fullContent = noteHeader + noteMarkdown

    return new NextResponse(fullContent, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(article.title || 'note-article')}.md"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 500 })
  }
}

