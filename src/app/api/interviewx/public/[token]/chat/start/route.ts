// ============================================
// POST /api/interviewx/public/[token]/chat/start
// ============================================
// チャットインタビュー開始 — Response作成 + AI挨拶生成
// 認証不要（トークンベース）

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildChatGreetingPrompt, buildChatInterviewerSystemPrompt } from '@/lib/interviewx/prompts'
import { callGeminiJson, parseAIResponse } from '@/lib/interviewx/chat-utils'

type RouteParams = { params: Promise<{ token: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params
    const body = await req.json()
    const { respondentName, respondentEmail, respondentRole, respondentCompany } = body

    if (!respondentName?.trim()) {
      return NextResponse.json({ success: false, error: 'お名前を入力してください' }, { status: 400 })
    }

    // プロジェクト取得
    const project = await prisma.interviewXProject.findUnique({
      where: { shareToken: token },
      include: {
        questions: { orderBy: { order: 'asc' } },
      },
    })

    if (!project) {
      return NextResponse.json({ success: false, error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    if (project.interviewMode !== 'chat') {
      return NextResponse.json({ success: false, error: 'このプロジェクトはチャットモードではありません' }, { status: 400 })
    }

    if (!['SHARED', 'RESPONDING'].includes(project.status)) {
      return NextResponse.json({ success: false, error: 'このインタビューは現在利用できません' }, { status: 410 })
    }

    if (project.questions.length === 0) {
      return NextResponse.json({ success: false, error: '質問が設定されていません' }, { status: 400 })
    }

    // 既存の進行中レスポンスがあればそれを返す
    const existingResponse = await prisma.interviewXResponse.findFirst({
      where: { projectId: project.id, status: 'IN_PROGRESS' },
      include: {
        chatMessages: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (existingResponse && existingResponse.chatMessages.length > 0) {
      return NextResponse.json({
        success: true,
        responseId: existingResponse.id,
        message: {
          id: existingResponse.chatMessages[0].id,
          role: 'interviewer',
          content: existingResponse.chatMessages[0].content,
          topicIndex: existingResponse.chatMessages[0].topicIndex ?? 0,
        },
        topicsTotal: project.questions.length,
        topicsCovered: 0,
        resumed: true,
      })
    }

    // IP/UA取得
    const forwarded = req.headers.get('x-forwarded-for')
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : null
    const userAgent = req.headers.get('user-agent')

    // InterviewXResponse作成
    const response = await prisma.interviewXResponse.create({
      data: {
        projectId: project.id,
        respondentName: respondentName.trim(),
        respondentEmail: respondentEmail?.trim() || null,
        respondentRole: respondentRole?.trim() || null,
        respondentCompany: respondentCompany?.trim() || null,
        status: 'IN_PROGRESS',
        ipAddress,
        userAgent,
      },
    })

    // プロジェクトstatus更新
    if (project.status === 'SHARED') {
      await prisma.interviewXProject.update({
        where: { id: project.id },
        data: { status: 'RESPONDING' },
      })
    }

    // AI挨拶生成
    const greetingPrompt = buildChatGreetingPrompt({
      respondentName: respondentName.trim(),
      projectTitle: project.title,
      companyName: project.companyName,
      tone: project.tone as any,
      firstQuestion: project.questions[0].text,
    })

    const rawResponse = await callGeminiJson([
      { role: 'user', parts: [{ text: greetingPrompt }] },
    ])

    const aiResponse = parseAIResponse(rawResponse)

    // ChatMessage保存
    const chatMessage = await prisma.interviewXChatMessage.create({
      data: {
        responseId: response.id,
        role: 'interviewer',
        content: aiResponse.reply,
        topicIndex: 0,
        messageType: 'greeting',
      },
    })

    return NextResponse.json({
      success: true,
      responseId: response.id,
      message: {
        id: chatMessage.id,
        role: 'interviewer',
        content: aiResponse.reply,
        topicIndex: 0,
      },
      topicsTotal: project.questions.length,
      topicsCovered: 0,
      resumed: false,
    })
  } catch (e: any) {
    console.error('[interviewx-chat] start error:', e?.message)
    return NextResponse.json(
      { success: false, error: e?.message || 'チャット開始に失敗しました' },
      { status: 500 }
    )
  }
}
