import type { Metadata } from 'next'

// 社員が開くアンケート回答画面。検索に載せない
export const metadata: Metadata = {
  title: '社員インタビュー アンケート',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
