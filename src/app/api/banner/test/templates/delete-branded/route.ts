import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ブランド名が含まれている可能性のあるテンプレートIDリスト
// 参考画像ベースで生成されたもの（著作権リスクあり）
const BRANDED_TEMPLATE_IDS = [
  // 参考画像ベースの19種類
  'reference-shrine-gourmet-001',
  'reference-winter-fashion-001',
  'reference-hiphop-event-001',
  'reference-themepark-anniversary-001',
  'reference-gift-guide-001',
  'reference-comedy-show-001',
  'reference-drama-campaign-001',
  'reference-book-summary-001',
  'reference-premium-beer-001',
  'reference-sports-drink-001',
  'reference-whisky-product-001',
  'reference-hr-interview-001',
  'reference-spring-fashion-001',
  'reference-cafe-seasonal-001', // 旧: reference-starbucks-seasonal-001
  'reference-starbucks-seasonal-001',
  'reference-realestate-home-001',
  'reference-ec-sale-001',
  'reference-newyear-campaign-001',
  'reference-mobile-family-001',
  'reference-software-dev-001',
]

export async function DELETE(request: Request) {
  try {
    // リクエストボディからIDリストを取得（指定がなければデフォルトリストを使用）
    let targetIds = BRANDED_TEMPLATE_IDS
    try {
      const body = await request.json()
      if (body.templateIds && Array.isArray(body.templateIds) && body.templateIds.length > 0) {
        targetIds = body.templateIds
      }
    } catch {
      // bodyが空の場合はデフォルトリストを使用
    }

    // 削除対象のテンプレートを検索
    const templatesToDelete = await prisma.bannerTemplate.findMany({
      where: {
        templateId: {
          in: targetIds
        }
      },
      select: {
        id: true,
        templateId: true,
        industry: true,
      }
    })

    if (templatesToDelete.length === 0) {
      return NextResponse.json({
        message: '削除対象のテンプレートは見つかりませんでした',
        deleted: 0,
        templates: []
      })
    }

    // 削除実行
    const result = await prisma.bannerTemplate.deleteMany({
      where: {
        templateId: {
          in: targetIds
        }
      }
    })

    return NextResponse.json({
      message: `${result.count}件のテンプレートを削除しました`,
      deleted: result.count,
      templates: templatesToDelete
    })
  } catch (error) {
    console.error('[DELETE /api/banner/test/templates/delete-branded] Error:', error)
    return NextResponse.json(
      { error: 'テンプレートの削除に失敗しました', details: String(error) },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // 削除対象のテンプレートを検索（プレビュー用）
    const templatesToDelete = await prisma.bannerTemplate.findMany({
      where: {
        templateId: {
          in: BRANDED_TEMPLATE_IDS
        }
      },
      select: {
        id: true,
        templateId: true,
        industry: true,
        category: true,
      }
    })

    return NextResponse.json({
      message: '削除対象のテンプレート一覧',
      count: templatesToDelete.length,
      templates: templatesToDelete,
      targetIds: BRANDED_TEMPLATE_IDS
    })
  } catch (error) {
    console.error('[GET /api/banner/test/templates/delete-branded] Error:', error)
    return NextResponse.json(
      { error: '確認に失敗しました', details: String(error) },
      { status: 500 }
    )
  }
}
