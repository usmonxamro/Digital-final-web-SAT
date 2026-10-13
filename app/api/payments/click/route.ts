import { NextRequest, NextResponse } from 'next/server'

/**
 * Click.uz integration stub.
 *
 * TODO(Usmon): Click bilan tijorat shartnoma tuzib, merchant hisobingizni
 * oching (https://docs.click.uz). Keyin quyidagi env o'zgaruvchilarni
 * to'ldiring:
 *   CLICK_MERCHANT_ID, CLICK_SERVICE_ID, CLICK_SECRET_KEY
 *
 * Click ikki xil so'rov yuboradi: "Prepare" va "Complete" (webhook sifatida,
 * ular POST qiladi, siz emas). Bu route hozircha shunchaki 501 qaytaradi —
 * haqiqiy kalitlar qo'shilgach, Click hujjatidagi imzo tekshiruvi (MD5 hash)
 * va invoice yozish logikasi shu yerga qo'shiladi.
 */
export async function POST(req: NextRequest) {
  const merchantId = process.env.CLICK_MERCHANT_ID
  const serviceId = process.env.CLICK_SERVICE_ID
  const secretKey = process.env.CLICK_SECRET_KEY

  if (!merchantId || !serviceId || !secretKey) {
    return NextResponse.json(
      {
        error:
          "Click to'lov tizimi hali sozlanmagan. CLICK_MERCHANT_ID, CLICK_SERVICE_ID, CLICK_SECRET_KEY env o'zgaruvchilarini qo'shing.",
      },
      { status: 501 },
    )
  }

  // Real signature verification + invoice creation goes here once the
  // merchant account exists. See: https://docs.click.uz/en/click-api-request/
  return NextResponse.json({ error: 'Not implemented yet.' }, { status: 501 })
}
