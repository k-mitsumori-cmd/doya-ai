/**
 * 管理者ユーザー作成スクリプト
 * 
 * 使用方法:
 * npx tsx src/scripts/create-admin.ts <username> <password> [email] [name]
 * 
 * 例:
 * npx tsx src/scripts/create-admin.ts admin SecureP@ssw0rd123 admin@example.com "管理者"
 */

import { hashPassword } from '../lib/admin-auth'
import { prisma } from '../lib/prisma'
import { validatePassword } from '../lib/admin-auth'

async function createAdmin() {
  const args = process.argv.slice(2)
  
  if (args.length < 2) {
    console.error('使用方法: npx tsx src/scripts/create-admin.ts <username> <password> [email] [name]')
    process.exit(1)
  }

  const username = args[0]
  const password = args[1]
  const email = args[2] || null
  const name = args[3] || null

  // パスワード検証
  const passwordValidation = validatePassword(password)
  if (!passwordValidation.valid) {
    console.error('❌ パスワード要件を満たしていません:')
    passwordValidation.errors.forEach(error => console.error(`  - ${error}`))
    process.exit(1)
  }

  try {
    // 既存ユーザーをチェック
    const existing = await prisma.adminUser.findUnique({
      where: { username },
    })

    if (existing) {
      console.error(`❌ ユーザー名 "${username}" は既に存在します`)
      process.exit(1)
    }

    // パスワードをハッシュ化
    const passwordHash = await hashPassword(password)

    // 管理者ユーザーを作成
    const adminUser = await prisma.adminUser.create({
      data: {
        username,
        passwordHash,
        email,
        name,
        isActive: true,
      },
    })

    console.log('✅ 管理者ユーザーが正常に作成されました:')
    console.log(`   ユーザー名: ${adminUser.username}`)
    console.log(`   メール: ${adminUser.email || '(未設定)'}`)
    console.log(`   名前: ${adminUser.name || '(未設定)'}`)
    console.log(`   ID: ${adminUser.id}`)
    
    await prisma.$disconnect()
  } catch (error) {
    console.error('❌ 管理者ユーザーの作成に失敗しました:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

createAdmin()

