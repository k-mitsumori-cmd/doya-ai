import { redirect } from 'next/navigation'

export default function SeoArticlesIndexPage() {
  // 互換URL: 旧ナビ/外部リンクのために残す（一覧は /seo に統合）
  redirect('/seo')
}


