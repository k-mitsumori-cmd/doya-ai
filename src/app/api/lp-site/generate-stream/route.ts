// ============================================
// ドヤサイト LP生成API（段階的結果返却）
// ============================================

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { extractProductInfoFromUrl, structureProductInfo } from '@/lib/lp-site/product-understanding'
import { generateLpStructure } from '@/lib/lp-site/structure-generation'
import { generateWireframes } from '@/lib/lp-site/wireframe-generation'
import { generateSectionImages } from '@/lib/lp-site/image-generation'
import { LpGenerationRequest, ProductInfo } from '@/lib/lp-site/types'

export const maxDuration = 300 // 5分

// ストリーミングレスポンスを生成
function createStreamResponse() {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        const chunk = encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        controller.enqueue(chunk)
      }

      try {
        // ここでリクエストボディを取得する必要があるが、ストリーミングでは難しい
        // 代わりに、通常のAPIで段階的に結果を返す方式に変更
        controller.close()
      } catch (error: any) {
        const errorChunk = encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`)
        controller.enqueue(errorChunk)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

export async function POST(request: NextRequest) {
  // ストリーミングは複雑なので、通常のAPIで段階的に結果を返す方式に変更
  return new Response('Not implemented', { status: 501 })
}

