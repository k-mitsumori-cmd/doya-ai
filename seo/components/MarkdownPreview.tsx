'use client'

import { useMemo } from 'react'
import { markdownToHtmlBasic } from '@seo/lib/markdown'

export function MarkdownPreview({ markdown }: { markdown: string }) {
  const html = useMemo(() => markdownToHtmlBasic(markdown || ''), [markdown])
  return (
    <div
      className="
        prose prose-sm sm:prose lg:prose-lg max-w-none
        text-gray-800
        prose-headings:text-gray-900 prose-headings:font-bold prose-headings:scroll-mt-20
        prose-h1:text-2xl prose-h1:border-b prose-h1:border-gray-200 prose-h1:pb-2 prose-h1:mb-4
        prose-h2:text-xl prose-h2:border-l-4 prose-h2:border-blue-500 prose-h2:pl-3 prose-h2:mt-8 prose-h2:mb-4
        prose-h3:text-lg prose-h3:text-gray-800 prose-h3:mt-6 prose-h3:mb-3
        prose-h4:text-base prose-h4:text-gray-700 prose-h4:font-semibold
        prose-p:text-gray-700 prose-p:leading-relaxed
        prose-a:text-blue-600 prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-blue-800
        prose-strong:text-gray-900 prose-strong:font-bold
        prose-em:text-gray-700 prose-em:italic
        prose-code:text-pink-600 prose-code:bg-pink-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
        prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-xl prose-pre:shadow-lg prose-pre:overflow-x-auto
        prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:bg-gray-50 prose-blockquote:pl-4 prose-blockquote:py-2 prose-blockquote:text-gray-600 prose-blockquote:italic prose-blockquote:rounded-r-lg
        prose-ul:text-gray-700 prose-ul:list-disc prose-ul:pl-6
        prose-ol:text-gray-700 prose-ol:list-decimal prose-ol:pl-6
        prose-li:text-gray-700 prose-li:my-1
        prose-table:border-collapse prose-table:w-full prose-table:text-sm
        prose-th:bg-gray-100 prose-th:text-gray-900 prose-th:font-bold prose-th:px-4 prose-th:py-3 prose-th:border prose-th:border-gray-200 prose-th:text-left
        prose-td:px-4 prose-td:py-3 prose-td:border prose-td:border-gray-200 prose-td:text-gray-700
        prose-tr:even:bg-gray-50
        prose-img:rounded-xl prose-img:shadow-md prose-img:mx-auto
        prose-hr:border-gray-200 prose-hr:my-8
      "
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
