import { NextResponse } from 'next/server'

// ============================================
// 提供を終了したサービスのAPIを閉じる
// ============================================
// ⚠️ next.config.js のリダイレクトは `/movie` のような**ページのパス**にしか
//    マッチしない。`/api/movie/*` は素通りするため、画面を閉じただけでは
//    APIが生きたままになる（/adbanner で実際に起きた。URLを知る第三者が
//    直接叩けば生成の費用が発生していた）。入口はAPI側でも閉じること。
//
// ⚠️ middleware では閉じられない。matcher に当てても各ルートの認証とは別物で、
//    このリポジトリでは過去に middleware 自体が動いていなかった経緯もある。
//    ルート側で明示的に閉じるのが確実。
//
// ⚠️ ルートファイルとDBのデータは残す（ロールバックの余地を確保する方針）。
//    止めるのは入口だけにして、戻したくなったらフラグを false にすれば復旧できる。

/**
 * ⚠️ 型を boolean にしてあるのは意図的。`true` リテラルにするとガード以降が
 *    到達不能コードになり、TypeScript が型解決をやめて既存の本体コードが
 *    大量の型エラーになる（実際にビルドが壊れた）。
 */
export const SERVICE_RETIRED: boolean = true

export function retiredServiceResponse(serviceName: string) {
  return NextResponse.json(
    {
      error: `${serviceName}は提供を終了しました。ほかのサービスは doya-ai.surisuta.jp をご覧ください。`,
      movedTo: '/',
    },
    { status: 410 }
  )
}
