// ============================================
// ドヤサイト ダウンロードAPI
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import archiver from 'archiver'
import { Readable } from 'stream'

function createZipArchive(): Promise<{ archive: archiver.Archiver; buffer: Promise<Buffer> }> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } })
    const chunks: Buffer[] = []

    archive.on('data', (chunk: Buffer) => chunks.push(chunk))
    archive.on('error', reject)
    archive.on('end', () => {})

    const bufferPromise = new Promise<Buffer>((resolveBuffer) => {
      archive.on('end', () => {
        resolveBuffer(Buffer.concat(chunks))
      })
    })

    resolve({ archive, buffer: bufferPromise })
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      download_type, // 'single' | 'section' | 'all_pc' | 'all_sp'
      section_id,
      image_data, // base64
      all_data, // 全データ
    } = body

    if (download_type === 'single' && image_data) {
      // 単一画像ダウンロード
      const base64Data = image_data.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      const mimeType = image_data.match(/data:image\/(\w+);base64/)?.[1] || 'png'
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': `image/${mimeType}`,
          'Content-Disposition': `attachment; filename="lp-image-${section_id || 'image'}.${mimeType}"`,
        },
      })
    }

    if (download_type === 'section' && all_data) {
      // セクション単位ZIP
      const { archive, buffer } = await createZipArchive()

      const section = all_data.sections?.find((s: any) => s.section_id === section_id)
      if (section) {
        const image = all_data.images?.find((img: any) => img.section_id === section_id)
        if (image?.image_pc) {
          const base64 = image.image_pc.replace(/^data:image\/\w+;base64,/, '')
          archive.append(Buffer.from(base64, 'base64'), { name: `pc/${section_id}.png` })
        }
        if (image?.image_sp) {
          const base64 = image.image_sp.replace(/^data:image\/\w+;base64,/, '')
          archive.append(Buffer.from(base64, 'base64'), { name: `sp/${section_id}.png` })
        }
      }

      await archive.finalize()
      const zipBuffer = await buffer

      return new NextResponse(zipBuffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="lp-section-${section_id}.zip"`,
        },
      })
    }

    if ((download_type === 'all_pc' || download_type === 'all_sp') && all_data) {
      // 全体ZIP（PC/SP別）
      const { archive, buffer } = await createZipArchive()

      const device = download_type === 'all_pc' ? 'pc' : 'sp'
      const imageKey = download_type === 'all_pc' ? 'image_pc' : 'image_sp'

      // 構造JSON
      archive.append(JSON.stringify(all_data, null, 2), { name: 'structure.json' })

      // 画像
      if (all_data.images) {
        for (const image of all_data.images) {
          const imageData = image[imageKey]
          if (imageData) {
            const base64 = imageData.replace(/^data:image\/\w+;base64,/, '')
            archive.append(Buffer.from(base64, 'base64'), {
              name: `${device}/${image.section_id}.png`,
            })
          }
        }
      }

      await archive.finalize()
      const zipBuffer = await buffer

      return new NextResponse(zipBuffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="lp-${device}-all.zip"`,
        },
      })
    }

    return NextResponse.json(
      { error: '無効なダウンロードタイプです' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('[LP-SITE] Download error:', error)
    return NextResponse.json(
      {
        error: 'ダウンロードに失敗しました',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

