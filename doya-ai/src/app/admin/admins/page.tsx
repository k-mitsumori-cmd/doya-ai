'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Shield, UserPlus, Mail, Key, Check, X, Edit3, 
  Trash2, ToggleLeft, ToggleRight, RefreshCw, AlertCircle
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

interface AdminUser {
  id: string
  username: string
  email: string | null
  name: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

export default function AdminAccountsPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // フォーム状態
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    name: '',
    password: '',
    confirmPassword: '',
  })

  // 管理者一覧を取得
  const fetchAdmins = async () => {
    try {
      const res = await fetch('/api/admin/admin-users', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setAdmins(data)
      } else {
        toast.error('管理者一覧の取得に失敗しました')
      }
    } catch (error) {
      console.error('Fetch admins error:', error)
      toast.error('エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAdmins()
  }, [])

  // 管理者を追加
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('パスワードが一致しません')
      return
    }

    if (formData.password.length < 12) {
      toast.error('パスワードは12文字以上必要です')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: formData.username,
          email: formData.email || null,
          name: formData.name || null,
          password: formData.password,
        }),
      })

      if (res.ok) {
        toast.success('管理者を追加しました')
        setShowAddModal(false)
        setFormData({ username: '', email: '', name: '', password: '', confirmPassword: '' })
        fetchAdmins()
      } else {
        const data = await res.json()
        toast.error(data.error || '追加に失敗しました')
      }
    } catch (error) {
      console.error('Add admin error:', error)
      toast.error('エラーが発生しました')
    } finally {
      setIsSaving(false)
    }
  }

  // 管理者を更新（有効/無効切り替え）
  const handleToggleActive = async (admin: AdminUser) => {
    try {
      const res = await fetch(`/api/admin/admin-users/${admin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !admin.isActive }),
      })

      if (res.ok) {
        toast.success(admin.isActive ? '管理者を無効化しました' : '管理者を有効化しました')
        fetchAdmins()
      } else {
        toast.error('更新に失敗しました')
      }
    } catch (error) {
      console.error('Toggle admin error:', error)
      toast.error('エラーが発生しました')
    }
  }

  // パスワードリセット
  const handleResetPassword = async (admin: AdminUser) => {
    const newPassword = prompt('新しいパスワードを入力してください（12文字以上、大文字・小文字・数字・記号を含む）')
    if (!newPassword) return

    if (newPassword.length < 12) {
      toast.error('パスワードは12文字以上必要です')
      return
    }

    try {
      const res = await fetch(`/api/admin/admin-users/${admin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: newPassword }),
      })

      if (res.ok) {
        toast.success('パスワードをリセットしました')
      } else {
        const data = await res.json()
        toast.error(data.error || 'パスワードリセットに失敗しました')
      }
    } catch (error) {
      console.error('Reset password error:', error)
      toast.error('エラーが発生しました')
    }
  }

  // 管理者を削除
  const handleDeleteAdmin = async (admin: AdminUser) => {
    if (!confirm(`管理者「${admin.username}」を削除しますか？この操作は取り消せません。`)) return

    try {
      const res = await fetch(`/api/admin/admin-users/${admin.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (res.ok) {
        toast.success('管理者を削除しました')
        fetchAdmins()
      } else {
        const data = await res.json()
        toast.error(data.error || '削除に失敗しました')
      }
    } catch (error) {
      console.error('Delete admin error:', error)
      toast.error('エラーが発生しました')
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('ja-JP')
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white p-8">
      <Toaster position="top-right" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              管理者アカウント
            </h1>
            <p className="text-white/40 mt-1">管理画面にログインできる管理者を管理します</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            <UserPlus className="w-5 h-5" />
            管理者を追加
          </button>
        </div>

        {/* Admin List */}
        <div className="bg-white/[0.02] backdrop-blur rounded-2xl border border-white/5 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-violet-400" />
              <p className="mt-4 text-white/40">読み込み中...</p>
            </div>
          ) : admins.length === 0 ? (
            <div className="p-12 text-center">
              <Shield className="w-12 h-12 mx-auto text-white/20" />
              <p className="mt-4 text-white/40">管理者が登録されていません</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b border-white/5">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase">ユーザー</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase">メール</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase">ステータス</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase">最終ログイン</th>
                  <th className="text-center px-6 py-4 text-xs font-medium text-white/40 uppercase">操作</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                          <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{admin.name || admin.username}</p>
                          <p className="text-xs text-white/40">@{admin.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-white/60">
                      {admin.email || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        admin.isActive 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {admin.isActive ? (
                          <>
                            <Check className="w-3 h-3" />
                            有効
                          </>
                        ) : (
                          <>
                            <X className="w-3 h-3" />
                            無効
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-white/40 text-sm">
                      {formatDate(admin.lastLoginAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleToggleActive(admin)}
                          className={`p-2 rounded-lg transition-colors ${
                            admin.isActive 
                              ? 'hover:bg-amber-500/10 text-amber-400' 
                              : 'hover:bg-emerald-500/10 text-emerald-400'
                          }`}
                          title={admin.isActive ? '無効化' : '有効化'}
                        >
                          {admin.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => handleResetPassword(admin)}
                          className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
                          title="パスワードリセット"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAdmin(admin)}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-red-400/50 hover:text-red-400 transition-colors"
                          title="削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* セキュリティ情報 */}
        <div className="mt-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-400">セキュリティに関する注意</h3>
              <ul className="mt-2 text-sm text-amber-400/70 space-y-1">
                <li>• パスワードは12文字以上、大文字・小文字・数字・記号を含めてください</li>
                <li>• 不要な管理者アカウントは削除または無効化してください</li>
                <li>• 定期的にパスワードを変更することを推奨します</li>
              </ul>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Add Admin Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1a1a24] rounded-2xl border border-white/10 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">管理者を追加</h2>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-white/60" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddAdmin} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">
                    ユーザー名 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500"
                    placeholder="admin"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500"
                    placeholder="admin@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">
                    表示名
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500"
                    placeholder="管理者 太郎"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">
                    パスワード <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500"
                    placeholder="••••••••••••"
                    required
                    minLength={12}
                  />
                  <p className="text-xs text-white/40 mt-1">12文字以上、大文字・小文字・数字・記号を含む</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">
                    パスワード確認 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500"
                    placeholder="••••••••••••"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-xl font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSaving ? '追加中...' : '管理者を追加'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}





