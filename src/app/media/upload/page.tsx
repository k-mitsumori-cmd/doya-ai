'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import MultipartUploadQueue from '@/components/direct-upload/MultipartUploadQueue'

// 動画・音声の取り込み画面。大きなファイルを小分けにして送り、切れても続きから送れる。
// 送り終えたあとの処理（音声の抜き出しなど）は、完了 API の後ろに media-jobs をつなぐ（reference/12 参照）。
export default function MediaUploadPage() {
  const { status } = useSession()
  const [done, setDone] = useState<{ fileName: string; fileSize: number }[]>([])

  if (status === 'loading') return null
  if (status === 'unauthenticated') {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-slate-700">動画の取り込みにはログインが必要です。</p>
        <Link href="/auth/signin?callbackUrl=/media/upload" className="mt-4 inline-block rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white">
          ログインする
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-black text-slate-900">動画・音声の取り込み</h1>
      <p className="mt-2 text-sm text-slate-600">
        数百MBから数GBのファイルも送れます。複数のファイルをまとめて選べます。
      </p>
      <div className="mt-6">
        <MultipartUploadQueue onDone={f => setDone(d => [...d, { fileName: f.fileName, fileSize: f.fileSize }])} />
      </div>
      {done.length > 0 && (
        <p className="mt-6 text-sm text-slate-700">{done.length}本の取り込みが完了しました。</p>
      )}
    </main>
  )
}
