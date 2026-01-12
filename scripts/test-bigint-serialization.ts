/**
 * BigIntシリアライゼーションテスト
 * 
 * このスクリプトは、BigIntがJSONレスポンスに正しく含まれるかをテストします
 */

// BigIntのシリアライゼーションをテスト
function testBigIntSerialization() {
  console.log('\n【BigIntシリアライゼーションテスト】')
  console.log('================================================================================')

  // テストケース1: BigIntを文字列に変換
  const testCases = [
    { name: '小さいファイルサイズ (100MB)', size: BigInt(100 * 1024 * 1024) },
    { name: '中サイズファイル (1GB)', size: BigInt(1024 * 1024 * 1024) },
    { name: '大サイズファイル (5GB)', size: BigInt(5 * 1024 * 1024 * 1024) },
    { name: '超大サイズファイル (10GB)', size: BigInt(10 * 1024 * 1024 * 1024) },
    { name: 'null値', size: null },
    { name: 'undefined値', size: undefined },
  ]

  let passed = 0
  let failed = 0

  for (const testCase of testCases) {
    try {
      // materialオブジェクトを模擬
      const material = {
        id: 'test-id',
        fileName: 'test.mp4',
        fileSize: testCase.size,
        fileUrl: 'https://example.com/test.mp4',
      }

      // BigIntを文字列に変換（修正後のロジック）
      const materialResponse = {
        ...material,
        fileSize: material.fileSize ? material.fileSize.toString() : null,
      }

      // JSON.stringifyでシリアライズできるかテスト
      const jsonString = JSON.stringify(materialResponse)
      const parsed = JSON.parse(jsonString)

      // 検証
      if (testCase.size === null || testCase.size === undefined) {
        if (parsed.fileSize === null) {
          console.log(`✓ ${testCase.name}: 成功 (null値)`)
          passed++
        } else {
          console.error(`✗ ${testCase.name}: 失敗 (期待: null, 実際: ${parsed.fileSize})`)
          failed++
        }
      } else {
        if (parsed.fileSize === testCase.size.toString()) {
          console.log(`✓ ${testCase.name}: 成功 (${parsed.fileSize})`)
          passed++
        } else {
          console.error(`✗ ${testCase.name}: 失敗 (期待: ${testCase.size.toString()}, 実際: ${parsed.fileSize})`)
          failed++
        }
      }
    } catch (error) {
      console.error(`✗ ${testCase.name}: エラー - ${error instanceof Error ? error.message : String(error)}`)
      failed++
    }
  }

  console.log('\n--------------------------------------------------------------------------------')
  console.log(`テスト結果: ${passed}件成功, ${failed}件失敗`)
  console.log('================================================================================\n')

  return failed === 0
}

// プラン解決ロジックのテスト
function testPlanResolution() {
  console.log('\n【プラン解決ロジックテスト】')
  console.log('================================================================================')

  const testCases = [
    {
      name: '統一プラン=ENTERPRISE, サブスクリプション=PRO → ENTERPRISE',
      unifiedPlan: 'ENTERPRISE',
      subscriptionPlan: 'PRO',
      expected: 'ENTERPRISE',
    },
    {
      name: '統一プラン=ENTERPRISE, サブスクリプション=null → ENTERPRISE',
      unifiedPlan: 'ENTERPRISE',
      subscriptionPlan: null,
      expected: 'ENTERPRISE',
    },
    {
      name: '統一プラン=PRO, サブスクリプション=ENTERPRISE → ENTERPRISE',
      unifiedPlan: 'PRO',
      subscriptionPlan: 'ENTERPRISE',
      expected: 'ENTERPRISE',
    },
    {
      name: '統一プラン=PRO, サブスクリプション=PRO → PRO',
      unifiedPlan: 'PRO',
      subscriptionPlan: 'PRO',
      expected: 'PRO',
    },
    {
      name: '統一プラン=PRO, サブスクリプション=null → PRO',
      unifiedPlan: 'PRO',
      subscriptionPlan: null,
      expected: 'PRO',
    },
    {
      name: '統一プラン=FREE, サブスクリプション=PRO → PRO',
      unifiedPlan: 'FREE',
      subscriptionPlan: 'PRO',
      expected: 'PRO',
    },
    {
      name: '統一プラン=FREE, サブスクリプション=null → FREE',
      unifiedPlan: 'FREE',
      subscriptionPlan: null,
      expected: 'FREE',
    },
  ]

  let passed = 0
  let failed = 0

  for (const testCase of testCases) {
    try {
      // プラン解決ロジック（/api/interview/plan/currentと同じ）
      let planToUse: string | null = null
      const unifiedPlanUpper = testCase.unifiedPlan ? testCase.unifiedPlan.toUpperCase().trim() : null
      const subscriptionPlanUpper = testCase.subscriptionPlan ? testCase.subscriptionPlan.toUpperCase().trim() : null

      if (unifiedPlanUpper === 'ENTERPRISE') {
        planToUse = 'ENTERPRISE'
      } else if (unifiedPlanUpper === 'PRO') {
        if (subscriptionPlanUpper === 'ENTERPRISE') {
          planToUse = 'ENTERPRISE'
        } else {
          planToUse = 'PRO'
        }
      } else {
        planToUse = testCase.subscriptionPlan || testCase.unifiedPlan
      }

      if (planToUse === testCase.expected) {
        console.log(`✓ ${testCase.name}: 成功 (${planToUse})`)
        passed++
      } else {
        console.error(`✗ ${testCase.name}: 失敗 (期待: ${testCase.expected}, 実際: ${planToUse})`)
        failed++
      }
    } catch (error) {
      console.error(`✗ ${testCase.name}: エラー - ${error instanceof Error ? error.message : String(error)}`)
      failed++
    }
  }

  console.log('\n--------------------------------------------------------------------------------')
  console.log(`テスト結果: ${passed}件成功, ${failed}件失敗`)
  console.log('================================================================================\n')

  return failed === 0
}

// メイン実行
function main() {
  console.log('================================================================================')
  console.log('エラーテスト/デバッグテスト開始')
  console.log('================================================================================')

  const results = [
    testBigIntSerialization(),
    testPlanResolution(),
  ]

  const allPassed = results.every(result => result === true)

  console.log('\n================================================================================')
  if (allPassed) {
    console.log('✓ すべてのテストが成功しました')
  } else {
    console.log('✗ 一部のテストが失敗しました')
  }
  console.log('================================================================================\n')

  process.exit(allPassed ? 0 : 1)
}

main()

