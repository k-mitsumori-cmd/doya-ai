import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// プロジェクト一覧取得
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projects = await prisma.interviewProject.findMany({
      where: {
        OR: [{ userId: userId || undefined }, { guestId: guestId || undefined }],
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('[INTERVIEW] Projects fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

// プロジェクト作成
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    // ゲストIDがなければ生成（ログインしていない場合）
    let finalGuestId = guestId
    if (!userId && !guestId) {
      // ゲストユーザーとして処理（一時的なIDを生成）
      finalGuestId = `guest-${Date.now()}-${Math.random().toString(36).substring(7)}`
    }

    const body = await request.json()
    const { title, intervieweeName, intervieweeRole, intervieweeCompany, theme, purpose, targetAudience, tone, mediaType, status } = body

    // タイトルの検証
    const projectTitle = title || '無題のプロジェクト'
    if (projectTitle.length > 200) {
      return NextResponse.json(
        {
          error: 'プロジェクト名が長すぎます',
          details: 'プロジェクト名は200文字以内で入力してください。',
        },
        { status: 400 }
      )
    }

    const project = await prisma.interviewProject.create({
      data: {
        userId: userId || undefined,
        guestId: finalGuestId || undefined,
        title: projectTitle,
        intervieweeName,
        intervieweeRole,
        intervieweeCompany,
        theme,
        purpose,
        targetAudience,
        tone: tone || 'friendly',
        mediaType: mediaType || 'blog',
        status: status || 'DRAFT',
      },
    })

    return NextResponse.json({ project })
  } catch (error) {
    console.error('[INTERVIEW] Project creation error:', error)
    const errorMessage = error instanceof Error ? error.message : '不明なエラー'
    
    // Prismaエラーの詳細を取得
    let details = 'データベースへの保存に失敗しました。'
    if (errorMessage.includes('Unique constraint')) {
      details = '同じプロジェクト名が既に存在します。別の名前を試してください。'
    } else if (errorMessage.includes('Foreign key constraint')) {
      details = '関連データの参照に失敗しました。'
    } else if (errorMessage.includes('Invalid value')) {
      details = '無効な値が入力されています。入力内容を確認してください。'
    }

    return NextResponse.json(
      {
        error: 'プロジェクトの作成に失敗しました',
        details: `${details} エラー詳細: ${errorMessage}`,
      },
      { status: 500 }
    )
  }
}

