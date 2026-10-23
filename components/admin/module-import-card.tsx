'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Eye, EyeOff, ImagePlus, Loader2, X } from 'lucide-react'
import { validateQuestions, unansweredNumbers, normalizeAnswers } from '@/lib/admin-schema'
import { Math as MathTex } from '@/components/math'
import { ChoiceContent } from '@/components/choice-content'
import { ChoiceImageRow, uploadQuestionImage } from '@/components/admin/choice-image-slot'
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
  /** Pictures of answer options, keyed by question key + option id. */
  const [choiceImages, setChoiceImages] = useState<Record<string, string>>(() => {
    if (!initialRaw.trim()) return {}
    try {
      const arr = JSON.parse(initialRaw) as Question[]
      const seeded: Record<string, string> = {}
      const ks = makeKeys(arr)
      arr.forEach((q, i) => q?.choices?.forEach((c) => c?.image && (seeded[`${ks[i]}\u0001${c.id}`] = c.image)))
      return seeded
    } catch {
      return {}
    }
  })
  const [choiceBusy, setChoiceBusy] = useState<string | null>(null)
  const [openSlot, setOpenSlot] = useState<number | null>(null)
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const parsed = useMemo(() => {
    if (!raw.trim()) return { data: null as Question[] | null, error: null as string | null }
    try {
      const data = normalizeAnswers(JSON.parse(raw))
      return { data: data as Question[], error: null }
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : 'JSON xato' }
    }
  }, [raw])

  const keys = useMemo(() => (Array.isArray(parsed.data) ? makeKeys(parsed.data) : []), [parsed.data])

  /** The pasted questions with the uploaded option pictures put into their choices. */
  const withChoiceImages = useMemo(() => {
    if (!Array.isArray(parsed.data)) return parsed.data
    return parsed.data.map((q, i) =>
      q && Array.isArray(q.choices)
        ? { ...q, choices: q.choices.map((c) => ({ ...c, image: choiceImages[`${keys[i]}\u0001${c?.id}`] })) }
        : q,
    )
  }, [parsed.data, choiceImages, keys])

  const errors = useMemo(
    () => (withChoiceImages ? validateQuestions(withChoiceImages, { requireAnswers: false }) : []),
    [withChoiceImages],
  )
  const isValid = !parsed.error && parsed.data !== null && errors.length === 0
  const missing = useMemo(() => (isValid && parsed.data ? unansweredNumbers(parsed.data) : []), [isValid, parsed.data])
  const total = Array.isArray(parsed.data) ? parsed.data.length : 0
  const [showPreview, setShowPreview] = useState(false)

  const merged = useMemo(() => {
    if (!isValid || !Array.isArray(withChoiceImages)) return null
    return withChoiceImages.map((q, i) => (images[keys[i]] ? { ...q, image: images[keys[i]] } : { ...q, image: undefined }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValid, raw, images, keys, choiceImages])

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

  async function handleChoiceUpload(index: number, id: string, file: File) {
    setChoiceBusy(id)
    setUploadError(null)
    try {
      const url = await uploadQuestionImage(file)
      setChoiceImages((m) => ({ ...m, [`${keys[index]}\u0001${id}`]: url }))
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Yuklashda xatolik yuz berdi.')
    } finally {
      setChoiceBusy(null)
    }
  }

  function clearChoiceImage(index: number, id: string) {
    setChoiceImages((m) => {
      const next = { ...m }
      delete next[`${keys[index]}\u0001${id}`]
      return next
    })
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
              {missing.length === 0 ? (
                <span className="text-green-deep font-normal">
                  — barcha {total} ta savolning javobi JSON&apos;dan olindi (saqlagach pastda tekshirib chiqasiz)
                </span>
              ) : missing.length === total ? (
                <span className="text-amber-600 font-normal">
                  — JSON&apos;da javob yo&apos;q: saqlagach pastda barcha javoblarni qo&apos;lda kiritasiz
                </span>
              ) : (
                <span className="text-amber-600 font-normal">
                  — {total - missing.length} ta javob JSON&apos;dan olindi, ⚠ {missing.length} tasida YO&apos;Q:{' '}
                  {missing.slice(0, 12).join(', ')}
                  {missing.length > 12 ? '…' : ''}-savol. Saqlagach pastda qo&apos;lda kiritasiz
                </span>
              )}
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

      {Array.isArray(parsed.data) && parsed.data.length > 0 && parsed.data.every((q) => q && typeof q === 'object') && (
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
                {(images[keys[i]] || Object.keys(choiceImages).some((k) => k.startsWith(`${keys[i]}\u0001`))) && <CheckCircle2 size={11} />}{' '}
                {i + 1}-savol
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

          {openSlot !== null &&
            parsed.data &&
            (parsed.data[openSlot]?.type ?? 'mcq') === 'mcq' &&
            (() => {
              const q = parsed.data[openSlot]
              const ids = q.choices?.length ? q.choices.map((c) => c.id) : ['A', 'B', 'C', 'D']
              const urls: Record<string, string | undefined> = {}
              ids.forEach((id) => (urls[id] = choiceImages[`${keys[openSlot]}\u0001${id}`]))
              return (
                <ChoiceImageRow
                  ids={ids}
                  urls={urls}
                  busyId={choiceBusy}
                  onFile={(id, file) => handleChoiceUpload(openSlot, id, file)}
                  onClear={(id) => clearChoiceImage(openSlot, id)}
                />
              )
            })()}

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
            <ChoiceContent choice={c} size="sm" />
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
