/** Send large owned lists without buffering one oversized Function response. */
export function streamDoyalistJsonArray<T>(
  fields: Record<string, unknown>,
  arrayKey: string,
  rows: T[],
): Response {
  const encoder = new TextEncoder()
  const metadata = JSON.stringify(fields)
  const opening = `${metadata === '{}' ? '{' : `${metadata.slice(0, -1)},`}${JSON.stringify(arrayKey)}:[`
  let position = -1
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      try {
        if (position === -1) {
          controller.enqueue(encoder.encode(opening))
          position = 0
          return
        }
        if (position < rows.length) {
          const next = Math.min(position + 25, rows.length)
          const chunk = rows.slice(position, next).map((row) => JSON.stringify(row)).join(',')
          controller.enqueue(encoder.encode(`${position > 0 ? ',' : ''}${chunk}`))
          position = next
          return
        }
        controller.enqueue(encoder.encode(']}'))
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  })
}
