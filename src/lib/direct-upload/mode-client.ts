// 画面側の切り替え。サーバーの旗（DIRECT_UPLOAD_ROLLOUT）を1度だけ聞いて覚える。
// 聞けなかったときは false（これまでの経路）に倒す。

let cached: Promise<boolean> | null = null

export function isDirectUploadEnabled(): Promise<boolean> {
  if (!cached) {
    cached = fetch('/api/direct-upload/mode', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => d?.direct === true)
      .catch(() => false)
    // 失敗は覚えず、次の送信でもう一度聞く
    cached.then(ok => { if (!ok) cached = null })
  }
  return cached
}
