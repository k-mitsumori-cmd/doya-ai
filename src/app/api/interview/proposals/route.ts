import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateProposals } from '@/lib/interview/prompts'

// 企画提案生成
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, intervieweeName, intervieweeRole, intervieweeCompany, theme, purpose, targetAudience, tone, mediaType } = body

    // AIで企画案を生成
    const proposals = await generateProposals({
      intervieweeName,
      intervieweeRole,
      intervieweeCompany,
      theme,
      purpose,
      targetAudience,
      tone,
      mediaType,
    })

    return NextResponse.json({ proposals })
  } catch (error) {
    console.error('[INTERVIEW] Proposal generation error:', error)
    return NextResponse.json({ error: 'Failed to generate proposals' }, { status: 500 })
  }
}


