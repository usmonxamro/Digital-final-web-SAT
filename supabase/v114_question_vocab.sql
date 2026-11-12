-- v114 — Har bir savolga lug'at (qiyin so'zlar ro'yxati): review ekranida va PDF'da savol ostida chiqadi.
-- Supabase -> SQL Editor -> New query -> hammasini qo'yib Run. Qayta ishga tushirsa ham xavfsiz.
--
-- Format (jsonb massiv, odatda 3–8 ta element):
--   [{"w": "ubiquitous", "uz": "hamma joyda uchraydigan", "ex": "(ixtiyoriy) savoldan olingan qisqa ibora"}]
-- Imtihon paytida bu ustun HECH QAYERGA yuborilmaydi (/api/questions va /api/tests uni tanlamaydi);
-- u faqat /api/mock-vocab orqali, mockni tugatgan o'quvchiga (yoki adminga) alohida olinadi.
alter table questions add column if not exists vocab jsonb;
