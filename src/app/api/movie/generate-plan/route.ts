import { NextRequest } from 'next/server'
import { generatePlansStream } from '@/lib/movie/gemini'
import type { ProductInfo, MoviePersona } from '@/lib/movie/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { productInfo, persona, config } = body as {
      productInfo: ProductInfo
      persona: MoviePersona | null
      config: { duration: number; platform: string; aspectRatio: string }
    }

    const stream = generatePlansStream(productInfo, persona, config)

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const plan of stream) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ plan })}\n\n`))
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        } catch (error) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(error) })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[POST /api/movie/generate-plan]', error)
    return new Response(JSON.stringify({ error: '企画生成に失敗しました' }), { status: 500 })
  }
}
