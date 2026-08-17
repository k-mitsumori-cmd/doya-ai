import { NextResponse } from 'next/server'

// ============================================
// ドヤ広告バナーAI（/adbanner）は廃止済み
// ============================================
// 2026-08-10 に後継の ドヤ広告画像AI（/adimage）へ統合した。
//
// ⚠️ 画面は next.config.js の 308 リダイレクトで到達不能になったが、
//    リダイレクトの source は `/adbanner` と `/adbanner/:path*` なので
//    **`/api/adbanner/*` にはマッチしない**。そのため統合後も
//    `POST /api/adbanner/generate` 等は生きたままで、URLを知っている
//    第三者が直接叩けば画像生成の費用が発生する状態だった。
//
// ⚠️ middleware での遮断は使えない。この構成では middleware が
//    **一度も実行されていない**（app が src/ 配下にあるのに middleware.ts が
//    リポジトリ直下にあり、Next.js に認識されていない）。
//
// ⚠️ ルートファイルとDBの adbanner_* は残す（ロールバックの余地を確保する方針）。
//    止めるのは入口だけにして、戻したくなったらこのフラグを false にすれば復旧できる。

/**
 * ⚠️ 型を boolean にしてあるのは意図的。`true` リテラルにすると
 *    ガード以降が到達不能コードになり、TypeScript が型解決をやめて
 *    既存の本体コードが大量の型エラーになる（実際にビルドが壊れた）。
 */
export const ADBANNER_RETIRED: boolean = true

export function retiredResponse() {
  return NextResponse.json(
    {
      error: 'ドヤ広告バナーAIはドヤ広告画像AIに統合されました。/adimage をご利用ください。',
      movedTo: '/adimage',
    },
    { status: 410 }
  )
}
