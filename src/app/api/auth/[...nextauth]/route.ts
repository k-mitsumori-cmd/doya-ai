import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

function ensureNextAuthUrl(req: Request) {
  // まずは明示設定を優先（Google OAuthのredirect_uri_mismatch回避）
  const explicit = String(process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim()
  if (explicit) {
    process.env.NEXTAUTH_URL = explicit
    return
  }
  // 次にリクエストヘッダから推測（Vercelのpreview/production両対応）
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  if (host) process.env.NEXTAUTH_URL = `${proto}://${host}`
}

const handler = (req: Request) => {
  ensureNextAuthUrl(req)
  return NextAuth(authOptions)(req as any)
}

export async function GET(req: Request) {
  return handler(req)
}

export async function POST(req: Request) {
  return handler(req)
}


