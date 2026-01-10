'use client'

import React, { useState } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GripVertical,
  Edit,
  Image as ImageIcon,
  RefreshCw,
  Download,
  X,
  Monitor,
  Smartphone,
  Loader2,
  Link2,
  Eye,
  EyeOff,
  Layers,
  MousePointer2,
  Frame,
  Type,
  Hand,
  ZoomIn,
  ExternalLink,
  Globe,
  FileDown,
  Settings,
} from 'lucide-react'
import { LpGenerationResult, LpSection, SectionImage } from '@/lib/lp-site/types'
import toast from 'react-hot-toast'

interface FigmaStyleEditorProps {
  result: LpGenerationResult
  selectedDevice: 'pc' | 'sp'
  onDeviceChange: (device: 'pc' | 'sp') => void
  onSectionsReorder: (newSections: LpSection[]) => void
  onSectionRegenerate: (sectionId: string) => Promise<void>
  onDownload: (type: string, sectionId?: string, imageData?: string) => void
  onSectionUpdate?: (sectionId: string, field: string, value: string) => void
  onPreview?: () => void
  onPublish?: () => void
}

interface LayerItemProps {
  section: LpSection
  index: number
  image?: SectionImage
  selectedDevice: 'pc' | 'sp'
  isSelected: boolean
  isVisible: boolean
  onSelect: () => void
  onToggleVisibility: () => void
}

function LayerItem({ section, index, image, selectedDevice, isSelected, isVisible, onSelect, onToggleVisibility }: LayerItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.section_id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const hasImage = selectedDevice === 'pc' ? !!image?.image_pc : !!image?.image_sp

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-100 text-blue-900'
          : 'hover:bg-slate-100 text-slate-700'
      } ${!isVisible ? 'opacity-40' : ''}`}
      onClick={onSelect}
    >
      <div
        {...attributes}
        {...listeners}
        className="w-4 h-4 flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleVisibility()
        }}
        className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600"
      >
        {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{section.headline || `セクション ${index + 1}`}</div>
        <div className="text-[10px] text-slate-500 truncate">{section.section_type}</div>
      </div>
      {hasImage && (
        <div className="w-4 h-4 rounded border border-slate-300 bg-white flex-shrink-0">
          <ImageIcon className="w-3 h-3 text-slate-400" />
        </div>
      )}
    </div>
  )
}

interface PropertyPanelProps {
  section: LpSection | null
  image?: SectionImage
  selectedDevice: 'pc' | 'sp'
  isRegenerating: boolean
  onRegenerate: () => void
  onDownload: () => void
  onFieldUpdate: (field: string, value: string) => void
  onSectionUpdate?: (sectionId: string, field: string, value: string) => void
}

function PropertyPanel({
  section,
  image,
  selectedDevice,
  isRegenerating,
  onRegenerate,
  onDownload,
  onFieldUpdate,
  onSectionUpdate,
}: PropertyPanelProps) {
  if (!section) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-sm">
        <div className="text-center">
          <MousePointer2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>セクションを選択してください</p>
        </div>
      </div>
    )
  }

  const imageData = selectedDevice === 'pc' ? image?.image_pc : image?.image_sp
  const hasImage = !!imageData

  const handleFieldUpdate = (field: string, value: string) => {
    onFieldUpdate(field, value)
    if (onSectionUpdate) {
      onSectionUpdate(section.section_id, field, value)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* セクション情報 */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900">セクション {section.section_id.slice(0, 8)}</h3>
          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">{section.section_type}</span>
        </div>
      </div>

      {/* 画像プレビュー */}
      {hasImage && (
        <div className="p-4 border-b border-slate-200">
          <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
            <img src={imageData} alt={section.headline} className="w-full h-auto" />
          </div>
        </div>
      )}

      {/* プロパティ */}
      <div className="p-4 space-y-4">
        {/* 見出し */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">見出し</label>
          <input
            type="text"
            value={section.headline}
            onChange={(e) => handleFieldUpdate('headline', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* サブ見出し */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">サブ見出し</label>
          <input
            type="text"
            value={section.sub_headline || ''}
            onChange={(e) => handleFieldUpdate('sub_headline', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* 目的 */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">目的</label>
          <textarea
            value={section.purpose}
            onChange={(e) => handleFieldUpdate('purpose', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
          />
        </div>

        {/* CTA設定 */}
        <div className="pt-2 border-t border-slate-200">
          <label className="block text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" />
            CTAボタン
          </label>
          <div className="space-y-2">
            <input
              type="text"
              value={section.cta_text || ''}
              onChange={(e) => handleFieldUpdate('cta_text', e.target.value)}
              placeholder="例: 今すぐ申し込む"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <input
              type="url"
              value={section.cta_link || ''}
              onChange={(e) => handleFieldUpdate('cta_link', e.target.value)}
              placeholder="https://example.com/cta"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
        </div>

        {/* アクション */}
        <div className="pt-2 border-t border-slate-200 space-y-2">
          {hasImage && (
            <>
              <button
                onClick={onRegenerate}
                disabled={isRegenerating}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRegenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>生成中...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>画像を再生成</span>
                  </>
                )}
              </button>
              <button
                onClick={onDownload}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>画像をダウンロード</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function FigmaStyleEditor({
  result,
  selectedDevice,
  onDeviceChange,
  onSectionsReorder,
  onSectionRegenerate,
  onDownload,
  onSectionUpdate,
  onPreview,
  onPublish,
}: FigmaStyleEditorProps) {
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [regeneratingSectionId, setRegeneratingSectionId] = useState<string | null>(null)
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set(result.sections.map(s => s.section_id)))
  const [zoom, setZoom] = useState(100)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const sections = result.sections
  const selectedSection = sections.find(s => s.section_id === selectedSectionId) || null
  const selectedImage = result.images.find(img => img.section_id === selectedSectionId)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex(s => s.section_id === active.id)
      const newIndex = sections.findIndex(s => s.section_id === over.id)
      const newSections = arrayMove(sections, oldIndex, newIndex)
      onSectionsReorder(newSections)
      toast.success('セクションの順序を変更しました')
    }
  }

  const handleSectionRegenerate = async (sectionId: string) => {
    setRegeneratingSectionId(sectionId)
    try {
      await onSectionRegenerate(sectionId)
      toast.success('画像を再生成しました')
    } catch (error) {
      toast.error('画像の再生成に失敗しました')
    } finally {
      setRegeneratingSectionId(null)
    }
  }

  const handleToggleVisibility = (sectionId: string) => {
    const newVisible = new Set(visibleSections)
    if (newVisible.has(sectionId)) {
      newVisible.delete(sectionId)
    } else {
      newVisible.add(sectionId)
    }
    setVisibleSections(newVisible)
  }

  // 表示可能なセクションのみをフィルタリング
  const visibleSectionsList = sections.filter(s => visibleSections.has(s.section_id))

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* 上部ツールバー */}
      <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          {/* ツール */}
          <div className="flex items-center gap-1 border-r border-slate-200 pr-4">
            <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600">
              <MousePointer2 className="w-4 h-4" />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600">
              <Frame className="w-4 h-4" />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600">
              <Type className="w-4 h-4" />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600">
              <Hand className="w-4 h-4" />
            </button>
          </div>

          {/* デバイス切り替え */}
          <div className="flex items-center gap-1 border-r border-slate-200 pr-4">
            <button
              onClick={() => onDeviceChange('pc')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                selectedDevice === 'pc'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDeviceChange('sp')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                selectedDevice === 'sp'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>

          {/* ズーム */}
          <div className="flex items-center gap-1 border-r border-slate-200 pr-4">
            <button
              onClick={() => setZoom(Math.max(25, zoom - 25))}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600"
            >
              <ZoomIn className="w-4 h-4 rotate-180" />
            </button>
            <span className="text-xs font-medium text-slate-700 min-w-[3rem] text-center">{zoom}%</span>
            <button
              onClick={() => setZoom(Math.min(200, zoom + 25))}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex items-center gap-2">
          {onPreview && (
            <button
              onClick={onPreview}
              className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              プレビュー
            </button>
          )}
          {onPublish && (
            <button
              onClick={onPublish}
              className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-1.5"
            >
              <Globe className="w-3.5 h-3.5" />
              公開
            </button>
          )}
          <button
            onClick={() => onDownload(selectedDevice === 'pc' ? 'all_pc' : 'all_sp')}
            className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition-colors flex items-center gap-1.5"
          >
            <FileDown className="w-3.5 h-3.5" />
            ダウンロード
          </button>
        </div>
      </div>

      {/* メインエリア */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左サイドバー：レイヤーパネル */}
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
          <div className="h-12 border-b border-slate-200 flex items-center px-4">
            <Layers className="w-4 h-4 text-slate-600 mr-2" />
            <span className="text-sm font-semibold text-slate-900">レイヤー</span>
            <span className="ml-auto text-xs text-slate-500">{sections.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sections.map(s => s.section_id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-0.5">
                    {sections.map((section, index) => {
                      const image = result.images.find(img => img.section_id === section.section_id)
                      return (
                        <LayerItem
                          key={section.section_id}
                          section={section}
                          index={index}
                          image={image}
                          selectedDevice={selectedDevice}
                          isSelected={selectedSectionId === section.section_id}
                          isVisible={visibleSections.has(section.section_id)}
                          onSelect={() => setSelectedSectionId(section.section_id)}
                          onToggleVisibility={() => handleToggleVisibility(section.section_id)}
                        />
                      )
                    })}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>

        {/* 中央キャンバス */}
        <div className="flex-1 overflow-auto bg-slate-100 flex items-center justify-center p-8">
          <div
            className="bg-white rounded-lg shadow-2xl"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'center',
              width: selectedDevice === 'pc' ? '1200px' : '414px',
              maxHeight: selectedDevice === 'pc' ? 'none' : '896px',
              transition: 'transform 0.2s',
            }}
          >
            {/* デバイスフレーム */}
            {selectedDevice === 'sp' && (
              <div className="relative bg-slate-900 rounded-[2.5rem] p-2">
                <div className="bg-white rounded-[2rem] overflow-hidden">
                  {/* ノッチ */}
                  <div className="h-8 bg-slate-900 rounded-t-[2rem] flex items-center justify-center">
                    <div className="w-32 h-6 bg-slate-900 rounded-full"></div>
                  </div>
                  <div className="overflow-y-auto" style={{ maxHeight: '896px' }}>
                    {visibleSectionsList.map((section) => {
                      const image = result.images.find(img => img.section_id === section.section_id)
                      const imageData = image?.image_sp
                      if (!imageData) return null
                      return (
                        <div
                          key={section.section_id}
                          className={`cursor-pointer transition-all ${
                            selectedSectionId === section.section_id
                              ? 'ring-4 ring-blue-500 ring-offset-2'
                              : 'hover:opacity-90'
                          }`}
                          onClick={() => setSelectedSectionId(section.section_id)}
                        >
                          <img src={imageData} alt={section.headline} className="w-full block" />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* PC表示 */}
            {selectedDevice === 'pc' && (
              <div className="overflow-y-auto" style={{ maxHeight: '80vh' }}>
                {visibleSectionsList.map((section) => {
                  const image = result.images.find(img => img.section_id === section.section_id)
                  const imageData = image?.image_pc
                  if (!imageData) return null
                  return (
                    <div
                      key={section.section_id}
                      className={`cursor-pointer transition-all ${
                        selectedSectionId === section.section_id
                          ? 'ring-4 ring-blue-500 ring-offset-2'
                          : 'hover:opacity-90'
                      }`}
                      onClick={() => setSelectedSectionId(section.section_id)}
                    >
                      <img src={imageData} alt={section.headline} className="w-full block" />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 右サイドバー：プロパティパネル */}
        <div className="w-80 bg-white border-l border-slate-200 flex flex-col flex-shrink-0">
          <div className="h-12 border-b border-slate-200 flex items-center px-4">
            <Settings className="w-4 h-4 text-slate-600 mr-2" />
            <span className="text-sm font-semibold text-slate-900">プロパティ</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <PropertyPanel
              section={selectedSection}
              image={selectedImage}
              selectedDevice={selectedDevice}
              isRegenerating={regeneratingSectionId === selectedSectionId}
              onRegenerate={() => handleSectionRegenerate(selectedSectionId!)}
              onDownload={() => {
                const imageData = selectedDevice === 'pc' ? selectedImage?.image_pc : selectedImage?.image_sp
                if (imageData) {
                  onDownload('single', selectedSectionId!, imageData)
                }
              }}
              onFieldUpdate={() => {}}
              onSectionUpdate={onSectionUpdate}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

