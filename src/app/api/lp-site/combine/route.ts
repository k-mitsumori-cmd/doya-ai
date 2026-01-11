// ============================================
// ドヤサイト LP全体画像結合API
// 全セクション画像を縦につなげてLP全体画像を生成
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      images, // [{ section_id, image_pc?, image_sp? }]
      device, // 'pc' | 'sp'
    } = body

    if (!images || !Array.isArray(images)) {
      return NextResponse.json(
        { error: '画像データが必要です' },
        { status: 400 }
      )
    }

    const imageKey = device === 'pc' ? 'image_pc' : 'image_sp'
    const validImages = images.filter((img: any) => img[imageKey])

    if (validImages.length === 0) {
      return NextResponse.json(
        { error: '有効な画像がありません' },
        { status: 400 }
      )
    }

    // 各画像を読み込んで情報を取得
    const imageBuffers: Buffer[] = []
    let totalHeight = 0
    let maxWidth = 0

    for (const imageData of validImages) {
      const base64 = imageData[imageKey].replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64, 'base64')
      
      const metadata = await sharp(buffer).metadata()
      if (metadata.width && metadata.height) {
        imageBuffers.push(buffer)
        totalHeight += metadata.height
        maxWidth = Math.max(maxWidth, metadata.width)
      }
    }

    if (imageBuffers.length === 0) {
      return NextResponse.json(
        { error: '画像の読み込みに失敗しました' },
        { status: 500 }
      )
    }

    // 全画像を縦につなげる
    const combined = sharp({
      create: {
        width: maxWidth,
        height: totalHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })

    // 各画像を順番に配置
    const composite = []
    let currentY = 0

    for (const buffer of imageBuffers) {
      const metadata = await sharp(buffer).metadata()
      if (metadata.width && metadata.height) {
        composite.push({
          input: buffer,
          top: currentY,
          left: 0,
        })
        currentY += metadata.height
      }
    }

    const combinedImage = await combined
      .composite(composite)
      .png()
      .toBuffer()

    // Base64に変換
    const base64Image = `data:image/png;base64,${combinedImage.toString('base64')}`

    return NextResponse.json({
      success: true,
      combined_image: base64Image,
      width: maxWidth,
      height: totalHeight,
      section_count: imageBuffers.length,
    })
  } catch (error: any) {
    console.error('[LP-SITE] Combine error:', error)
    return NextResponse.json(
      {
        error: '画像結合に失敗しました',
        details: error.message,
      },
      { status: 500 }
    )
  }
}




