import { NextResponse } from 'next/server'

// ============================================
// ドヤ広告バナーAI（/adbanner）は廃止済み
// ============================================
// 2026-08-10 に後継の ドヤ広告画像AI（/adimage）へ統合した。
//
// ⚠️ 画面は next.config.js の 308 リダイレクトで到達不能になったが、
//    リダイレクトの source は `/adbanner` と `/adbanner/:path*` なので
//    **`/api/adbanner/*` にはマッチしない**。middleware.ts も
//    SHARED_SKIP_PREFIXES で `/api` を丸ごと飛ばす。
//    そのため統合後も `POST /api/adbanner/generate` 等は生きたままで、
//    URLを知っている第三者が直接叩けば画像生成の費用が発生する状態だった。
//
// ⚠️ ルートファイルとDBの adbanner_* は残す（ロールバックの余地を確保する方針）。
//    止めるのは入口だけにして、戻したくなったらこのガードを外せば復旧できる。
export function retiredResponse() {
  return NextResponse.json(
    {
      error: 'ドヤ広告バナーAIはドヤ広告画像AIに統合されました。/adimage をご利用ください。',
      movedTo: '/adimage',
    },
    { status: 410 }
  )
}
