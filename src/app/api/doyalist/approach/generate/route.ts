export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import {
  getUserDoyalistLimits,
  countMonthlyApproaches,
} from '@/lib/doyalist/limits'

type ApproachType = 'email' | 'dm' | 'phone' | 'letter'

interface GeneratedApproach {
  subject?: string
  body: string
}

const TYPE_LABEL: Record<ApproachType, string> = {
  email: 'メール',
  dm: 'SNS DM（短文・カジュアル）',
  phone: '電話スクリプト',
  letter: '手紙（フォーマル）',
}

function buildPrompt(
  type: ApproachType,
  company: any,
  project: any,
  tone?: string
): string {
  const base = [
    `あなたはBtoB営業のプロフェッショナルです。`,
    `以下の企業に対するアプローチ文面（${TYPE_LABEL[type]}）を作成してください。`,
    '',
    `【ターゲット企業】`,
    `- 企業名: ${company.name}`,
    `- 業種: ${company.industry || '不明'}`,
    `- 所在地: ${company.region || '不明'}`,
    `- 規模: ${company.size || '不明'}`,
    company.description ? `- 事業概要: ${company.description}` : '',
    '',
    `【自社プロジェクト】`,
    `- プロジェクト名: ${project.name}`,
    project.description ? `- 概要: ${project.description}` : '',
    project.keywords ? `- キーワード: ${project.keywords}` : '',
    tone ? `\n【トーン】${tone}` : '',
    '',
  ]
    .filter(Boolean)
    .join('\n')

  let format = ''
  switch (type) {
    case 'email':
      format = [
        '【出力フォーマット】',
        'JSON形式で以下のフィールドを出力してください:',
        '- subject: 件名（30字以内、開封率を意識した訴求）',
        '- body: 本文（300〜500字、丁寧語、署名は不要）',
      ].join('\n')
      break
    case 'dm':
      format = [
        '【出力フォーマット】',
        'JSON形式で以下のフィールドを出力してください:',
        '- subject: 空文字列（DMには件名なし）',
        '- body: DM本文（200字以内、カジュアル＆短文、絵文字使用可）',
      ].join('\n')
      break
    case 'phone':
      format = [
        '【出力フォーマット】',
        'JSON形式で以下のフィールドを出力してください:',
        '- subject: 想定される会話の目的（30字以内）',
        '- body: 電話スクリプト（受付突破→担当者へ→提案 の流れで、',
        '  「自分: 」「相手: 」のような会話形式で400〜600字）',
      ].join('\n')
      break
    case 'letter':
      format = [
        '【出力フォーマット】',
        'JSON形式で以下のフィールドを出力してください:',
        '- subject: 件名（手紙の表題、20字以内）',
        '- body: 手紙本文（拝啓〜敬具まで、フォーマルに500〜800字）',
      ].join('\n')
      break
  }

  return `${base}\n${format}\n\n注意: JSON1オブジェクトのみ出力。markdownや余計な文字を含めないこと。`
}

/**
 * POST /api/doyalist/approach/generate
 * Body: { companyId, type, tone? }
 * 企業情報＋プロジェクト情報を元にAIでアプローチ文面を生成し、DoyalistApproachを保存
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { companyId, type, tone } = body || {}

    if (!companyId || typeof companyId !== 'string') {
      return NextResponse.json({ error: 'companyIdは必須です' }, { status: 400 })
    }
    const validTypes: ApproachType[] = ['email', 'dm', 'phone', 'letter']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `typeは${validTypes.join(', ')}のいずれかを指定してください` },
        { status: 400 }
      )
    }

    // 所有権確認
    const company = await prisma.doyalistCompany.findUnique({
      where: { id: companyId },
      include: { project: true },
    })
    if (!company) {
      return NextResponse.json({ error: '企業が見つかりません' }, { status: 404 })
    }
    if (company.project.userId !== userId) {
      return NextResponse.json({ error: 'アクセス権がありません' }, { status: 403 })
    }

    // プラン上限チェック
    const limits = await getUserDoyalistLimits(userId)
    if (limits.maxApproachesPerMonth === 0) {
      return NextResponse.json(
        { error: '現在のプランではアプローチ生成を利用できません' },
        { status: 403 }
      )
    }
    if (limits.maxApproachesPerMonth > 0) {
      const used = await countMonthlyApproaches(userId)
      if (used >= limits.maxApproachesPerMonth) {
        return NextResponse.json(
          { error: `月間上限（${limits.maxApproachesPerMonth}件）に達しました` },
          { status: 403 }
        )
      }
    }

    const prompt = buildPrompt(type, company, company.project, tone)

    let generated: GeneratedApproach
    try {
      generated = await geminiGenerateJson<GeneratedApproach>({
        prompt,
        model: GEMINI_TEXT_MODEL_DEFAULT,
      })
    } catch (e: any) {
      console.error('[doyalist/approach/generate] gemini error', e)
      return NextResponse.json(
        { error: 'AIによる文面生成に失敗しました。しばらく経ってから再試行してください' },
        { status: 502 }
      )
    }

    const text = String(generated?.body || '').trim()
    if (!text) {
      return NextResponse.json(
        { error: 'AIから空のレスポンスが返されました' },
        { status: 502 }
      )
    }

    const approach = await prisma.doyalistApproach.create({
      data: {
        projectId: company.projectId,
        companyId: company.id,
        type,
        subject: generated.subject ? String(generated.subject).slice(0, 200) : null,
        body: text,
        status: 'draft',
      },
    })

    return NextResponse.json({ success: true, approach })
  } catch (e: any) {
    console.error('[doyalist/approach/generate][POST]', e)
    return NextResponse.json(
      { error: e?.message || 'アプローチ生成に失敗しました' },
      { status: 500 }
    )
  }
}
