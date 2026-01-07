'use client'

import { useState } from 'react'
import { 
  Settings, Globe, Bell, Shield, Database, Key, 
  Save, Loader2, CheckCircle, ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SERVICES } from '@/lib/services'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const [settings, setSettings] = useState({
    adminPassword: '',
    notifications: {
      newUser: true,
      upgrade: true,
      error: true,
      dailyReport: false,
    },
    security: {
      sessionTimeout: '24',
      ipWhitelist: '',
    },
  })

  const handleSave = async () => {
    setIsLoading(true)
    
    // モック保存処理
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    setIsLoading(false)
    setSaved(true)
    toast.success('設定を保存しました')
    
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="p-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Settings className="w-7 h-7 text-gray-600" />
            設定
          </h1>
          <p className="text-gray-600">管理ポータルの設定を管理</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isLoading}
          className={cn(
            "btn-primary",
            saved && "bg-emerald-600 hover:bg-emerald-700"
          )}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? '保存しました' : '設定を保存'}
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* メインコンテンツ */}
        <div className="lg:col-span-2 space-y-6">
          {/* サービス接続 */}
          <div className="card">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Globe className="w-5 h-5 text-gray-400" />
              サービス接続
            </h2>
            <div className="space-y-4">
              {SERVICES.map((service) => (
                <div key={service.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center text-2xl",
                      service.bgColor
                    )}>
                      {service.icon}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{service.name}</p>
                      <p className="text-sm text-gray-500 font-mono">{service.apiUrl}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-sm text-emerald-600">接続中</span>
                    </div>
                    <a
                      href={service.apiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 通知設定 */}
          <div className="card">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Bell className="w-5 h-5 text-gray-400" />
              通知設定
            </h2>
            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <div>
                  <p className="font-medium text-gray-900">新規ユーザー登録</p>
                  <p className="text-sm text-gray-500">新しいユーザーが登録したときに通知</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications.newUser}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, newUser: e.target.checked }
                  }))}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <div>
                  <p className="font-medium text-gray-900">プランアップグレード</p>
                  <p className="text-sm text-gray-500">ユーザーが有料プランにアップグレードしたときに通知</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications.upgrade}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, upgrade: e.target.checked }
                  }))}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <div>
                  <p className="font-medium text-gray-900">エラー通知</p>
                  <p className="text-sm text-gray-500">システムエラーが発生したときに通知</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications.error}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, error: e.target.checked }
                  }))}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <div>
                  <p className="font-medium text-gray-900">日次レポート</p>
                  <p className="text-sm text-gray-500">毎日のサマリーをメールで受信</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications.dailyReport}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, dailyReport: e.target.checked }
                  }))}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
            </div>
          </div>

          {/* セキュリティ設定 */}
          <div className="card">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Shield className="w-5 h-5 text-gray-400" />
              セキュリティ
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  セッションタイムアウト
                </label>
                <select
                  value={settings.security.sessionTimeout}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    security: { ...prev.security, sessionTimeout: e.target.value }
                  }))}
                  className="input-field"
                >
                  <option value="1">1時間</option>
                  <option value="8">8時間</option>
                  <option value="24">24時間</option>
                  <option value="168">1週間</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  管理者パスワード変更
                </label>
                <input
                  type="password"
                  value={settings.adminPassword}
                  onChange={(e) => setSettings(prev => ({ ...prev, adminPassword: e.target.value }))}
                  placeholder="新しいパスワードを入力"
                  className="input-field"
                />
                <p className="text-xs text-gray-500 mt-1">空欄の場合は変更しません</p>
              </div>
            </div>
          </div>
        </div>

        {/* サイドバー */}
        <div className="space-y-6">
          {/* システム情報 */}
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-gray-400" />
              システム情報
            </h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">バージョン</dt>
                <dd className="text-gray-900 font-mono">1.0.0</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">環境</dt>
                <dd className="text-gray-900">Production</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">管理サービス</dt>
                <dd className="text-gray-900">{SERVICES.length}個</dd>
              </div>
            </dl>
          </div>

          {/* API設定 */}
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-gray-400" />
              環境変数
            </h3>
            <div className="text-sm space-y-2">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">KANTAN_DOYA_API_URL</p>
                <p className="font-mono text-gray-900 text-xs truncate">
                  {process.env.NEXT_PUBLIC_KANTAN_DOYA_API_URL || 'http://localhost:3000'}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">DOYA_BANNER_API_URL</p>
                <p className="font-mono text-gray-900 text-xs truncate">
                  {process.env.NEXT_PUBLIC_DOYA_BANNER_API_URL || 'http://localhost:3001'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

