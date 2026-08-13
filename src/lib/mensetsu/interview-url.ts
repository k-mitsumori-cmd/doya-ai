// ============================================
// 面接URLの組み立て
// ============================================
// 面接のお渡し方は「担当者がURLをコピーして応募者にお渡しする」の1通りに絞っている。
// ⚠️ ご案内メールの送信機能は 2026-08-13 に廃止した。
//    「メールが届かない」問い合わせが、担当者と応募者の双方を止めてしまうため。
//    お渡しの経路（媒体のメッセージ・チャット・電話口）は担当者が既に持っている。

/** ⚠️ VERCEL_URL は使わない（デプロイ保護付きの内部URLなので応募者が開けない） */
export function interviewUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL || 'https://doya-ai.surisuta.jp'
  return `${base}/mensetsu/live/${token}`
}
