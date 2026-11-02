// ============================================
// 保存しているファイルの台帳（容量の数え方・期限・削除）
// ============================================
// 設定値は src/lib/storage-plans.ts。表は prisma の StoredFile。
// ・使っている合計 = 台帳の合計 + 送信中（まだ台帳に入っていない）の申告サイズ
// ・期限は Cron（stored-files メンテナンス）が契約の状態に合わせて付け外しする

import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { getStorageAdmin } from './server'
import {
  EXPIRY_NOTICE_DAYS, POST_CANCEL_GRACE_DAYS, formatBytes, storagePlanFor,
} from '@/lib/storage-plans'

const DAY = 24 * 3600 * 1000

export async function getUserPlan(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } })
  return u?.plan ?? null
}

/** 使っている合計（バイト）。送信中のぶんも含める */
export async function getUsedBytes(userId: string, client: Pick<typeof prisma, 'storedFile' | 'directUploadSession'> = prisma): Promise<number> {
  const [stored, uploading] = await Promise.all([
    client.storedFile.aggregate({ where: { userId }, _sum: { fileSize: true } }),
    client.directUploadSession.aggregate({ where: { userId, status: 'UPLOADING' }, _sum: { fileSize: true } }),
  ])
  return Number(stored._sum.fileSize ?? 0) + Number(uploading._sum.fileSize ?? 0)
}

export async function getUsage(userId: string) {
  const plan = storagePlanFor(await getUserPlan(userId))
  const used = await getUsedBytes(userId)
  return { plan, used, remaining: Math.max(0, plan.quotaBytes - used) }
}

/** 上限を超えるときは、画面に出せる文面つきで null 以外を返す */
export function quotaMessage(quotaBytes: number, used: number, newSize: number): string | null {
  if (used + newSize <= quotaBytes) return null
  const remaining = Math.max(0, quotaBytes - used)
  return `保存できる容量を超えます。あと${formatBytes(remaining)}まで使えます（上限${formatBytes(quotaBytes)}）。不要なファイルを削除してからお試しください。`
}

/** 期限の初期値：無料は置いた日から retentionDays 日、有料の契約中は期限なし */
export function initialExpiry(planCode: string | null, createdAt: Date): Date | null {
  const days = storagePlanFor(planCode).retentionDays
  return days === null ? null : new Date(createdAt.getTime() + days * DAY)
}

export async function removeStoredObject(bucket: string, objectKey: string): Promise<boolean> {
  const { error } = await getStorageAdmin().storage.from(bucket).remove([objectKey])
  return !error
}

/** 本人のファイル1件を、保存場所と台帳の両方から消す */
export async function deleteStoredFile(userId: string, id: string): Promise<'deleted' | 'not_found' | 'failed'> {
  const f = await prisma.storedFile.findFirst({ where: { id, userId } })
  if (!f) return 'not_found'
  if (!(await removeStoredObject(f.bucket, f.objectKey))) return 'failed'
  await prisma.storedFile.deleteMany({ where: { id, userId } })
  return 'deleted'
}

function baseUrl() {
  return process.env.NEXTAUTH_URL || 'https://doya-ai.surisuta.jp'
}

async function sendExpiryNotice(email: string, name: string | null, files: { fileName: string; expiresAt: Date; fileSize: bigint }[]) {
  const rows = files
    .map(f => `<li>${escapeHtml(f.fileName)}（${formatBytes(Number(f.fileSize))}）　削除予定日：${f.expiresAt.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}</li>`)
    .join('')
  const link = `${baseUrl()}/settings/files`
  await sendEmail({
    to: email,
    subject: '【ドヤAI】保存しているファイルの削除予定のお知らせ',
    html: `<p>${escapeHtml(name || 'お客様')}</p>
<p>いつもドヤAIをご利用いただき、ありがとうございます。</p>
<p>保存期間の終了が近いファイルがございます。${EXPIRY_NOTICE_DAYS}日以内に、次のファイルを自動で削除いたします。</p>
<ul>${rows}</ul>
<p>必要なファイルは、期限までにお手元へ保存してください。プロプランなどの有料プランをご契約いただいた場合は、契約中は削除されません。</p>
<p><a href="${link}">保存しているファイルを確認する</a></p>
<p>ドヤAI</p>`,
    tags: [{ name: 'type', value: 'stored-file-expiry' }],
  })
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

/**
 * 1日1回の定期処理。
 *  1. 契約の状態に合わせて期限を付け外しする（有料→無料は猶予つきで付け、無料→有料は外す）
 *  2. 期限の7日前に、1人につき1通のメールで知らせる
 *  3. 期限を過ぎたファイルを消す
 */
export async function runStoredFileMaintenance(now = new Date()) {
  const result = { users: 0, expiryAssigned: 0, expiryCleared: 0, notified: 0, deleted: 0, failed: 0 }
  const ids = await prisma.storedFile.findMany({ distinct: ['userId'], select: { userId: true }, take: 1000 })
  for (const { userId } of ids) {
    result.users++
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, email: true, name: true } })
    const plan = storagePlanFor(user?.plan)

    if (plan.retentionDays === null) {
      const r = await prisma.storedFile.updateMany({
        where: { userId, OR: [{ expiresAt: { not: null } }, { noticeSentAt: { not: null } }] },
        data: { expiresAt: null, noticeSentAt: null },
      })
      result.expiryCleared += r.count
    } else {
      const open = await prisma.storedFile.findMany({ where: { userId, expiresAt: null }, select: { id: true, createdAt: true } })
      for (const f of open) {
        const byRetention = f.createdAt.getTime() + plan.retentionDays * DAY
        const byGrace = now.getTime() + POST_CANCEL_GRACE_DAYS * DAY
        await prisma.storedFile.update({ where: { id: f.id }, data: { expiresAt: new Date(Math.max(byRetention, byGrace)) } })
        result.expiryAssigned++
      }
    }

    // 予告
    if (user?.email) {
      const soon = await prisma.storedFile.findMany({
        where: { userId, noticeSentAt: null, expiresAt: { gt: now, lte: new Date(now.getTime() + EXPIRY_NOTICE_DAYS * DAY) } },
        select: { id: true, fileName: true, expiresAt: true, fileSize: true },
      })
      if (soon.length) {
        const sent = await sendExpiryNotice(user.email, user.name, soon.map(s => ({ ...s, expiresAt: s.expiresAt! }))).then(() => true, () => false)
        if (sent) {
          await prisma.storedFile.updateMany({ where: { id: { in: soon.map(s => s.id) } }, data: { noticeSentAt: now } })
          result.notified += soon.length
        }
      }
    }

    // 削除
    const due = await prisma.storedFile.findMany({ where: { userId, expiresAt: { lte: now } } })
    for (const f of due) {
      if (await removeStoredObject(f.bucket, f.objectKey)) {
        await prisma.storedFile.deleteMany({ where: { id: f.id } })
        result.deleted++
      } else {
        result.failed++
      }
    }
  }
  return result
}
