'use client'

import { ArrowLeft, Eye, Globe, EyeOff, LayoutTemplate, Loader2, RotateCcw, Save, Undo2 } from 'lucide-react'

type Props = {
  published: boolean
  modules: { id: string; label: string }[]
  moduleIdx: number
  onModuleChange: (idx: number) => void
  editMode: boolean
  onToggleEdit: () => void
  /** The current question can be edited (it has a database id). */
  canEdit: boolean
  dirtyCount: number
  currentDirty: boolean
  onDiscardCurrent: () => void
  onResetCurrent: () => void
  saving: boolean
  onSave: () => void
  publishing: boolean
  onTogglePublish: () => void
  onBack: () => void
  message: { ok: boolean; text: string } | null
  /** Correct answer of the question on screen (letter, or the grid-in value); `missing` = not entered yet. */
  answer?: { text: string; missing: boolean }
  /** Questions of the whole mock that have no answer key — Publish stays locked while this is > 0. */
  missingKeys?: number
}

/**
 * Admin-only strip shown above the exam header in "Check it now" mode:
 * jump between modules, switch block-layout editing on, save, publish.
 */
export function PreviewBar(p: Props) {
  return (
    <div className="shrink-0 border-b border-[#0b4f4a] bg-[#0b4f4a] text-white">
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 sm:px-5">
        <button
          type="button"
          onClick={p.onBack}
          className="flex items-center gap-1 rounded px-1.5 py-1 text-[12px] font-semibold text-white/80 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="size-3.5" /> Admin
        </button>
        <span className="flex items-center gap-1 text-[12px] font-bold">
          <Eye className="size-3.5" /> Preview
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold tracking-wide ${
            p.published ? 'bg-[#22c55e] text-white' : 'bg-[#fbbf24] text-[#3b2a00]'
          }`}
        >
          {p.published ? 'PUBLISHED' : 'DRAFT'}
        </span>

        {p.modules.length > 1 && (
          <select
            value={p.moduleIdx}
            onChange={(e) => p.onModuleChange(Number(e.target.value))}
            className="rounded border border-white/30 bg-white/10 px-1.5 py-1 text-[12px] font-semibold text-white outline-none [&>option]:text-[#111]"
            aria-label="Modul"
          >
            {p.modules.map((m, i) => (
              <option key={m.id} value={i}>
                {m.label}
              </option>
            ))}
          </select>
        )}

        {p.answer && (
          <span
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-extrabold ${
              p.answer.missing ? 'bg-[#dc2626] text-white' : 'bg-white text-[#0b4f4a]'
            }`}
            title="To'g'ri javob (faqat admin ko'radi)"
          >
            To&apos;g&apos;ri javob: <span className="text-[13px]">{p.answer.text}</span>
          </span>
        )}
        {!!p.missingKeys && (
          <span className="rounded-full bg-[#fbbf24] px-2 py-0.5 text-[10.5px] font-extrabold text-[#3b2a00]">
            {p.missingKeys} ta savolda javob yo&apos;q
          </span>
        )}

        <button
          type="button"
          onClick={p.onToggleEdit}
          disabled={!p.canEdit}
          title={p.canEdit ? '' : "Bu savolni tahrirlab bo'lmaydi (bazada emas)"}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-bold transition-colors disabled:opacity-40 ${
            p.editMode ? 'bg-white text-[#0b4f4a]' : 'border border-white/40 text-white hover:bg-white/10'
          }`}
        >
          <LayoutTemplate className="size-3.5" />
          {p.editMode ? 'Tahrirlash: ON' : 'Joylashuvni tahrirlash'}
        </button>

        {p.editMode && p.canEdit && (
          <>
            <button
              type="button"
              onClick={p.onResetCurrent}
              title="Shu savolni standart tartibga qaytarish (rasm → tenglama → matn)"
              className="flex items-center gap-1 rounded px-1.5 py-1 text-[11.5px] font-semibold text-white/80 hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="size-3.5" /> Standart
            </button>
            {p.currentDirty && (
              <button
                type="button"
                onClick={p.onDiscardCurrent}
                title="Shu savoldagi saqlanmagan o'zgarishlarni bekor qilish"
                className="flex items-center gap-1 rounded px-1.5 py-1 text-[11.5px] font-semibold text-white/80 hover:bg-white/10 hover:text-white"
              >
                <Undo2 className="size-3.5" /> Bekor
              </button>
            )}
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {p.message && (
            <span className={`text-[11.5px] font-semibold ${p.message.ok ? 'text-[#a7f3d0]' : 'text-[#fecaca]'}`}>
              {p.message.text}
            </span>
          )}
          <button
            type="button"
            onClick={p.onSave}
            disabled={p.dirtyCount === 0 || p.saving}
            className="flex items-center gap-1.5 rounded-md border border-white/40 px-2.5 py-1 text-[12px] font-bold text-white hover:bg-white/10 disabled:opacity-40"
          >
            {p.saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Saqlash{p.dirtyCount > 0 ? ` (${p.dirtyCount})` : ''}
          </button>
          <button
            type="button"
            onClick={p.onTogglePublish}
            disabled={p.publishing || (!p.published && !!p.missingKeys)}
            title={!p.published && p.missingKeys ? `${p.missingKeys} ta savolda javob yo'q — avval javoblarni kiriting` : ''}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-[12px] font-extrabold disabled:opacity-50 ${
              p.published ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-[#22c55e] text-white hover:bg-[#16a34a]'
            }`}
          >
            {p.publishing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : p.published ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Globe className="size-3.5" />
            )}
            {p.published ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  )
}
