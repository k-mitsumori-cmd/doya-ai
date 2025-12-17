'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Save, Key, Bell, Shield, Database, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState({
    // API設定
    openaiApiKey: '••••••••••••••••••••••••••••••',
    openaiModel: 'gpt-4-turbo-preview',
    dalleModel: 'dall-e-3',
    
    // 制限設定
    freeDailyLimit: 5,
    premiumDailyLimit: -1, // -1 = 無制限
    maxInputLength: 2000,
    maxOutputLength: 4000,
    
    // 料金設定
    premiumPrice: 2980,
    
    // 通知設定
    emailNotifications: true,
    slackWebhook: '',
    
    // メンテナンス
    maintenanceMode: false,
    maintenanceMessage: 'システムメンテナンス中です。しばらくお待ちください。',
  })

  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    // 実際にはAPIで保存
    await new Promise((resolve) => setTimeout(resolve, 1000))
    toast.success('設定を保存しました')
    setIsSaving(false)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-gray-900 mb-2">
          システム設定
        </h1>
        <p className="text-gray-600">DOYA-AI の各種設定を管理します</p>
      </div>

      <div className="max-w-4xl space-y-8">
        {/* API設定 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Key className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">API設定</h2>
              <p className="text-sm text-gray-500">OpenAI APIの設定を管理します</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">OpenAI API Key</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={settings.openaiApiKey}
                  onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                  className="input-field flex-1"
                />
                <button className="btn-secondary">変更</button>
              </div>
              <p className="text-xs text-gray-400 mt-1">※ Vercel環境変数で設定することを推奨します</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">テキスト生成モデル</label>
                <select
                  value={settings.openaiModel}
                  onChange={(e) => setSettings({ ...settings, openaiModel: e.target.value })}
                  className="input-field"
                >
                  <option value="gpt-4-turbo-preview">GPT-4 Turbo (推奨)</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">画像生成モデル</label>
                <select
                  value={settings.dalleModel}
                  onChange={(e) => setSettings({ ...settings, dalleModel: e.target.value })}
                  className="input-field"
                >
                  <option value="dall-e-3">DALL-E 3 (推奨)</option>
                  <option value="dall-e-2">DALL-E 2</option>
                </select>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 制限設定 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">利用制限</h2>
              <p className="text-sm text-gray-500">プランごとの利用制限を設定します</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">フリープラン：1日の生成回数</label>
              <input
                type="number"
                value={settings.freeDailyLimit}
                onChange={(e) => setSettings({ ...settings, freeDailyLimit: parseInt(e.target.value) })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">プレミアム：1日の生成回数</label>
              <input
                type="number"
                value={settings.premiumDailyLimit}
                onChange={(e) => setSettings({ ...settings, premiumDailyLimit: parseInt(e.target.value) })}
                className="input-field"
                placeholder="-1 で無制限"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">入力文字数の上限</label>
              <input
                type="number"
                value={settings.maxInputLength}
                onChange={(e) => setSettings({ ...settings, maxInputLength: parseInt(e.target.value) })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">出力文字数の上限</label>
              <input
                type="number"
                value={settings.maxOutputLength}
                onChange={(e) => setSettings({ ...settings, maxOutputLength: parseInt(e.target.value) })}
                className="input-field"
              />
            </div>
          </div>
        </motion.div>

        {/* 料金設定 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-sm p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <Database className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">料金設定</h2>
              <p className="text-sm text-gray-500">プレミアムプランの料金を設定します</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">プレミアムプラン月額（円）</label>
              <input
                type="number"
                value={settings.premiumPrice}
                onChange={(e) => setSettings({ ...settings, premiumPrice: parseInt(e.target.value) })}
                className="input-field"
              />
              <p className="text-xs text-gray-400 mt-1">※ Stripeの価格設定と同期してください</p>
            </div>
          </div>
        </motion.div>

        {/* 通知設定 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-sm p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">通知設定</h2>
              <p className="text-sm text-gray-500">管理者への通知設定を管理します</p>
            </div>
          </div>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-gray-700">新規登録・課金時にメール通知を受け取る</span>
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Slack Webhook URL（オプション）</label>
              <input
                type="text"
                value={settings.slackWebhook}
                onChange={(e) => setSettings({ ...settings, slackWebhook: e.target.value })}
                className="input-field"
                placeholder="https://hooks.slack.com/services/..."
              />
            </div>
          </div>
        </motion.div>

        {/* メンテナンス */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl shadow-sm p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">メンテナンスモード</h2>
              <p className="text-sm text-gray-500">サービスを一時停止する場合に使用します</p>
            </div>
          </div>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.maintenanceMode}
                onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-gray-700">メンテナンスモードを有効にする</span>
            </label>
            {settings.maintenanceMode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">メンテナンスメッセージ</label>
                <textarea
                  value={settings.maintenanceMessage}
                  onChange={(e) => setSettings({ ...settings, maintenanceMessage: e.target.value })}
                  className="input-field resize-none"
                  rows={2}
                />
              </div>
            )}
          </div>
        </motion.div>

        {/* 保存ボタン */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary flex items-center gap-2"
          >
            {isSaving ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {isSaving ? '保存中...' : '設定を保存'}
          </button>
        </div>
      </div>
    </div>
  )
}


