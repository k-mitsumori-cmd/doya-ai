#!/usr/bin/env tsx
/**
 * getUserPlan関数のテストスクリプト
 * 
 * プラン名の大文字小文字の違いが正しく処理されるかテストします
 */

import { getUserPlan, type InterviewPlan } from '../src/lib/interview/planLimits'

const testCases = [
  // ENTERPRISEプランのテスト（大文字小文字のバリエーション）
  {
    description: 'ENTERPRISE: 大文字',
    userId: 'test-user-1',
    guestId: null,
    userPlan: 'ENTERPRISE',
    expected: 'ENTERPRISE',
  },
  {
    description: 'ENTERPRISE: 小文字',
    userId: 'test-user-2',
    guestId: null,
    userPlan: 'enterprise',
    expected: 'ENTERPRISE',
  },
  {
    description: 'ENTERPRISE: 先頭大文字',
    userId: 'test-user-3',
    guestId: null,
    userPlan: 'Enterprise',
    expected: 'ENTERPRISE',
  },
  {
    description: 'ENTERPRISE: 混在',
    userId: 'test-user-4',
    guestId: null,
    userPlan: 'EnTeRpRiSe',
    expected: 'ENTERPRISE',
  },
  {
    description: 'ENTERPRISE: 前後に空白',
    userId: 'test-user-5',
    guestId: null,
    userPlan: '  ENTERPRISE  ',
    expected: 'ENTERPRISE',
  },
  // PROプランのテスト
  {
    description: 'PRO: 大文字',
    userId: 'test-user-6',
    guestId: null,
    userPlan: 'PRO',
    expected: 'PRO',
  },
  {
    description: 'PRO: 小文字',
    userId: 'test-user-7',
    guestId: null,
    userPlan: 'pro',
    expected: 'PRO',
  },
  {
    description: 'PRO: 先頭大文字',
    userId: 'test-user-8',
    guestId: null,
    userPlan: 'Pro',
    expected: 'PRO',
  },
  // FREEプランのテスト（デフォルト）
  {
    description: 'FREE: プランがnullの場合',
    userId: 'test-user-9',
    guestId: null,
    userPlan: null,
    expected: 'FREE',
  },
  {
    description: 'FREE: プランが空文字の場合',
    userId: 'test-user-10',
    guestId: null,
    userPlan: '',
    expected: 'FREE',
  },
  {
    description: 'FREE: 無効なプラン名の場合',
    userId: 'test-user-11',
    guestId: null,
    userPlan: 'INVALID',
    expected: 'FREE',
  },
  // ゲストユーザーのテスト
  {
    description: 'GUEST: ゲストIDがある場合',
    userId: null,
    guestId: 'test-guest-1',
    userPlan: null,
    expected: 'GUEST',
  },
  {
    description: 'GUEST: userIdとguestIdがない場合（デフォルト）',
    userId: null,
    guestId: null,
    userPlan: null,
    expected: 'GUEST',
  },
]

async function runTests() {
  console.log('='.repeat(80))
  console.log('getUserPlan関数のテスト開始')
  console.log('='.repeat(80))
  console.log()

  let totalTests = 0
  let passedTests = 0
  let failedTests = 0

  for (const test of testCases) {
    totalTests++
    
    try {
      // console.logを一時的に無効化
      const originalLog = console.log
      console.log = () => {} // ログを抑制
      
      const result = await getUserPlan(test.userId, test.guestId, test.userPlan)
      
      // console.logを復元
      console.log = originalLog

      if (result === test.expected) {
        passedTests++
        console.log(`✅ PASS: ${test.description}`)
        console.log(`   userId: ${test.userId || 'null'}, guestId: ${test.guestId || 'null'}, userPlan: ${test.userPlan || 'null'}`)
        console.log(`   結果: ${result} (期待値: ${test.expected})`)
      } else {
        failedTests++
        console.log(`❌ FAIL: ${test.description}`)
        console.log(`   userId: ${test.userId || 'null'}, guestId: ${test.guestId || 'null'}, userPlan: ${test.userPlan || 'null'}`)
        console.log(`   期待値: ${test.expected}, 実際: ${result}`)
      }
    } catch (error) {
      failedTests++
      console.log(`❌ ERROR: ${test.description}`)
      console.log(`   エラー: ${error}`)
    }
    console.log()
  }

  // テスト結果サマリー
  console.log('='.repeat(80))
  console.log('テスト結果サマリー')
  console.log('='.repeat(80))
  console.log(`総テスト数: ${totalTests}`)
  console.log(`✅ 成功: ${passedTests}`)
  console.log(`❌ 失敗: ${failedTests}`)
  console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(2)}%`)
  console.log('='.repeat(80))

  if (failedTests > 0) {
    console.error('\n❌ 一部のテストが失敗しました。')
    process.exit(1)
  } else {
    console.log('\n✅ すべてのテストが成功しました！')
    process.exit(0)
  }
}

// テスト実行
runTests()

