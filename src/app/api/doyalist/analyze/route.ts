export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordServiceUsage } from '@/lib/service-usage'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const body = await req.json()
  const { projectId, companyIds } = body

  if (!projectId) {
    return NextResponse.json({ error: 'projectIdは必須です' }, { status: 400 })
  }

  const project = await prisma.doyalistProject.findUnique({
    where: { id: projectId },
    include: {
      companies: companyIds?.length
        ? { where: { id: { in: companyIds } } }
        : true
    }
  })

  if (!project) {
    return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
  }
  if (project.userId !== session.user.id) {
    return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
  }

  if (project.companies.length === 0) {
    return NextResponse.json({ error: '分析対象の企業がありません' }, { status: 400 })
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GENAI_API_KEY
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'AI APIキーが設定されていません' }, { status: 500 })
  }

  const model = 'gemini-2.0-flash'
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

  try {
    // Update project status
    await prisma.doyalistProject.update({
      where: { id: projectId },
      data: { status: 'analyzing' }
    })

    const results: any[] = []

    // Process companies in batches of 5
    const batchSize = 5
    for (let i = 0; i < project.companies.length; i += batchSize) {
      const batch = project.companies.slice(i, i + batchSize)

      const batchPromises = batch.map(async (company) => {
        const prompt = `あなたは営業戦略アナリストです。この企業と自社サービスのマッチ度を分析してください。

【企業情報】
- 企業名: ${company.name}
- 業種: ${company.industry || '不明'}
- 所在地: ${company.region || '不明'}

【自社サービス】
${project.description || '未設定'}

【自社の強み】
${project.keywords || '未設定'}

以下のJSON形式で回答してください:
{
  "matchScore": 0から100の数値,
  "needsAnalysis": "この企業が抱えている可能性のある課題・ニーズの分析",
  "approachAdvice": "この企業へのアプローチ方法のアドバイス",
  "riskFlags": "注意すべきリスクや懸念点（なければ空文字）"
}`

        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.3, responseMimeType: 'application/json' }
            })
          })

          if (!response.ok) {
            console.error(`Gemini API error for company ${company.id}:`, response.status)
            return null
          }

          const data = await response.json()
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text
          if (!text) return null

          const analysis = JSON.parse(text)

          // Update company record
          await prisma.doyalistCompany.update({
            where: { id: company.id },
            data: {
              score: analysis.matchScore || 0,
              enrichedData: {
                matchScore: analysis.matchScore || 0,
                needsAnalysis: analysis.needsAnalysis || null,
                approachAdvice: analysis.approachAdvice || null,
                riskFlags: analysis.riskFlags || null,
              },
            }
          })

          return { companyId: company.id, ...analysis }
        } catch (err) {
          console.error(`Analysis error for company ${company.id}:`, err)
          return null
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults.filter(Boolean))
    }

    // Update project status to completed
    await prisma.doyalistProject.update({
      where: { id: projectId },
      data: { status: 'completed' }
    })

    await recordServiceUsage({
      userId: session.user.id,
      serviceId: 'doyalist',
      action: '企業分析',
      summary: project.name || '',
      count: results.length,
      input: { projectId, companyCount: project.companies.length },
    })

    return NextResponse.json({ success: true, analyzed: results.length, results })
  } catch (error) {
    console.error('analyze error:', error)

    await prisma.doyalistProject.update({
      where: { id: projectId },
      data: { status: 'completed' }
    }).catch(() => {})

    return NextResponse.json({ error: '企業分析に失敗しました' }, { status: 500 })
  }
}
