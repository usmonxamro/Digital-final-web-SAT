-- v118: finished groups can be archived (hidden from "O'quvchilar tahlili", their data is not loaded).
-- The bot's sync (bot_to_supabase.py) only upserts chat_id/title/course_slug/added_at, so these columns survive it.
alter table public.tg_groups add column if not exists archived boolean not null default false;
alter table public.tg_groups add column if not exists archived_at timestamptz;
