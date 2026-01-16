'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Plus, BarChart3, Target, TrendingUp, ArrowRight, Sparkles } from 'lucide-react'
import { StrategyProject } from '@prisma/client'

interface StrategyDashboardProps {
  projects: StrategyProject[]
  isLoggedIn: boolean
}

export function StrategyDashboard({ projects, isLoggedIn }: StrategyDashboardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const categories = [
    { id: 'all', label: 'すべて', count: projects.length },
    { id: 'draft', label: '下書き', count: projects.filter((p) => p.status === 'DRAFT').length },
    { id: 'generated', label: '生成済み', count: projects.filter((p) => p.status === 'GENERATED').length },
    { id: 'completed', label: '完了', count: projects.filter((p) => p.status === 'COMPLETED').length },
  ]

  const filteredProjects = selectedCategory
    ? selectedCategory === 'all'
      ? projects
      : projects.filter((p) => p.status === selectedCategory.toUpperCase())
    : projects

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-black text-slate-900 mb-2">戦略ダッシュボード</h1>
            <p className="text-sm text-slate-600">マーケティング戦略を構造化・可視化・再利用</p>
          </div>
          <span className="px-2 py-1 bg-amber-500 text-white text-xs font-black rounded-md shadow-sm">
            ベータ版
          </span>
        </div>
        <div className="flex gap-3">
          <Link
            href="/strategy/swipe"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg shadow-purple-500/20"
          >
            <Sparkles className="w-5 h-5" />
            スワイプで戦略を決める
          </Link>
          <Link
            href="/strategy/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus className="w-5 h-5" />
            新規戦略作成
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Target className="w-6 h-6 text-indigo-600" />
            </div>
            <span className="text-2xl font-black text-slate-900">{projects.length}</span>
          </div>
          <p className="text-sm font-semibold text-slate-600">戦略プロジェクト</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-2xl font-black text-slate-900">
              {projects.filter((p) => p.status === 'GENERATED' || p.status === 'COMPLETED').length}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-600">生成済み戦略</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-2xl font-black text-slate-900">
              {projects.filter((p) => p.status === 'COMPLETED').length}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-600">完了済み</p>
        </motion.div>
      </div>

      {/* Categories Filter (TVer風) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id === 'all' ? null : category.id)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
              (selectedCategory === null && category.id === 'all') ||
              (selectedCategory === category.id && category.id !== 'all')
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {category.label} ({category.count})
          </button>
        ))}
      </div>

      {/* Projects Grid (TVer風のグリッド表示) */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-indigo-600" />
          </div>
          <h3 className="text-lg font-black text-slate-900 mb-2">戦略プロジェクトがありません</h3>
          <p className="text-sm text-slate-600 mb-6">新規戦略を作成して、マーケティング戦略を構造化しましょう</p>
          <Link
            href="/strategy/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg"
          >
            <Plus className="w-5 h-5" />
            新規戦略作成
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-all cursor-pointer group"
            >
              <Link href={`/strategy/${project.id}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-black text-slate-900 mb-1 truncate">
                      {project.title || '無題の戦略'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {new Date(project.createdAt).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  <div
                    className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                      project.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : project.status === 'GENERATED'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {project.status === 'COMPLETED' ? '完了' : project.status === 'GENERATED' ? '生成済み' : '下書き'}
                  </div>
                </div>
                {project.description && (
                  <p className="text-sm text-slate-600 mb-4 line-clamp-2">{project.description}</p>
                )}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <BarChart3 className="w-4 h-4" />
                    <span>戦略を表示</span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
