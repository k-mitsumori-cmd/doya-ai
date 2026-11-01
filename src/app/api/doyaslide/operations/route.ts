import { NextRequest } from 'next/server'
import { postDoyaSlideOperation, readDoyaSlideOperation } from '@/lib/doyaslide/generation-http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) { return postDoyaSlideOperation(req) }
export async function GET(req: NextRequest) { return readDoyaSlideOperation(req, false) }
// Live reservations cannot be cancelled: only a missing intent is fenced.
export async function DELETE(req: NextRequest) { return readDoyaSlideOperation(req, true) }
