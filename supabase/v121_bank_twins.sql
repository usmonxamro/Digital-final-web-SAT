-- v121: kitob savollar banki (question_bank) savollari uchun ham twin (egizak savol).
-- question_twins.family_id — mock savoli (questions.id) YOKI kitob savoli (question_bank.id) bo'lishi mumkin;
-- qaysi jadvaldan kelgani source_table da turadi. Shu bilan bir xil tizim ikkala bankni ham qamrab oladi.
alter table question_twins add column if not exists source_table text not null default 'questions';
create index if not exists question_twins_source_table_idx on question_twins (source_table, family_id);

-- Kitobdan tuzilgan testlar: nusxa qilingan savol qaysi kitob savolidan kelganini eslab qoladi
-- (questions.family_id = question_bank.id), shuning uchun xatolar o'sha oilaga yig'iladi.
alter table questions add column if not exists family_source text;
