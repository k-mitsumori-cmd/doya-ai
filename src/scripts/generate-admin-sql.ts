/**
 * 管理者ユーザー作成用SQL生成スクリプト
 * 
 * 使用方法:
 * npx tsx src/scripts/generate-admin-sql.ts <username> <password> [email] [name]
 * 
 * 出力されたSQLをSupabaseのSQL Editorで実行してください
 */

import bcrypt from 'bcryptjs'

async function generateSQL() {
  const args = process.argv.slice(2)
  
  if (args.length < 2) {
    console.error('使用方法: npx tsx src/scripts/generate-admin-sql.ts <username> <password> [email] [name]')
    process.exit(1)
  }

  const username = args[0]
  const password = args[1]
  const email = args[2] || null
  const name = args[3] || null

  // パスワードをハッシュ化
  const saltRounds = 12
  const passwordHash = await bcrypt.hash(password, saltRounds)

  // IDを生成（cuid形式をシミュレート）
  const id = `admin_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

  // SQL生成
  const sql = `
-- 管理者ユーザー作成SQL
-- このSQLをSupabaseのSQL Editorで実行してください

INSERT INTO "AdminUser" (id, username, "passwordHash", email, name, "isActive", "createdAt", "updatedAt")
VALUES (
  '${id}',
  '${username}',
  '${passwordHash}',
  ${email ? `'${email}'` : 'NULL'},
  ${name ? `'${name}'` : 'NULL'},
  true,
  NOW(),
  NOW()
)
ON CONFLICT (username) DO NOTHING;

-- 作成されたユーザーを確認
SELECT id, username, email, name, "isActive", "createdAt"
FROM "AdminUser"
WHERE username = '${username}';
`

  console.log('='.repeat(80))
  console.log('管理者ユーザー作成SQL')
  console.log('='.repeat(80))
  console.log(sql)
  console.log('='.repeat(80))
  console.log('\n⚠️  上記のSQLをSupabaseのSQL Editorで実行してください')
  console.log(`   ユーザー名: ${username}`)
  if (email) console.log(`   メール: ${email}`)
  if (name) console.log(`   名前: ${name}`)
}

generateSQL()

