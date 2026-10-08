'use client'
export default function DepartmentListState({ status, error, retry }: { status: string; error: string; retry: () => void }) {
  if (status === 'loading') return <p role="status" className="mb-4 text-sm text-slate-600">部署一覧を取得しています。入力内容はそのままお待ちください。</p>
  if (status !== 'error') return null
  return <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
    <p>{error || '部署一覧を取得できませんでした。'}</p>
    <p className="mt-1">入力内容は保持しています。保存する前に部署一覧を再取得してください。</p>
    <button type="button" onClick={retry} className="mt-2 font-bold underline">部署一覧を再取得する</button>
  </div>
}
