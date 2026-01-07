import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

// NextAuth handler
// NOTE: `NEXTAUTH_URL` はVercelのEnvironment Variablesで本番ドメインに設定してください。
const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }


