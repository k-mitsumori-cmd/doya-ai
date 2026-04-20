export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { LP_THEMES } from '@/lib/lp/themes'

export async function GET() {
  return NextResponse.json({ themes: LP_THEMES })
}
