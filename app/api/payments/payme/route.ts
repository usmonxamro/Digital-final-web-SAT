import { NextRequest, NextResponse } from 'next/server'

/**
 * Payme (Paycom) integration stub.
 *
 * TODO(Usmon): Payme bilan tijorat shartnoma tuzib, merchant hisobingizni
 * oching (https://developer.help.paycom.uz). Keyin quyidagi env
 * o'zgaruvchilarni to'ldiring:
 *   PAYME_MERCHANT_ID, PAYME_SECRET_KEY
 *
 * Payme JSON-RPC orqali ishlaydi (CheckPerformTransaction, CreateTransaction,
 * PerformTransaction, CancelTransaction metodlari). Haqiqiy kalitlar
 * qo'shilgach, shu metodlarni shu yerga qo'shamiz.
 */
export async function POST(req: NextRequest) {
  const merchantId = process.env.PAYME_MERCHANT_ID
  const secretKey = process.env.PAYME_SECRET_KEY

  if (!merchantId || !secretKey) {
    return NextResponse.json(
      {
        error:
          "Payme to'lov tizimi hali sozlanmagan. PAYME_MERCHANT_ID, PAYME_SECRET_KEY env o'zgaruvchilarini qo'shing.",
      },
      { status: 501 },
    )
  }

  return NextResponse.json({ error: 'Not implemented yet.' }, { status: 501 })
}
