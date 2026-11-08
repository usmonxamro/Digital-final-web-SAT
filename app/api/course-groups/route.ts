import { NextResponse } from 'next/server'
import { loadCourseGroups } from '@/lib/course-groups-db'

/** Public: the course groups with their banner texts and where each banner is shown (landing / dashboard). */
export async function GET() {
  const groups = await loadCourseGroups()
  return NextResponse.json({ groups }, { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=120' } })
}
