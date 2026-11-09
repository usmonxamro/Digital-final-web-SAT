import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { isMissingTable } from '@/lib/db-errors'
import { bustVocabCache, NO_VOCAB_TABLE } from '@/lib/vocab-server'

export type AdminVocabWord = {
  id: number
  subject: 'math' | 'english'
  en: string
  uz: string
  cat: string
  example: string | null
  example_src: string | null
  needs_review: boolean
  active: boolean
  source: string
}
export type AdminVocabCandidate = { word: string; docs: number; example: string | null; example_src: string | null; status: string }

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const SUBJECTS = ['math', 'english']

/** GET → barcha so'zlar (yashirinlari ham) + tarjima kutayotganlar. */
export async function GET() {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const sb = supabaseAdmin()
  const [w, c] = await Promise.all([
    sb.from('vocab_words').select('id, subject, en, uz, cat, example, example_src, needs_review, active, source').order('id').limit(5000),
    sb.from('vocab_candidates').select('word, docs, example, example_src, status').eq('status', 'new').order('docs', { ascending: false }).limit(300),
  ])
  if (w.error) {
    return NextResponse.json({ words: [], candidates: [], error: isMissingTable(w.error) ? NO_VOCAB_TABLE : "Lug'atni yuklab bo'lmadi." })
  }
  return NextResponse.json({ words: (w.data ?? []) as AdminVocabWord[], candidates: (c.data ?? []) as AdminVocabCandidate[] })
}

/**
 * POST — yangi so'z(lar):
 *   { en, uz, cat?, subject?, fromCandidate? }  yoki  { bulk: "english<TAB yoki =>o'zbekcha" qatorlari }
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "Noto'g'ri so'rov." }, { status: 400 })
  const sb = supabaseAdmin()
  const subject = SUBJECTS.includes(body.subject as string) ? (body.subject as string) : 'math'

  if (typeof body.bulk === 'string') {
    const rows: { subject: string; en: string; uz: string; cat: string; source: string }[] = []
    for (const line of body.bulk.split('\n')) {
      // Birinchi ajratgichda bo'lamiz: TAB, "=", yoki " - " (inglizcha so'z ichidagi "x-intercept" kabi chiziqchalarga tegmaydi)
      const m = line.match(/^(.*?)(?:\t|\s*=\s*|\s+[-–]\s+)(.*)$/)
      const en = clean(m?.[1], 120)
      const uz = clean(m?.[2], 200)
      if (en && uz) rows.push({ subject, en, uz, cat: clean(body.cat, 40) || 'Umumiy', source: 'admin' })
    }
    if (!rows.length) return NextResponse.json({ error: "Qator topilmadi. Format: english [TAB] o'zbekcha" }, { status: 400 })
    // Takrorlarni o'tkazib yuboramiz (mavjud so'zlarga tegmaymiz)
    const { data: have } = await sb.from('vocab_words').select('en').eq('subject', subject).limit(5000)
    const haveSet = new Set((have ?? []).map((h) => String(h.en).toLowerCase()))
    const fresh = rows.filter((r, i) => !haveSet.has(r.en.toLowerCase()) && rows.findIndex((x) => x.en.toLowerCase() === r.en.toLowerCase()) === i)
    if (fresh.length) {
      const { error } = await sb.from('vocab_words').insert(fresh)
      if (error) return NextResponse.json({ error: "Saqlab bo'lmadi." }, { status: 500 })
    }
    bustVocabCache()
    return NextResponse.json({ ok: true, added: fresh.length, skipped: rows.length - fresh.length })
  }

  const en = clean(body.en, 120)
  const uz = clean(body.uz, 200)
  if (!en || !uz) return NextResponse.json({ error: "Inglizcha so'z va o'zbekcha tarjimani yozing." }, { status: 400 })
  const { data, error } = await sb
    .from('vocab_words')
    .insert({ subject, en, uz, cat: clean(body.cat, 40) || 'Umumiy', source: 'admin', example: clean(body.example, 200) || null })
    .select('id, subject, en, uz, cat, example, example_src, needs_review, active, source')
    .single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: "Bunday so'z allaqachon bor." }, { status: 409 })
    return NextResponse.json({ error: "Saqlab bo'lmadi." }, { status: 500 })
  }
  if (typeof body.fromCandidate === 'string') {
    await sb.from('vocab_candidates').update({ status: 'added', updated_at: new Date().toISOString() }).eq('subject', subject).eq('word', body.fromCandidate)
  }
  bustVocabCache()
  return NextResponse.json({ ok: true, word: data as AdminVocabWord })
}

/**
 * PATCH { id, en?, uz?, cat?, example?, needs_review?, active? } — tahrirlash / yashirish / tiklash.
 * PATCH { candidate, status: 'ignored' } — tarjima kutayotgan so'zni rad etish.
 */
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const sb = supabaseAdmin()
  if (typeof body?.candidate === 'string') {
    await sb.from('vocab_candidates').update({ status: 'ignored', updated_at: new Date().toISOString() }).eq('subject', 'math').eq('word', body.candidate)
    return NextResponse.json({ ok: true })
  }
  if (!Number.isInteger(body?.id)) return NextResponse.json({ error: "Noto'g'ri so'rov." }, { status: 400 })
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('en' in body!) {
    const v = clean(body!.en, 120)
    if (!v) return NextResponse.json({ error: "Inglizcha so'z bo'sh bo'lmasin." }, { status: 400 })
    patch.en = v
  }
  if ('uz' in body!) {
    const v = clean(body!.uz, 200)
    if (!v) return NextResponse.json({ error: "Tarjima bo'sh bo'lmasin." }, { status: 400 })
    patch.uz = v
    patch.needs_review = false // admin ko'rib tahrirladi
  }
  if ('cat' in body!) patch.cat = clean(body!.cat, 40) || 'Umumiy'
  if ('example' in body!) patch.example = clean(body!.example, 200) || null
  if (typeof body!.needs_review === 'boolean') patch.needs_review = body!.needs_review
  if (typeof body!.active === 'boolean') patch.active = body!.active
  const { error } = await sb.from('vocab_words').update(patch).eq('id', body!.id as number)
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: "Bunday so'z allaqachon bor." }, { status: 409 })
    return NextResponse.json({ error: "Saqlab bo'lmadi." }, { status: 500 })
  }
  bustVocabCache()
  return NextResponse.json({ ok: true })
}

/** DELETE { id } — butunlay o'chirish (odatda yashirish yetarli: PATCH active:false). Taraqqiyot yozuvlari ham o'chadi. */
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = (await req.json().catch(() => null)) as { id?: unknown } | null
  if (!Number.isInteger(body?.id)) return NextResponse.json({ error: "Noto'g'ri so'rov." }, { status: 400 })
  const { error } = await supabaseAdmin().from('vocab_words').delete().eq('id', body!.id as number)
  if (error) return NextResponse.json({ error: "O'chirib bo'lmadi." }, { status: 500 })
  bustVocabCache()
  return NextResponse.json({ ok: true })
}
