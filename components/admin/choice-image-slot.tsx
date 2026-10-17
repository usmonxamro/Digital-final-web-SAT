'use client'

import { ImagePlus, Loader2, X } from 'lucide-react'

/** Uploads one picture through the admin endpoint and returns its public URL. */
export async function uploadQuestionImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  let res: Response
  try {
    res = await fetch('/api/admin/upload-image', { method: 'POST', body: formData })
  } catch {
    throw new Error("Server bilan bog'lanib bo'lmadi.")
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.url) throw new Error(data.error ?? 'Yuklashda xatolik yuz berdi.')
  return data.url as string
}

/**
 * A row of small upload boxes — one per answer option (A, B, C, D). A choice that is only a picture
 * (graph, diagram) gets its image here; the option's text can stay empty.
 */
export function ChoiceImageRow({
  ids,
  urls,
  busyId,
  onFile,
  onClear,
}: {
  ids: string[]
  urls: Record<string, string | undefined>
  busyId: string | null
  onFile: (id: string, file: File) => void
  onClear: (id: string) => void
}) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[11.5px] font-bold text-ink-faint">
        Javob variantlari chizmasi (faqat chizmali variantlarga yuklang). Variant faqat rasm bo&apos;lsa, JSON&apos;da{' '}
        <code>&quot;text&quot;: &quot;&quot;</code> qoldiring.
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ids.map((id) => {
          const url = urls[id]
          return (
            <div key={id} className="rounded-lg border border-line bg-white p-2">
              <div className="mb-1 flex items-center justify-between text-[12px] font-extrabold text-ink">
                {id} javob
                {url && (
                  <button type="button" onClick={() => onClear(id)} className="text-ink-faint hover:text-red-600" title="Rasmni olib tashlash">
                    <X size={13} />
                  </button>
                )}
              </div>
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="mx-auto max-h-24 max-w-full rounded border border-line object-contain" />
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-line px-2 py-3 text-[11.5px] font-bold text-ink-soft transition-colors hover:border-green">
                  {busyId === id ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                  Rasm tanlash
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) onFile(id, file)
                      e.target.value = ''
                    }}
                  />
                </label>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
