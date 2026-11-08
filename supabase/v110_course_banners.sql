-- v110: admin-managed course groups / banners («Kurs bannerlari»)
create table if not exists site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table site_settings enable row level security;

insert into site_settings (key, value) values ('course_groups', '[
  {"slug":"nov","title":"SAT November 800/800","short":"Noyabr","theme":"nov","month":"NOVEMBER","landing":false,"dashboard":false},
  {"slug":"dec","title":"SAT December 800/800","short":"Dekabr","theme":"dec","month":"DECEMBER","tag":"❄ Qabul ochiq",
   "desc":"Dekabr imtihoniga mo‘ljallangan intensiv kurs Telegramda — eng yaxshi natija uchun.",
   "bullets":["10 haftalik intensiv dastur","Daily video darslar va qisqa konspektlar","Amaliy mashqlar va testlar","Shaxsiy progress tahlili","Faol hamjamiyat va motivatsion muhit"],
   "link":"https://t.me/Usmon_Xamroyev","landing":true,"dashboard":true}
]'::jsonb) on conflict (key) do nothing;
