// GET /api/direct-upload/mode — 画面が「直接アップロード」と「これまでの経路」のどちらで送るかを知るための窓口
// 旗は DIRECT_UPLOAD_ROLLOUT（src/lib/direct-upload/flag.ts）。ログイン不要・秘密の値は返さない。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { directUploadRollout } from '@/lib/direct-upload/flag'

export async function GET() {
  return NextResponse.json({ direct: directUploadRollout() }, { headers: { 'Cache-Control': 'no-store' } })
}
