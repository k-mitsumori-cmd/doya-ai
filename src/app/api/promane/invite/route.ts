export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import crypto from 'crypto'

/**
 * POST /api/promane/invite
 * 招待リンクを発行
 * Body: { workspaceId: string, email: string, role?: 'admin'|'member'|'guest' }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { workspaceId, email, role = 'member' } = body || {}

    if (!workspaceId || !email) {
      return NextResponse.json({ error: 'workspaceId と email は必須です' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'メールアドレス形式が不正です' }, { status: 400 })
    }
    if (!['admin', 'member', 'guest'].includes(role)) {
      return NextResponse.json({ error: 'role が不正です' }, { status: 400 })
    }

    // 自分が workspace owner/admin か確認
    const myMember = await prisma.promaneMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    })
    if (!myMember || !['owner', 'admin'].includes(myMember.role)) {
      return NextResponse.json({ error: '招待権限がありません（owner/admin のみ）' }, { status: 403 })
    }

    // 既存メンバーは招待不要
    const existingMember = await prisma.promaneMember.findFirst({
      where: { workspaceId, user: { email } },
    })
    if (existingMember) {
      return NextResponse.json({ error: '既にメンバーです' }, { status: 409 })
    }

    // 既存の未承諾招待を確認（重複防止）
    const existingInvite = await prisma.promaneInvitation.findFirst({
      where: {
        workspaceId,
        email: email.toLowerCase(),
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    })
    if (existingInvite) {
      const inviteUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://doya-ai.surisuta.jp'}/promane/invite/${existingInvite.token}`
      return NextResponse.json({ success: true, token: existingInvite.token, inviteUrl, reused: true })
    }

    // ワークスペース名・招待者名を取得（メール内で使用）
    const [workspace, inviter] = await Promise.all([
      prisma.promaneWorkspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    ])
    if (!workspace) {
      return NextResponse.json({ error: 'ワークスペースが見つかりません' }, { status: 404 })
    }

    // 新規招待作成（30日有効）
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const invitation = await prisma.promaneInvitation.create({
      data: {
        workspaceId,
        email: email.toLowerCase(),
        role,
        token,
        invitedById: userId,
        expiresAt,
      },
    })

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://doya-ai.surisuta.jp'
    const inviteUrl = `${baseUrl}/promane/invite/${token}`

    // 招待メール送信（Resend）
    const roleLabel = role === 'admin' ? '管理者' : role === 'guest' ? 'ゲスト' : 'メンバー'
    const inviterName = inviter?.name || inviter?.email || '招待者'
    const emailResult = await sendEmail({
      to: email,
      subject: `【ドヤプロマネ】${workspace.name} へ招待されました`,
      html: buildInviteEmailHtml({
        workspaceName: workspace.name,
        inviterName,
        inviterEmail: inviter?.email || '',
        roleLabel,
        inviteUrl,
        expiresAt,
      }),
      tags: [
        { name: 'service', value: 'promane' },
        { name: 'type', value: 'invitation' },
      ],
    })

    return NextResponse.json({
      success: true,
      token: invitation.token,
      inviteUrl,
      expiresAt: invitation.expiresAt,
      emailSent: emailResult.success,
      emailError: emailResult.success ? undefined : emailResult.error,
    })
  } catch (e: any) {
    console.error('[promane/invite][POST]', e)
    return NextResponse.json({ error: e?.message || '招待リンク発行に失敗しました' }, { status: 500 })
  }
}

function buildInviteEmailHtml(args: {
  workspaceName: string
  inviterName: string
  inviterEmail: string
  roleLabel: string
  inviteUrl: string
  expiresAt: Date
}): string {
  const expiresStr = args.expiresAt.toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ドヤプロマネへの招待</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Hiragino Sans','Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.04);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#3b82f6 0%,#8b5cf6 100%);padding:32px 32px 24px;text-align:center;">
          <div style="font-size:48px;line-height:1;margin-bottom:8px;">📊</div>
          <h1 style="color:#ffffff;font-size:24px;font-weight:900;margin:0;letter-spacing:-0.5px;">ドヤプロマネ</h1>
          <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:4px 0 0;font-weight:600;">プロジェクト管理ツール</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 32px 24px;">
          <h2 style="color:#0f172a;font-size:20px;font-weight:900;margin:0 0 16px;line-height:1.4;">
            ${escapeHtml(args.workspaceName)} に招待されました
          </h2>
          <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">
            <strong>${escapeHtml(args.inviterName)}</strong> さんから、ドヤプロマネのワークスペース<br>
            「<strong style="color:#0f172a;">${escapeHtml(args.workspaceName)}</strong>」へ
            <strong style="color:#7c3aed;">${escapeHtml(args.roleLabel)}</strong> として招待されました。
          </p>

          <!-- Invitation info card -->
          <table width="100%" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin:24px 0;">
            <tr><td style="padding:16px 20px;">
              <table width="100%">
                <tr>
                  <td style="color:#64748b;font-size:12px;font-weight:700;padding:6px 0;">ワークスペース</td>
                  <td style="color:#0f172a;font-size:14px;font-weight:700;text-align:right;padding:6px 0;">${escapeHtml(args.workspaceName)}</td>
                </tr>
                <tr>
                  <td style="color:#64748b;font-size:12px;font-weight:700;padding:6px 0;border-top:1px solid #e2e8f0;">役割</td>
                  <td style="color:#0f172a;font-size:14px;font-weight:700;text-align:right;padding:6px 0;border-top:1px solid #e2e8f0;">${escapeHtml(args.roleLabel)}</td>
                </tr>
                <tr>
                  <td style="color:#64748b;font-size:12px;font-weight:700;padding:6px 0;border-top:1px solid #e2e8f0;">招待者</td>
                  <td style="color:#0f172a;font-size:14px;font-weight:700;text-align:right;padding:6px 0;border-top:1px solid #e2e8f0;">${escapeHtml(args.inviterName)}</td>
                </tr>
                <tr>
                  <td style="color:#64748b;font-size:12px;font-weight:700;padding:6px 0;border-top:1px solid #e2e8f0;">有効期限</td>
                  <td style="color:#dc2626;font-size:14px;font-weight:700;text-align:right;padding:6px 0;border-top:1px solid #e2e8f0;">${expiresStr}</td>
                </tr>
              </table>
            </td></tr>
          </table>

          <!-- CTA -->
          <table width="100%" style="margin:28px 0 16px;"><tr><td align="center">
            <a href="${escapeHtml(args.inviteUrl)}"
              style="display:inline-block;background:linear-gradient(135deg,#3b82f6 0%,#8b5cf6 100%);color:#ffffff;font-size:16px;font-weight:900;text-decoration:none;padding:14px 36px;border-radius:999px;box-shadow:0 4px 12px rgba(139,92,246,0.3);">
              🚀 招待を承諾する
            </a>
          </td></tr></table>

          <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:24px 0 0;text-align:center;">
            または以下のURLをブラウザで開いてください：<br>
            <a href="${escapeHtml(args.inviteUrl)}" style="color:#3b82f6;word-break:break-all;">${escapeHtml(args.inviteUrl)}</a>
          </p>

          <!-- Security notice -->
          <div style="background-color:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:12px 16px;margin:24px 0 0;">
            <p style="color:#92400e;font-size:12px;line-height:1.6;margin:0;font-weight:600;">
              🔒 <strong>セキュリティのお願い</strong><br>
              招待は <strong>${escapeHtml(args.inviterEmail || '不明')}</strong> 宛のメールアドレスでログインしないと承諾できません。<br>
              心当たりがない場合はこのメールを無視してください。
            </p>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="color:#94a3b8;font-size:11px;margin:0;line-height:1.6;">
            このメールに心当たりがない場合は無視してください。<br>
            お問い合わせ: <a href="mailto:support@surisuta.jp" style="color:#3b82f6;">support@surisuta.jp</a>
          </p>
          <p style="color:#cbd5e1;font-size:10px;margin:12px 0 0;">© スリスタ株式会社 / ドヤAI</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
