/**
 * 管理者ユーザー（AdminUser）の存在確認スクリプト
 *
 * 目的:
 * - 本番DBに管理者が既に存在するか（0人かどうか）を確認する
 *
 * 使用方法:
 * npx tsx src/scripts/check-admin-users.ts
 */

import { prisma } from '../lib/prisma'

async function main() {
  try {
    const count = await prisma.adminUser.count()
    console.log(`AdminUser count: ${count}`)

    const admins = await prisma.adminUser.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    })

    if (admins.length === 0) {
      console.log('No admin users found.')
      return
    }

    console.log('Latest admin users (max 20):')
    for (const a of admins) {
      console.log(
        `- ${a.username} | email=${a.email ?? '-'} | active=${a.isActive} | lastLogin=${a.lastLoginAt?.toISOString?.() ?? '-'} | created=${a.createdAt.toISOString?.() ?? a.createdAt}`
      )
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('Failed to check admin users:', e)
  process.exit(1)
})







