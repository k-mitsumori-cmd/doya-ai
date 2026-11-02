// 画面側の切り替え。旗 NEXT_PUBLIC_DIRECT_UPLOAD_ROLLOUT（ビルド時に埋め込まれる）が on のときだけ直接アップロード。
// 検査スクリプトのように process が無い環境では false（これまでの経路）になる。

export async function isDirectUploadEnabled(): Promise<boolean> {
  return typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DIRECT_UPLOAD_ROLLOUT === 'on'
}
