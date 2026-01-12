#!/usr/bin/env tsx
/**
 * プラン別制限のテストスクリプト
 * 
 * 各プラン（GUEST、FREE、PRO、ENTERPRISE）で
 * - ファイルサイズ制限が正しく適用されるか
 * - 動画ファイルが許可されているか
 * - 音声ファイルの制限が正しいか
 * をテストします
 */

import {
  PLAN_LIMITS,
  getMaxFileSize,
  isFileSizeWithinLimit,
  getEffectivePlan,
  type InterviewPlan,
} from '../src/lib/interview/planLimits'

// テストケース定義
const testCases = [
  // GUESTプランのテスト
  {
    plan: 'GUEST' as InterviewPlan,
    tests: [
      {
        description: 'GUEST: 100MBの音声ファイルは許可',
        fileSize: 100 * 1024 * 1024, // 100MB
        isVideoFile: false,
        expected: true,
      },
      {
        description: 'GUEST: 101MBの音声ファイルは拒否',
        fileSize: 101 * 1024 * 1024, // 101MB
        isVideoFile: false,
        expected: false,
      },
      {
        description: 'GUEST: 10MBの動画ファイルは拒否（動画不可）',
        fileSize: 10 * 1024 * 1024, // 10MB
        isVideoFile: true,
        expected: false,
      },
      {
        description: 'GUEST: 1GBの動画ファイルは拒否（動画不可）',
        fileSize: 1 * 1024 * 1024 * 1024, // 1GB
        isVideoFile: true,
        expected: false,
      },
    ],
  },
  // FREEプランのテスト
  {
    plan: 'FREE' as InterviewPlan,
    tests: [
      {
        description: 'FREE: 1GBの音声ファイルは許可',
        fileSize: 1 * 1024 * 1024 * 1024, // 1GB
        isVideoFile: false,
        expected: true,
      },
      {
        description: 'FREE: 1.1GBの音声ファイルは拒否',
        fileSize: 1.1 * 1024 * 1024 * 1024, // 1.1GB
        isVideoFile: false,
        expected: false,
      },
      {
        description: 'FREE: 10MBの動画ファイルは拒否（動画不可）',
        fileSize: 10 * 1024 * 1024, // 10MB
        isVideoFile: true,
        expected: false,
      },
      {
        description: 'FREE: 5GBの動画ファイルは拒否（動画不可）',
        fileSize: 5 * 1024 * 1024 * 1024, // 5GB
        isVideoFile: true,
        expected: false,
      },
    ],
  },
  // PROプランのテスト
  {
    plan: 'PRO' as InterviewPlan,
    tests: [
      {
        description: 'PRO: 5GBの音声ファイルは許可',
        fileSize: 5 * 1024 * 1024 * 1024, // 5GB
        isVideoFile: false,
        expected: true,
      },
      {
        description: 'PRO: 5.1GBの音声ファイルは拒否',
        fileSize: 5.1 * 1024 * 1024 * 1024, // 5.1GB
        isVideoFile: false,
        expected: false,
      },
      {
        description: 'PRO: 5GBの動画ファイルは許可（動画可）',
        fileSize: 5 * 1024 * 1024 * 1024, // 5GB
        isVideoFile: true,
        expected: true,
      },
      {
        description: 'PRO: 5.1GBの動画ファイルは拒否',
        fileSize: 5.1 * 1024 * 1024 * 1024, // 5.1GB
        isVideoFile: true,
        expected: false,
      },
      {
        description: 'PRO: 1GBの動画ファイルは許可',
        fileSize: 1 * 1024 * 1024 * 1024, // 1GB
        isVideoFile: true,
        expected: true,
      },
    ],
  },
  // ENTERPRISEプランのテスト
  {
    plan: 'ENTERPRISE' as InterviewPlan,
    tests: [
      {
        description: 'ENTERPRISE: 10GBの音声ファイルは許可',
        fileSize: 10 * 1024 * 1024 * 1024, // 10GB
        isVideoFile: false,
        expected: true,
      },
      {
        description: 'ENTERPRISE: 10.1GBの音声ファイルは拒否',
        fileSize: 10.1 * 1024 * 1024 * 1024, // 10.1GB
        isVideoFile: false,
        expected: false,
      },
      {
        description: 'ENTERPRISE: 10GBの動画ファイルは許可（動画可）',
        fileSize: 10 * 1024 * 1024 * 1024, // 10GB
        isVideoFile: true,
        expected: true,
      },
      {
        description: 'ENTERPRISE: 10.1GBの動画ファイルは拒否',
        fileSize: 10.1 * 1024 * 1024 * 1024, // 10.1GB
        isVideoFile: true,
        expected: false,
      },
      {
        description: 'ENTERPRISE: 5GBの動画ファイルは許可',
        fileSize: 5 * 1024 * 1024 * 1024, // 5GB
        isVideoFile: true,
        expected: true,
      },
    ],
  },
]

// ゲストユーザーの1時間使い放題機能のテスト
const guestUnlimitedTests = [
  {
    description: 'GUEST: 1時間以内の場合、ENTERPRISE制限を適用',
    plan: 'GUEST' as InterviewPlan,
    guestFirstAccessAt: new Date(Date.now() - 30 * 60 * 1000), // 30分前
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB
    isVideoFile: true,
    expected: true,
  },
  {
    description: 'GUEST: 1時間以内の場合、10GB動画ファイルは許可',
    plan: 'GUEST' as InterviewPlan,
    guestFirstAccessAt: new Date(Date.now() - 45 * 60 * 1000), // 45分前
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB
    isVideoFile: true,
    expected: true,
  },
  {
    description: 'GUEST: 1時間超過の場合、通常のGUEST制限を適用',
    plan: 'GUEST' as InterviewPlan,
    guestFirstAccessAt: new Date(Date.now() - 61 * 60 * 1000), // 61分前
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB
    isVideoFile: true,
    expected: false,
  },
  {
    description: 'GUEST: 1時間超過の場合、100MB音声ファイルは許可',
    plan: 'GUEST' as InterviewPlan,
    guestFirstAccessAt: new Date(Date.now() - 61 * 60 * 1000), // 61分前
    fileSize: 100 * 1024 * 1024, // 100MB
    isVideoFile: false,
    expected: true,
  },
]

// テスト実行関数
function runTests() {
  console.log('='.repeat(80))
  console.log('プラン別制限テスト開始')
  console.log('='.repeat(80))
  console.log()

  let totalTests = 0
  let passedTests = 0
  let failedTests = 0

  // 各プランのテストを実行
  for (const planTest of testCases) {
    console.log(`\n【${planTest.plan}プランのテスト】`)
    console.log('-'.repeat(80))

    for (const test of planTest.tests) {
      totalTests++
      const maxFileSize = getMaxFileSize(planTest.plan, test.isVideoFile)
      const result = isFileSizeWithinLimit(test.fileSize, planTest.plan, test.isVideoFile)
      const fileSizeGB = (test.fileSize / 1024 / 1024 / 1024).toFixed(2)
      const maxSizeGB = (maxFileSize / 1024 / 1024 / 1024).toFixed(2)

      if (result === test.expected) {
        passedTests++
        console.log(`✅ PASS: ${test.description}`)
        console.log(`   ファイルサイズ: ${fileSizeGB}GB, 最大サイズ: ${maxSizeGB}GB, 動画: ${test.isVideoFile ? 'Yes' : 'No'}`)
      } else {
        failedTests++
        console.log(`❌ FAIL: ${test.description}`)
        console.log(`   期待値: ${test.expected ? '許可' : '拒否'}, 実際: ${result ? '許可' : '拒否'}`)
        console.log(`   ファイルサイズ: ${fileSizeGB}GB, 最大サイズ: ${maxSizeGB}GB, 動画: ${test.isVideoFile ? 'Yes' : 'No'}`)
      }
    }
  }

  // ゲストユーザーの1時間使い放題機能のテスト
  console.log(`\n【ゲストユーザーの1時間使い放題機能のテスト】`)
  console.log('-'.repeat(80))

  for (const test of guestUnlimitedTests) {
    totalTests++
    const effectivePlan = getEffectivePlan(test.plan, test.guestFirstAccessAt)
    const maxFileSize = getMaxFileSize(effectivePlan, test.isVideoFile)
    const result = isFileSizeWithinLimit(test.fileSize, effectivePlan, test.isVideoFile)
    const fileSizeGB = (test.fileSize / 1024 / 1024 / 1024).toFixed(2)
    const maxSizeGB = (maxFileSize / 1024 / 1024 / 1024).toFixed(2)
    const elapsedMinutes = Math.floor((Date.now() - test.guestFirstAccessAt.getTime()) / (60 * 1000))

    if (result === test.expected) {
      passedTests++
      console.log(`✅ PASS: ${test.description}`)
      console.log(`   経過時間: ${elapsedMinutes}分, 有効プラン: ${effectivePlan}`)
      console.log(`   ファイルサイズ: ${fileSizeGB}GB, 最大サイズ: ${maxSizeGB}GB, 動画: ${test.isVideoFile ? 'Yes' : 'No'}`)
    } else {
      failedTests++
      console.log(`❌ FAIL: ${test.description}`)
      console.log(`   期待値: ${test.expected ? '許可' : '拒否'}, 実際: ${result ? '許可' : '拒否'}`)
      console.log(`   経過時間: ${elapsedMinutes}分, 有効プラン: ${effectivePlan}`)
      console.log(`   ファイルサイズ: ${fileSizeGB}GB, 最大サイズ: ${maxSizeGB}GB, 動画: ${test.isVideoFile ? 'Yes' : 'No'}`)
    }
  }

  // プラン制限の定義確認
  console.log(`\n【プラン制限の定義確認】`)
  console.log('-'.repeat(80))
  for (const plan of ['GUEST', 'FREE', 'PRO', 'ENTERPRISE'] as InterviewPlan[]) {
    const limits = PLAN_LIMITS[plan]
    console.log(`${plan}:`)
    console.log(`  最大ファイルサイズ: ${(limits.maxFileSize / 1024 / 1024 / 1024).toFixed(2)}GB`)
    console.log(`  最大動画ファイルサイズ: ${(limits.maxVideoFileSize / 1024 / 1024 / 1024).toFixed(2)}GB`)
    console.log(`  最大音声ファイルサイズ: ${(limits.maxAudioFileSize / 1024 / 1024 / 1024).toFixed(2)}GB`)
    console.log(`  動画ファイル許可: ${limits.maxVideoFileSize > 0 ? 'Yes' : 'No'}`)
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

