import { redirect } from 'next/navigation'

export default function SeoNewHiddenPage() {
  // 「新規記事作成（詳細）」は一旦非表示（導線も機能も停止）
  redirect('/seo/create')
}

