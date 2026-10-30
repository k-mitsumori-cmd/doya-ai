// ============================================
// サービス名の切り替えの旗（ドヤAI → ドヤ部下）
// ============================================
// 2026-10-30 本人の決定: サービス名を「ドヤAI」から「ドヤ部下」（英語 DOYA BUKA）に変える。URL（doya-ai.surisuta.jp）は変えない。
//   NEXT_PUBLIC_BRAND_RENAME_ROLLOUT=off（既定。値が無い・知らない値も off）… 今の「ドヤAI」のまま
//   NEXT_PUBLIC_BRAND_RENAME_ROLLOUT=all                                      … 「ドヤ部下」に切り替える（切り替える日は本人が決める）
// ⚠️ 画面（クライアント）でも読むので、NEXT_PUBLIC_ を付けた名前にしている。値を変えたら再デプロイが要る（ビルドのときに埋め込まれる）。
// ⚠️ 本番に出すのは、統括の監査と本人の承認のあと。
export type BrandRenameRollout = 'off' | 'all'

/** 環境変数の値を読む。既定は off（all だけを受け付ける） */
export function brandRenameRollout(raw: string | undefined = process.env.NEXT_PUBLIC_BRAND_RENAME_ROLLOUT): BrandRenameRollout {
  return (raw ?? '').trim().toLowerCase() === 'all' ? 'all' : 'off'
}

/** 切り替え後の名前を出すか */
export function isBrandRenamed(raw?: string | undefined): boolean {
  return brandRenameRollout(raw === undefined ? process.env.NEXT_PUBLIC_BRAND_RENAME_ROLLOUT : raw) === 'all'
}
