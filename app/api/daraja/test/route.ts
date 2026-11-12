import { NextRequest, NextResponse } from 'next/server'
import uz from '@/lib/daraja/test.uz.json'
import en from '@/lib/daraja/test.en.json'
import { isLang } from '@/lib/daraja/scoring'

// Savollar matni (javobsiz) — ommaviy. Kalitlar faqat Supabase'da.
export function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get('lang')
  if (!isLang(lang)) return NextResponse.json({ error: 'lang' }, { status: 400 })
  return NextResponse.json({ questions: lang === 'uz' ? uz : en }, { headers: { 'Cache-Control': 'public, max-age=300' } })
}
