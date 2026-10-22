import type { SupabaseClient } from '@supabase/supabase-js'
import { assemblePdfItems } from '@/lib/mock-pdf-items'
import type { Question } from '@/lib/test-data'

export type BotPushResult =
  | { status: 'created'; code: string; name: string; count: number; message: string }
  | { status: 'exists'; code: string; message: string }
  | { status: 'skipped' | 'incomplete' | 'error'; message: string }

/** A 3-digit code like the bot's own (4–5 digits once those run out), unused in bot_tests. */
async function freeCode(supabase: SupabaseClient): Promise<string | null> {
  for (const digits of [3, 4, 5]) {
    const low = 10 ** (digits - 1)
    const high = 10 ** digits - 1
    for (let i = 0; i < 40; i++) {
      const code = String(low + Math.floor(Math.random() * (high - low + 1)))
      const { data } = await supabase.from('bot_tests').select('code').eq('code', code).maybeSingle()
      if (!data) return code
    }
  }
  return null
}

/**
 * Makes a site mock available in the Telegram bot: a `bot_tests` row (code + answer key) marked origin 'site'.
 * The bot picks it up within a minute, saves it in its own database and tells the admins.
 * Only the Math part goes to the bot (the bot has Math tests only). Needs the full answer key.
 */
export async function pushMockToBot(supabase: SupabaseClient, label: string): Promise<BotPushResult> {
  try {
    const { data: cfg } = await supabase.from('test_configs').select('subject, placement, scored, math_layout').eq('test_label', label).maybeSingle()
    if (!cfg) return { status: 'error', message: 'Mock topilmadi.' }
    if (cfg.subject === 'english') return { status: 'skipped', message: "English mock botga qo'shilmaydi (botda faqat Math testlar bor)." }

    const { data: have, error: haveErr } = await supabase.from('bot_tests').select('code').eq('test_label', label).limit(1)
    if (haveErr) {
      return { status: 'error', message: "Bot jadvallari yo'q yoki v100 SQL ishga tushirilmagan: " + haveErr.message }
    }
    if (have && have.length > 0) return { status: 'exists', code: have[0].code, message: `Botda allaqachon bor (kod: ${have[0].code}).` }

    type Row = { id: string; type: string | null; correct: string | null; correct_value: string | null; module_number: number | null }
    const byId = new Map<string, Row>()
    const load = async (kind: 'reading' | 'math'): Promise<Question[]> => {
      const { data } = await supabase
        .from('questions')
        .select('id, type, correct, correct_value, module_number')
        .eq('kind', kind)
        .eq('test_label', label)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
      return (data ?? []).map((r: Row) => {
        byId.set(r.id, r)
        return {
          id: r.id,
          type: (r.type as Question['type']) ?? 'mcq',
          prompt: '',
          moduleNumber: r.module_number === 1 || r.module_number === 2 ? r.module_number : undefined,
        } as Question
      })
    }
    const [reading, math] = await Promise.all([load('reading'), load('math')])
    const items = (
      await assemblePdfItems(
        { subject: cfg.subject, placement: cfg.placement, scored: cfg.scored, mathLayout: cfg.math_layout },
        async (kind) => (kind === 'math' ? math : reading),
      )
    ).filter((it) => it.sectionKind === 'math')
    if (items.length === 0) return { status: 'skipped', message: "Mockda Math savollari yo'q." }

    const answers: Record<string, string> = {}
    let missing = 0
    items.forEach((it, i) => {
      const r = byId.get(it.question.id as string)
      const v = r ? ((r.type ?? 'mcq') === 'mcq' ? r.correct : r.correct_value) : null
      if (!v || !String(v).trim()) missing++
      else answers[String(i + 1)] = String(v).trim()
    })
    if (missing > 0) {
      return { status: 'incomplete', message: `${missing} ta savolning javobi kiritilmagan — avval javoblarni to'liq kiriting, keyin botga qo'shing.` }
    }

    const code = await freeCode(supabase)
    if (!code) return { status: 'error', message: "Bo'sh test kodi topilmadi." }
    const count = items.length
    const kind = cfg.placement === 'course_task' || cfg.scored === false || count !== 44 ? 'ixtiyoriy' : cfg.math_layout === 'sequential' ? 'ketmaket_44' : 'modulli_44'
    const level = kind === 'ixtiyoriy' ? 'oddiy' : 'normal'
    const name = cfg.subject === 'full' ? `${label} (Math)` : label

    const { error } = await supabase.from('bot_tests').insert({
      code,
      name,
      kind,
      level,
      answers,
      question_count: count,
      test_label: label,
      origin: 'site',
      created_at: new Date().toISOString(),
    })
    if (error) return { status: 'error', message: `Botga qo'shib bo'lmadi: ${error.message}` }
    return {
      status: 'created',
      code,
      name,
      count,
      message: `Botga qo'shildi — kod: ${code} (${count} ta savol). Bot ~1 daqiqada oladi va adminlarga xabar yuboradi.`,
    }
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Xatolik.' }
  }
}
