export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'

type ToolType = 'form' | 'email' | 'phone'

interface Input {
  type: ToolType
  serviceInput?: string      // 自社サービス内容またはURL（フロントの実フィールド）
  targetIndustry?: string    // 相手業種（フロントの実フィールド）
  myService?: string         // 互換用
  industry?: string          // 互換用
  companyName?: string
  contactPerson?: string
  myCompany?: string
  benefit?: string
  tone?: 'formal' | 'casual' | 'friendly'
}

function buildPrompt(input: Input): string {
  const type = input.type
  const companyName = input.companyName || '【貴社名】'
  const industry = input.targetIndustry || input.industry || ''
  const contactPerson = input.contactPerson || '【ご担当者名】'
  const myService = input.serviceInput || input.myService || '【自社サービスの説明を入力してください】'
  const myCompany = input.myCompany || '【自社名】'
  const benefit = input.benefit || ''
  const tone = input.tone || 'formal'

  const toneLabel = tone === 'casual' ? 'カジュアル' : tone === 'friendly' ? '親しみやすい' : '丁寧でフォーマル'

  // 自社サービスがURLっぽい場合は補足
  const isUrl = /^https?:\/\//.test(myService.trim())
  const serviceDesc = isUrl
    ? `URL: ${myService}（このサービスサイトの内容を推定して、サービスの強み・特徴を文章内に反映してください）`
    : myService

  const placeholderNote = '【プレースホルダ】企業名は「【貴社名】」、自社名は「【自社名】」、担当者は「【ご担当者名】」「【自分の名前】」のように明確に置き換え可能な形で挿入してください。'

  if (type === 'form') {
    return [
      `以下の条件で、企業のお問い合わせフォーム送信用の営業文を作成してください。`,
      ``,
      `■ 相手企業（${industry || '指定なし'}業界）: ${companyName}`,
      `■ 担当者: ${contactPerson}`,
      `■ 自社名: ${myCompany}`,
      `■ 自社サービス: ${serviceDesc}`,
      benefit ? `■ 訴求ポイント: ${benefit}` : '',
      `■ トーン: ${toneLabel}`,
      ``,
      `要件:`,
      `- 400〜600字程度`,
      `- 件名は不要、本文のみ`,
      `- ${placeholderNote}`,
      `- 自社サービスの特徴・価値を必ず本文に反映する（一般論で終わらせない）`,
      `- 相手企業（${industry}業界）にとっての具体的な利点に触れる`,
      `- 一方的な売り込みは避け、相手の状況を尊重する`,
      `- 最後に「次のアクション」を提案（例: 15分の打ち合わせ）`,
      `- 装飾記号や絵文字は使わない`,
      ``,
      `出力は本文テキストのみ。説明や前置きは不要。`,
    ].filter(Boolean).join('\n')
  }

  if (type === 'email') {
    return [
      `以下の条件で、新規開拓メールを作成してください。`,
      ``,
      `■ 相手企業（${industry || '指定なし'}業界）: ${companyName}`,
      `■ 担当者: ${contactPerson}`,
      `■ 自社名: ${myCompany}`,
      `■ 自社サービス: ${serviceDesc}`,
      benefit ? `■ 訴求ポイント: ${benefit}` : '',
      `■ トーン: ${toneLabel}`,
      ``,
      `要件:`,
      `- 件名（30字以内）と本文（300〜500字）を作成`,
      `- ${placeholderNote}`,
      `- 件名は開封率の高い表現にする`,
      `- 本文は導入→価値提案→次のアクションの3パート`,
      `- 自社サービスの特徴・価値を必ず反映する（一般論で終わらせない）`,
      `- 相手企業（${industry}業界）にとっての具体的な利点に触れる`,
      `- 装飾記号や絵文字は使わない`,
      ``,
      `出力形式:`,
      `件名: 〜〜`,
      ``,
      `本文:`,
      `（本文）`,
    ].filter(Boolean).join('\n')
  }

  // phone
  return [
    `以下の条件で、新規開拓の電話スクリプト（荷電スクリプト）を作成してください。`,
    ``,
    `■ 相手企業（${industry || '指定なし'}業界）: ${companyName}`,
    `■ 担当者: ${contactPerson}`,
    `■ 自社名: ${myCompany}`,
    `■ 自社サービス: ${serviceDesc}`,
    benefit ? `■ 訴求ポイント: ${benefit}` : '',
    `■ トーン: ${toneLabel}`,
    ``,
    `要件:`,
    `- 受付突破→担当者接続→自己紹介→価値提案→アポ獲得の流れ`,
    `- ${placeholderNote}`,
    `- セリフはすべて「自分:」「相手:」形式で書く`,
    `- 自社サービスの特徴・価値を具体的に伝える（一般論を避ける）`,
    `- 3〜5回のやりとりを想定`,
    `- 想定される断り文句と切り返しトークも追記`,
    ``,
    `出力形式:`,
    `【トークスクリプト】`,
    `自分: 〜〜`,
    `相手: 〜〜`,
    `自分: 〜〜`,
    `...`,
    ``,
    `【切り返しトーク】`,
    `- 断り例1: 〜 → 切り返し: 〜`,
    `- 断り例2: 〜 → 切り返し: 〜`,
  ].filter(Boolean).join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as Input | null
    if (!body || !['form', 'email', 'phone'].includes(body.type)) {
      return NextResponse.json({ error: 'typeは form/email/phone のいずれかを指定してください' }, { status: 400 })
    }

    const prompt = buildPrompt(body)

    const text = await geminiGenerateText({
      model: GEMINI_TEXT_MODEL_DEFAULT,
      parts: [{ text: prompt }],
    })

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'AI生成に失敗しました' }, { status: 502 })
    }

    return NextResponse.json({ success: true, text: text.trim() })
  } catch (e: any) {
    console.error('[doyalist/tools]', e)
    return NextResponse.json({ error: e?.message || 'ツール実行に失敗しました' }, { status: 500 })
  }
}
