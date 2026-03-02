// ============================================
// GET /api/tenkai/export
// ============================================
// ユーザーの全展開AIデータをJSON形式でエクスポート

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    // 全データを並列取得
    const [projects, brandVoices, templates, usages] = await Promise.all([
      prisma.tenkaiProject.findMany({
        where: { userId },
        include: {
          outputs: {
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.tenkaiBrandVoice.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.tenkaiTemplate.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.tenkaiUsage.findMany({
        where: { userId },
        orderBy: { yearMonth: 'desc' },
      }),
    ])

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      user: {
        id: userId,
        name: session.user.name || null,
        email: session.user.email || null,
      },
      projects: projects.map((p) => ({
        id: p.id,
        title: p.title,
        inputType: p.inputType,
        inputUrl: p.inputUrl,
        inputText: p.inputText,
        transcript: p.transcript,
        analysis: p.analysis,
        status: p.status,
        wordCount: p.wordCount,
        language: p.language,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        outputs: p.outputs.map((o) => ({
          id: o.id,
          platform: o.platform,
          content: o.content,
          charCount: o.charCount,
          qualityScore: o.qualityScore,
          isEdited: o.isEdited,
          status: o.status,
          tokensUsed: o.tokensUsed,
          feedback: o.feedback,
          version: o.version,
          createdAt: o.createdAt.toISOString(),
          updatedAt: o.updatedAt.toISOString(),
        })),
      })),
      brandVoices: brandVoices.map((bv) => ({
        id: bv.id,
        name: bv.name,
        firstPerson: bv.firstPerson,
        formalityLevel: bv.formalityLevel,
        enthusiasmLevel: bv.enthusiasmLevel,
        technicalLevel: bv.technicalLevel,
        humorLevel: bv.humorLevel,
        targetAudience: bv.targetAudience,
        sampleText: bv.sampleText,
        preferredExpressions: bv.preferredExpressions,
        prohibitedWords: bv.prohibitedWords,
        isDefault: bv.isDefault,
        createdAt: bv.createdAt.toISOString(),
        updatedAt: bv.updatedAt.toISOString(),
      })),
      templates: templates.map((t) => ({
        id: t.id,
        platform: t.platform,
        name: t.name,
        description: t.description,
        promptOverride: t.promptOverride,
        structureHint: t.structureHint,
        isSystem: t.isSystem,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      usage: usages.map((u) => ({
        yearMonth: u.yearMonth,
        creditsUsed: u.creditsUsed,
        tokensTotal: u.tokensTotal,
        projectsCreated: u.projectsCreated,
      })),
      summary: {
        totalProjects: projects.length,
        totalOutputs: projects.reduce((sum, p) => sum + p.outputs.length, 0),
        totalBrandVoices: brandVoices.length,
        totalTemplates: templates.length,
      },
    }

    const jsonStr = JSON.stringify(exportData, null, 2)
    const date = new Date().toISOString().slice(0, 10)

    return new Response(jsonStr, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="doya-tenkai-export-${date}.json"`,
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エクスポートに失敗しました'
    console.error('[tenkai] export error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
