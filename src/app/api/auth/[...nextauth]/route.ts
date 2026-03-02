import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

// NextAuth handler
// NOTE: `NEXTAUTH_URL` はVercelのEnvironment Variablesで本番ドメインに設定してください。
const handler = NextAuth(authOptions)

// 動的レンダリングを強制（ビルド時のページデータ収集エラーを回避）
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export { handler as GET, handler as POST }


