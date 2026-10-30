// ============================================
// 直接アップロードの共通部品（ブラウザ側）
// ============================================
// 発行 API → Storage へ直接 PUT → 完了 API の3段を、ツールごとに書かずここにまとめる。

export type DirectUploadOptions = {
  file: Blob
  fileName: string
  /** 署名付きURLを発行する API。{ success, signedUrl, path } を返すこと */
  issueUrl: string
  /** 完了を知らせる API。{ success, ... } を返すこと */
  confirmUrl: string
  /** 発行 API に送る追加の項目（mimeType と fileSize は自動で入る） */
  issueBody?: Record<string, unknown>
  /** 完了 API に送る追加の項目（path と mimeType は自動で入る） */
  confirmBody?: Record<string, unknown>
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

export class DirectUploadError extends Error {}

async function postJson(url: string, body: unknown, signal?: AbortSignal) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.success) {
    throw new DirectUploadError(data?.error || 'アップロードに失敗しました')
  }
  return data
}

function putToSignedUrl(signedUrl: string, file: Blob, fileName: string, onProgress?: (p: number) => void, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const form = new FormData()
    form.append('cacheControl', '3600')
    form.append('', file, fileName)
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new DirectUploadError('アップロードに失敗しました。通信環境を確認してください。'))
    xhr.onerror = () => reject(new DirectUploadError('アップロードに失敗しました。通信環境を確認してください。'))
    xhr.onabort = () => reject(new DirectUploadError('アップロードを中止しました'))
    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(form)
  })
}

/** 3段をまとめて実行し、完了 API の応答を返す */
export async function directUpload(opts: DirectUploadOptions) {
  const mimeType = (opts.file.type || '').split(';')[0]
  const issued = await postJson(
    opts.issueUrl,
    { ...opts.issueBody, mimeType, fileSize: opts.file.size },
    opts.signal
  )
  await putToSignedUrl(issued.signedUrl, opts.file, opts.fileName, opts.onProgress, opts.signal)
  return postJson(opts.confirmUrl, { ...opts.confirmBody, path: issued.path, mimeType }, opts.signal)
}
