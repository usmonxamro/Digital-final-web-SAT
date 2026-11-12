import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { cleanVocab } from '@/lib/question-vocab'

/**
 * Bulk save of question vocabularies: body `{ items: [{ id, vocab: [{ w, uz, ex? }] }] }` (an empty `vocab` clears it).
 * GET ?label=<mock> lists that mock's questions with their current vocabulary — the sheet to fill in.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = await req.json().catch(() => null)
  const items: unknown = body?.items
  if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: "'items' bo'sh emas massiv bo'lishi kerak." }, { status: 400 })

  const supabase = supabaseAdmin()
  let saved = 0
  const failed: string[] = []
  for (const raw of items) {
    const id = raw && typeof raw === 'object' ? (raw as { id?: unknown }).id : null
    if (typeof id !== 'string') continue
    const list = cleanVocab((raw as { vocab?: unknown }).vocab)
    const { error } = await supabase.from('questions').update({ vocab: list.length ? list : null }).eq('id', id)
    if (error) failed.push(id)
    else saved++
  }
  if (saved === 0 && failed.length) return NextResponse.json({ error: "Saqlanmadi (v114 SQL ishga tushirilganmi?).", failed }, { status: 500 })
  return NextResponse.json({ saved, failed })
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const label = req.nextUrl.searchParams.get('label')?.trim()
  if (!label) return NextResponse.json({ error: "'label' kerak." }, { status: 400 })
  const { data, error } = await supabaseAdmin()
    .from('questions')
    .select('id, kind, module_number, prompt, passage, underline, vocab')
    .eq('test_label', label)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ questions: data ?? [] })
}
