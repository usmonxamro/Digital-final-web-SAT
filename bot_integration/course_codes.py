# =====================================================================
# KURS KODLARI — Telegram guruh a'zosiga SAYTDA kurs guruhini ochadigan kod
# =====================================================================
# Bu blokni bot faylingizga QO'SHING: `_execute` funksiyasi (≈127-qator)
# tagidan keyin, birinchi @dp.message(...) dan OLDIN. Boshqa joyga
# o'zgartirish shart emas. Batafsil: bot_integration/README.md
#
# Qanday ishlaydi:
#   1) Siz kurs guruhida (SAT November / December) `/kurs nov` yoki `/kurs dec`
#      deb yozasiz — bot shu guruhni o'sha kurs bilan bog'laydi.
#   2) O'quvchi botga kirib "🔑 Saytga kirish kodi" tugmasini bosadi (yoki /kod).
#   3) Bot uning guruh a'zosi ekanini TEKSHIRADI va unga shaxsiy kod beradi.
#   4) O'quvchi kodni saytda (Kurslar → "Kod bilan qo'shilish") kiritadi.
#      Sayt kodni bir xil maxfiy so'z (COURSE_CODE_SECRET) bilan tekshiradi.
#
# Bot saytga hech qanday so'rov yubormaydi — kod bot ichida hisoblanadi,
# shuning uchun sayt/server o'chiq bo'lsa ham bot ishlayveradi.
# =====================================================================
import hmac
import hashlib

# Saytdagi lib/course-groups.ts dagi bilan BIR XIL bo'lishi shart
COURSE_SLUGS = {
    "nov": "SAT November 800/800",
    "dec": "SAT December 800/800",
}
# Saytdagi .env.local dagi COURSE_CODE_SECRET bilan BIR XIL (Wispbyte'da muhit o'zgaruvchisi qilib qo'ying)
COURSE_CODE_SECRET = os.getenv("COURSE_CODE_SECRET", "")
COURSE_SITE_URL = os.getenv("COURSE_SITE_URL", "https://SAYT-MANZILINGIZ.uz")

_course_table_ready = False


async def _ensure_course_table():
    global _course_table_ready
    if _course_table_ready:
        return
    await _execute("CREATE TABLE IF NOT EXISTS course_bindings (slug TEXT PRIMARY KEY, chat_id INTEGER NOT NULL)")
    _course_table_ready = True


def _to_base36(n: int) -> str:
    digits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    out = ""
    while n:
        n, r = divmod(n, 36)
        out = digits[r] + out
    return out or "0"


def make_course_code(slug: str, tg_id: int) -> str:
    sig = hmac.new(COURSE_CODE_SECRET.encode(), f"{slug}:{tg_id}".encode(), hashlib.sha256).hexdigest()[:10].upper()
    return f"{slug.upper()}-{_to_base36(tg_id)}-{sig}"


async def _is_course_member(chat_id: int, user_id: int) -> bool:
    """Avval Telegramning o'zidan so'raydi (ishonchli), bo'lmasa bot bazasiga qaraydi."""
    try:
        m = await bot.get_chat_member(chat_id, user_id)
        return m.status in ("member", "administrator", "creator", "restricted")
    except Exception:
        row = await _fetchone("SELECT 1 FROM group_members WHERE chat_id=? AND user_id=?", (chat_id, user_id))
        return row is not None


# ---- ADMIN: guruhni kursga bog'lash (kurs guruhining ichida yoziladi) ----
@dp.message(Command("kurs"), F.chat.type.in_({"group", "supergroup"}))
async def course_bind_cmd(message: types.Message, command: CommandObject):
    if message.from_user.id not in all_admin_ids():
        return
    slug = (command.args or "").strip().lower()
    if slug not in COURSE_SLUGS:
        opts = ", ".join(f"<code>/kurs {k}</code> — {v}" for k, v in COURSE_SLUGS.items())
        await message.reply(f"Qaysi kurs? {opts}", parse_mode="HTML")
        return
    await _ensure_course_table()
    await _execute(
        "INSERT INTO course_bindings (slug, chat_id) VALUES (?, ?) "
        "ON CONFLICT(slug) DO UPDATE SET chat_id=excluded.chat_id",
        (slug, message.chat.id),
    )
    await message.reply(f"✅ Bu guruh «{esc(COURSE_SLUGS[slug])}» kursi sifatida bog'landi.", parse_mode="HTML")


# ---- ADMIN: bog'lanishlar ro'yxati (shaxsiy chatda) ----
@dp.message(Command("kurslar"), F.chat.type == "private")
async def course_list_cmd(message: types.Message):
    if message.from_user.id not in all_admin_ids():
        return
    await _ensure_course_table()
    rows = await _fetchall("SELECT slug, chat_id FROM course_bindings")
    bound = {r[0]: r[1] for r in rows}
    lines = []
    for slug, title in COURSE_SLUGS.items():
        chat_id = bound.get(slug)
        gt = get_group_title(chat_id) if chat_id else None
        lines.append(f"• {esc(title)}: " + (f"✅ {esc(gt or str(chat_id))}" if chat_id else "❌ bog'lanmagan (guruhda /kurs " + slug + ")"))
    if not COURSE_CODE_SECRET:
        lines.append("\n⚠️ COURSE_CODE_SECRET o'rnatilmagan — kodlar ishlamaydi.")
    await message.answer("\n".join(lines), parse_mode="HTML")


# ---- O'QUVCHI: shaxsiy kod olish ----
@dp.message(Command("kod"), F.chat.type == "private")
@dp.message(F.text == "🔑 Saytga kirish kodi", F.chat.type == "private")
async def course_code_cmd(message: types.Message):
    if not COURSE_CODE_SECRET:
        await message.answer("Kod tizimi hali sozlanmagan. O'qituvchiga yozing.")
        return
    await _ensure_course_table()
    uid = message.from_user.id
    rows = await _fetchall("SELECT slug, chat_id FROM course_bindings")
    lines = []
    for slug, chat_id in rows:
        if slug in COURSE_SLUGS and await _is_course_member(chat_id, uid):
            lines.append(f"📚 <b>{esc(COURSE_SLUGS[slug])}</b>\n<code>{make_course_code(slug, uid)}</code>")
    if not lines:
        await message.answer(
            "Siz hozircha kurs guruhlarimizning a'zosi emassiz.\n"
            "Kursga qo'shilgach, shu tugmani qayta bosing.",
        )
        return
    await message.answer(
        "🔑 <b>Saytga kirish kodingiz</b>\n\n" + "\n\n".join(lines) +
        f"\n\nKodni saytda kiriting: {esc(COURSE_SITE_URL)} → <b>Kurslar</b> → <b>Kod bilan qo'shilish</b>.\n"
        "Kod faqat sizniki — boshqalarga bermang.",
        parse_mode="HTML",
        disable_web_page_preview=True,
    )
