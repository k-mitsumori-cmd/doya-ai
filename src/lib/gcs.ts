// ... existing code ...

/**
 * 署名付きダウンロードURLを生成（読み取り用）
 * @param filePath GCS内のファイルパス
 * @param expiresIn 有効期限（秒、デフォルト: 1時間）
 * @returns 署名付きURL
 */
export async function generateSignedDownloadUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const storage = await getStorage()
    const bucket = storage.bucket(getBucketName())
    const file = bucket.file(filePath)

    // 署名付きURLを生成（GETメソッドでダウンロード可能）
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresIn * 1000,
    })

    return signedUrl
  } catch (error: any) {
    console.error('[GCS] Error generating signed download URL:', error)
    throw new Error(
      `署名付きダウンロードURLの生成に失敗しました: ${error?.message || '不明なエラー'}`
    )
  }
}
