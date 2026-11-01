// 直接アップロード（署名付きURLでブラウザから Storage へ直接送る形）の切り替え旗。
// NEXT_PUBLIC_DIRECT_UPLOAD_ROLLOUT=on のときだけ新しい経路を使う。未設定・それ以外は、これまでの経路（Vercel 経由）のまま。
// 画面とサーバーの両方が同じ値を見る（NEXT_PUBLIC_ はビルド時に画面側へ埋め込まれる）。旗を変えたら再デプロイが必要。

export function directUploadRollout(): boolean {
  return process.env.NEXT_PUBLIC_DIRECT_UPLOAD_ROLLOUT === 'on'
}

// 完了通知が JSON なら直接アップロード、multipart/form-data ならこれまでの経路
export function isDirectConfirm(req: { headers?: { get?: (name: string) => string | null } }): boolean {
  const type = req.headers?.get?.('content-type') || ''
  return type.toLowerCase().includes('application/json')
}
