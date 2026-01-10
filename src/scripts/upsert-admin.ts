/**
 * 管理者ユーザー 作成/更新（パスワードリセット）スクリプト
 *
 * 使用方法:
 * npx tsx src/scripts/upsert-admin.ts <username> <password> [email] [name]
 *
 * - ユーザーが存在しない場合: 新規作成
 * - ユーザーが存在する場合: passwordHash を更新し、有効化(isActive=true)
 */

import { hashPassword, validatePassword } from '../lib/admin-auth'
import { prisma } from '../lib/prisma'

async function upsertAdmin() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.error('使用方法: npx tsx src/scripts/upsert-admin.ts <username> <password> [email] [name]')
    process.exit(1)
  }

  let username = args[0]
  const password = args[1]
  let email = args[2] || null
  const name = args[3] || null

  // 便利機能: 1つ目の引数がメールっぽい場合、email未指定ならemailとしても使う
  if (username.includes('@') && !email) {
    email = username
  }

  const passwordValidation = validatePassword(password)
  if (!passwordValidation.valid) {
    console.error('❌ パスワード要件を満たしていません:')
    passwordValidation.errors.forEach((error) => console.error(`  - ${error}`))
    process.exit(1)
  }

  try {
    const passwordHash = await hashPassword(password)

    const existing = await prisma.adminUser.findUnique({
      where: { username },
      select: { id: true, username: true, email: true, name: true, isActive: true, createdAt: true, updatedAt: true },
    })

    if (!existing) {
      const created = await prisma.adminUser.create({
        data: {
          username,
          passwordHash,
          email,
          name,
          isActive: true,
        },
      })

      console.log('✅ 管理者ユーザーを作成しました')
      console.log(`   username: ${created.username}`)
      console.log(`   email: ${created.email || '(未設定)'}`)
      console.log(`   name: ${created.name || '(未設定)'}`)
      console.log(`   id: ${created.id}`)
      await prisma.$disconnect()
      return
    }

    const updated = await prisma.adminUser.update({
      where: { username },
      data: {
        passwordHash,
        email,
        name,
        isActive: true,
      },
    })

    console.log('✅ 管理者ユーザーを更新しました（パスワードをリセットしました）')
    console.log(`   username: ${updated.username}`)
    console.log(`   email: ${updated.email || '(未設定)'}`)
    console.log(`   name: ${updated.name || '(未設定)'}`)
    console.log(`   id: ${updated.id}`)

    await prisma.$disconnect()
  } catch (error) {
    console.error('❌ 管理者ユーザーの作成/更新に失敗しました:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

upsertAdmin()


