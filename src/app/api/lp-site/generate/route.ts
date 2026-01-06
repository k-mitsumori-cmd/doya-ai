// ============================================
// ドヤサイト LP生成API
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateLp } from '@/lib/lp-site/pipeline'
import { LpGenerationRequest } from '@/lib/lp-site/types'
import { prisma } from '@/lib/prisma'
import { getServiceById } from '@/lib/services'

export const maxDuration = 300 // 5分

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const isGuest = !session

    // リクエストボディを取得
    const body = await request.json()
    const {
      input_type,
      url,
      form_data,
      lp_type,
      tone,
    } = body as LpGenerationRequest

    // バリデーション
    if (input_type !== 'url' && input_type !== 'form') {
      return NextResponse.json(
        { error: 'input_typeは"url"または"form"である必要があります' },
        { status: 400 }
      )
    }

    if (input_type === 'url' && !url) {
      return NextResponse.json(
        { error: 'URLが指定されていません' },
        { status: 400 }
      )
    }

    if (input_type === 'form' && !form_data?.product_name) {
      return NextResponse.json(
        { error: '商品名が指定されていません' },
        { status: 400 }
      )
    }

    if (!lp_type || !tone) {
      return NextResponse.json(
        { error: 'lp_typeとtoneは必須です' },
        { status: 400 }
      )
    }

    // 使用量チェック（簡易版）
    const service = getServiceById('lp-site')
    if (service) {
      // TODO: 使用量チェック実装
    }

    // LP生成実行
    const result = await generateLp({
      input_type,
      url,
      form_data,
      lp_type,
      tone,
    })

    // 生成履歴を保存（オプション）
    if (session?.user) {
      try {
        await prisma.generation.create({
          data: {
            userId: session.user.id,
            serviceId: 'lp-site',
            input: body,
            output: JSON.stringify(result),
            outputType: 'JSON',
            metadata: {
              lp_type,
              tone,
              section_count: result.sections.length,
            },
          },
        })
      } catch (error) {
        console.error('生成履歴保存エラー:', error)
        // エラーでも処理は続行
      }
    }

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error: any) {
    console.error('[LP-SITE] Generation error:', error)
    return NextResponse.json(
      {
        error: 'LP生成に失敗しました',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

