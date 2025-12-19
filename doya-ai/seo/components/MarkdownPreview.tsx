'use client'

import { useMemo } from 'react'
import { markdownToHtmlBasic } from '@seo/lib/markdown'

export function MarkdownPreview({ markdown }: { markdown: string }) {
  const html = useMemo(() => markdownToHtmlBasic(markdown || ''), [markdown])
  return (
    <div
      className="prose prose-sm sm:prose max-w-none text-gray-900 prose-headings:scroll-mt-20 prose-a:text-blue-600 prose-code:text-gray-900 prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-blockquote:text-gray-700"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}


