import { NextRequest } from 'next/server'
import { readAdImageOperation } from '@/lib/adimage/image-operation-http'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(req: NextRequest) { return readAdImageOperation(req, false) }
export async function DELETE(req: NextRequest) { return readAdImageOperation(req, true) }
