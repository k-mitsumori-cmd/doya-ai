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
