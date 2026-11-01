'use client'

import { useEffect, useRef } from 'react'

export interface PersonaManualCopy {
  id: string
  text: string
}

export function PersonaCopyFallback({ value }: { value: PersonaManualCopy }) {
  const field = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    field.current?.focus()
    field.current?.select()
  }, [value])
  return (
    <div className="mt-3 export-hide">
      <p role="status" className="text-xs font-medium text-gray-700">
        コピーできませんでした。下の文章を手動でコピーしてください。
      </p>
      <textarea
        ref={field}
        aria-label="キャッチコピー（手動コピー）"
        readOnly
        value={value.text}
        rows={3}
        className="mt-2 w-full resize-y rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      />
    </div>
  )
}

export function PersonaExportFailure({ message }: { message: string }) {
  return <p role="alert" className="mt-2 text-sm text-red-700">{message}</p>
}
