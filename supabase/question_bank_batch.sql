-- v90: "batch" marks questions added in one College Board update (e.g. 2026-11-23), so the student bank can offer them
-- as "Yangi savollar" (solve here + PDF). Run once in Supabase -> SQL Editor BEFORE the seed file below.
alter table question_bank add column if not exists batch text;
create index if not exists question_bank_batch_idx on question_bank(batch) where batch is not null;
