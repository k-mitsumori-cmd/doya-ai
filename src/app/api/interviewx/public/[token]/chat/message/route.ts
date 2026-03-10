// ============================================
// POST /api/interviewx/public/[token]/chat/message
// ============================================
// チャットメッセージ送信 — ユーザー回答保存 + AI応答生成
// 認証不要（トークンベース）

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildChatInterviewerSystemPrompt } from '@/lib/interviewx/prompts'
import { callGeminiJson, parseAIResponse, buildGeminiContents, extractQAPairsFromChat } from '@/lib/interviewx/chat-utils'

type RouteParams = { params: Promise<{ token: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params
    const body = await req.json()
    const { responseId, content } = body

    if (!responseId || !content?.trim()) {
      return NextResponse.json({ success: false, error: 'メッセージを入力してください' }, { status: 400 })
    }

    // プロジェクト + レスポンス取得
    const project = await prisma.interviewXProject.findUnique({
      where: { shareToken: token },
      include: {
        questions: { orderBy: { order: 'asc' } },
      },
    })

    if (!project) {
      return NextResponse.json({ success: false, error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    const response = await prisma.interviewXResponse.findUnique({
      where: { id: responseId },
      include: {
        chatMessages: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!response || response.projectId !== project.id) {
      return NextResponse.json({ success: false, error: 'セッションが見つかりません' }, { status: 404 })
    }

    if (response.status === 'COMPLETED') {
      return NextResponse.json({ success: false, error: 'インタビューは既に完了しています' }, { status: 410 })
    }

    // 最新のAIメッセージからtopicIndexを取得
    const lastAiMessage = [...response.chatMessages].reverse().find(m => m.role === 'interviewer')
    const currentTopicIndex = lastAiMessage?.topicIndex ?? 0

    // ユーザーメッセージ保存
    await prisma.interviewXChatMessage.create({
      data: {
        responseId,
        role: 'respondent',
        content: content.trim(),
        topicIndex: currentTopicIndex,
        messageType: 'answer',
      },
    })

    // カバー済みトピック数を計算
    const coveredTopics = new Set(
      response.chatMessages
        .filter(m => m.role === 'respondent')
        .map(m => m.topicIndex)
        .filter((i): i is number => i != null)
    )
    coveredTopics.add(currentTopicIndex)

    // システムプロンプト構築
    const systemPrompt = buildChatInterviewerSystemPrompt({
      projectTitle: project.title,
      companyName: project.companyName,
      purpose: project.purpose,
      targetAudience: project.targetAudience,
      tone: project.tone as any,
      articleType: project.articleType as any,
      customInstructions: project.customInstructions,
      respondentName: response.respondentName,
      questions: project.questions.map(q => ({
        text: q.text,
        order: q.order,
        description: q.description,
      })),
    })

    // 進捗情報をプロンプトに追加
    const progressHint = `\n\n[進捗: ${coveredTopics.size}/${project.questions.length}トピック完了。${
      coveredTopics.size >= project.questions.length
        ? 'すべてのトピックをカバーしました。インタビューを締めくくってください。'
        : `残り${project.questions.length - coveredTopics.size}トピックです。`
    }]`

    // Gemini呼び出し
    const contents = buildGeminiContents(
      systemPrompt + progressHint,
      response.chatMessages.map(m => ({ role: m.role, content: m.content })),
      content.trim(),
    )

    const rawResponse = await callGeminiJson(contents)
    const aiResponse = parseAIResponse(rawResponse)

    // AIメッセージ保存
    const aiMessage = await prisma.interviewXChatMessage.create({
      data: {
        responseId,
        role: 'interviewer',
        content: aiResponse.reply,
        topicIndex: aiResponse.topicIndex,
        messageType: aiResponse.messageType,
      },
    })

    // トピックカバー状況更新
    coveredTopics.add(aiResponse.topicIndex)

    // インタビュー完了処理
    if (aiResponse.shouldEndInterview) {
      // 全チャットメッセージ再取得
      const allMessages = await prisma.interviewXChatMessage.findMany({
        where: { responseId },
        orderBy: { createdAt: 'asc' },
      })

      // Q&Aペア抽出
      const qaPairs = extractQAPairsFromChat(
        allMessages.map(m => ({ role: m.role, content: m.content, topicIndex: m.topicIndex })),
        project.questions.map(q => ({ id: q.id, text: q.text, order: q.order })),
      )

      // InterviewXAnswer保存
      if (qaPairs.length > 0) {
        await prisma.interviewXAnswer.createMany({
          data: qaPairs.map(qa => ({
            responseId,
            questionId: qa.questionId,
            answerText: qa.answerText,
          })),
        })
      }

      // Response完了
      await prisma.interviewXResponse.update({
        where: { id: responseId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })

      // Project status更新
      await prisma.interviewXProject.update({
        where: { id: project.id },
        data: {
          status: 'ANSWERED',
          respondentName: response.respondentName,
          respondentEmail: response.respondentEmail,
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: {
        id: aiMessage.id,
        role: 'interviewer',
        content: aiResponse.reply,
        topicIndex: aiResponse.topicIndex,
      },
      topicsTotal: project.questions.length,
      topicsCovered: coveredTopics.size,
      isComplete: aiResponse.shouldEndInterview,
    })
  } catch (e: any) {
    console.error('[interviewx-chat] message error:', e?.message)
    return NextResponse.json(
      { success: false, error: e?.message || 'メッセージの送信に失敗しました' },
      { status: 500 }
    )
  }
}
