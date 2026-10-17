'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Eye, EyeOff, ImagePlus, Loader2, X } from 'lucide-react'
import { validateQuestions, countUnanswered } from '@/lib/admin-schema'
import { Math as MathTex } from '@/components/math'
import type { Question } from '@/lib/test-data'

/**
 * One module's question-import box: a JSON textarea plus, once the JSON is
 * valid, a row of "N-savol" buttons (one per parsed question, purely by
 * array position — never a typed-in id) that open a small per-question
 * image uploader. A question nobody clicks stays "no figure"; there is no
 * separate step to declare that. This mirrors the exact flow described in
 * the admin panel spec: paste JSON -> pick which numbered questions have a
 * diagram -> upload just those.
 */
/** Images are keyed by the question's prompt text (not its array position),
 *  so editing / reordering the JSON keeps every picture on its own question. */
function makeKeys(arr: Question[]): string[] {
  const seen: Record<string, number> = {}
  return arr.map((q, i) => {
    const base = (q?.prompt ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || `#${i}`
    seen[base] = (seen[base] ?? 0) + 1
    return `${base}\u0000${seen[base]}`
  })
}

export function ModuleImportCard({
  title,
  expectedCount,
  initialRaw = '',
  onChange,
}: {
  title: string
  /** Exact number of questions this box expects; null/undefined = any number. */
  expectedCount?: number | null
  initialRaw?: string
  onChange: (questions: Question[] | null) => void
}) {
  const [raw, setRaw] = useState(initialRaw)
  const [images, setImages] = useState<Record<string, string>>(() => {
    if (!initialRaw.trim()) return {}
    try {
      const arr = JSON.parse(initialRaw) as Question[]
      const seeded: Record<string, string> = {}
      const ks = makeKeys(arr)
      arr.forEach((q, i) => {
        if (q?.image) seeded[ks[i]] = q.image
      })
      return seeded
    } catch {
      return {}
    }
  })
  const [openSlot, setOpenSlot] = useState<number | null>(null)
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const parsed = useMemo(() => {
    if (!raw.trim()) return { data: null as Question[] | null, error: null as string | null }
    try {
      const data = JSON.parse(raw)
      return { data: data as Question[], error: null }
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : 'JSON xato' }
    }
  }, [raw])

  const errors = useMemo(
    () => (parsed.data ? validateQuestions(parsed.data, { requireAnswers: false }) : []),
    [parsed.data],
  )
  const isValid = !parsed.error && parsed.data !== null && errors.length === 0
  const unanswered = useMemo(() => (isValid && parsed.data ? countUnanswered(parsed.data) : 0), [isValid, parsed.data])
  const [showPreview, setShowPreview] = useState(false)

  const keys = useMemo(() => (parsed.data ? makeKeys(parsed.data) : []), [parsed.data])

  const merged = useMemo(() => {
    if (!isValid || !parsed.data) return null
    return parsed.data.map((q, i) => (images[keys[i]] ? { ...q, image: images[keys[i]] } : { ...q, image: undefined }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValid, raw, images, keys])

  useEffect(() => {
    onChange(merged)
    // Only re-run when the actual content changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merged])

  async function handleUpload(index: number, file: File) {
    setUploadingSlot(index)
    setUploadError(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/admin/upload-image', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setUploadError(data.error ?? 'Yuklashda xatolik yuz berdi.')
      } else {
        setImages((m) => ({ ...m, [keys[index]]: data.url }))
      }
    } catch {
      setUploadError("Server bilan bog'lanib bo'lmadi.")
    } finally {
      setUploadingSlot(null)
    }
  }

  function clearImage(index: number) {
    setImages((m) => {
      const next = { ...m }
      delete next[keys[index]]
      return next
    })
  }

  return (
    <div className="border border-line rounded-xl p-4 bg-bg">
      <h3 className="text-[13.5px] font-bold mb-2">{title}</h3>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={`[{ "prompt": "...", "choices": [...], "correct": "A" }, ...]  (${expectedCount ? `${expectedCount} ta savol` : 'istalgancha savol'})`}
        rows={8}
        className="w-full font-mono text-[12px] px-3 py-2.5 rounded-lg border border-line bg-white focus:outline-none focus:border-green resize-y"
      />

      {raw.trim() && (
        <div className="mt-2">
          {isValid && parsed.data ? (
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-green-deep flex-wrap">
              <CheckCircle2 size={14} /> {parsed.data.length} ta savol to&apos;g&apos;ri formatda
              {!!expectedCount && parsed.data.length !== expectedCount && (
                <span className="text-amber-600 font-normal">(kutilgan: {expectedCount} ta)</span>
              )}
              <span className="text-amber-600 font-normal">
                — javoblar JSON&apos;dan olinmaydi, saqlagach &quot;Javob kiritish&quot; orqali qo&apos;lda
                kiritasiz{unanswered > 0 ? '' : ' (JSON ichidagi javoblar bekor qilinadi)'}
              </span>
            </div>
          ) : (
            <div className="space-y-1">
              {(parsed.error ? [{ message: `JSON xato: ${parsed.error}` }] : errors.slice(0, 5)).map((e, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[12px] text-red-600">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {e.message}
                </div>
              ))}
              {!parsed.error && errors.length > 5 && (
                <div className="text-[11.5px] text-ink-faint">...va yana {errors.length - 5} ta xato</div>
              )}
            </div>
          )}
        </div>
      )}

      {isValid && parsed.data && parsed.data.length > 0 && (
        <div className="mt-3">
          <div className="text-[11.5px] font-bold text-ink-faint mb-1.5">
            Chizmasi bor savolni tanlang (bosilmagan savollar &quot;chizmasiz&quot; deb qoladi):
          </div>
          <div className="flex flex-wrap gap-1.5">
            {parsed.data.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setOpenSlot(openSlot === i ? null : i)}
                className={`text-[11.5px] font-bold px-2.5 py-1.5 rounded-lg border flex items-center gap-1 transition-colors ${
                  images[keys[i]]
                    ? 'bg-green-mist border-green text-green-deep'
                    : openSlot === i
                      ? 'border-green text-ink-soft'
                      : 'border-line text-ink-soft hover:border-green'
                }`}
              >
                {images[keys[i]] && <CheckCircle2 size={11} />} {i + 1}-savol
              </button>
            ))}
          </div>

          {openSlot !== null && (
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-1.5 text-[12px] font-bold text-ink-soft border-2 border-dashed border-line rounded-lg px-3 py-2 cursor-pointer hover:border-green transition-colors">
                {uploadingSlot === openSlot ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <ImagePlus size={13} />
                )}
                {openSlot + 1}-savol chizmasini shu yerga tashlang
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(openSlot, file)
                    e.target.value = ''
                  }}
                />
              </label>
              {images[keys[openSlot]] && (
                <div className="flex items-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={images[keys[openSlot]]} alt="" className="h-10 rounded border border-line" />
                  <button
                    type="button"
                    onClick={() => clearImage(openSlot)}
                    className="text-ink-faint hover:text-red-600"
                    title="Rasmni olib tashlash"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {uploadError && (
            <div className="flex items-start gap-1.5 text-[12px] text-red-600 mt-2">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {uploadError}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="mt-3 flex items-center gap-1.5 text-[12px] font-bold text-ink-soft border border-line rounded-lg px-3 py-1.5 hover:border-green"
          >
            {showPreview ? <EyeOff size={13} /> : <Eye size={13} />} {showPreview ? "Ko'rinishni yopish" : "Ko'rinish (preview)"}
          </button>

          {showPreview && merged && (
            <div className="mt-2.5 space-y-2.5 max-h-[420px] overflow-y-auto thin-scroll">
              {merged.map((q, i) => (
                <QuestionPreviewRow key={i} question={q} index={i} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function QuestionPreviewRow({ question, index }: { question: Question; index: number }) {
  const choicesOrGrid =
    (question.type ?? 'mcq') === 'mcq' ? (
      <div className="mt-1.5 space-y-1">
        {question.choices?.map((c) => (
          <div
            key={c.id}
            className={`flex items-center gap-2 px-2 py-1 rounded-lg border text-[12px] ${
              c.id === question.correct ? 'border-green bg-green-mist text-green-deep font-bold' : 'border-line'
            }`}
          >
            <span className="font-bold">{c.id}</span>
            {c.tex ? <MathTex tex={c.tex} /> : <span>{c.text}</span>}
          </div>
        ))}
      </div>
    ) : (
      <div className="mt-1.5 text-[12px] text-green-deep font-bold">To&apos;g&apos;ri javob: {question.correctValue}</div>
    )

  return (
    <div className="border border-line rounded-lg p-3 bg-white">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-5 h-5 rounded-full bg-bg-deep text-[10.5px] font-bold flex items-center justify-center">
          {index + 1}
        </span>
        {question.difficulty && <span className="text-[10px] font-bold text-ink-faint uppercase">{question.difficulty}</span>}
      </div>
      {question.passage && (
        <p className="text-[11.5px] text-ink-faint leading-relaxed mb-1.5 line-clamp-3">{question.passage}</p>
      )}
      {question.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={question.image} alt="" className="max-h-28 rounded-lg border border-line mb-1.5" />
      )}
      <p className="text-[12.5px] font-semibold">{question.prompt}</p>
      {question.equations?.map((eq, i) => (
        <div key={i} className="my-1.5 flex justify-center rounded-lg border border-green-mist bg-green-mist/40 py-2">
          <MathTex tex={eq} display />
        </div>
      ))}
      {choicesOrGrid}
    </div>
  )
}
