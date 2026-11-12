/** Bot shkalasi (bot_integration/bot_updated.py → SAT_MATH_SCALE, «normal» daraja ustuni): 44 ta xom ball → 200–800. */
export const SCALE_44: Record<number, number> = { 0:200,1:200,2:200,3:200,4:200,5:300,6:300,7:300,8:300,9:300,10:380,11:380,12:380,13:460,14:460,15:460,16:480,17:480,18:480,19:480,20:490,21:500,22:510,23:520,24:530,25:550,26:550,27:560,28:570,29:590,30:600,31:620,32:630,33:640,34:650,35:670,36:690,37:700,38:710,39:730,40:750,41:760,42:770,43:790,44:800 }

export function rawToScaled(raw44: number): number {
  const r = Math.max(0, Math.min(44, Math.round(raw44)))
  return SCALE_44[r] ?? 200
}
