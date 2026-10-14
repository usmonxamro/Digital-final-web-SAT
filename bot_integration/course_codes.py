# =====================================================================
# SAYT ORQALI VAZIFALAR + KURS KODI (SAT November / December 800/800)
# =====================================================================
# Bu blokni bot faylingizga QO'SHING: `_execute` funksiyasi tagidan keyin,
# birinchi @dp.message(...) dan OLDIN. (Tayyor to'liq fayl: bot_updated.py)
#
# Qoidalar:
#   • Kod FAQAT shu guruhning a'zosiga beriladi (a'zolik Telegramdan jonli tekshiriladi).
#   • Har bir guruh uchun alohida kod: NOV kodi faqat November guruhini ochadi,
#     DEC kodi faqat December guruhini. Ikkalasida bo'lsa — ikkita kod.
#   • O'quvchiga kod BIR MARTA beriladi (bazaga yoziladi). Qayta bossa — yangi kod
#     emas, o'sha kodning o'zi eslatma bilan ko'rsatiladi.
#   • Sayt kodni faqat BIR akkauntga bog'laydi: kod ishlatilgach, boshqa akkaunt
#     shu kod bilan kira olmaydi.
#   • Pro obuna kurs guruhini OCHMAYDI — faqat shu kod yoki admin qo'shishi.
# =====================================================================
import hmac
import hashlib

# Saytdagi lib/course-groups.ts dagi bilan BIR XIL bo'lishi shart
COURSE_SLUGS = {
    "nov": "SAT November 800/800",
    "dec": "SAT December 800/800",
}
# Saytdagi COURSE_CODE_SECRET bilan BIR XIL (Wispbyte'da muhit o'zgaruvchisi)
COURSE_CODE_SECRET = os.getenv("COURSE_CODE_SECRET", "")
COURSE_SITE_URL = (os.getenv("COURSE_SITE_URL", "https://satbyusmon.com") or "").rstrip("/")

_course_tables_ready = False


async def _ensure_course_tables():
    global _course_tables_ready
    if _course_tables_ready:
        return
    await _execute("CREATE TABLE IF NOT EXISTS course_bindings (slug TEXT PRIMARY KEY, chat_id INTEGER NOT NULL)")
    await _execute(
        "CREATE TABLE IF NOT EXISTS course_codes_issued ("
        "tg_id INTEGER NOT NULL, slug TEXT NOT NULL, issued_at TEXT NOT NULL, "
        "PRIMARY KEY (tg_id, slug))"
    )
    _course_tables_ready = True


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
    """Telegramdan jonli so'raydi: guruhni tark etgan/chiqarilgan odamga kod BERILMAYDI.
    Faqat Telegram javob bera olmasa (bot guruhda emas) bot bazasiga qaraydi."""
    try:
        m = await bot.get_chat_member(chat_id, user_id)
        if m.status in ("member", "administrator", "creator"):
            return True
        if m.status == "restricted":
            return bool(getattr(m, "is_member", True))
        return False
    except Exception:
        row = await _fetchone("SELECT 1 FROM group_members WHERE chat_id=? AND user_id=?", (chat_id, user_id))
        return row is not None


async def _member_slugs(uid: int) -> list:
    """Foydalanuvchi a'zo bo'lgan kurs guruhlari (slug ro'yxati)."""
    await _ensure_course_tables()
    rows = await _fetchall("SELECT slug, chat_id FROM course_bindings")
    out = []
    for slug, chat_id in rows:
        if slug in COURSE_SLUGS and await _is_course_member(chat_id, uid):
            out.append(slug)
    return out


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
    await _ensure_course_tables()
    await _execute(
        "INSERT INTO course_bindings (slug, chat_id) VALUES (?, ?) "
        "ON CONFLICT(slug) DO UPDATE SET chat_id=excluded.chat_id",
        (slug, message.chat.id),
    )
    await message.reply(f"✅ Bu guruh «{esc(COURSE_SLUGS[slug])}» kursi sifatida bog'landi.", parse_mode="HTML")


# ---- ADMIN: bog'lanishlar va berilgan kodlar (shaxsiy chatda) ----
@dp.message(Command("kurslar"), F.chat.type == "private")
async def course_list_cmd(message: types.Message):
    if message.from_user.id not in all_admin_ids():
        return
    await _ensure_course_tables()
    rows = await _fetchall("SELECT slug, chat_id FROM course_bindings")
    bound = {r[0]: r[1] for r in rows}
    lines = []
    for slug, title in COURSE_SLUGS.items():
        chat_id = bound.get(slug)
        gt = get_group_title(chat_id) if chat_id else None
        issued = await _fetchone("SELECT COUNT(*) FROM course_codes_issued WHERE slug=?", (slug,))
        lines.append(
            f"• {esc(title)}: "
            + (f"✅ {esc(gt or str(chat_id))}" if chat_id else "❌ bog'lanmagan (guruhda /kurs " + slug + ")")
            + f" — berilgan kodlar: {issued[0] if issued else 0}"
        )
    if not COURSE_CODE_SECRET:
        lines.append("\n⚠️ COURSE_CODE_SECRET o'rnatilmagan — kodlar ishlamaydi.")
    await message.answer("\n".join(lines), parse_mode="HTML")


# ---- O'QUVCHI: "🌐 Sayt orqali vazifalar" ----
@dp.message(Command("kod"), F.chat.type == "private")
@dp.message(F.text == "🌐 Sayt orqali vazifalar", F.chat.type == "private")
async def course_site_menu(message: types.Message):
    uid = message.from_user.id
    rows = [[InlineKeyboardButton(text="🌐 Saytga o'tish", url=f"{COURSE_SITE_URL}/dashboard/course-tasks")]]
    slugs = await _member_slugs(uid) if COURSE_CODE_SECRET else []
    if slugs:
        for slug in slugs:
            rows.append([InlineKeyboardButton(text=f"🔑 {COURSE_SLUGS[slug]} — kod olish", callback_data=f"ccode|{slug}")])
        text = (
            "🌐 <b>Vazifalarni sayt orqali ishlash</b>\n\n"
            "1) Saytga kiring (ro'yxatdan o'ting)\n"
            "2) Pastdagi tugma bilan guruhingiz kodini oling\n"
            "3) Saytda <b>Kurslar → Kod bilan qo'shilish</b>ga kiriting\n\n"
            "Kod faqat <b>bir marta</b> beriladi va faqat <b>bitta</b> akkauntda ishlaydi."
        )
    else:
        text = (
            "🌐 <b>Vazifalarni sayt orqali ishlash</b>\n\n"
            "Siz hozircha kurs guruhlarimizning a'zosi emassiz — kod faqat guruh a'zolariga beriladi.\n"
            "Kursga qo'shilgach, shu tugmani qayta bosing."
        )
    await message.answer(text, parse_mode="HTML", reply_markup=InlineKeyboardMarkup(inline_keyboard=rows), disable_web_page_preview=True)


@dp.callback_query(F.data.startswith("ccode|"))
async def course_code_cb(callback: types.CallbackQuery):
    slug = callback.data.split("|", 1)[1]
    uid = callback.from_user.id
    if slug not in COURSE_SLUGS or not COURSE_CODE_SECRET:
        await callback.answer("Kod tizimi sozlanmagan.", show_alert=True)
        return
    await _ensure_course_tables()
    row = await _fetchone("SELECT chat_id FROM course_bindings WHERE slug=?", (slug,))
    # A'zolik HAR SAFAR shu guruhning o'zida tekshiriladi
    if not row or not await _is_course_member(row[0], uid):
        await callback.answer(f"Siz «{COURSE_SLUGS[slug]}» guruhi a'zosi emassiz.", show_alert=True)
        return
    code = make_course_code(slug, uid)
    prev = await _fetchone("SELECT 1 FROM course_codes_issued WHERE tg_id=? AND slug=?", (uid, slug))
    if prev is None:
        await _execute(
            "INSERT OR IGNORE INTO course_codes_issued (tg_id, slug, issued_at) VALUES (?, ?, ?)",
            (uid, slug, datetime.datetime.utcnow().isoformat()),
        )
        head = "🔑 <b>Kodingiz tayyor</b>"
        tail = "Bu kod <b>bir marta</b> beriladi. Saytda kiriting: <b>Kurslar → Kod bilan qo'shilish</b>."
    else:
        head = "🔑 <b>Kod avval berilgan</b> (yangisi berilmaydi)"
        tail = "Agar saytda ishlatgan bo'lsangiz — qayta kerak emas. Akkaunt muammosi bo'lsa, o'qituvchiga yozing."
    await callback.message.answer(
        f"{head}\n📚 {esc(COURSE_SLUGS[slug])}\n\n<code>{code}</code>\n\n{tail}\nKodni boshqalarga bermang.",
        parse_mode="HTML",
    )
    await callback.answer()
