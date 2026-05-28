export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildApproachPrompt } from '@/lib/doyalist/prompts'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GENAI_API_KEY
const model = 'gemini-2.0-flash'
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

const BATCH_SIZE = 5
const BATCH_DELAY_MS = 2000

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function generateApproachText(prompt: string): Promise<{ subject: string; body: string } | null> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured')
  }

  try {
    const response = await fetch(`${endpoint}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    })

    if (!response.ok) {
      console.error('Gemini API error:', response.status, await response.text())
      return null
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return null

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    return JSON.parse(jsonMatch[0])
  } catch (error) {
    console.error('Gemini generation error:', error)
    return null
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  try {
    const { projectId, type, tone } = await req.json()

    if (!projectId) {
      return NextResponse.json({ error: 'プロジェクトIDは必須です' }, { status: 400 })
    }

    const validTypes = ['email', 'form', 'letter', 'phone_script']
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json({ error: '有効なタイプを指定してください（email, form, letter, phone_script）' }, { status: 400 })
    }

    // Verify project ownership
    const project = await prisma.doyalistProject.findFirst({
      where: { id: projectId, userId: session.user.id },
    })

    if (!project) {
      return NextResponse.json({ error: 'プロジェクトが見つからないか、アクセス権限がありません' }, { status: 404 })
    }

    // プラン上限チェック
    const { getUserDoyalistLimits, countMonthlyApproaches } = await import('@/lib/doyalist/limits')
    const limits = await getUserDoyalistLimits(session.user.id)
    if (limits.maxApproachesPerMonth > 0) {
      const used = await countMonthlyApproaches(session.user.id)
      const remaining = limits.maxApproachesPerMonth - used
      if (remaining <= 0) {
        return NextResponse.json(
          { error: `今月のアプローチ生成上限（${limits.maxApproachesPerMonth}件）に達しました。プランをアップグレードしてください。` },
          { status: 403 }
        )
      }
    }

    // Fetch all companies in the project
    const companies = await prisma.doyalistCompany.findMany({
      where: { projectId },
    })

    if (companies.length === 0) {
      return NextResponse.json({ error: 'プロジェクトに企業が登録されていません' }, { status: 400 })
    }

    const serviceDesc = (project as any).myServiceDesc || ''
    const strengths = (project as any).myStrengths || ''

    let generated = 0

    // Process in batches
    for (let i = 0; i < companies.length; i += BATCH_SIZE) {
      const batch = companies.slice(i, i + BATCH_SIZE)

      const batchPromises = batch.map(async (company) => {
        const companyData = company as any
        const companyInfo = {
          industry: companyData.industry || undefined,
          needsAnalysis: companyData.needsAnalysis || undefined,
          approachAdvice: companyData.approachAdvice || undefined,
        }

        const prompt = buildApproachPrompt(
          company.name,
          companyInfo,
          serviceDesc,
          type,
          tone || 'formal'
        )

        const result = await generateApproachText(prompt)
        if (!result) return null

        // Save as DoyalistApproach record
        await prisma.doyalistApproach.create({
          data: {
            companyId: company.id,
            projectId,
            type,
            tone: tone || 'formal',
            subject: result.subject || '',
            body: result.body,
          },
        })

        return true
      })

      const results = await Promise.all(batchPromises)
      generated += results.filter(Boolean).length

      // Add delay between batches to avoid rate limits
      if (i + BATCH_SIZE < companies.length) {
        await delay(BATCH_DELAY_MS)
      }
    }

    return NextResponse.json({ success: true, generated })
  } catch (error) {
    console.error('Bulk approach generation error:', error)
    return NextResponse.json({ error: 'アプローチ文面の一括生成に失敗しました' }, { status: 500 })
  }
}
