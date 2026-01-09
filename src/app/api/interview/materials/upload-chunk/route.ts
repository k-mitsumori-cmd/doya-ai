import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir, appendFile, readFile, unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { put } from '@vercel/blob'

// Vercel等のサーバーレス環境では /tmp を使用
function getUploadBaseDir() {
  const envDir = process.env.INTERVIEW_STORAGE_DIR || process.env.NEXT_PUBLIC_INTERVIEW_STORAGE_DIR
  if (envDir) return envDir

  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return '/tmp/interview'
  }

  return join(process.cwd(), 'uploads', 'interview')
}

// ファイルサイズをフォーマット
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

// チャンクアップロード（大きなファイル用）
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const projectId = formData.get('projectId') as string
    const chunk = formData.get('chunk') as File | null
    const chunkIndexStr = formData.get('chunkIndex') as string
    const totalChunksStr = formData.get('totalChunks') as string
    const fileName = formData.get('fileName') as string
    const fileSizeStr = formData.get('fileSize') as string
    const mimeType = formData.get('mimeType') as string
    const tempFileName = formData.get('tempFileName') as string

    // パラメータの検証とデバッグ情報
    const missingParams: string[] = []
    if (!projectId) missingParams.push('projectId')
    if (!chunk) missingParams.push('chunk')
    if (!chunkIndexStr || isNaN(parseInt(chunkIndexStr))) missingParams.push('chunkIndex')
    if (!totalChunksStr || isNaN(parseInt(totalChunksStr))) missingParams.push('totalChunks')
    if (!fileName) missingParams.push('fileName')
    if (!tempFileName) missingParams.push('tempFileName')

    if (missingParams.length > 0) {
      console.error('[INTERVIEW] Missing parameters:', missingParams)
      console.error('[INTERVIEW] Received parameters:', {
        projectId: projectId || 'missing',
        chunk: chunk ? `File(${chunk.size} bytes)` : 'missing',
        chunkIndex: chunkIndexStr || 'missing',
        totalChunks: totalChunksStr || 'missing',
        fileName: fileName || 'missing',
        tempFileName: tempFileName || 'missing',
        mimeType: mimeType || 'missing',
        fileSize: fileSizeStr || 'missing',
      })
      return NextResponse.json(
        { 
          error: '必須パラメータが不足しています', 
          details: `不足しているパラメータ: ${missingParams.join(', ')}\n必要なパラメータ: projectId, chunk, chunkIndex, totalChunks, fileName, tempFileName` 
        },
        { status: 400 }
      )
    }

    const chunkIndex = parseInt(chunkIndexStr)
    const totalChunks = parseInt(totalChunksStr)
    const fileSize = parseInt(fileSizeStr)

    // チャンクインデックスの範囲チェック
    if (chunkIndex < 0 || chunkIndex >= totalChunks) {
      console.error(`[INTERVIEW] Invalid chunk index: ${chunkIndex}, totalChunks: ${totalChunks}`)
      return NextResponse.json(
        {
          error: '無効なチャンクインデックスです',
          details: `チャンクインデックスが範囲外です。chunkIndex: ${chunkIndex}, totalChunks: ${totalChunks}`,
        },
        { status: 400 }
      )
    }

    // チャンクサイズの検証
    if (!chunk || chunk.size === 0) {
      console.error(`[INTERVIEW] Invalid chunk size: ${chunk?.size || 0}`)
      return NextResponse.json(
        {
          error: '無効なチャンクサイズです',
          details: `チャンクサイズが0または無効です。chunkSize: ${chunk?.size || 0}`,
        },
        { status: 400 }
      )
    }

    // ファイルサイズの検証
    if (isNaN(fileSize) || fileSize <= 0) {
      console.error(`[INTERVIEW] Invalid file size: ${fileSize}`)
      return NextResponse.json(
        {
          error: '無効なファイルサイズです',
          details: `ファイルサイズが無効です。fileSize: ${fileSize}`,
        },
        { status: 400 }
      )
    }

    // tempFileNameの検証
    if (!tempFileName || tempFileName.trim() === '') {
      console.error(`[INTERVIEW] Invalid tempFileName: ${tempFileName}`)
      return NextResponse.json(
        {
          error: '無効なtempFileNameです',
          details: `tempFileNameが空または無効です。tempFileName: ${tempFileName}`,
        },
        { status: 400 }
      )
    }

    // プロジェクトの所有権確認
    let project
    try {
      project = await prisma.interviewProject.findFirst({
        where: {
          id: projectId,
          OR: [{ userId: userId || undefined }, { guestId: guestId || undefined }],
        },
      })
    } catch (dbError) {
      console.error('[INTERVIEW] Database query error:', dbError)
      if (dbError && typeof dbError === 'object' && 'code' in dbError) {
        const prismaError = dbError as { code: string }
        if (prismaError.code === 'P2021') {
          return NextResponse.json(
            {
              error: 'データベースのテーブルが存在しません',
              details: 'データベースのマイグレーションが必要です。管理者にお問い合わせください。',
            },
            { status: 503 }
          )
        }
      }
      throw dbError
    }

    if (!project) {
      return NextResponse.json(
        { error: 'プロジェクトが見つかりません', details: '指定されたプロジェクトIDが存在しないか、アクセス権限がありません。' },
        { status: 404 }
      )
    }

    // チャンクの保存先ディレクトリ
    const baseDir = getUploadBaseDir()
    const chunkDir = join(baseDir, 'chunks', projectId)
    // tempFileNameはクライアント側から送信される（すべてのチャンクで同じ値）
    const chunkFilePath = join(chunkDir, `${tempFileName}.chunk.${chunkIndex}`)

    try {
      // チャンクディレクトリの作成
      if (!existsSync(chunkDir)) {
        await mkdir(chunkDir, { recursive: true })
      }

      // チャンクの重複チェック（既に存在する場合は上書き）
      const chunkExists = existsSync(chunkFilePath)
      if (chunkExists) {
        console.warn(`[INTERVIEW] Chunk ${chunkIndex} already exists, overwriting: ${chunkFilePath}`)
      }

      // チャンクを保存
      let writeSuccess = false
      try {
        const bytes = await chunk.arrayBuffer()
        const buffer = Buffer.from(bytes)
        
        // チャンクサイズの検証（期待されるサイズと実際のサイズを比較）
        const expectedChunkSize = chunkIndex === totalChunks - 1 
          ? fileSize - (chunkIndex * (4 * 1024 * 1024)) // 最後のチャンクは残りのサイズ
          : 4 * 1024 * 1024 // 通常のチャンクは4MB
        
        if (buffer.length > expectedChunkSize * 1.1) { // 10%の許容誤差
          console.warn(`[INTERVIEW] Chunk size mismatch: expected ~${expectedChunkSize}, got ${buffer.length}`)
        }
        
        await writeFile(chunkFilePath, buffer)
        writeSuccess = true
        console.log(`[INTERVIEW] Chunk ${chunkIndex + 1}/${totalChunks} saved: ${chunkFilePath} (size: ${buffer.length} bytes)`)
      } catch (writeError: any) {
        console.error(`[INTERVIEW] Failed to write chunk file: ${chunkFilePath}`, writeError)
        
        // ENOSPCエラーの場合、既存のチャンクファイルをクリーンアップしてから再試行
        if (writeError.code === 'ENOSPC' || writeError.message?.includes('no space left')) {
          console.log(`[INTERVIEW] Disk space full. Cleaning up old chunk files...`)
          try {
            // 古いチャンクファイルを削除（現在のプロジェクト以外）
            const chunksBaseDir = join(baseDir, 'chunks')
            if (existsSync(chunksBaseDir)) {
              const { readdir, rmdir } = await import('fs/promises')
              const projectDirs = await readdir(chunksBaseDir)
              for (const dir of projectDirs) {
                if (dir !== projectId) {
                  try {
                    const oldChunkDir = join(chunksBaseDir, dir)
                    const { rm } = await import('fs/promises')
                    await rm(oldChunkDir, { recursive: true, force: true })
                    console.log(`[INTERVIEW] Cleaned up old chunk directory: ${oldChunkDir}`)
                  } catch (cleanupError) {
                    console.warn(`[INTERVIEW] Failed to cleanup ${dir}:`, cleanupError)
                  }
                }
              }
            }
            
            // 再試行
            const bytes = await chunk.arrayBuffer()
            const buffer = Buffer.from(bytes)
            await writeFile(chunkFilePath, buffer)
            writeSuccess = true
            console.log(`[INTERVIEW] Chunk ${chunkIndex + 1}/${totalChunks} saved after cleanup`)
          } catch (retryError) {
            return NextResponse.json(
              {
                error: 'ディスク容量が不足しています',
                details: 'サーバーの一時ストレージが満杯です。しばらく待ってから再度お試しください。',
              },
              { status: 507 } // 507 Insufficient Storage
            )
          }
        } else {
          throw writeError
        }
      }

      if (!writeSuccess) {
        return NextResponse.json(
          { error: 'チャンクの保存に失敗しました', details: 'ファイルの書き込みに失敗しました。' },
          { status: 500 }
        )
      }

      // すべてのチャンクがアップロードされたか確認
      const uploadedChunks: number[] = []
      for (let i = 0; i < totalChunks; i++) {
        const chunkFile = join(chunkDir, `${tempFileName}.chunk.${i}`)
        if (existsSync(chunkFile)) {
          uploadedChunks.push(i)
        }
      }

      console.log(`[INTERVIEW] Uploaded chunks: ${uploadedChunks.length}/${totalChunks}`, uploadedChunks)

        // すべてのチャンクが揃った場合、ファイルを結合
      if (uploadedChunks.length === totalChunks) {
        console.log(`[INTERVIEW] All chunks received. Starting file merge...`)
        
        try {
          // 結合前に古いファイルをクリーンアップ
          try {
            const finalDir = join(baseDir, projectId)
            if (existsSync(finalDir)) {
              const { readdir, unlink: unlinkFile } = await import('fs/promises')
              const files = await readdir(finalDir)
              // 古いファイルを削除（最新の5ファイル以外）
              if (files.length > 5) {
                const fileStats = await Promise.all(
                  files.map(async (f) => {
                    const filePath = join(finalDir, f)
                    const { stat } = await import('fs/promises')
                    return { path: filePath, mtime: (await stat(filePath)).mtime }
                  })
                )
                fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
                const filesToDelete = fileStats.slice(5)
                for (const file of filesToDelete) {
                  try {
                    await unlinkFile(file.path)
                    console.log(`[INTERVIEW] Deleted old file: ${file.path}`)
                  } catch (e) {
                    console.warn(`[INTERVIEW] Failed to delete old file: ${file.path}`, e)
                  }
                }
              }
            }
          } catch (cleanupError) {
            console.warn(`[INTERVIEW] Cleanup error (continuing):`, cleanupError)
          }

          const finalDir = join(baseDir, projectId)
          if (!existsSync(finalDir)) {
            await mkdir(finalDir, { recursive: true })
          }

          const savedFileName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
          const finalFilePath = join(finalDir, savedFileName)

          // チャンクを順番に結合（結合と同時に削除して容量を確保）
          let mergeError: Error | null = null
          let mergedChunks = 0
          try {
            for (let i = 0; i < totalChunks; i++) {
              const chunkFile = join(chunkDir, `${tempFileName}.chunk.${i}`)
              
              // チャンクファイルの存在確認
              if (!existsSync(chunkFile)) {
                const errorMsg = `チャンクファイルが見つかりません: ${chunkFile}`
                console.error(`[INTERVIEW] ${errorMsg}`)
                mergeError = new Error(errorMsg)
                break
              }
              
              try {
                const chunkData = await readFile(chunkFile)
                
                // チャンクデータのサイズ確認
                if (chunkData.length === 0) {
                  const errorMsg = `チャンク ${i} のデータが空です`
                  console.error(`[INTERVIEW] ${errorMsg}`)
                  mergeError = new Error(errorMsg)
                  break
                }
                
                if (i === 0) {
                  await writeFile(finalFilePath, chunkData)
                } else {
                  await appendFile(finalFilePath, chunkData)
                }
                
                mergedChunks++
                console.log(`[INTERVIEW] Merged chunk ${i + 1}/${totalChunks} (${chunkData.length} bytes)`)
                
                // チャンクファイルを即座に削除（容量を確保）
                await unlink(chunkFile)
              } catch (chunkError: any) {
                console.error(`[INTERVIEW] Error processing chunk ${i}:`, chunkError)
                
                // ENOSPCエラーの場合、より積極的にクリーンアップ
                if (chunkError.code === 'ENOSPC' || chunkError.message?.includes('no space left')) {
                  console.log(`[INTERVIEW] ENOSPC during merge. Cleaning up more aggressively...`)
                  // 他のプロジェクトのチャンクを削除
                  try {
                    const chunksBaseDir = join(baseDir, 'chunks')
                    if (existsSync(chunksBaseDir)) {
                      const { readdir, rm } = await import('fs/promises')
                      const projectDirs = await readdir(chunksBaseDir)
                      for (const dir of projectDirs) {
                        if (dir !== projectId) {
                          try {
                            const oldChunkDir = join(chunksBaseDir, dir)
                            await rm(oldChunkDir, { recursive: true, force: true })
                            console.log(`[INTERVIEW] Cleaned up chunk directory: ${oldChunkDir}`)
                          } catch (cleanupError) {
                            console.warn(`[INTERVIEW] Failed to cleanup ${dir}:`, cleanupError)
                          }
                        }
                      }
                    }
                  } catch (cleanupError) {
                    console.warn(`[INTERVIEW] Aggressive cleanup failed:`, cleanupError)
                  }
                  
                  // 再試行
                  try {
                    if (i === 0) {
                      await writeFile(finalFilePath, await readFile(chunkFile))
                    } else {
                      await appendFile(finalFilePath, await readFile(chunkFile))
                    }
                    await unlink(chunkFile)
                  } catch (retryError) {
                    mergeError = retryError as Error
                    break
                  }
                } else {
                  mergeError = chunkError as Error
                  break
                }
              }
            }
          } catch (mergeErr) {
            mergeError = mergeErr as Error
          }
          
          // エラーが発生した場合、作成したファイルを削除
          if (mergeError) {
            try {
              if (existsSync(finalFilePath)) {
                await unlink(finalFilePath)
              }
            } catch (e) {
              console.warn(`[INTERVIEW] Failed to delete incomplete file: ${finalFilePath}`, e)
            }
            
            // 残っているチャンクファイルを削除
            try {
              for (let i = 0; i < totalChunks; i++) {
                const chunkFile = join(chunkDir, `${tempFileName}.chunk.${i}`)
                if (existsSync(chunkFile)) {
                  try {
                    await unlink(chunkFile)
                  } catch (e) {
                    console.warn(`[INTERVIEW] Failed to delete chunk ${i}:`, e)
                  }
                }
              }
            } catch (e) {
              console.warn(`[INTERVIEW] Failed to cleanup chunks:`, e)
            }
            
            // エラーを返す
            return NextResponse.json(
              {
                completed: false,
                error: 'ファイルの結合に失敗しました',
                details: `エラー詳細: ${mergeError.message || '不明なエラー'}\n結合済みチャンク: ${mergedChunks}/${totalChunks}\nアップロード済みチャンク: ${uploadedChunks.length}/${totalChunks}`,
                uploadedChunks: uploadedChunks.length,
                totalChunks,
                mergedChunks,
              },
              { status: 500 }
            )
          }
        
        // チャンクディレクトリを削除
        try {
          const { rmdir } = await import('fs/promises')
          await rmdir(chunkDir)
        } catch (e) {
          console.warn(`[INTERVIEW] Failed to delete chunk directory: ${chunkDir}`, e)
        }

          // ファイルタイプ判定
          const fileNameLower = fileName.toLowerCase()
          const extension = fileNameLower.split('.').pop()
          let materialType = 'text'
          const isAudio = mimeType.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'ogg'].includes(extension || '')
          const isVideo = mimeType.startsWith('video/') || ['mp4', 'mov', 'avi', 'webm'].includes(extension || '')
          const isPdf = mimeType === 'application/pdf' || extension === 'pdf'
          const isText = mimeType.startsWith('text/') || ['txt', 'md'].includes(extension || '') || extension === 'docx'

          if (isAudio) materialType = 'audio'
          else if (isVideo) materialType = 'video'
          else if (isPdf) materialType = 'pdf'
          else if (isText) materialType = 'text'
          else {
            return NextResponse.json(
              {
                error: '対応していないファイル形式です',
                details: `対応形式: 音声（MP3, WAV, M4A）、動画（MP4, MOV, AVI）、テキスト（TXT, DOCX）、PDF。\n検出された形式: ${mimeType || '不明'}（拡張子: ${extension || 'なし'}）`,
              },
              { status: 400 }
            )
          }

          // ファイルサイズを確認してからVercel Blob Storageにアップロード
          const { stat } = await import('fs/promises')
          const finalFileStats = await stat(finalFilePath)
          
          // 結合後のファイルサイズが元のファイルサイズと一致するか確認
          if (finalFileStats.size !== fileSize) {
            console.error(`[INTERVIEW] File size mismatch: expected ${fileSize}, got ${finalFileStats.size}`)
            // ファイルサイズが一致しない場合でも続行（ログのみ）
            // ただし、大きな差がある場合はエラーを返す
            const sizeDiff = Math.abs(finalFileStats.size - fileSize)
            const sizeDiffPercent = (sizeDiff / fileSize) * 100
            if (sizeDiffPercent > 1) { // 1%以上の差がある場合
              return NextResponse.json(
                {
                  completed: false,
                  error: 'ファイルサイズの不一致が検出されました',
                  details: `結合後のファイルサイズが元のファイルサイズと一致しません。\n期待されるサイズ: ${formatFileSize(fileSize)}\n実際のサイズ: ${formatFileSize(finalFileStats.size)}\n差: ${formatFileSize(sizeDiff)} (${sizeDiffPercent.toFixed(2)}%)`,
                  uploadedChunks: uploadedChunks.length,
                  totalChunks,
                },
                { status: 500 }
              )
            }
          }
          
          const finalFileBuffer = await readFile(finalFilePath)
          
          // BLOB_READ_WRITE_TOKENの確認
          if (!process.env.BLOB_READ_WRITE_TOKEN) {
            console.error('[INTERVIEW] BLOB_READ_WRITE_TOKEN is not set')
            return NextResponse.json(
              {
                error: 'ストレージの設定が完了していません',
                details: 'Vercel Blob Storageの環境変数（BLOB_READ_WRITE_TOKEN）が設定されていません。Vercelダッシュボードで設定を確認してください。',
              },
              { status: 500 }
            )
          }
          
          // Vercel Blob Storageにアップロード
          const blobPath = `interview/${projectId}/${savedFileName}`
          let blob: { url: string; pathname: string; size: number }
          try {
            blob = await put(blobPath, finalFileBuffer, {
              access: 'public',
              contentType: mimeType || undefined,
            })
            console.log(`[INTERVIEW] File uploaded to Blob Storage: ${blob.url}`)
          } catch (blobError: any) {
            console.error('[INTERVIEW] Failed to upload file to Blob Storage:', blobError)
            
            let errorMessage = 'ファイルのBlob Storageへのアップロードに失敗しました'
            let errorDetails = ''
            let statusCode = 500
            
            if (blobError?.message?.includes('Unauthorized') || blobError?.message?.includes('401')) {
              errorMessage = 'Blob Storageの認証に失敗しました'
              errorDetails = 'BLOB_READ_WRITE_TOKENが無効です。Vercelダッシュボードで環境変数を確認してください。'
              statusCode = 401
            } else if (blobError?.message?.includes('Forbidden') || blobError?.message?.includes('403')) {
              errorMessage = 'Blob Storageへのアクセスが拒否されました'
              errorDetails = 'Blobストアへのアクセス権限がありません。Vercelダッシュボードで設定を確認してください。'
              statusCode = 403
            } else if (blobError?.message?.includes('Size limit') || blobError?.message?.includes('413')) {
              errorMessage = 'ファイルサイズが大きすぎます'
              errorDetails = `ファイルサイズがBlob Storageの上限を超えています。最大ファイルサイズ: 4.75GB`
              statusCode = 413
            } else if (blobError?.message?.includes('Storage quota') || blobError?.message?.includes('quota exceeded') || blobError?.message?.includes('1GB maximum') || blobError?.message?.includes('Hobby plan')) {
              errorMessage = 'Blob Storageの容量制限に達しました'
              errorDetails = `Vercel Blob Storageの容量制限（Hobbyプラン: 1GB）に達しています。\n\n対処方法:\n1. 古いプロジェクトを削除して容量を確保する\n2. Vercelのプランをアップグレードする（Proプラン以上では容量が増えます）\n3. 不要なファイルを削除する\n\n現在のファイルサイズ: ${formatFileSize(finalFileStats.size)}`
              statusCode = 507 // 507 Insufficient Storage
            } else {
              errorDetails = `エラー詳細: ${blobError instanceof Error ? blobError.message : '不明なエラー'}`
            }
            
            // エラーレスポンスを返す（必ずcompleted: falseとerrorを含める）
            return NextResponse.json(
              {
                completed: false,
                error: errorMessage,
                details: errorDetails,
                uploadedChunks: uploadedChunks.length,
                totalChunks,
              },
              { status: statusCode }
            )
          }
          
          // 結合済みファイルを削除（Blob Storageに保存済みのため）
          try {
            await unlink(finalFilePath)
            console.log(`[INTERVIEW] Deleted merged file from /tmp: ${finalFilePath}`)
          } catch (e) {
            console.warn(`[INTERVIEW] Failed to delete merged file: ${finalFilePath}`, e)
          }

          // DBに記録
          let material
          try {
            material = await prisma.interviewMaterial.create({
              data: {
                projectId,
                type: materialType,
                fileName: fileName,
                filePath: blob.pathname, // Blob pathnameを保存
                fileUrl: blob.url, // Blob URLを保存
                fileSize: blob.size || finalFileStats.size,
                mimeType,
                status: 'UPLOADED',
              },
            })
          } catch (dbError) {
            console.error('[INTERVIEW] Database error when creating material:', dbError)
            return NextResponse.json(
              {
                error: 'データベースへの保存に失敗しました',
                details: `エラー詳細: ${dbError instanceof Error ? dbError.message : '不明なエラー'}\nファイルはBlob Storageに保存されましたが、データベースへの記録に失敗しました。`,
                uploadedChunks: uploadedChunks.length,
                totalChunks,
              },
              { status: 500 }
            )
          }

          console.log(`[INTERVIEW] File merge and Blob upload completed. Material ID: ${material.id}`)
          
          return NextResponse.json({
            completed: true,
            material,
            message: 'ファイルのアップロードが完了しました',
          })
        } catch (mergeProcessError: any) {
          console.error('[INTERVIEW] Error during merge process:', mergeProcessError)
          return NextResponse.json(
            {
              error: 'ファイルの結合処理中にエラーが発生しました',
              details: `エラー詳細: ${mergeProcessError.message || '不明なエラー'}\nチャンク数: ${uploadedChunks.length}/${totalChunks}`,
              uploadedChunks: uploadedChunks.length,
              totalChunks,
            },
            { status: 500 }
          )
        }
      }

      // チャンクがまだ揃っていない場合
      return NextResponse.json({
        completed: false,
        uploadedChunks: uploadedChunks.length,
        totalChunks,
        progress: Math.round((uploadedChunks.length / totalChunks) * 100),
      })
    } catch (fileError) {
      console.error('[INTERVIEW] File operation error:', fileError)
      throw fileError
    }
  } catch (error) {
    console.error('[INTERVIEW] Chunk upload error:', error)
    const errorMessage = error instanceof Error ? error.message : '不明なエラー'
    
    return NextResponse.json(
      {
        error: 'チャンクのアップロードに失敗しました',
        details: `エラー詳細: ${errorMessage}`,
      },
      { status: 500 }
    )
  }
}

