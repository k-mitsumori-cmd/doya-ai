export async function uploadBannerAdminImage(file: File): Promise<string> {
  const response = await fetch('/api/admin/doyamana/images/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mimeType: file.type, fileSize: file.size }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || '画像アップロードの準備に失敗しました')
  if (typeof result.signedUrl !== 'string' || typeof result.publicUrl !== 'string') {
    throw new Error('アップロード先を取得できませんでした')
  }
  const upload = await fetch(result.signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!upload.ok) throw new Error('画像のアップロードに失敗しました')
  return result.publicUrl
}
