'use client'

import { useMemo } from 'react'
import { markdownToHtmlBasic } from '@seo/lib/markdown'

export function MarkdownPreview({ markdown }: { markdown: string }) {
  const html = useMemo(() => markdownToHtmlBasic(markdown || ''), [markdown])
  return (
    <div
      className="prose prose-sm sm:prose max-w-none prose-headings:scroll-mt-20 prose-a:text-blue-600"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}


