import { NextRequest } from 'next/server'
import { postDoyaSlideOperation } from '@/lib/doyaslide/generation-http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) { return postDoyaSlideOperation(req, { kind: 'batch' }) }
