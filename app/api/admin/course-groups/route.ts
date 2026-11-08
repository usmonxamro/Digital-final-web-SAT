import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { adminErrorResponse } from '@/lib/admin-errors'
import { isMissingTable } from '@/lib/db-errors'
import { cleanCourseGroups } from '@/lib/course-groups'
import { loadCourseGroups, saveCourseGroups } from '@/lib/course-groups-db'

/** Admin «Kurs bannerlari»: GET the full list (archived included), PUT { groups } to replace it. */
export async function GET() {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const groups = await loadCourseGroups(undefined, true)
  return NextResponse.json({ groups })
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    return adminErrorResponse(e)
  }
  const body = await req.json().catch(() => null)
  const groups = cleanCourseGroups(body?.groups)
  if (!groups.length) return NextResponse.json({ error: 'Kamida bitta guruh bo‘lishi kerak (slug va nom to‘ldirilgan).' }, { status: 400 })
  // A slug that is already in use must never disappear (tasks / members / codes point at it) — archive it instead.
  const before = await loadCourseGroups(undefined, true)
  const lost = before.filter((g) => !groups.some((x) => x.slug === g.slug))
  if (lost.length) {
    return NextResponse.json(
      { error: `"${lost.map((g) => g.title).join(', ')}" guruhini o‘chirib bo‘lmaydi — uni «Arxiv» qiling (vazifalar va a’zolar unga bog‘langan).` },
      { status: 400 },
    )
  }
  const error = await saveCourseGroups(supabaseAdmin(), groups)
  if (error) {
    const msg = isMissingTable(error) ? 'site_settings jadvali yo‘q — supabase/v110_course_banners.sql ni ishga tushiring.' : error.message
    return NextResponse.json({ error: msg }, { status: 500 })
  }
  return NextResponse.json({ ok: true, groups })
}
