'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, AlertCircle, Loader2, ArrowLeft, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface EnvCheck {
  exists: boolean
  exactMatch: boolean
  similarNames: string[]
  valuePreview?: string
  valueLength?: number
}

interface CheckResult {
  status: 'ok' | 'error'
  message: string
  checks: Record<string, EnvCheck>
  summary: {
    allRequiredExist: boolean
    hasSimilarNames: boolean
    jsonValid: boolean
    jsonError: string | null
  }
  recommendations: string[]
}

export default function CheckEnvPage() {
  const [result, setResult] = useState<CheckResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkEnvironmentVariables()
  }, [])

  const checkEnvironmentVariables = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/interview/check-env')
      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '環境変数の確認中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (exists: boolean, exactMatch: boolean, similarNames: string[]) => {
    if (!exists) {
      return <XCircle className="w-5 h-5 text-red-500" />
    }
    if (similarNames.length > 0) {
      return <AlertCircle className="w-5 h-5 text-orange-500" />
    }
    if (exactMatch) {
      return <CheckCircle2 className="w-5 h-5 text-green-500" />
    }
    return <AlertCircle className="w-5 h-5 text-yellow-500" />
  }

  const getStatusText = (exists: boolean, exactMatch: boolean, similarNames: string[]) => {
    if (!exists) {
      return '設定されていません'
    }
    if (similarNames.length > 0) {
      return '環境変数名が一致していません'
    }
    if (exactMatch) {
      return '正しく設定されています'
    }
    return '確認が必要です'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/interview"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            インタビューページに戻る
          </Link>
          <h1 className="text-3xl font-black text-slate-900 mb-2">
            環境変数の設定確認
          </h1>
          <p className="text-slate-600">
            Google Cloud Storageの環境変数が正しく設定されているか確認します
          </p>
        </div>

        {/* ローディング */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
            <p className="text-slate-600">環境変数を確認中...</p>
          </div>
        )}

        {/* エラー */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-900 mb-2">エラーが発生しました</h3>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* 結果表示 */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* サマリー */}
            <div
              className={`rounded-2xl shadow-lg p-6 ${
                result.status === 'ok'
                  ? 'bg-green-50 border-2 border-green-200'
                  : 'bg-orange-50 border-2 border-orange-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.status === 'ok' ? (
                  <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h3
                    className={`font-bold mb-2 ${
                      result.status === 'ok' ? 'text-green-900' : 'text-orange-900'
                    }`}
                  >
                    {result.message}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">必須環境変数:</span>
                      <span
                        className={
                          result.summary.allRequiredExist ? 'text-green-700' : 'text-red-700'
                        }
                      >
                        {result.summary.allRequiredExist ? '✓ すべて設定済み' : '✗ 不足あり'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">環境変数名:</span>
                      <span
                        className={
                          !result.summary.hasSimilarNames ? 'text-green-700' : 'text-orange-700'
                        }
                      >
                        {!result.summary.hasSimilarNames
                          ? '✓ 完全一致'
                          : '⚠ 類似名あり'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">JSON形式:</span>
                      <span
                        className={
                          result.summary.jsonValid ? 'text-green-700' : 'text-red-700'
                        }
                      >
                        {result.summary.jsonValid ? '✓ 有効' : '✗ 無効'}
                      </span>
                    </div>
                    {result.summary.jsonError && (
                      <div className="text-red-700 text-xs mt-2">
                        エラー: {result.summary.jsonError}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 推奨事項 */}
            {result.recommendations.length > 0 && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
                <h3 className="font-bold text-blue-900 mb-3">推奨事項</h3>
                <ul className="space-y-2">
                  {result.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2 text-blue-800">
                      <span className="text-blue-500 mt-1">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 修正手順（環境変数名が間違っている場合） */}
            {result.summary.hasSimilarNames && (
              <div className="bg-orange-50 border-2 border-orange-300 rounded-2xl p-6">
                <h3 className="font-bold text-orange-900 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  修正手順
                </h3>
                <div className="space-y-4">
                  <div className="bg-white rounded-lg p-4 border border-orange-200">
                    <h4 className="font-semibold text-orange-900 mb-2">1. Vercelダッシュボードにアクセス</h4>
                    <p className="text-sm text-orange-800">
                      <a
                        href="https://vercel.com/dashboard"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:text-orange-700 underline"
                      >
                        https://vercel.com/dashboard
                      </a>
                      にログインしてください
                    </p>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 border border-orange-200">
                    <h4 className="font-semibold text-orange-900 mb-2">2. プロジェクトを選択</h4>
                    <p className="text-sm text-orange-800">プロジェクト一覧から <code className="bg-orange-100 px-2 py-1 rounded">doya-ai</code> を選択</p>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 border border-orange-200">
                    <h4 className="font-semibold text-orange-900 mb-2">3. 環境変数の設定画面を開く</h4>
                    <p className="text-sm text-orange-800">
                      <strong>Settings</strong> → <strong>Environment Variables</strong> をクリック
                    </p>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 border border-orange-200">
                    <h4 className="font-semibold text-orange-900 mb-2">4. 間違った環境変数を削除</h4>
                    <p className="text-sm text-orange-800 mb-2">以下の間違った環境変数名を探して削除してください：</p>
                    {Object.entries(result.checks).map(([varName, check]) => {
                      if (check.similarNames.length > 0) {
                        return (
                          <div key={varName} className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                            <p className="text-xs font-medium text-red-900 mb-1">削除する環境変数:</p>
                            {check.similarNames.map((name) => (
                              <code key={name} className="text-xs font-mono text-red-700 bg-red-100 px-2 py-1 rounded">
                                {name}
                              </code>
                            ))}
                          </div>
                        )
                      }
                      return null
                    })}
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 border border-orange-200">
                    <h4 className="font-semibold text-orange-900 mb-2">5. 正しい環境変数を追加</h4>
                    <p className="text-sm text-orange-800 mb-2">以下の正しい環境変数名で追加してください：</p>
                    {Object.entries(result.checks).map(([varName, check]) => {
                      if (check.similarNames.length > 0 || !check.exists) {
                        return (
                          <div key={varName} className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                            <p className="text-xs font-medium text-green-900 mb-1">追加する環境変数:</p>
                            <div className="space-y-2">
                              <div>
                                <code className="text-xs font-mono text-green-700 bg-green-100 px-2 py-1 rounded">
                                  {varName}
                                </code>
                                <p className="text-xs text-green-700 mt-1">
                                  {varName === 'GOOGLE_APPLICATION_CREDENTIALS' && (
                                    <>
                                      <strong>値:</strong> サービスアカウントキーのJSONを1行で貼り付け
                                      <br />
                                      <span className="text-[10px] text-green-600">
                                        （改行を含めず、JSONファイルの内容をそのまま貼り付けてください）
                                      </span>
                                    </>
                                  )}
                                  {varName === 'GOOGLE_CLOUD_PROJECT_ID' && (
                                    <>
                                      <strong>値:</strong> <code>gen-lang-client-0767544294</code>
                                    </>
                                  )}
                                  {varName === 'GCS_BUCKET_NAME' && (
                                    <>
                                      <strong>値:</strong> <code>doya-interview-storage</code>
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      }
                      return null
                    })}
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 border border-orange-200">
                    <h4 className="font-semibold text-orange-900 mb-2">6. 再デプロイ</h4>
                    <p className="text-sm text-orange-800">
                      環境変数を変更した後、<strong>必ず再デプロイ</strong>が必要です。
                      <br />
                      <strong>Deployments</strong> タブ → 最新のデプロイメントの <strong>...</strong> メニュー → <strong>Redeploy</strong>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 詳細チェック結果 */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="font-bold text-slate-900 mb-4">詳細チェック結果</h3>
              <div className="space-y-4">
                {/* 必須環境変数 */}
                <div>
                  <h4 className="font-semibold text-slate-700 mb-3">必須環境変数</h4>
                  <div className="space-y-3">
                    {['GOOGLE_CLOUD_PROJECT_ID', 'GCS_BUCKET_NAME', 'GOOGLE_APPLICATION_CREDENTIALS'].map(
                      (varName) => {
                        const check = result.checks[varName]
                        return (
                          <div
                            key={varName}
                            className="border border-slate-200 rounded-lg p-4 bg-slate-50"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(check.exists, check.exactMatch, check.similarNames)}
                                <code className="font-mono text-sm font-bold text-slate-900">
                                  {varName}
                                </code>
                              </div>
                              <span
                                className={`text-xs font-medium px-2 py-1 rounded ${
                                  check.exists && check.exactMatch && check.similarNames.length === 0
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {getStatusText(check.exists, check.exactMatch, check.similarNames)}
                              </span>
                            </div>
                            {check.exists && (
                              <div className="mt-2 text-sm text-slate-600">
                                {varName === 'GOOGLE_APPLICATION_CREDENTIALS' ? (
                                  <div>
                                    <div>長さ: {check.valueLength} 文字</div>
                                    <div className="mt-1 font-mono text-xs break-all">
                                      {check.valuePreview}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="font-mono text-xs">{check.valuePreview}</div>
                                )}
                              </div>
                            )}
                            {check.similarNames.length > 0 && (
                              <div className="mt-2 p-3 bg-red-50 rounded-lg border-2 border-red-300">
                                <div className="flex items-start gap-2 mb-2">
                                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <div className="text-xs font-bold text-red-900 mb-1">
                                      間違った環境変数名が設定されています
                                    </div>
                                    <div className="text-xs text-red-800 mb-2">
                                      以下の環境変数名を削除してください:
                                    </div>
                                    <ul className="space-y-1 mb-2">
                                      {check.similarNames.map((name) => (
                                        <li key={name} className="flex items-center gap-2">
                                          <XCircle className="w-3 h-3 text-red-600" />
                                          <code className="text-xs text-red-700 font-mono bg-red-100 px-2 py-0.5 rounded">
                                            {name}
                                          </code>
                                          <span className="text-xs text-red-600">（削除）</span>
                                        </li>
                                      ))}
                                    </ul>
                                    <div className="mt-2 pt-2 border-t border-red-200">
                                      <div className="text-xs font-bold text-green-800 mb-1">
                                        正しい環境変数名:
                                      </div>
                                      <code className="text-xs font-mono text-green-700 bg-green-100 px-2 py-1 rounded font-bold">
                                        {varName}
                                      </code>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      }
                    )}
                  </div>
                </div>

                {/* オプション環境変数 */}
                <div>
                  <h4 className="font-semibold text-slate-700 mb-3">オプション環境変数</h4>
                  <div className="space-y-3">
                    {['GCS_CLIENT_EMAIL', 'GCS_PRIVATE_KEY'].map((varName) => {
                      const check = result.checks[varName]
                      return (
                        <div
                          key={varName}
                          className="border border-slate-200 rounded-lg p-4 bg-slate-50"
                        >
                          <div className="flex items-center gap-2">
                            {check.exists ? (
                              <CheckCircle2 className="w-5 h-5 text-green-500" />
                            ) : (
                              <div className="w-5 h-5 text-slate-400">-</div>
                            )}
                            <code className="font-mono text-sm font-bold text-slate-900">
                              {varName}
                            </code>
                            <span className="text-xs text-slate-500">(オプション)</span>
                          </div>
                          {check.exists && (
                            <div className="mt-2 text-sm text-slate-600">
                              {varName === 'GCS_PRIVATE_KEY' ? (
                                <div>長さ: {check.valueLength} 文字</div>
                              ) : (
                                <div className="font-mono text-xs">{check.valuePreview}</div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 再確認ボタン */}
            <div className="text-center">
              <button
                onClick={checkEnvironmentVariables}
                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <Loader2 className="w-4 h-4" />
                再確認
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

