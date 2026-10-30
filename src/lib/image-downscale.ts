// ブラウザで画像を縮小して dataURL にする。JSON 本文に画像を載せる API が、
// Vercel の約4.5MB の本文制限を超えないようにするために使う（AI に渡す画像は縮小で足りる）。

export async function downscaleToDataUrl(file: File, maxEdge: number, quality = 0.85): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  // 透過を保つため、PNG のロゴは PNG のまま（縮小後は小さい）。写真は JPEG
  const keepAlpha = file.type === 'image/png' || file.type === 'image/webp'
  return canvas.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', quality)
}

/** 生成済みの画像（dataURL）を、AI に渡すのに十分な大きさへ縮めて JPEG にする。縮められなければそのまま返す */
export async function shrinkDataUrl(dataUrl: string, maxEdge = 1600, quality = 0.9): Promise<string> {
  if (!dataUrl.startsWith('data:image/') || dataUrl.length < 1_500_000) return dataUrl // 小さいものは触らない
  try {
    const blob = await (await fetch(dataUrl)).blob()
    const bitmap = await createImageBitmap(blob)
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()
    return canvas.toDataURL('image/jpeg', quality)
  } catch {
    return dataUrl
  }
}
