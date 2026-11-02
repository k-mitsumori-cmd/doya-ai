// GET /api/stored-files — 自分が保存しているファイルの一覧と、使っている量・上限
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getUsage } from '@/lib/direct-upload/stored-files'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (!userId) return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
  const [files, usage] = await Promise.all([
    prisma.storedFile.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 500 }),
    getUsage(userId),
  ])
  return NextResponse.json({
    success: true,
    plan: { label: usage.plan.label, quotaBytes: usage.plan.quotaBytes, retentionDays: usage.plan.retentionDays },
    usedBytes: usage.used,
    remainingBytes: usage.remaining,
    files: files.map(f => ({
      id: f.id, fileName: f.fileName, mimeType: f.mimeType, fileSize: Number(f.fileSize),
      createdAt: f.createdAt, expiresAt: f.expiresAt,
    })),
  })
}
