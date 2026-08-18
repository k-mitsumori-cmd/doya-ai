import toast from 'react-hot-toast'

// ============================================
// エラー通知
// ============================================
// ⚠️ 画面内のエラー表示だけだと、スクロール位置によっては気づかれない。
//    reference/06-ui-patterns.md §6.6 のとおり react-hot-toast を併用する。
//    （新4サービスは toast を一切使っておらず、他110ファイルと揃っていなかった）
// ⚠️ 画面内の表示は消さないこと。トーストは数秒で消えるため、
//    何が起きたかを後から確認できる場所も残しておく。

type Setter = (v: any) => void

/** 画面内にエラーを出しつつ、トーストでも知らせる */
export function notifyError(setError: Setter, message: unknown) {
  const text =
    message instanceof Error
      ? message.message
      : typeof message === 'string'
        ? message
        : '処理に失敗しました'
  setError(text)
  if (text) toast.error(text)
}

/** 成功を知らせる。画面内に出す場所が無いときはトーストだけでよい */
export function notifySuccess(message: string) {
  toast.success(message)
}
