/**
 * ドヤマーケAI SSE ヘルパー
 * 既存 copy/lp/adsim の `ReadableStream + safeEnqueue` パターン踏襲。
 */

import type { AnalyzeSseEvent, ChatSseEvent } from './types'

export interface SseController<T> {
  send: (event: T) => void
  close: () => void
  isClosed: () => boolean
}

/**
 * SSE 文字列フォーマット
 * `data: {...}\n\n` 形式。
 */
function formatSse(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

/**
 * SSE Response を作る（analyze 用）
 * 使い方:
 *   const stream = createSseStream<AnalyzeSseEvent>(async (send) => { ... })
 *   return new Response(stream, { headers: SSE_HEADERS })
 */
export function createSseStream<TEvent = AnalyzeSseEvent>(
  producer: (ctrl: SseController<TEvent>) => Promise<void>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let closed = false

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const safeEnqueue = (event: TEvent) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(formatSse(event)))
        } catch {
          closed = true
        }
      }
      const safeClose = () => {
        if (closed) return
        closed = true
        try {
          controller.close()
        } catch {
          /* noop */
        }
      }
      try {
        await producer({ send: safeEnqueue, close: safeClose, isClosed: () => closed })
      } catch (err) {
        if (!closed) {
          try {
            controller.enqueue(
              encoder.encode(
                formatSse({ type: 'error', message: err instanceof Error ? err.message : String(err) })
              )
            )
          } catch {
            /* noop */
          }
        }
      } finally {
        safeClose()
      }
    },
    cancel() {
      closed = true
    },
  })
}

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
}

export type { AnalyzeSseEvent, ChatSseEvent }
