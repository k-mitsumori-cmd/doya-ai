import { NextRequest } from 'next/server'
import { postDoyaSlideOperation } from '@/lib/doyaslide/generation-http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return postDoyaSlideOperation(req, { kind: 'regenerate', slideId: id })
}
