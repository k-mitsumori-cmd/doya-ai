import type { NextRequest } from 'next/server'
import { ownerTransferGet, ownerTransferPost } from '@/lib/owner-transfer/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) { return ownerTransferGet('aishodan', request) }
export async function POST(request: NextRequest) { return ownerTransferPost('aishodan', request) }
