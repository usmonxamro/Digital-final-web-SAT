import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'

const DIFFS = ['Easy', 'Medium', 'Hard']
const str = (x: unknown, n: number) => (typeof x === 'string' ? x.slice(0, n) : '')

/** PATCH: edit one bank question (text, choices, answer, difficulty, solution, "needs check"). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const { id } = await params
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b) return NextResponse.json({ error: "Noto'g'ri so'rov." }, { status: 400 })
  const supabase = supabaseAdmin()
  const { data: cur } = await supabase.from('question_bank').select('type').eq('id', id).maybeSingle()
  if (!cur) return NextResponse.json({ error: 'Savol topilmadi.' }, { status: 404 })

  const patch: Record<string, unknown> = {}
  if ('prompt' in b) {
    const p = str(b.prompt, 8000).trim()
    if (!p) return NextResponse.json({ error: 'Savol matni bo‘sh bo‘lmasin.' }, { status: 400 })
    patch.prompt = p
  }
  if ('equations' in b) {
    const eq = Array.isArray(b.equations) ? b.equations.map((e) => str(e, 2000).trim()).filter(Boolean) : []
    patch.equations = eq.length ? eq : null
  }
  if ('choices' in b && cur.type === 'mcq') {
    if (!Array.isArray(b.choices) || b.choices.length < 2) return NextResponse.json({ error: 'Kamida 2 ta variant kerak.' }, { status: 400 })
    patch.choices = b.choices.slice(0, 6).map((c: Record<string, unknown>) => {
      const o: Record<string, string> = { id: str(c.id, 2) }
      if (str(c.text, 2000).trim()) o.text = str(c.text, 2000).trim()
      if (str(c.tex, 2000).trim()) o.tex = str(c.tex, 2000).trim()
      if (str(c.image, 400)) o.image = str(c.image, 400)
      return o
    })
  }
  if ('correct' in b && cur.type === 'mcq') {
    if (!/^[A-F]$/.test(String(b.correct))) return NextResponse.json({ error: "To'g'ri javob A–D bo'lsin." }, { status: 400 })
    patch.correct = b.correct
  }
  if ('correct_value' in b && cur.type === 'gridin') {
    const v = str(b.correct_value, 200).trim()
    if (!v) return NextResponse.json({ error: 'Javob bo‘sh bo‘lmasin.' }, { status: 400 })
    patch.correct_value = v
  }
  if ('difficulty' in b) {
    if (!DIFFS.includes(String(b.difficulty))) return NextResponse.json({ error: 'Qiyinlik noto‘g‘ri.' }, { status: 400 })
    patch.difficulty = b.difficulty
  }
  if ('explanation' in b) patch.explanation = str(b.explanation, 8000).trim() || null
  if ('needs_check' in b) patch.needs_check = b.needs_check === true
  if ('note' in b) patch.note = str(b.note, 1000).trim() || null

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "O'zgarish yo'q." }, { status: 400 })
  // Mark it as hand-edited so re-importing the book never overwrites it (column from the v88 SQL; optional).
  let { data, error } = await supabase.from('question_bank').update({ ...patch, edited_at: new Date().toISOString() }).eq('id', id).select('*').single()
  if (error && /edited_at/.test(error.message)) {
    ;({ data, error } = await supabase.from('question_bank').update(patch).eq('id', id).select('*').single())
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ row: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const { id } = await params
  const { error } = await supabaseAdmin().from('question_bank').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
