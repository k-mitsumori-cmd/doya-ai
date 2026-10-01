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

/** Stream an async database cursor without retaining the complete result set. */
export function streamDoyalistJsonIterable<T>(
  fields: Record<string, unknown>,
  arrayKey: string,
  rows: AsyncIterable<T>,
): Response {
  const encoder = new TextEncoder()
  const metadata = JSON.stringify(fields)
  const opening = `${metadata === '{}' ? '{' : `${metadata.slice(0, -1)},`}${JSON.stringify(arrayKey)}:[`
  const iterator = rows[Symbol.asyncIterator]()
  let opened = false
  let emitted = 0
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (!opened) {
          controller.enqueue(encoder.encode(opening))
          opened = true
          return
        }
        const batch: string[] = []
        for (let index = 0; index < 25; index++) {
          const next = await iterator.next()
          if (next.done) break
          batch.push(JSON.stringify(next.value))
        }
        if (batch.length) {
          controller.enqueue(encoder.encode(`${emitted ? ',' : ''}${batch.join(',')}`))
          emitted += batch.length
          return
        }
        controller.enqueue(encoder.encode(']}'))
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
    async cancel() {
      await iterator.return?.()
    },
  })
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  })
}
