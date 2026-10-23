'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Columns2, GripVertical, MoveHorizontal, Pencil, RotateCcw, Scissors, Trash2, X } from 'lucide-react'
import { Math as MathTex } from '@/components/math'
import { RichText } from '@/components/rich-text'
import { QuestionImage } from '@/components/question-image'
import {
  MAX_PER_ROW,
  moveBlock,
  nudgeBlock,
  resolveRows,
  serializeLayout,
  splitSentences,
  toggleSideBySide,
  STYLE_LIMITS,
  cleanStyle,
  type BlockStyle,
  type DropTarget,
  type LayoutBlock,
  type QuestionLayout,
} from '@/lib/question-layout'
import type { Question } from '@/lib/test-data'

export type LayoutEdit = { prompt: string; layout: QuestionLayout | null }

type Props = {
  question: Question
  /** Math: figure + equations + prompt. Reading: the prompt only (figure lives in the passage pane). */
  withFigure: boolean
  /** Typography for prompt text blocks. */
  textClassName: string
  /** Admin preview: blocks become draggable / editable. */
  editable?: boolean
  onEdit?: (edit: LayoutEdit) => void
  /** Printing / PDF: figures without zoom buttons. */
  plain?: boolean
}

/**
 * A question's stimulus (prompt paragraphs, tables, figure, equations) drawn
 * from its saved layout — or, in the admin preview, a small block editor:
 * drag a block onto a gap to give it its own row, onto the left/right edge of
 * another block to put them side by side; ✎ edits text in place (a blank
 * line cuts the block in two), ✂ splits a paragraph into sentences.
 */
export function QuestionStimulus({ question, withFigure, textClassName, editable, onEdit, plain }: Props) {
  const { blocks, rows } = useMemo(
    () => resolveRows(question, withFigure),
    [question, withFigure],
  )

  /* ------------------------------- editor state ------------------------------ */
  const [dragId, setDragId] = useState<string | null>(null)
  const [hover, setHover] = useState<DropTarget | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  // Leaving edit mode / changing question cancels any half-finished action.
  useEffect(() => {
    setDragId(null)
    setHover(null)
    setEditingId(null)
  }, [editable, question.id, question.prompt])

  const styles = question.layout?.styles ?? {}

  function commit(
    nextRows: string[][],
    nextBlocks: Map<string, LayoutBlock> = blocks,
    img: { scale: number } | undefined = question.layout?.img,
    nextStyles: Record<string, BlockStyle> = styles,
  ) {
    if (!onEdit) return
    onEdit(serializeLayout(nextBlocks, nextRows, img, nextStyles, question.layout?.choiceImg))
  }

  /* ------------------- fine-tuning: margins, shift, size ------------------- */
  // While a handle is being dragged the value lives here; it is saved on release.
  const [live, setLiveState] = useState<{ id: string; style: BlockStyle } | null>(null)
  const liveRef = useRef<{ id: string; style: BlockStyle } | null>(null)
  const setLive = (v: { id: string; style: BlockStyle } | null) => {
    liveRef.current = v
    setLiveState(v)
  }
  const tune = useRef<{
    id: string
    prop: 'mt' | 'mb' | 'dx' | 'scale'
    x: number
    y: number
    start: BlockStyle
    width: number
    /** Horizontal shift only: the block's box and where the content sits at dx = 0 (for guides / snapping). */
    boxW?: number
    baseLeft?: number
  } | null>(null)
  /** Canva-style guides while shifting a figure / table / equation: gaps to both edges, centre line. */
  const [guide, setGuide] = useState<{ id: string; left: number; right: number; w: number; centered: boolean } | null>(null)

  const styleOf = (id: string): BlockStyle => (live?.id === id ? live.style : styles[id] ?? {})

  function setStyle(id: string, style: BlockStyle | undefined) {
    const next = { ...styles }
    const c = cleanStyle(style)
    if (c) next[id] = c
    else delete next[id]
    commit(rows, blocks, question.layout?.img, next)
  }

  function startTune(e: React.PointerEvent, id: string, prop: 'mt' | 'mb' | 'dx' | 'scale') {
    e.preventDefault()
    e.stopPropagation()
    const box = (e.currentTarget as HTMLElement).closest('[data-block]') as HTMLElement | null
    const content = box?.querySelector('[data-content]') as HTMLElement | null
    const br = box?.getBoundingClientRect()
    const cr = content?.getBoundingClientRect()
    const startDx = styles[id]?.dx ?? 0
    tune.current = {
      id,
      prop,
      x: e.clientX,
      y: e.clientY,
      start: { ...(styles[id] ?? {}) },
      width: Math.max(40, cr?.width ?? 200),
      boxW: br?.width,
      baseLeft: br && cr ? cr.left - br.left - startDx : undefined,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setLive({ id, style: { ...(styles[id] ?? {}) } })
  }

  function moveTune(e: React.PointerEvent) {
    const t = tune.current
    if (!t) return
    const dx = e.clientX - t.x
    const dy = e.clientY - t.y
    const st = { ...t.start }
    const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, Math.round(v)))
    if (t.prop === 'mt') st.mt = clamp((t.start.mt ?? 0) + dy, STYLE_LIMITS.margin)
    if (t.prop === 'mb') st.mb = clamp((t.start.mb ?? 0) + dy, STYLE_LIMITS.margin)
    if (t.prop === 'dx') {
      let v = clamp((t.start.dx ?? 0) + dx, STYLE_LIMITS.dx)
      if (t.boxW != null && t.baseLeft != null) {
        const SNAP = 6
        const w = t.width
        let left = t.baseLeft + v
        const centerDiff = left + w / 2 - t.boxW / 2
        let centered = false
        if (Math.abs(centerDiff) <= SNAP) {
          v = Math.round(v - centerDiff)
          centered = true
        } else if (Math.abs(left) <= SNAP) v = Math.round(-t.baseLeft)
        else if (Math.abs(t.boxW - (left + w)) <= SNAP) v = Math.round(t.boxW - w - t.baseLeft)
        left = t.baseLeft + v
        setGuide({ id: t.id, left: Math.max(0, left), right: Math.max(0, t.boxW - left - w), w, centered })
      }
      st.dx = v
    }
    if (t.prop === 'scale') {
      const s0 = t.start.scale ?? 1
      const next = (s0 * (t.width + dx)) / t.width
      st.scale = Math.round(Math.min(STYLE_LIMITS.scale[1], Math.max(STYLE_LIMITS.scale[0], next)) * 100) / 100
    }
    setLive({ id: t.id, style: st })
  }

  function endTune() {
    setGuide(null)
    const t = tune.current
    const last = liveRef.current
    tune.current = null
    setLive(null)
    if (!t || !last) return
    setStyle(t.id, last.style)
  }

  const tuneHandlers = { onPointerMove: moveTune, onPointerUp: endTune, onPointerCancel: endTune }

  // Pointer-down on a control inside a block (image resize handle, zoom
  // buttons) must not start dragging the whole block.
  const noDrag = useRef(false)

  function applyDrop(target: DropTarget) {
    if (!dragId) return
    const next = moveBlock(rows, dragId, target)
    setDragId(null)
    setHover(null)
    if (next !== rows) commit(next)
  }

  /** Text / table blocks of the prompt — at least one must stay (a question needs its sentence). */
  const textBlockCount = [...blocks.values()].filter((x) => x.kind === 'text' || x.kind === 'table').length

  /** Removes a whole text / table block (e.g. "Note: Figure not drawn to scale."). Asks first. */
  function deleteBlock(id: string) {
    const b = blocks.get(id)
    if (!b || (b.kind !== 'text' && b.kind !== 'table')) return
    if (textBlockCount <= 1) {
      window.alert("Bu savolning yagona matn bloki — uni o'chirib bo'lmaydi. Matnni tahrirlang (✎).")
      return
    }
    const preview = b.content.length > 90 ? `${b.content.slice(0, 90)}…` : b.content
    if (!window.confirm(`Shu blok butunlay o'chirilsinmi?\n\n«${preview}»\n\n(Saqlamaguningizcha bekor qilsa bo'ladi.)`)) return
    setEditingId(null)
    const nextRows = rows.map((r) => r.filter((x) => x !== id)).filter((r) => r.length > 0)
    const next = new Map(blocks)
    next.delete(id)
    commit(nextRows, next)
  }

  function saveText(id: string, text: string) {
    const b = blocks.get(id)
    setEditingId(null)
    if (!b || text === b.content) return
    // Emptied the whole box: that means "delete this block" — confirmed, never silently.
    if (!text.trim()) {
      deleteBlock(id)
      return
    }
    const next = new Map(blocks)
    next.set(id, { ...b, content: text })
    commit(rows, next)
  }

  function splitIntoSentences(id: string) {
    const b = blocks.get(id)
    if (!b) return
    const parts = splitSentences(b.content)
    if (parts.length < 2) return
    const next = new Map(blocks)
    next.set(id, { ...b, content: parts.join('\n\n') })
    commit(rows, next)
  }

  /* --------------------------------- render --------------------------------- */

  /** Content with its horizontal shift and (tables, equations) proportional size. */
  function renderShifted(b: LayoutBlock) {
    const st = styleOf(b.id)
    const scalable = b.kind === 'table' || b.kind === 'equation'
    return (
      <div
        data-content
        style={{
          transform: st.dx ? `translateX(clamp(-30vw, ${st.dx}px, 30vw))` : undefined,
          zoom: scalable && st.scale ? st.scale : undefined,
          width: scalable ? 'fit-content' : undefined,
          maxWidth: '100%',
          marginInline: b.kind === 'equation' || b.kind === 'table' ? 'auto' : undefined,
        }}
      >
        {renderBlockContent(b)}
      </div>
    )
  }

  function renderBlockContent(b: LayoutBlock) {
    if (b.kind === 'image') {
      return (
        <QuestionImage
          key={b.content}
          src={b.content}
          scale={question.layout?.img?.scale}
          editable={editable}
          plain={plain}
          onScaleChange={(scale) => commit(rows, blocks, { scale })}
        />
      )
    }
    if (b.kind === 'equation') {
      return (
        // Tighter than KaTeX's default 1em display margin — stacked equations
        // sat too far apart. Fine-tune further with the block's margin handles.
        <div className="my-0 flex justify-center [&_.katex-display]:!my-0.5">
          <MathTex tex={b.content} display className="text-[#111]" />
        </div>
      )
    }
    return (
      <div className={textClassName}>
        <RichText text={b.content} />
      </div>
    )
  }

  function renderBlock(b: LayoutBlock, rowLen: number) {
    const st = styleOf(b.id)
    const outer = { marginTop: st.mt || undefined, marginBottom: st.mb || undefined }
    if (!editable) {
      return (
        <div key={b.id} className={rowLen > 1 ? 'min-w-0 flex-1' : ''} style={outer}>
          {renderShifted(b)}
        </div>
      )
    }
    const tuning = live?.id === b.id ? tune.current?.prop : null
    const canShift = b.kind !== 'text'
    const canScale = b.kind === 'table' || b.kind === 'equation'
    const hasStyle = !!(st.mt || st.mb || st.dx || (st.scale && st.scale !== 1))

    const isEditing = editingId === b.id
    const isText = b.kind === 'text' || b.kind === 'table'
    const sideHover = hover?.kind === 'side' && hover.targetId === b.id ? hover.side : null
    const ri = rows.findIndex((r) => r.includes(b.id))
    const canJoin = rows[ri]?.length > 1 || (ri > 0 && rows[ri - 1].length < MAX_PER_ROW)

    return (
      <div
        key={b.id}
        data-block
        style={outer}
        className={`group/blk relative rounded-md border border-dashed px-2 transition-colors ${
          rowLen > 1 ? 'min-w-0 flex-1' : ''
        } ${dragId === b.id ? 'border-[#0e7c75] opacity-40' : 'border-[#9cc9c3] hover:border-[#0e7c75] hover:bg-[#f3fbf9]'}`}
        draggable={!isEditing}
        onPointerDownCapture={(e) => {
          noDrag.current = !!(e.target as HTMLElement).closest('[data-nodrag]')
        }}
        onDragStart={(e) => {
          if (noDrag.current) {
            e.preventDefault()
            return
          }
          setDragId(b.id)
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', b.id)
        }}
        onDragEnd={() => {
          setDragId(null)
          setHover(null)
        }}
        onDragOver={(e) => {
          if (!dragId || dragId === b.id) return
          e.preventDefault()
          const r = e.currentTarget.getBoundingClientRect()
          const x = (e.clientX - r.left) / r.width
          const fits = (rows[ri]?.length ?? 0) < MAX_PER_ROW || rows[ri]?.includes(dragId)
          if (fits && (x < 0.3 || x > 0.7)) {
            setHover({ kind: 'side', targetId: b.id, side: x < 0.3 ? 'left' : 'right' })
          } else {
            const y = (e.clientY - r.top) / r.height
            setHover({ kind: 'gap', rowIndex: y < 0.5 ? ri : ri + 1 })
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          if (hover) applyDrop(hover)
        }}
      >
        {sideHover && (
          <span
            className={`pointer-events-none absolute inset-y-0 w-1.5 rounded bg-[#0e7c75] ${
              sideHover === 'left' ? '-left-1' : '-right-1'
            }`}
          />
        )}

        {/* hover toolbar */}
        {!isEditing && (
          <div className="absolute -top-3 right-1 z-10 flex items-center gap-0.5 rounded-md border border-[#c7d6d4] bg-white px-0.5 py-0.5 opacity-0 shadow-sm transition-opacity group-hover/blk:opacity-100">
            <span className="cursor-grab px-0.5 text-[#64748b]" title="Sudrab olib boring">
              <GripVertical className="size-3.5" />
            </span>
            <ToolBtn title="Yuqoriga" onClick={() => commit(nudgeBlock(rows, b.id, -1))}>
              <ArrowUp className="size-3.5" />
            </ToolBtn>
            <ToolBtn title="Pastga" onClick={() => commit(nudgeBlock(rows, b.id, 1))}>
              <ArrowDown className="size-3.5" />
            </ToolBtn>
            <ToolBtn
              title={rows[ri]?.length > 1 ? 'Alohida qatorga' : 'Tepadagi blok yoniga'}
              disabled={!canJoin}
              onClick={() => commit(toggleSideBySide(rows, b.id))}
            >
              <Columns2 className="size-3.5" />
            </ToolBtn>
            {hasStyle && (
              <ToolBtn title="Masofa, surish va o'lchamni tiklash" onClick={() => setStyle(b.id, undefined)}>
                <RotateCcw className="size-3.5" />
              </ToolBtn>
            )}
            {isText && (
              <>
                <ToolBtn
                  title="Tahrirlash (bo'sh qator — blokni ikkiga bo'ladi)"
                  onClick={() => {
                    setDraft(b.content)
                    setEditingId(b.id)
                  }}
                >
                  <Pencil className="size-3.5" />
                </ToolBtn>
                {b.kind === 'text' && (
                  <ToolBtn title="Gaplarga ajratish (keyin keraksiz gapni alohida o'chirasiz)" onClick={() => splitIntoSentences(b.id)}>
                    <Scissors className="size-3.5" />
                  </ToolBtn>
                )}
                <ToolBtn title="Blokni butunlay o'chirish" disabled={textBlockCount <= 1} onClick={() => deleteBlock(b.id)} danger>
                  <Trash2 className="size-3.5" />
                </ToolBtn>
              </>
            )}
          </div>
        )}

        {/* Margin handles: drag the top / bottom edge up or down */}
        {!isEditing &&
          (['mt', 'mb'] as const).map((prop) => (
            <span
              key={prop}
              data-nodrag
              draggable={false}
              title={prop === 'mt' ? 'Tepadagi masofa — sudrang' : 'Pastdagi masofa — sudrang'}
              onPointerDown={(e) => startTune(e, b.id, prop)}
              {...tuneHandlers}
              className={`absolute left-1/2 z-10 flex h-2.5 w-12 -translate-x-1/2 cursor-ns-resize items-center justify-center rounded-full bg-[#0e7c75] transition-opacity ${
                prop === 'mt' ? '-top-1.5' : '-bottom-1.5'
              } ${tuning === prop ? 'opacity-100' : 'opacity-0 group-hover/blk:opacity-70 hover:!opacity-100'}`}
            >
              <span className="h-px w-6 bg-white/80" />
            </span>
          ))}

        {/* Horizontal shift handle (figure, table, equation) */}
        {!isEditing && canShift && (
          <span
            data-nodrag
            draggable={false}
            title="Chapga / o'ngga surish — sudrang"
            onPointerDown={(e) => startTune(e, b.id, 'dx')}
            {...tuneHandlers}
            className={`absolute -left-2.5 top-1/2 z-10 flex size-5 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-[#0e7c75] text-white shadow transition-opacity ${
              tuning === 'dx' ? 'opacity-100' : 'opacity-0 group-hover/blk:opacity-80 hover:!opacity-100'
            }`}
          >
            <MoveHorizontal className="size-3" />
          </span>
        )}

        {/* Proportional size handle (table, equation) */}
        {!isEditing && canScale && (
          <span
            data-nodrag
            draggable={false}
            title="Kattalashtirish / kichraytirish — sudrang"
            onPointerDown={(e) => startTune(e, b.id, 'scale')}
            {...tuneHandlers}
            className={`absolute -bottom-1.5 -right-1.5 z-10 size-3.5 cursor-nwse-resize rounded-sm border-2 border-white bg-[#0e7c75] shadow transition-opacity ${
              tuning === 'scale' ? 'opacity-100' : 'opacity-0 group-hover/blk:opacity-90 hover:!opacity-100'
            }`}
          />
        )}

        {/* Canva-style guides while shifting: distance to each edge, a magenta centre line when centred */}
        {guide?.id === b.id && (
          <span className="pointer-events-none absolute inset-0 z-20">
            {guide.centered && <span className="absolute inset-y-[-6px] left-1/2 w-0 border-l-[1.5px] border-dashed border-[#ec4899]" />}
            <span className="absolute top-1/2 h-0 border-t border-[#ec4899]" style={{ left: 0, width: guide.left }} />
            <span className="absolute top-1/2 h-0 border-t border-[#ec4899]" style={{ right: 0, width: guide.right }} />
            <span
              className="absolute top-1/2 -translate-x-1/2 -translate-y-[130%] rounded bg-[#ec4899] px-1 text-[10px] font-bold leading-4 text-white"
              style={{ left: Math.max(14, guide.left / 2) }}
            >
              {Math.round(guide.left)}
            </span>
            <span
              className="absolute top-1/2 translate-x-1/2 -translate-y-[130%] rounded bg-[#ec4899] px-1 text-[10px] font-bold leading-4 text-white"
              style={{ right: Math.max(14, guide.right / 2) }}
            >
              {Math.round(guide.right)}
            </span>
            {guide.centered && (
              <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full rounded bg-[#ec4899] px-1.5 text-[10px] font-bold leading-4 text-white">
                markaz
              </span>
            )}
          </span>
        )}

        {/* Live value while dragging */}
        {tuning && (
          <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-md bg-[#0b4f4a] px-2 py-1 text-[11px] font-bold text-white shadow-lg">
            {tuning === 'mt' && `Tepa: ${st.mt ?? 0}px`}
            {tuning === 'mb' && `Past: ${st.mb ?? 0}px`}
            {tuning === 'dx' && (guide?.centered ? 'Markazda' : `Surish: ${st.dx ?? 0}px`)}
            {tuning === 'scale' && `O'lcham: ${Math.round((st.scale ?? 1) * 100)}%`}
          </span>
        )}

        {isEditing ? (
          <TextBlockEditor
            value={draft}
            onChange={setDraft}
            onSave={() => saveText(b.id, draft)}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          renderShifted(b)
        )}
      </div>
    )
  }

  function renderGap(rowIndex: number) {
    if (!editable) return null
    const active = hover?.kind === 'gap' && hover.rowIndex === rowIndex
    return (
      <div
        key={`gap-${rowIndex}`}
        onDragOver={(e) => {
          if (!dragId) return
          e.preventDefault()
          setHover({ kind: 'gap', rowIndex })
        }}
        onDrop={(e) => {
          e.preventDefault()
          applyDrop({ kind: 'gap', rowIndex })
        }}
        className={`rounded transition-all ${
          dragId ? (active ? 'my-1 h-8 border-2 border-dashed border-[#0e7c75] bg-[#e3f4f1]' : 'h-3') : 'h-3'
        }`}
      />
    )
  }

  return (
    <div className={editable ? 'rounded-lg bg-white/60 p-1' : ''}>
      {rows.map((row, ri) => (
        <div key={row.join('+')}>
          {renderGap(ri)}
          {row.length === 1 ? (
            renderBlock(blocks.get(row[0])!, 1)
          ) : (
            <div className="my-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
              {row.map((id) => renderBlock(blocks.get(id)!, row.length))}
            </div>
          )}
          {!editable && ri < rows.length - 1 && <div className="h-2" />}
        </div>
      ))}
      {renderGap(rows.length)}
    </div>
  )
}

function ToolBtn({
  title,
  onClick,
  disabled,
  danger,
  children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded p-1 disabled:opacity-30 ${danger ? 'text-[#dc2626] hover:bg-[#fee2e2]' : 'text-[#0b4f4a] hover:bg-[#e3f4f1]'}`}
    >
      {children}
    </button>
  )
}

function TextBlockEditor({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return (
    <div className="flex flex-col gap-1.5 py-1">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel()
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSave()
        }}
        className="w-full resize-none rounded border border-[#0e7c75] bg-white px-2 py-1.5 font-mono text-[13px] leading-relaxed text-[#111] outline-none"
      />
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[11px] text-[#64748b]">
          Bo&apos;sh qator qoldirsangiz blok ikkiga bo&apos;linadi · hammasini o&apos;chirib saqlasangiz — blok o&apos;chadi · Ctrl+Enter — saqlash · Esc — bekor
        </span>
        <button
          type="button"
          onClick={() => onChange('')}
          className="rounded px-1.5 py-1 text-[11px] font-bold text-[#dc2626] hover:bg-[#fee2e2]"
          title="Matnni tozalash"
        >
          Tozalash
        </button>
        <button type="button" onClick={onCancel} className="rounded p-1 text-[#64748b] hover:bg-[#f1f5f9]" aria-label="Bekor qilish">
          <X className="size-4" />
        </button>
        <button type="button" onClick={onSave} className="rounded bg-[#0e7c75] p-1 text-white hover:bg-[#0b4f4a]" aria-label="Saqlash">
          <Check className="size-4" />
        </button>
      </div>
    </div>
  )
}
