import { redirect } from 'next/navigation'

// /seo に「生成記事一覧（ダッシュボード＋履歴）」を統合したため、旧URLはリダイレクト
export default function SeoArticlesIndexPage() {
  redirect('/seo')
}


