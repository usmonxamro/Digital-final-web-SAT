import os
import json
import time
import random
import asyncio
import datetime
import re
import socket
from decimal import Decimal, getcontext, ROUND_HALF_UP
from fractions import Fraction
from urllib.parse import quote
from html import escape as esc

import aiohttp
import aiosqlite
from aiogram import Bot, Dispatcher, types, F
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.filters import CommandStart, Command, CommandObject, BaseFilter
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.exceptions import TelegramRetryAfter, TelegramForbiddenError, TelegramBadRequest

# =====================================================================
# SOZLAMALAR
# =====================================================================
# Token serverdagi BOT_TOKEN muhit o'zgaruvchisidan olinadi, bo'lmasa pastdagisi ishlatiladi.
TOKEN = os.getenv("BOT_TOKEN")
if not TOKEN:
    raise SystemExit("BOT_TOKEN muhit o'zgaruvchisi o'rnatilmagan (Wispbyte → Environment).")
ADMIN_ID = 924190461
ADMIN_IDS = [924190461, 7703440792]  # asosiy (kod ichidagi, o'zgarmas) adminlar -
                                      # FAQAT shular yangi admin qo'sha/olib tashlay oladi
REQUIRED_CHANNELS = ["@SATAKADEMIYASI", "@SAT_surxon"]
NETLIFY_URL = "https://vazifatekshiruvchi.netlify.app/"
DB_PATH = "sat_system.db"

# MOCKLAR (admin kiritgan to'g'ri javoblar) HECH QACHON avtomatik o'chmaydi.
# Faqat o'quvchi natijalari shuncha kundan keyin avtomatik o'chadi (~3.5 oy):
RESULT_LIFETIME_DAYS = 105
# Eski natijalarni tozalash haftada 1 marta ishlaydi:
CLEANUP_INTERVAL_DAYS = 7

# Ro'yxatlar (mocklar, natijalar) sahifalab ko'rsatiladi - Telegram tugmalar sonini cheklaydi
PAGE_SIZE = 10
RESULTS_PAGE_SIZE = 20

# ---------------------------------------------------------------------
# TARMOQ / DNS TUZATISHI
# ---------------------------------------------------------------------
# Wispbyte konteynerlarida ba'zan: (1) ichki DNS-resolver butunlay
# ishlamay qoladi ("Temporary failure in name resolution"), yoki
# (2) DNS ishlaydi-yu, lekin natijada qaytgan IPv6 manzilga ulanish
# konteyner tarmog'ida bloklangan/qo'llab-quvvatlanmaydi
# ("Connect call failed ('2001:...', 443, ...)"). Ikkalasini ham oldini
# olish uchun: Google/Cloudflare DNS'dan foydalanamiz VA ulanishni
# faqat IPv4ga (family=socket.AF_INET) majburlaymiz.
#
# MUHIM: aiohttp.TCPConnector faqat ISHLAB TURGAN event loop ichida
# yaratilishi SHART (aks holda "RuntimeError: no running event loop").
# Shuning uchun bot obyekti fayl boshida emas, balki main() ichida -
# asyncio.run() chaqirilgandan KEYIN yaratiladi. Pastdagi `bot`
# o'zgaruvchisi hozircha bo'sh - main() uni to'ldiradi.
BOT_VERSION = "2026-10-14: DNS-zanjir, avto-vazifa, guruh tanlash, vazifalarim + sayt kodi + admin statistika"
bot: Bot = None
dp = Dispatcher(storage=MemoryStorage())


class _FallbackResolver(aiohttp.abc.AbstractResolver):
    """DNS zanjiri. Wispbyte tarmog'ida DNS ba'zan to'liq ishlamay qoladi ("Timeout while contacting DNS servers").
    Tartib: 1) Google/Cloudflare DNS  ->  2) konteynerning o'z (tizim) DNS i  ->  3) oxirgi ishlagan IP manzil.
    3-bosqich faqat ikkala DNS ham ishlamaganda ishlatiladi; TLS baribir host nomi bo'yicha tekshiriladi."""
    DNS_TIMEOUT = 5
    # api.telegram.org uchun ma'lum manzil - faqat birinchi DNS javobi kelguncha zaxira (keyin yangilanadi)
    _SEED = {"api.telegram.org": ["149.154.167.220"]}

    def __init__(self, nameservers, primary=None, system=None):
        self._primary = primary
        if self._primary is None:
            try:
                self._primary = aiohttp.AsyncResolver(nameservers=nameservers)
            except Exception as e:
                print(f"⚠️ Maxsus DNS (aiodns) yoqilmadi, tizim DNS ishlatiladi: {e}")
        self._system = system if system is not None else aiohttp.ThreadedResolver()
        self._last_good = {h: list(ips) for h, ips in self._SEED.items()}

    async def resolve(self, host, port=0, family=socket.AF_INET):
        last_err = None
        for resolver in (self._primary, self._system):
            if resolver is None:
                continue
            try:
                res = await asyncio.wait_for(resolver.resolve(host, port, family), self.DNS_TIMEOUT)
                if res:
                    self._last_good[host] = [r["host"] for r in res]
                    return res
            except Exception as e:
                last_err = e
        cached = self._last_good.get(host)
        if cached:
            print(f"⚠️ DNS ishlamadi, {host} uchun oxirgi ma'lum IP ishlatiladi: {cached[0]}")
            return [{"hostname": host, "host": ip, "port": port, "family": socket.AF_INET,
                     "proto": 0, "flags": socket.AI_NUMERICHOST} for ip in cached]
        raise last_err or OSError(f"DNS: {host} aniqlanmadi")

    async def close(self):
        for resolver in (self._primary, self._system):
            if resolver is not None:
                try:
                    await resolver.close()
                except Exception:
                    pass


def _build_bot() -> Bot:
    """Event loop ishlab turgan paytda (main() ichida) chaqirilishi SHART."""
    resolver = _FallbackResolver(["8.8.8.8", "1.1.1.1", "8.8.4.4"])
    connector = aiohttp.TCPConnector(
        resolver=resolver,
        family=socket.AF_INET,
        limit=100,
        ttl_dns_cache=300,
    )
    session = AiohttpSession()
    session._connector = connector
    session._should_reset_connector = False
    session.timeout = 30
    return Bot(token=TOKEN, session=session)

# Bot username - ishga tushganda BIR MARTA olinadi (har safar get_me() so'ramaslik uchun)
BOT_USERNAME = ""

# Runtime keshi: botga keyinchalik "➕ Admin qo'shish" orqali qo'shilgan adminlar.
dynamic_admin_ids: set = set()

# --- Tezlik uchun xotiradagi keshlar (bot ishga tushganda bazadan to'ldiriladi) ---
known_groups: dict = {}          # chat_id -> title
known_members: dict = {}         # (chat_id, user_id) -> (fullname, username)
_group_admin_cache: dict = {}    # (chat_id, user_id) -> (is_admin, vaqt)
GROUP_ADMIN_CACHE_SECONDS = 24 * 3600
_sub_cache: dict = {}            # user_id -> obuna tasdiqlangan vaqt
SUB_CACHE_SECONDS = 600

# Eskirgan _group_admin_cache/_sub_cache yozuvlarini xotiradan tozalash
# oralig'i. Bu ikkisi hech qachon o'zi o'chmaydi (faqat qayta tekshirilsa
# yangilanadi), shuning uchun bot haftalar/oylar davomida qayta ishga
# tushmasdan ishlasa, xotira asta-sekin o'saveradi. Har soatda muddati
# o'tgan yozuvlarni yig'ishtirib, xotirani doimiy darajada ushlab turadi.
CACHE_PRUNE_INTERVAL_SECONDS = 3600


def all_admin_ids() -> set:
    """Kod ichidagi doimiy adminlar + bazada saqlangan qo'shimcha adminlar."""
    return set(ADMIN_IDS) | dynamic_admin_ids


db_conn: aiosqlite.Connection = None


async def _fetchone(sql, params=()):
    async with db_conn.execute(sql, params) as cur:
        return await cur.fetchone()


async def _fetchall(sql, params=()):
    async with db_conn.execute(sql, params) as cur:
        return await cur.fetchall()


async def _execute(sql, params=()):
    await db_conn.execute(sql, params)
    await db_conn.commit()


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


# =====================================================================
# ADMIN: "📈 O'quvchilar statistikasi" — guruh bo'yicha BIR JOYDA ro'yxat
# =====================================================================
# 1) O'quvchilar: kim nechta vazifa bajargan / bajarmagan (+ o'rtacha natija)
# 2) Mocklar: har bir mockni nechta o'quvchi bajargan / bajarmagan
# "Bajarilgan" = o'quvchining shu test bo'yicha natijasi bazada bor (qaysi guruh
# nomidan topshirgani muhim emas) — "Vazifalarim" bilan bir xil qoida.
# =====================================================================
def _short(name: str, n: int = 22) -> str:
    name = (name or "—").strip()
    return name if len(name) <= n else name[: n - 1] + "…"


async def _group_stats_lines(chat_id: int) -> list:
    title = get_group_title(chat_id) or str(chat_id)
    members = await _fetchall("SELECT user_id, fullname, username FROM group_members WHERE chat_id=?", (chat_id,))
    tasks = await _fetchall(
        "SELECT t.code, t.name FROM mock_group_assignments a JOIN tests t ON t.code = a.test_code "
        "WHERE a.chat_id=? ORDER BY a.assigned_at DESC",
        (chat_id,),
    )
    lines = [f"📈 <b>{esc(title)}</b> — umumiy statistika"]
    if not members or not tasks:
        lines.append(f"\n👥 A'zolar: {len(members)} ta   🗂 Vazifalar: {len(tasks)} ta")
        lines.append("Statistika uchun guruhda a'zolar va unga biriktirilgan vazifalar bo'lishi kerak.")
        return lines

    codes = [c for c, _ in tasks]
    ph = ",".join("?" * len(codes))
    res_rows = await _fetchall(
        f"SELECT user_id, test_code, correct_count, total_questions FROM results WHERE test_code IN ({ph}) ORDER BY id",
        tuple(codes),
    )
    best = {}  # (user, code) -> eng oxirgi natija
    for uid, code, cor, tot in res_rows:
        best[(uid, code)] = (cor or 0, tot or 0)

    total = len(tasks)
    # ---- 1) o'quvchilar ----
    stu = []
    for uid, fullname, username in members:
        done = [(code, best[(uid, code)]) for code, _ in tasks if (uid, code) in best]
        pcts = [c * 100 / t for _, (c, t) in done if t]
        avg = sum(pcts) / len(pcts) if pcts else None
        stu.append((len(done), avg, fullname, uid))
    stu.sort(key=lambda x: (-x[0], -(x[1] or 0), (x[2] or "").lower()))
    full = sum(1 for d, *_ in stu if d == total)
    none = sum(1 for d, *_ in stu if d == 0)
    lines.append(f"\n👥 A'zolar: <b>{len(members)}</b>   🗂 Vazifalar: <b>{total}</b>")
    lines.append(f"🏁 Hammasini bajargan: <b>{full}</b>   😴 Hech narsa qilmagan: <b>{none}</b>")
    lines.append("\n<b>👤 O'quvchilar</b>  (bajargan/bajarmagan · o'rtacha)")
    rows = []
    for i, (d, avg, fullname, uid) in enumerate(stu, 1):
        avg_t = f"{avg:.0f}%" if avg is not None else "—"
        rows.append(f"{i:>2}. {esc(_short(fullname), quote=False):<22} {d:>2}/{total - d:<2} {avg_t:>5}")
    for s in range(0, len(rows), 40):
        lines.append("<pre>" + "\n".join(rows[s : s + 40]) + "</pre>")

    # ---- 2) mocklar ----
    lines.append(f"\n<b>📚 Mocklar</b>  (bajargan/bajarmagan · o'rtacha)")
    mrows = []
    n = len(members)
    for code, name in tasks:
        got = [(uid, best[(uid, code)]) for uid, _, _ in members if (uid, code) in best]
        pcts = [c * 100 / t for _, (c, t) in got if t]
        avg = sum(pcts) / len(pcts) if pcts else None
        avg_t = f"{avg:.0f}%" if avg is not None else "—"
        mrows.append(f"{esc(code, quote=False):>4} {esc(_short(name, 20), quote=False):<20} {len(got):>3}/{n - len(got):<3} {avg_t:>5}")
    for s in range(0, len(mrows), 40):
        lines.append("<pre>" + "\n".join(mrows[s : s + 40]) + "</pre>")
    lines.append("ℹ️ Aniq kim bajarmaganini ko'rish: «👥 Guruhlar» → mock → statistikasi.")
    return lines


@dp.message(IsPrivateChat(), IsAdmin(), F.text == "📈 O'quvchilar statistikasi")
async def admin_group_stats_menu(message: types.Message):
    groups = await db_list_groups()
    if not groups:
        await message.answer("Hozircha birorta guruh ro'yxatga olinmagan.")
        return
    kb = [[InlineKeyboardButton(text=truncate_label(f"📈 {t or cid}"), callback_data=f"gst|{cid}")] for cid, t in groups]
    if len(groups) > 1:
        kb.append([InlineKeyboardButton(text="📊 Hamma guruhlar", callback_data="gst|all")])
    await message.answer("📈 Qaysi guruhning statistikasi kerak?", reply_markup=InlineKeyboardMarkup(inline_keyboard=kb))


@dp.callback_query(IsAdmin(), F.data.startswith("gst|"))
async def admin_group_stats_cb(callback: types.CallbackQuery):
    arg = callback.data.split("|", 1)[1]
    await callback.answer("Hisoblanmoqda…")
    if arg == "all":
        ids = [cid for cid, _ in await db_list_groups()]
    else:
        ids = [int(arg)]
    for cid in ids:
        await send_long(callback.message, await _group_stats_lines(cid))



# =====================================================================
# XAVFSIZ YUBORISH (Telegram flood-limitiga tushib qolmaslik uchun)
# =====================================================================
async def safe_send(func, *args, **kwargs):
    """Xabar yuboradi. Telegram "sekinroq" desa (RetryAfter) - kutib qayta urinadi.
    Foydalanuvchi botni bloklagan bo'lsa - None qaytaradi, xato tashlamaydi."""
    for _ in range(3):
        try:
            return await func(*args, **kwargs)
        except TelegramRetryAfter as e:
            await asyncio.sleep(e.retry_after + 1)
        except (TelegramForbiddenError, TelegramBadRequest):
            return None
        except Exception:
            return None
    return None


# =====================================================================
# MA'LUMOTLAR BAZASINI YARATISH (async)
# =====================================================================
async def init_db():
    await db_conn.execute("PRAGMA journal_mode=WAL")
    await db_conn.execute("PRAGMA synchronous=NORMAL")

    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS tests (
            code TEXT PRIMARY KEY,
            name TEXT,
            type TEXT,
            level TEXT,
            answers TEXT,
            created_at TEXT
        )
    """)
    cols = [r[1] for r in await _fetchall("PRAGMA table_info(tests)")]
    if "created_at" not in cols:
        await db_conn.execute("ALTER TABLE tests ADD COLUMN created_at TEXT")
        await db_conn.execute("UPDATE tests SET created_at = ? WHERE created_at IS NULL",
                               (datetime.datetime.now().isoformat(),))

    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            fullname TEXT
        )
    """)
    cols = [r[1] for r in await _fetchall("PRAGMA table_info(users)")]
    if "name_set" not in cols:
        await db_conn.execute("ALTER TABLE users ADD COLUMN name_set INTEGER DEFAULT 0")
        await db_conn.execute("UPDATE users SET name_set = 0 WHERE name_set IS NULL")

    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            fullname TEXT,
            username TEXT,
            test_code TEXT,
            test_name TEXT,
            correct_count INTEGER,
            total_questions INTEGER,
            score TEXT
        )
    """)
    cols = [r[1] for r in await _fetchall("PRAGMA table_info(results)")]
    if "student_answers" not in cols:
        await db_conn.execute("ALTER TABLE results ADD COLUMN student_answers TEXT")
    if "chat_id" not in cols:
        await db_conn.execute("ALTER TABLE results ADD COLUMN chat_id INTEGER NOT NULL DEFAULT 0")
    if "submitted_at" not in cols:
        # Natija qachon topshirilgani. Eski natijalarga hozirgi vaqt qo'yiladi -
        # ya'ni ular ham to'liq RESULT_LIFETIME_DAYS kun saqlanadi.
        await db_conn.execute("ALTER TABLE results ADD COLUMN submitted_at TEXT")
        await db_conn.execute("UPDATE results SET submitted_at = ? WHERE submitted_at IS NULL",
                               (datetime.datetime.now().isoformat(),))

    cols = [r[1] for r in await _fetchall("PRAGMA table_info(resubmit_permissions)")]
    if not cols:
        await db_conn.execute("""
            CREATE TABLE resubmit_permissions (
                user_id INTEGER,
                test_code TEXT,
                chat_id INTEGER NOT NULL DEFAULT 0,
                granted_at TEXT,
                PRIMARY KEY (user_id, test_code, chat_id)
            )
        """)
    elif "chat_id" not in cols:
        await db_conn.execute("ALTER TABLE resubmit_permissions RENAME TO resubmit_permissions_old")
        await db_conn.execute("""
            CREATE TABLE resubmit_permissions (
                user_id INTEGER,
                test_code TEXT,
                chat_id INTEGER NOT NULL DEFAULT 0,
                granted_at TEXT,
                PRIMARY KEY (user_id, test_code, chat_id)
            )
        """)
        await db_conn.execute("""
            INSERT INTO resubmit_permissions (user_id, test_code, chat_id, granted_at)
            SELECT user_id, test_code, 0, granted_at FROM resubmit_permissions_old
        """)
        await db_conn.execute("DROP TABLE resubmit_permissions_old")

    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS groups (
            chat_id INTEGER PRIMARY KEY,
            title TEXT,
            added_at TEXT
        )
    """)
    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS group_members (
            chat_id INTEGER,
            user_id INTEGER,
            fullname TEXT,
            joined_at TEXT,
            PRIMARY KEY (chat_id, user_id)
        )
    """)
    cols = [r[1] for r in await _fetchall("PRAGMA table_info(group_members)")]
    if "username" not in cols:
        await db_conn.execute("ALTER TABLE group_members ADD COLUMN username TEXT")
    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS mock_group_assignments (
            test_code TEXT,
            chat_id INTEGER,
            assigned_at TEXT,
            PRIMARY KEY (test_code, chat_id)
        )
    """)

    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS pending_submissions (
            user_id INTEGER,
            test_code TEXT,
            chat_id INTEGER,
            PRIMARY KEY (user_id, test_code)
        )
    """)

    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS bot_admins (
            user_id INTEGER PRIMARY KEY,
            fullname TEXT,
            added_by INTEGER,
            added_at TEXT
        )
    """)

    # Bot sozlamalari (masalan, oxirgi tozalash vaqti) - qayta ishga tushganda ham esda qoladi
    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS bot_meta (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)

    # Admin oxirgi ko'rgan joyi (faqat adminlar uchun, juda kichik jadval)
    await db_conn.execute("""
        CREATE TABLE IF NOT EXISTS admin_last_view (
            user_id INTEGER PRIMARY KEY,
            cb TEXT,
            label TEXT,
            updated_at TEXT
        )
    """)

    # Tugma matni ism sifatida saqlanib qolgan foydalanuvchilar ismini qayta so'raymiz (ma'lumot o'chmaydi)
    _bad = [
        "💻 Web App test kiritish", "✨ Yangi test yaratish", "📊 Natija", "🏆 Reyting", "✏️ Tahrirlash",
        "🗑 Mocklarni boshqarish", "📉 Xatolar statistikasi", "👥 Guruhlar", "📤 Guruhga yuborish", "🗂 Vazifalar",
        "🔍 ID orqali qidirish", "🧹 Javoblarni o'chirish", "👤 Ismni o'zgartirish", "📢 Reklama yuborish",
        "➕ Admin qo'shish", "🗑 Adminlar ro'yxati", "📱 Web app orqali test topshirish", "📋 Vazifalarim",
        "🏠 Bosh menyu", "🌐 Sayt orqali vazifalar", "📈 O'quvchilar statistikasi", "✍️ Javob kiritish",
    ]
    await db_conn.execute(
        f"UPDATE users SET name_set = 0 WHERE fullname IN ({','.join('?' for _ in _bad)})", _bad
    )

    await db_conn.execute("CREATE INDEX IF NOT EXISTS idx_results_test_code ON results(test_code)")
    await db_conn.execute("CREATE INDEX IF NOT EXISTS idx_results_user_id ON results(user_id)")
    await db_conn.execute("CREATE INDEX IF NOT EXISTS idx_results_user_test ON results(user_id, test_code)")
    await db_conn.execute("CREATE INDEX IF NOT EXISTS idx_results_user_test_chat ON results(user_id, test_code, chat_id)")
    await db_conn.execute("CREATE INDEX IF NOT EXISTS idx_results_submitted_at ON results(submitted_at)")
    await db_conn.execute("CREATE INDEX IF NOT EXISTS idx_group_members_chat ON group_members(chat_id)")
    await db_conn.execute("CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id)")
    await db_conn.execute("CREATE INDEX IF NOT EXISTS idx_mock_group_chat ON mock_group_assignments(chat_id)")
    await db_conn.execute("CREATE INDEX IF NOT EXISTS idx_mock_group_code ON mock_group_assignments(test_code)")
    await db_conn.execute("CREATE INDEX IF NOT EXISTS idx_tests_created_at ON tests(created_at)")
    await db_conn.commit()


async def load_caches():
    """Guruhlar va a'zolarni xotiraga yuklaydi - har bir guruh xabarida bazaga yozmaslik uchun."""
    known_groups.clear()
    for chat_id, title in await _fetchall("SELECT chat_id, title FROM groups"):
        known_groups[chat_id] = title
    known_members.clear()
    for chat_id, user_id, fullname, username in await _fetchall(
        "SELECT chat_id, user_id, fullname, username FROM group_members"
    ):
        known_members[(chat_id, user_id)] = (fullname, username)


async def prune_stale_caches():
    """_group_admin_cache va _sub_cache hech qachon o'zi o'chmaydi - faqat
    qayta tekshirilganda yangilanadi. Bot uzoq vaqt (haftalar/oylar) qayta
    ishga tushmasdan ishlasa, bu ikkisi xotirada asta-sekin to'planib
    boraveradi (yangi noyob foydalanuvchi/guruh juftligi qo'shilgani sayin).
    Shu vazifa har soatda muddati allaqachon o'tgan yozuvlarni yig'ishtirib,
    xotira sarfini doimiy darajada ushlab turadi - funksionallikka ta'sir
    qilmaydi, chunki muddati o'tgan yozuv baribir qayta tekshirilar edi."""
    while True:
        await asyncio.sleep(CACHE_PRUNE_INTERVAL_SECONDS)
        try:
            now = time.monotonic()

            expired_admin_keys = [
                k for k, (_is_admin, ts) in _group_admin_cache.items()
                if now - ts >= GROUP_ADMIN_CACHE_SECONDS
            ]
            for k in expired_admin_keys:
                _group_admin_cache.pop(k, None)

            expired_sub_keys = [
                uid for uid, ts in _sub_cache.items()
                if now - ts >= SUB_CACHE_SECONDS
            ]
            for uid in expired_sub_keys:
                _sub_cache.pop(uid, None)

            if expired_admin_keys or expired_sub_keys:
                print(
                    f"Kesh tozalandi: {len(expired_admin_keys)} ta admin-kesh, "
                    f"{len(expired_sub_keys)} ta obuna-kesh yozuvi olib tashlandi."
                )
        except Exception as e:
            print(f"Kesh tozalash xatoligi: {e}")


# =====================================================================
# DB QATLAMI: META
# =====================================================================
async def db_get_meta(key):
    row = await _fetchone("SELECT value FROM bot_meta WHERE key = ?", (key,))
    return row[0] if row else None


async def db_set_meta(key, value):
    await _execute(
        "INSERT INTO bot_meta (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, value)
    )


# =====================================================================
# DB QATLAMI: USERS
# =====================================================================
async def db_upsert_user_on_start(user_id, username, fullname) -> bool:
    row = await _fetchone("SELECT username FROM users WHERE user_id = ?", (user_id,))
    if row:
        if row[0] != username:
            await _execute("UPDATE users SET username = ? WHERE user_id = ?", (username, user_id))
        return True
    await _execute(
        "INSERT INTO users (user_id, username, fullname, name_set) VALUES (?, ?, ?, 0)",
        (user_id, username, fullname)
    )
    return False


async def db_has_name_set(user_id) -> bool:
    row = await _fetchone("SELECT name_set FROM users WHERE user_id = ?", (user_id,))
    return bool(row and row[0])


MENU_BUTTON_LABELS = {
    "💻 Web App test kiritish", "✨ Yangi test yaratish", "📊 Natija", "🏆 Reyting", "✏️ Tahrirlash",
    "🗑 Mocklarni boshqarish", "📉 Xatolar statistikasi", "👥 Guruhlar", "📤 Guruhga yuborish", "🗂 Vazifalar",
    "🔍 ID orqali qidirish", "🧹 Javoblarni o'chirish", "👤 Ismni o'zgartirish", "📢 Reklama yuborish",
    "➕ Admin qo'shish", "🗑 Adminlar ro'yxati", "📱 Web app orqali test topshirish", "📋 Vazifalarim",
    "🏠 Bosh menyu", "🌐 Sayt orqali vazifalar", "📈 O'quvchilar statistikasi", "✍️ Javob kiritish", "🛠 WebApp interfeysini ochish", "✏️ Tahrirlash uchun WebApp ochish",
}


def is_bad_name(text: str) -> bool:
    """Menyu tugmasi matni, buyruq yoki harfsiz matn ism bo'la olmaydi."""
    t = (text or "").strip()
    return (not t) or t in MENU_BUTTON_LABELS or t.startswith("/") or not any(ch.isalpha() for ch in t) or len(t) > 60


async def db_set_full_name(user_id, username, fullname):
    # Oldin xato saqlangan (tugma matni) ismlarni natijalarda ham to'g'rilaymiz
    placeholders = ",".join("?" for _ in MENU_BUTTON_LABELS)
    await _execute(
        f"UPDATE results SET fullname = ? WHERE user_id = ? AND fullname IN ({placeholders})",
        (fullname, user_id, *MENU_BUTTON_LABELS)
    )
    await _execute(
        "INSERT INTO users (user_id, username, fullname, name_set) VALUES (?, ?, ?, 1) "
        "ON CONFLICT(user_id) DO UPDATE SET username=excluded.username, fullname=excluded.fullname, name_set=1",
        (user_id, username, fullname)
    )


async def db_get_user_fullname_if_set(user_id):
    row = await _fetchone("SELECT fullname, name_set FROM users WHERE user_id = ?", (user_id,))
    return row[0] if (row and row[1]) else None


async def db_count_users() -> int:
    row = await _fetchone("SELECT COUNT(*) FROM users")
    return row[0]


async def db_list_all_user_ids():
    rows = await _fetchall("SELECT user_id FROM users")
    return [r[0] for r in rows]


# =====================================================================
# DB QATLAMI: QO'SHIMCHA ADMINLAR
# =====================================================================
async def db_add_bot_admin(user_id, fullname, added_by):
    await _execute(
        "INSERT OR REPLACE INTO bot_admins (user_id, fullname, added_by, added_at) VALUES (?, ?, ?, ?)",
        (user_id, fullname, added_by, datetime.datetime.now().isoformat())
    )


async def db_remove_bot_admin(user_id):
    await _execute("DELETE FROM bot_admins WHERE user_id=?", (user_id,))


async def db_list_bot_admins():
    return await _fetchall("SELECT user_id, fullname, added_at FROM bot_admins ORDER BY added_at DESC")


# =====================================================================
# DB QATLAMI: TESTS
# =====================================================================
async def db_generate_unique_code() -> str:
    # Mocklar endi o'chmagani uchun 3 xonali kodlar (900 ta) tugab qolishi mumkin -
    # shunda avtomatik 4 xonali kodga o'tiladi.
    for digits in (3, 4, 5):
        low, high = 10 ** (digits - 1), 10 ** digits - 1
        for _ in range(200):
            code = str(random.randint(low, high))
            row = await _fetchone("SELECT 1 FROM tests WHERE code = ?", (code,))
            if not row:
                return code
    raise RuntimeError("Bo'sh test kodi topilmadi")


async def db_insert_test(code, name, type_, level, answers: dict):
    await _execute(
        "INSERT INTO tests (code, name, type, level, answers, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (code, name, type_, level, json.dumps(answers), datetime.datetime.now().isoformat())
    )


async def db_get_test(code):
    row = await _fetchone("SELECT name, type, level, answers FROM tests WHERE code = ?", (code,))
    if not row:
        return None
    name, type_, level, answers_raw = row
    return name, type_, level, json.loads(answers_raw)


async def db_update_test_answers(code, answers: dict):
    await _execute("UPDATE tests SET answers = ? WHERE code = ?", (json.dumps(answers), code))


async def db_delete_test_and_results(code):
    """Faqat admin QO'LDA "🗑 Mocklarni boshqarish" orqali o'chirganda ishlaydi."""
    await db_conn.execute("DELETE FROM results WHERE test_code = ?", (code,))
    await db_conn.execute("DELETE FROM tests WHERE code = ?", (code,))
    await db_conn.execute("DELETE FROM mock_group_assignments WHERE test_code = ?", (code,))
    await db_conn.execute("DELETE FROM resubmit_permissions WHERE test_code = ?", (code,))
    await db_conn.execute("DELETE FROM pending_submissions WHERE test_code = ?", (code,))
    await db_conn.commit()


async def db_clear_test_results(code):
    await db_conn.execute("DELETE FROM results WHERE test_code = ?", (code,))
    await db_conn.execute("DELETE FROM resubmit_permissions WHERE test_code = ?", (code,))
    await db_conn.commit()


async def db_list_tests():
    return await _fetchall("SELECT code, name FROM tests ORDER BY created_at DESC")


async def db_get_test_name(code):
    row = await _fetchone("SELECT name FROM tests WHERE code = ?", (code,))
    return row[0] if row else None


async def db_count_tests() -> int:
    row = await _fetchone("SELECT COUNT(*) FROM tests")
    return row[0]


async def db_count_results_for_test(code) -> int:
    row = await _fetchone("SELECT COUNT(*) FROM results WHERE test_code = ?", (code,))
    return row[0]


async def db_get_test_details(code):
    return await _fetchone("SELECT name, type, level, created_at FROM tests WHERE code = ?", (code,))


async def db_expire_old_results(cutoff_iso: str) -> int:
    """FAQAT o'quvchi natijalarini o'chiradi. Mocklar (tests) bu yerda HECH QACHON o'chmaydi."""
    cur = await db_conn.execute(
        "DELETE FROM results WHERE submitted_at IS NOT NULL AND submitted_at <= ?",
        (cutoff_iso,)
    )
    deleted = cur.rowcount
    await db_conn.execute(
        "DELETE FROM resubmit_permissions WHERE granted_at IS NOT NULL AND granted_at <= ?",
        (cutoff_iso,)
    )
    await db_conn.commit()
    return deleted


# =====================================================================
# DB QATLAMI: RESULTS
# =====================================================================
async def db_has_submitted(user_id, code, chat_id: int = 0) -> bool:
    row = await _fetchone(
        "SELECT 1 FROM results WHERE user_id=? AND test_code=? AND chat_id=?",
        (user_id, code, chat_id)
    )
    return row is not None


async def db_has_resubmit_permission(user_id, code, chat_id: int = 0) -> bool:
    row = await _fetchone(
        "SELECT 1 FROM resubmit_permissions WHERE user_id=? AND test_code=? AND chat_id=?",
        (user_id, code, chat_id)
    )
    return row is not None


async def db_grant_resubmit_permission(user_id, code, chat_id: int = 0):
    await _execute(
        "INSERT OR REPLACE INTO resubmit_permissions (user_id, test_code, chat_id, granted_at) VALUES (?, ?, ?, ?)",
        (user_id, code, chat_id, datetime.datetime.now().isoformat())
    )


async def db_revoke_resubmit_permission(user_id, code, chat_id: int = 0):
    await _execute(
        "DELETE FROM resubmit_permissions WHERE user_id=? AND test_code=? AND chat_id=?",
        (user_id, code, chat_id)
    )


async def db_insert_result(user_id, fullname, username, code, test_name, correct_count,
                            total_questions, score, student_answers: dict, chat_id: int = 0) -> int:
    cur = await db_conn.execute(
        "INSERT INTO results (user_id, fullname, username, test_code, test_name, correct_count, "
        "total_questions, score, student_answers, chat_id, submitted_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (user_id, fullname, username, code, test_name, correct_count, total_questions,
         str(score), json.dumps(student_answers), chat_id, datetime.datetime.now().isoformat())
    )
    await db_conn.commit()
    return cur.lastrowid


async def db_get_result_by_id(rid):
    return await _fetchone(
        "SELECT user_id, fullname, username, test_code, test_name, correct_count, total_questions, "
        "score, student_answers, chat_id FROM results WHERE id = ?",
        (rid,)
    )


async def db_get_results_for_test(code):
    return await _fetchall(
        "SELECT id, fullname, username, correct_count, total_questions, score "
        "FROM results WHERE test_code = ? ORDER BY id DESC",
        (code,)
    )


async def db_get_results_for_user(user_id):
    return await _fetchall(
        "SELECT id, test_name, correct_count, total_questions, score, chat_id FROM results "
        "WHERE user_id = ? ORDER BY id ASC",
        (user_id,)
    )


async def db_get_user_tests_for_leaderboard(user_id):
    return await _fetchall(
        "SELECT DISTINCT t.code, t.name, t.created_at FROM tests t JOIN results r ON r.test_code = t.code "
        "WHERE r.user_id = ? ORDER BY t.created_at DESC",
        (user_id,)
    )


async def db_get_leaderboard_rows(code):
    return await _fetchall(
        "SELECT fullname, correct_count, total_questions, score, user_id, chat_id, username FROM results "
        "WHERE test_code = ? ORDER BY correct_count DESC, id ASC",
        (code,)
    )


async def db_get_results_with_student_answers(code):
    rows = await _fetchall(
        "SELECT id, user_id, correct_count, total_questions, score, student_answers, chat_id "
        "FROM results WHERE test_code = ? AND student_answers IS NOT NULL",
        (code,)
    )
    return [(rid, uid, c, t, s, json.loads(raw), cid) for rid, uid, c, t, s, raw, cid in rows]


async def db_get_error_stats_rows(code):
    rows = await _fetchall(
        "SELECT fullname, student_answers, user_id, chat_id, username FROM results "
        "WHERE test_code = ? AND student_answers IS NOT NULL",
        (code,)
    )
    return [(fullname, json.loads(raw), uid, cid, uname) for fullname, raw, uid, cid, uname in rows]


async def db_get_results_index_by_user(code, chat_id=None):
    """chat_id berilsa - avval shu guruh nomidan topshirilgan natija, bo'lmasa
    guruhsiz (chat_id=0), bo'lmasa boshqa guruh nomidan topshirilgan natija olinadi
    (vazifa guruhga keyin biriktirilgan bo'lsa ham oldingi natija hisobga olinadi)."""
    if chat_id is not None:
        rows = await _fetchall(
            "SELECT user_id, correct_count, total_questions, score, chat_id FROM results "
            "WHERE test_code=? ORDER BY (chat_id = ?) DESC, (chat_id = 0) DESC, id DESC",
            (code, chat_id)
        )
        result = {}
        for user_id, correct, total, score, _r_chat_id in rows:
            if user_id not in result:
                result[user_id] = (correct, total, score)
        return result
    else:
        rows = await _fetchall(
            "SELECT user_id, correct_count, total_questions, score FROM results WHERE test_code=?",
            (code,)
        )
        return {r[0]: (r[1], r[2], r[3]) for r in rows}


# =====================================================================
# DB QATLAMI: PENDING SUBMISSIONS
# =====================================================================
async def db_set_pending_submission(user_id, code, chat_id: int):
    await _execute(
        "INSERT INTO pending_submissions (user_id, test_code, chat_id) VALUES (?, ?, ?) "
        "ON CONFLICT(user_id, test_code) DO UPDATE SET chat_id=excluded.chat_id",
        (user_id, code, chat_id)
    )


async def db_pop_pending_submission(user_id, code) -> int:
    row = await _fetchone(
        "SELECT chat_id FROM pending_submissions WHERE user_id=? AND test_code=?",
        (user_id, code)
    )
    if row:
        await _execute(
            "DELETE FROM pending_submissions WHERE user_id=? AND test_code=?",
            (user_id, code)
        )
        return row[0]
    return 0


async def db_get_assigned_group_chat_ids_for_user(user_id, code):
    rows = await _fetchall(
        "SELECT gm.chat_id FROM group_members gm "
        "JOIN mock_group_assignments a ON a.chat_id = gm.chat_id "
        "WHERE gm.user_id = ? AND a.test_code = ?",
        (user_id, code)
    )
    return [r[0] for r in rows]


# =====================================================================
# DB QATLAMI: GURUHLAR (kesh bilan)
# =====================================================================
def get_group_title(chat_id):
    """Guruh nomi xotiradan olinadi - bazaga so'rov yubormaydi."""
    return known_groups.get(chat_id)


async def db_register_group(chat_id, title):
    title = title or str(chat_id)
    await _execute(
        "INSERT INTO groups (chat_id, title, added_at) VALUES (?, ?, ?) "
        "ON CONFLICT(chat_id) DO UPDATE SET title=excluded.title",
        (chat_id, title, datetime.datetime.now().isoformat())
    )
    known_groups[chat_id] = title


async def ensure_group_registered(chat_id, title):
    """Faqat guruh yangi bo'lsa yoki nomi o'zgargan bo'lsa bazaga yozadi."""
    if known_groups.get(chat_id) != (title or str(chat_id)):
        await db_register_group(chat_id, title)


async def db_register_group_member(chat_id, user_id, fullname, username=None):
    fullname = fullname or str(user_id)
    await _execute(
        "INSERT INTO group_members (chat_id, user_id, fullname, username, joined_at) VALUES (?, ?, ?, ?, ?) "
        "ON CONFLICT(chat_id, user_id) DO UPDATE SET fullname=excluded.fullname, username=excluded.username",
        (chat_id, user_id, fullname, username, datetime.datetime.now().isoformat())
    )
    known_members[(chat_id, user_id)] = (fullname, username)


async def track_group_member(chat_id, user_id, fullname, username):
    """Faqat a'zo yangi bo'lsa yoki ismi/username o'zgargan bo'lsa bazaga yozadi."""
    if known_members.get((chat_id, user_id)) == (fullname or str(user_id), username):
        return
    await db_register_group_member(chat_id, user_id, fullname, username)


async def db_remove_group_member(chat_id, user_id):
    await _execute("DELETE FROM group_members WHERE chat_id=? AND user_id=?", (chat_id, user_id))
    known_members.pop((chat_id, user_id), None)


async def db_list_groups():
    return await _fetchall("SELECT chat_id, title FROM groups ORDER BY added_at DESC")


async def db_count_group_members(chat_id) -> int:
    row = await _fetchone("SELECT COUNT(*) FROM group_members WHERE chat_id=?", (chat_id,))
    return row[0]


async def db_get_group_members(chat_id):
    return await _fetchall("SELECT user_id, fullname, username FROM group_members WHERE chat_id=?", (chat_id,))


async def db_assign_mock_to_group(code, chat_id):
    await _execute(
        "INSERT OR REPLACE INTO mock_group_assignments (test_code, chat_id, assigned_at) VALUES (?, ?, ?)",
        (code, chat_id, datetime.datetime.now().isoformat())
    )


async def db_is_mock_assigned(code, chat_id) -> bool:
    row = await _fetchone(
        "SELECT 1 FROM mock_group_assignments WHERE test_code=? AND chat_id=?", (code, chat_id)
    )
    return row is not None


async def db_get_group_mocks(chat_id):
    return await _fetchall(
        "SELECT t.code, t.name FROM mock_group_assignments a "
        "JOIN tests t ON t.code = a.test_code WHERE a.chat_id=? ORDER BY a.assigned_at DESC",
        (chat_id,)
    )


async def db_get_group_overall_progress(chat_id):
    return await _fetchall(
        "SELECT gm.user_id, gm.fullname, gm.username, COUNT(DISTINCT r.test_code) AS done_count "
        "FROM group_members gm "
        "JOIN mock_group_assignments a ON a.chat_id = gm.chat_id "
        "LEFT JOIN results r ON r.user_id = gm.user_id AND r.test_code = a.test_code "
        "WHERE gm.chat_id = ? "
        "GROUP BY gm.user_id, gm.fullname, gm.username",
        (chat_id,)
    )


# =====================================================================
# ESKI NATIJALARNI TOZALASH (haftada 1 marta, mocklarga tegmaydi)
# =====================================================================
async def cleanup_old_results():
    """Oxirgi tozalash vaqti bazada saqlanadi, shuning uchun bot qayta ishga
    tushsa ham tozalash haftada bir martadan ko'p bo'lmaydi. Oraliqda bot
    uxlab turadi - hech qanday so'rov yubormaydi."""
    interval = datetime.timedelta(days=CLEANUP_INTERVAL_DAYS)
    while True:
        wait_seconds = 0
        last_raw = await db_get_meta("last_results_cleanup")
        if last_raw:
            try:
                last = datetime.datetime.fromisoformat(last_raw)
                wait_seconds = max(0, (last + interval - datetime.datetime.now()).total_seconds())
            except Exception:
                wait_seconds = 0
        if wait_seconds > 0:
            await asyncio.sleep(wait_seconds)

        try:
            cutoff = (datetime.datetime.now() - datetime.timedelta(days=RESULT_LIFETIME_DAYS)).isoformat()
            deleted = await db_expire_old_results(cutoff)
            await db_set_meta("last_results_cleanup", datetime.datetime.now().isoformat())
            print(f"Tozalash: {deleted} ta eski natija o'chirildi (mocklar saqlanib qoldi).")
        except Exception as e:
            print(f"Tozalash xatoligi: {e}")
            await asyncio.sleep(6 * 3600)  # xato bo'lsa 6 soatdan keyin qayta urinadi


# =====================================================================
# FSM HOLATLARI
# =====================================================================
class NameState(StatesGroup):
    waiting_for_name = State()


class AdminState(StatesGroup):
    waiting_for_name = State()
    waiting_for_level = State()


class StudentState(StatesGroup):
    waiting_for_code = State()


class AdminEditState(StatesGroup):
    waiting_for_code = State()


class AdState(StatesGroup):
    waiting_for_content = State()
    waiting_for_button = State()


class GroupSendState(StatesGroup):
    choosing_groups = State()


class TaskAssignState(StatesGroup):
    waiting_for_codes = State()


class AdminManageState(StatesGroup):
    waiting_for_new_admin_id = State()


class AdminSearchState(StatesGroup):
    waiting_for_user_id = State()


# =====================================================================
# FILTERLAR
# =====================================================================
class IsAdmin(BaseFilter):
    async def __call__(self, event) -> bool:
        user = getattr(event, "from_user", None)
        return bool(user and user.id in all_admin_ids())


class IsSuperAdmin(BaseFilter):
    async def __call__(self, event) -> bool:
        user = getattr(event, "from_user", None)
        return bool(user and user.id in ADMIN_IDS)


class IsPrivateChat(BaseFilter):
    async def __call__(self, message: types.Message) -> bool:
        return message.chat.type == "private"


class IsGroupChat(BaseFilter):
    async def __call__(self, message: types.Message) -> bool:
        return message.chat.type in ("group", "supergroup")


# =====================================================================
# SAT JAVOBLARINI TEKSHIRISH TIZIMI
# =====================================================================
getcontext().prec = 50


def _clean_num(s: str) -> str:
    return s.strip().replace(" ", "")


def _parse_exact(s: str):
    s = _clean_num(s)
    if not s:
        return None
    neg = s.startswith('-')
    if neg:
        s = s[1:]
    if not re.fullmatch(r"\d+\.\d*|\.\d+|\d+|\d+/\d+", s):
        return None
    try:
        if '/' in s:
            num_str, den_str = s.split('/')
            if den_str == '0':
                return None
            value = Fraction(int(num_str), int(den_str))
        else:
            value = Fraction(Decimal(s))
    except Exception:
        return None
    return -value if neg else value


def _acceptable_grid_reprs(value: Fraction, max_chars: int = 5) -> set:
    neg = value < 0
    d = abs(Decimal(value.numerator) / Decimal(value.denominator))
    s = format(d, 'f')

    results = set()
    variants = [s]
    if s.startswith('0.'):
        variants.append(s[1:])

    for variant in variants:
        truncated = variant[:max_chars]
        if truncated.endswith('.'):
            truncated = variant[:max_chars + 1]
        results.add(truncated)

        decimals = len(truncated.split('.')[1]) if '.' in truncated else 0
        quant = Decimal(1).scaleb(-decimals) if decimals > 0 else Decimal(1)
        rounded = d.quantize(quant, rounding=ROUND_HALF_UP)
        rounded_str = format(rounded, 'f')
        if variant is not s and rounded_str.startswith('0.'):
            rounded_str = rounded_str[1:]
        results.add(rounded_str)

    return {('-' if neg else '') + r for r in results}


def _grid_in_match(correct_str: str, student_str: str) -> bool:
    correct_val = _parse_exact(correct_str)
    student_val = _parse_exact(student_str)
    if correct_val is None or student_val is None:
        return False
    if correct_val == student_val:
        return True
    acceptable = _acceptable_grid_reprs(correct_val)
    if _clean_num(student_str) in acceptable:
        return True
    for r in acceptable:
        v = _parse_exact(r)
        if v is not None and v == student_val:
            return True
    return False


def _split_multi(s: str) -> list:
    parts = re.split(r'[=,]', s or "")
    return [p.strip() for p in parts if p.strip()]


def check_sat_answer(student_ans, admin_ans_str):
    student_ans = (student_ans or "").strip()
    student_upper = student_ans.upper()
    admin_variants = _split_multi(admin_ans_str)

    if student_upper in ('A', 'B', 'C', 'D'):
        return student_upper in [v.upper() for v in admin_variants]

    student_variants = _split_multi(student_ans)
    if not student_variants:
        student_variants = [student_ans]

    for s_variant in student_variants:
        for variant in admin_variants:
            if _grid_in_match(variant, s_variant):
                return True
    return False


SAT_MATH_SCALE = {
    44: (800, 800, 800), 43: (780, 790, 790), 42: (770, 770, 780),
    41: (750, 760, 770), 40: (740, 750, 760), 39: (720, 730, 740),
    38: (710, 710, 730), 37: (700, 700, 720), 36: (680, 690, 700),
    35: (660, 670, 690), 34: (650, 650, 680), 33: (630, 640, 670),
    32: (620, 630, 660), 31: (610, 620, 650), 30: (600, 600, 640),
    29: (580, 590, 620), 28: (550, 570, 610), 27: (540, 560, 600),
    26: (540, 550, 590), 25: (530, 550, 580), 24: (520, 530, 570),
    23: (500, 520, 560), 22: (470, 510, 550), 21: (460, 500, 540),
    20: (460, 490, 530), 19: (450, 480, 500), 18: (450, 480, 500),
    17: (450, 480, 500), 16: (450, 480, 500), 15: (420, 460, 460),
    14: (420, 460, 460), 13: (420, 460, 460), 12: (350, 380, 380),
    11: (350, 380, 380), 10: (350, 380, 380), 9: (270, 300, 300),
    8: (270, 300, 300), 7: (270, 300, 300), 6: (270, 300, 300),
    5: (270, 300, 300), 4: (200, 200, 200), 3: (200, 200, 200),
    2: (200, 200, 200), 1: (200, 200, 200), 0: (200, 200, 200),
}
_LEVEL_INDEX = {"easy": 0, "normal": 1, "hard": 2}


def _raw_to_scaled(raw_44: int, level: str) -> int:
    idx = _LEVEL_INDEX.get(level, 1)
    raw_44 = max(0, min(44, raw_44))
    entry = SAT_MATH_SCALE.get(raw_44)
    if entry is None:
        lower = [k for k in SAT_MATH_SCALE if k <= raw_44]
        raw_44 = max(lower) if lower else min(SAT_MATH_SCALE)
        entry = SAT_MATH_SCALE[raw_44]
    return entry[idx]


def calculate_sat_score(correct, total, level):
    if level == 'oddiy' or total == 0:
        return f"{correct}/{total}"
    if total == 44:
        raw_44 = correct
    else:
        raw_44 = round(correct * 44 / total)
    scaled = _raw_to_scaled(raw_44, level)
    return f"{scaled} / 800"


def question_label(test_type, q_num) -> str:
    q_int = int(q_num) if str(q_num).isdigit() else None
    if test_type == "modulli_44" and q_int and q_int > 22:
        return f"2-modul, {q_int - 22}-savol"
    elif test_type == "modulli_44" and q_int:
        return f"1-modul, {q_int}-savol"
    return f"{q_num}-savol"


def _sorted_qnums(answers: dict):
    return sorted(answers.keys(), key=lambda x: int(x) if x.isdigit() else 0)


def build_result_body(admin_answers: dict, student_answers: dict, test_type: str):
    correct_count = 0
    total_questions = len(admin_answers)
    lines = []
    for q_num in _sorted_qnums(admin_answers):
        a_ans = admin_answers[q_num]
        s_ans = student_answers.get(str(q_num), "-")
        label = question_label(test_type, q_num)
        if check_sat_answer(s_ans, a_ans):
            correct_count += 1
            lines.append(f"{label}: {esc(s_ans)} ✅ Correct\n")
        else:
            lines.append(f"{label}: {esc(s_ans)} ❌ ({esc(a_ans)})\n")
    return correct_count, total_questions, "".join(lines)


def build_format_string(admin_answers: dict) -> str:
    chars = []
    for q in _sorted_qnums(admin_answers):
        variants = _split_multi(admin_answers[q])
        first_variant = (variants[0].upper() if variants else admin_answers[q].strip().upper())
        chars.append('M' if first_variant in ['A', 'B', 'C', 'D'] else 'G')
    return ''.join(chars)


# =====================================================================
# FORMATLASH YORDAMCHILARI
# =====================================================================
ORDINALS_UZ = {
    1: "1-chi", 2: "2-chi", 3: "3-chi", 4: "4-chi", 5: "5-chi",
    6: "6-chi", 7: "7-chi", 8: "8-chi", 9: "9-chi", 10: "10-chi",
}


def ordinal_uz(n: int) -> str:
    return ORDINALS_UZ.get(n, f"{n}-")


_USERNAME_PLACEHOLDERS = {"foydalanuvchi", "username yo'q", "noma'lum"}


def build_test_announcement(test_name: str, code, total_questions: int, author_name: str) -> str:
    """Yangi test e'loni - bitta shablon (test yaratilganda ham, guruhga yuborilganda ham)."""
    link = f"https://t.me/{BOT_USERNAME}?start={code}"
    return (
        f"📚 <b>Mock nomi:</b> {esc(test_name)}\n"
        f"🌐 <b>Test kodi:</b> <code>{esc(code)}</code>\n"
        f"🔂 <b>Savollar soni:</b> {total_questions}\n\n"
        f"✍️ <b>Muallif:</b> {esc(author_name)}\n"
        f"<b>Javoblaringizni quyidagi botga yuboring:</b>\n"
        f"👉@{BOT_USERNAME}\n👉@{BOT_USERNAME}\n👉@{BOT_USERNAME}\n\n"
        f"<b>yoki quyidagi link orqali kiring:</b>\n"
        f"🔗 <b>O'quvchilar uchun havola:</b>\n"
        f"👉{link}"
    )


def user_link(fullname: str, user_id: int, username: str = None) -> str:
    display = esc(fullname or str(user_id))
    if username:
        clean = username.strip()
        if clean.startswith('@'):
            clean = clean[1:].strip()
        if clean and ' ' not in clean and clean.lower() not in _USERNAME_PLACEHOLDERS:
            return f'<a href="https://t.me/{clean}">{display}</a>'
    return f'<a href="tg://user?id={user_id}">{display}</a>'


def format_dt(iso_str):
    if not iso_str:
        return "noma'lum"
    try:
        dt = datetime.datetime.fromisoformat(iso_str)
        return dt.strftime("%d.%m.%Y %H:%M")
    except Exception:
        return iso_str


def truncate_label(text: str, limit: int = 60) -> str:
    return text[: limit - 3] + "..." if len(text) > limit else text


def chunk_lines(lines: list, header: str = "", max_chars: int = 3800):
    chunks = []
    chunk = ""
    for line in lines:
        if len(chunk) + len(line) + 1 > max_chars:
            chunks.append(header + chunk if header else chunk)
            header = ""
            chunk = ""
        chunk += line + "\n"
    if chunk:
        chunks.append(header + chunk if header else chunk)
    return chunks


async def send_long(target_message: types.Message, lines: list, reply_markup=None):
    """Uzun matnni bo'laklab yuboradi; tugmalar oxirgi bo'lakka qo'yiladi."""
    text = "\n".join(lines)
    if len(text) <= 4096:
        await target_message.answer(text, parse_mode="HTML", reply_markup=reply_markup)
        return
    header = lines[0] + "\n"
    parts = chunk_lines(lines[1:], header=header)
    for i, part in enumerate(parts):
        markup = reply_markup if i == len(parts) - 1 else None
        await target_message.answer(part, parse_mode="HTML", reply_markup=markup)


# ---------------------------------------------------------------------
# SAHIFALASH (mocklar endi o'chmaydi -> ro'yxatlar uzayadi, Telegram esa
# bitta xabardagi tugmalar sonini cheklaydi)
# ---------------------------------------------------------------------
PAGED_PREFIXES = {
    "admres_test_": "📚",
    "lb_": "📚",
    "edittest_": "✏️",
    "errstat_": "📉",
    "clranswers_": "🧹",
    "gsend_test_": "📤",
    "delmock_": "🗑",
}


def _page_bounds(total_items: int, page: int, size: int):
    total_pages = max(1, (total_items + size - 1) // size)
    page = max(0, min(page, total_pages - 1))
    return page, total_pages, page * size, (page + 1) * size


def _nav_row(cb_prefix: str, page: int, total_pages: int):
    row = []
    if page > 0:
        row.append(InlineKeyboardButton(text="⬅️ Oldingi", callback_data=f"{cb_prefix}{page - 1}"))
    row.append(InlineKeyboardButton(text=f"{page + 1}/{total_pages}", callback_data="noop"))
    if page < total_pages - 1:
        row.append(InlineKeyboardButton(text="Keyingi ➡️", callback_data=f"{cb_prefix}{page + 1}"))
    return row


def tests_list_kb(rows, callback_prefix: str, page: int = 0) -> InlineKeyboardMarkup:
    emoji = PAGED_PREFIXES.get(callback_prefix, "📚")
    page, total_pages, start, end = _page_bounds(len(rows), page, PAGE_SIZE)
    buttons = []
    for row in rows[start:end]:
        code, name = row[0], row[1]
        label = truncate_label(f"{emoji} {name} ({code})")
        buttons.append([InlineKeyboardButton(text=label, callback_data=f"{callback_prefix}{code}")])
    if total_pages > 1:
        buttons.append(_nav_row(f"pg|{callback_prefix}|", page, total_pages))
    return InlineKeyboardMarkup(inline_keyboard=buttons)


async def _tests_for_prefix(prefix: str, user_id: int):
    if prefix == "lb_" and user_id not in all_admin_ids():
        return await db_get_user_tests_for_leaderboard(user_id)
    return await db_list_tests()


@dp.callback_query(F.data == "noop")
async def noop_cb(callback: types.CallbackQuery):
    await callback.answer()


@dp.callback_query(F.data.startswith("pg|"))
async def paginate_tests(callback: types.CallbackQuery):
    try:
        _, prefix, page_str = callback.data.split("|")
        page = int(page_str)
    except Exception:
        await callback.answer()
        return
    if prefix not in PAGED_PREFIXES:
        await callback.answer()
        return
    if prefix != "lb_" and callback.from_user.id not in all_admin_ids():
        await callback.answer()
        return
    rows = await _tests_for_prefix(prefix, callback.from_user.id)
    try:
        await callback.message.edit_reply_markup(reply_markup=tests_list_kb(rows, prefix, page))
    except Exception:
        pass
    await callback.answer()


def get_main_menu(user_id):
    if user_id in all_admin_ids():
        keyboard = [
            [KeyboardButton(text="💻 Web App test kiritish"), KeyboardButton(text="✨ Yangi test yaratish")],
            [KeyboardButton(text="📊 Natija"), KeyboardButton(text="🏆 Reyting")],
            [KeyboardButton(text="✏️ Tahrirlash"), KeyboardButton(text="🗑 Mocklarni boshqarish")],
            [KeyboardButton(text="📉 Xatolar statistikasi")],
            [KeyboardButton(text="👥 Guruhlar"), KeyboardButton(text="📤 Guruhga yuborish")],
            [KeyboardButton(text="🗂 Vazifalar"), KeyboardButton(text="📈 O'quvchilar statistikasi")],
            [KeyboardButton(text="🔍 ID orqali qidirish")],
            [KeyboardButton(text="🧹 Javoblarni o'chirish")],
            [KeyboardButton(text="👤 Ismni o'zgartirish")],
            [KeyboardButton(text="📢 Reklama yuborish")],
        ]
        if user_id in ADMIN_IDS:
            keyboard.append([KeyboardButton(text="➕ Admin qo'shish"), KeyboardButton(text="🗑 Adminlar ro'yxati")])
        return ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True, is_persistent=True)
    else:
        return ReplyKeyboardMarkup(keyboard=[
            [KeyboardButton(text="📱 Web app orqali test topshirish")],
            [KeyboardButton(text="📋 Vazifalarim"), KeyboardButton(text="🌐 Sayt orqali vazifalar")],
            [KeyboardButton(text="📊 Natija"), KeyboardButton(text="🏆 Reyting")],
            [KeyboardButton(text="👤 Ismni o'zgartirish")]
        ], resize_keyboard=True, is_persistent=True)


# =====================================================================
# MAJBURIY OBUNA (tasdiqlangan obuna 10 daqiqa eslab qolinadi)
# =====================================================================
async def is_subscribed(user_id):
    if user_id in all_admin_ids():
        return True
    checked_at = _sub_cache.get(user_id)
    if checked_at and time.monotonic() - checked_at < SUB_CACHE_SECONDS:
        return True

    # Kanallarni KETMA-KET emas, PARALLEL tekshiramiz - Telegram API'ga
    # ikkita alohida so'rov endi bir vaqtda yuboriladi, shuning uchun
    # umumiy kutish vaqti ikkita so'rovning YIG'INDISI emas, ENG SEKINI
    # bilan chegaralanadi (odatda ~2x tezroq).
    results = await asyncio.gather(
        *(bot.get_chat_member(chat_id=ch, user_id=user_id) for ch in REQUIRED_CHANNELS),
        return_exceptions=True
    )
    for res in results:
        if isinstance(res, Exception) or res.status in ("left", "kicked"):
            return False

    _sub_cache[user_id] = time.monotonic()
    return True


# =====================================================================
# YANGI FUNKSIYA: VAZIFALAR HOLATI (bajarilgan / bajarilmagan) + ADMIN OXIRGI JOY
# =====================================================================
# BU BLOKNI QAYERGA QO'YISH: bot faylida "MAJBURIY OBUNA" bo'limidagi
# is_subscribed() funksiyasidan KEYIN, "ISM SO'RASH TIZIMI" bo'limidan OLDIN.
# (Tartib muhim: "🏠 Bosh menyu" tugmasi ism so'rash holatidan oldin ushlanishi kerak.)
#
# Bazaga ta'sir: mavjud jadvallar O'ZGARMAYDI. Faqat bitta YANGI jadval
# (admin_last_view) qo'shiladi - u init_db() ichida CREATE TABLE IF NOT EXISTS
# bilan yaratiladi (pastdagi 1-tahrirga qarang).
# =====================================================================

# --- Admin uchun "oxirgi ko'rilgan joy" keshi (faqat 2-3 ta admin => xotira deyarli 0) ---
_last_view_cache: dict = {}   # user_id -> (callback_data, label)


async def db_save_last_view(user_id, cb: str, label: str):
    """Faqat o'zgargan bo'lsa bazaga yozadi - tezlikka ta'sir qilmaydi."""
    label = truncate_label(label, 50)
    if _last_view_cache.get(user_id) == (cb, label):
        return
    await _execute(
        "INSERT INTO admin_last_view (user_id, cb, label, updated_at) VALUES (?, ?, ?, ?) "
        "ON CONFLICT(user_id) DO UPDATE SET cb=excluded.cb, label=excluded.label, updated_at=excluded.updated_at",
        (user_id, cb, label, datetime.datetime.now().isoformat())
    )
    _last_view_cache[user_id] = (cb, label)


async def db_get_last_view(user_id):
    hit = _last_view_cache.get(user_id)
    if hit:
        return hit
    row = await _fetchone("SELECT cb, label FROM admin_last_view WHERE user_id = ?", (user_id,))
    if row:
        _last_view_cache[user_id] = (row[0], row[1])
        return row[0], row[1]
    return None


async def _offer_last_view(message: types.Message, user_id: int):
    """Faqat adminlar uchun: oxirgi kirgan joyiga qaytish tugmasi."""
    if user_id not in all_admin_ids():
        return
    last = await db_get_last_view(user_id)
    if not last:
        return
    cb, label = last
    markup = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text=truncate_label(f"↩️ {label}"), callback_data=cb)
    ]])
    await message.answer("📍 Oxirgi ko'rgan joyingiz:", reply_markup=markup)


@dp.message(IsPrivateChat(), F.text == "🏠 Bosh menyu")
async def home_menu_btn(message: types.Message, state: FSMContext):
    await state.clear()
    user_id = message.from_user.id
    await message.answer("🏠 Bosh menyu", reply_markup=get_main_menu(user_id))
    await _offer_last_view(message, user_id)


# ---------------------------------------------------------------------
# DB: o'quvchining guruhdagi vazifalari (bajarilgan/bajarilmagan)
# ---------------------------------------------------------------------
async def db_get_user_group_ids(user_id):
    """O'quvchi a'zo bo'lgan va vazifa biriktirilgan guruhlar."""
    rows = await _fetchall(
        "SELECT DISTINCT gm.chat_id FROM group_members gm "
        "JOIN mock_group_assignments a ON a.chat_id = gm.chat_id WHERE gm.user_id = ?",
        (user_id,)
    )
    return [r[0] for r in rows]


async def db_get_group_tasks_for_user(user_id, chat_id):
    """Guruhga biriktirilgan har bir test uchun: (code, name, result_id|None, correct, total, score).
    "Bajarilgan" = o'quvchi shu testni QACHON va QAYSI guruh nomidan (yoki guruhsiz) topshirgan
    bo'lishidan qat'i nazar, bazada uning natijasi bor. Shuning uchun vazifa guruhga keyin
    biriktirilgan bo'lsa ham, oldin yechgan o'quvchi "bajarmagan"ga tushib qolmaydi.
    Natijalar bir nechta bo'lsa: avval shu guruhniki, keyin guruhsiz, keyin eng oxirgisi."""
    return await _fetchall(
        "SELECT t.code, t.name, r.id, r.correct_count, r.total_questions, r.score "
        "FROM mock_group_assignments a "
        "JOIN tests t ON t.code = a.test_code "
        "LEFT JOIN results r ON r.id = ("
        "  SELECT r2.id FROM results r2 "
        "  WHERE r2.user_id = ? AND r2.test_code = a.test_code "
        "  ORDER BY (r2.chat_id = ?) DESC, (r2.chat_id = 0) DESC, r2.id DESC LIMIT 1"
        ") "
        "WHERE a.chat_id = ? ORDER BY a.assigned_at DESC",
        (user_id, chat_id, chat_id)
    )


def _split_tasks(rows):
    done = [r for r in rows if r[2] is not None]
    todo = [r for r in rows if r[2] is None]
    pcts = [r[3] * 100 / r[4] for r in done if r[4]]
    avg = (sum(pcts) / len(pcts)) if pcts else None
    return done, todo, avg


async def _member_fullname(chat_id, user_id) -> str:
    hit = known_members.get((chat_id, user_id))
    if hit and hit[0]:
        return hit[0]
    row = await _fetchone("SELECT fullname FROM users WHERE user_id = ?", (user_id,))
    return (row[0] if row and row[0] else str(user_id))


# ---------------------------------------------------------------------
# Asosiy ko'rinish (o'quvchi ham, admin ham bir xil)
# ---------------------------------------------------------------------
async def _progress_main(user_id: int, chat_id: int):
    title = get_group_title(chat_id) or str(chat_id)
    fullname = await _member_fullname(chat_id, user_id)
    rows = await db_get_group_tasks_for_user(user_id, chat_id)
    done, todo, avg = _split_tasks(rows)
    avg_txt = f"{avg:.1f}%" if avg is not None else "—"

    text = f"📋 <b>{esc(title)}</b>\n👤 {esc(fullname)}\n\n🗂 Guruhga biriktirilgan vazifalar: {len(rows)} ta"
    if not rows:
        text += "\n\nHozircha bu guruhga vazifa biriktirilmagan."

    kb = [
        [InlineKeyboardButton(text=f"✅ Bajarilgan vazifalar ({len(done)})",
                              callback_data=f"pl|d|{chat_id}|{user_id}|0")],
        [InlineKeyboardButton(text=f"⏳ Bajarilmagan vazifalar ({len(todo)})",
                              callback_data=f"pl|n|{chat_id}|{user_id}|0")],
        # Eng pastda umumiy statistika (bosilmaydigan tugmalar)
        [InlineKeyboardButton(text=f"✅ Bajargan: {len(done)} ta  |  ❌ Bajarmagan: {len(todo)} ta",
                              callback_data="noop")],
        [InlineKeyboardButton(text=f"📈 Bajarganlari bo'yicha o'rtacha: {avg_txt}", callback_data="noop")],
    ]
    label = f"{title} → {fullname}"
    return text, InlineKeyboardMarkup(inline_keyboard=kb), label


async def _progress_list(kind: str, user_id: int, chat_id: int, page: int, is_owner: bool):
    title = get_group_title(chat_id) or str(chat_id)
    fullname = await _member_fullname(chat_id, user_id)
    rows = await db_get_group_tasks_for_user(user_id, chat_id)
    done, todo, _avg = _split_tasks(rows)
    items = done if kind == "d" else todo
    page, total_pages, start, end = _page_bounds(len(items), page, PAGE_SIZE)

    if kind == "d":
        head = f"✅ <b>Bajarilgan vazifalar</b> ({len(items)} ta)"
    else:
        head = f"⏳ <b>Bajarilmagan vazifalar</b> ({len(items)} ta)"
    lines = [f"{head}\n📋 {esc(title)} | 👤 {esc(fullname)}\n"]
    kb = []

    if not items:
        lines.append("🎉 Barcha vazifalar bajarilgan!" if kind == "n" else "Hozircha bajarilgan vazifa yo'q.")
    elif kind == "d":
        for code, name, rid, correct, total, score in items[start:end]:
            pct = correct * 100 / total if total else 0
            lines.append(f"🔢 <code>{esc(code)}</code> — {esc(name)}: <b>{esc(score)}</b> ({correct}/{total}, {pct:.0f}%)")
            kb.append([InlineKeyboardButton(text=truncate_label(f"✅ {name} — {score}"),
                                            callback_data=f"pe|{rid}")])
        lines.append("\n👇 Xatolarini ko'rish uchun test nomini bosing")
    else:
        for code, name, *_rest in items[start:end]:
            lines.append(f"🔢 <code>{esc(code)}</code> — {esc(name)}")
            if is_owner:
                # Mavjud "gctx_" ishlovchisi: guruh nomidan javob topshirish oynasini ochadi
                kb.append([InlineKeyboardButton(text=truncate_label(f"⏳ {name} ({code})"),
                                                callback_data=f"gctx_{code}_{chat_id}")])
        if is_owner:
            lines.append("\n👇 Topshirish uchun test nomini bosing")

    if total_pages > 1:
        kb.append(_nav_row(f"pl|{kind}|{chat_id}|{user_id}|", page, total_pages))
    kb.append([InlineKeyboardButton(text="⬅️ Orqaga", callback_data=f"pv|{chat_id}|{user_id}")])
    return "\n".join(lines), InlineKeyboardMarkup(inline_keyboard=kb)


async def _show(callback: types.CallbackQuery, text: str, markup):
    try:
        await callback.message.edit_text(text, parse_mode="HTML", reply_markup=markup)
    except TelegramBadRequest as e:
        if "not modified" not in str(e).lower():
            await callback.message.answer(text, parse_mode="HTML", reply_markup=markup)


def _can_view(callback: types.CallbackQuery, target_uid: int) -> bool:
    return callback.from_user.id in all_admin_ids() or callback.from_user.id == target_uid


@dp.callback_query(F.data.startswith("pv|"))
async def progress_view_cb(callback: types.CallbackQuery):
    try:
        _, chat_str, uid_str = callback.data.split("|")
        chat_id, uid = int(chat_str), int(uid_str)
    except Exception:
        await callback.answer()
        return
    if not _can_view(callback, uid):
        await callback.answer("⛔ Bu ma'lumot sizga tegishli emas.", show_alert=True)
        return

    text, markup, label = await _progress_main(uid, chat_id)
    await callback.answer()
    await _show(callback, text, markup)
    if callback.from_user.id in all_admin_ids():
        await db_save_last_view(callback.from_user.id, callback.data, label)


@dp.callback_query(F.data.startswith("pl|"))
async def progress_list_cb(callback: types.CallbackQuery):
    try:
        _, kind, chat_str, uid_str, page_str = callback.data.split("|")
        chat_id, uid, page = int(chat_str), int(uid_str), int(page_str)
        if kind not in ("d", "n"):
            raise ValueError
    except Exception:
        await callback.answer()
        return
    if not _can_view(callback, uid):
        await callback.answer("⛔ Bu ma'lumot sizga tegishli emas.", show_alert=True)
        return

    text, markup = await _progress_list(kind, uid, chat_id, page, is_owner=(callback.from_user.id == uid))
    await callback.answer()
    await _show(callback, text, markup)


@dp.callback_query(F.data.startswith("pe|"))
async def progress_errors_cb(callback: types.CallbackQuery):
    """Bitta test bo'yicha faqat XATO qilingan savollar."""
    rid = callback.data.split("|", 1)[1]
    res = await db_get_result_by_id(rid)
    if not res:
        await callback.answer("⚠️ Bu natija topilmadi (o'chirilgan bo'lishi mumkin).", show_alert=True)
        return

    owner_id, fullname, username, code, test_name, _c, _t, score, sa_raw, chat_id = res
    if not _can_view(callback, owner_id):
        await callback.answer("⛔ Bu natija sizga tegishli emas.", show_alert=True)
        return
    await callback.answer()

    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📄 To'liq natija", callback_data=f"resview_{rid}")],
        [InlineKeyboardButton(text="🔴 Yopish", callback_data=f"resclose_{rid}")],
    ])
    test = await db_get_test(code)
    head = f"📉 <b>{esc(test_name)}</b> — xatolar\n👤 {user_link(fullname, owner_id, username)}\n🔢 Kod: <code>{esc(code)}</code>\n"

    if not test or not sa_raw:
        await callback.message.answer(head + "\nℹ️ Bu natija uchun savol-savol tafsilotlar saqlanmagan.",
                                      parse_mode="HTML", reply_markup=markup)
        return

    _name, type_, _level, admin_answers = test
    student_answers = json.loads(sa_raw)
    wrong = []
    for q in _sorted_qnums(admin_answers):
        s_ans = student_answers.get(str(q), "-")
        if not check_sat_answer(s_ans, admin_answers[q]):
            wrong.append(f"❌ {question_label(type_, q)}: {esc(s_ans)} → to'g'ri: <b>{esc(admin_answers[q])}</b>")

    total_q = len(admin_answers)
    right = total_q - len(wrong)
    pct = right * 100 / total_q if total_q else 0
    lines = [head + f"📈 To'g'ri: {right}/{total_q} ({pct:.1f}%) | 🎯 {esc(score)}\n"]
    lines += wrong if wrong else ["🎉 Xato yo'q — hammasi to'g'ri!"]
    await send_long(callback.message, lines, reply_markup=markup)


# ---------------------------------------------------------------------
# O'QUVCHI: "📋 Vazifalarim"
# ---------------------------------------------------------------------
@dp.message(IsPrivateChat(), F.text == "📋 Vazifalarim")
async def student_tasks_entry(message: types.Message):
    user_id = message.from_user.id
    if not await is_subscribed(user_id):
        await message.answer("Avval /start bosib, kanallarga a'zo bo'ling.")
        return

    chat_ids = await db_get_user_group_ids(user_id)
    if not chat_ids:
        await message.answer(
            "📋 Sizga hali vazifa biriktirilgan guruh topilmadi.\n\n"
            "Agar guruhda o'qisangiz, guruhda bir marta xabar yozing — bot sizni ro'yxatga oladi."
        )
        return

    if len(chat_ids) == 1:
        text, markup, _ = await _progress_main(user_id, chat_ids[0])
        await message.answer(text, parse_mode="HTML", reply_markup=markup)
        return

    buttons = [[InlineKeyboardButton(text=truncate_label(f"👥 {get_group_title(cid) or cid}"),
                                     callback_data=f"pv|{cid}|{user_id}")] for cid in chat_ids]
    await message.answer("📋 Qaysi guruh vazifalarini ko'rmoqchisiz?",
                         reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons))


# ---------------------------------------------------------------------
# ADMIN: guruh ichidagi o'quvchilar ro'yxati (inline tugmalar)
# ---------------------------------------------------------------------
STUDENTS_PAGE_SIZE = 15


async def _group_students_view(chat_id: int, page: int):
    title = get_group_title(chat_id) or str(chat_id)
    members = await db_get_group_members(chat_id)
    total_tasks = len(await db_get_group_mocks(chat_id))
    prog = {r[0]: r[3] for r in await db_get_group_overall_progress(chat_id)}

    members_sorted = sorted(members, key=lambda m: (m[1] or "").lower())
    page, total_pages, start, end = _page_bounds(len(members_sorted), page, STUDENTS_PAGE_SIZE)

    kb = []
    for uid, fullname, _username in members_sorted[start:end]:
        done = prog.get(uid, 0)
        kb.append([InlineKeyboardButton(text=truncate_label(f"👤 {fullname or uid} — {done}/{total_tasks}"),
                                        callback_data=f"pv|{chat_id}|{uid}")])
    if total_pages > 1:
        kb.append(_nav_row(f"gstp|{chat_id}|", page, total_pages))
    kb.append([InlineKeyboardButton(text="⬅️ Guruhga qaytish", callback_data=f"grp_{chat_id}")])

    text = (f"👥 <b>{esc(title)}</b> — o'quvchilar\n"
            f"🗂 Biriktirilgan vazifalar: {total_tasks} ta | 👤 Kuzatilgan: {len(members_sorted)} ta\n\n"
            + ("O'quvchini tanlang (yonida: bajargan/jami):" if members_sorted else
               "Hozircha kuzatilgan o'quvchi yo'q."))
    return text, InlineKeyboardMarkup(inline_keyboard=kb)


@dp.callback_query(IsAdmin(), F.data.startswith("gst|"))
async def admin_group_students_cb(callback: types.CallbackQuery):
    try:
        _, chat_str, page_str = callback.data.split("|")
        chat_id, page = int(chat_str), int(page_str)
    except Exception:
        await callback.answer()
        return
    await callback.answer()
    if not get_group_title(chat_id):
        await callback.message.answer("⚠️ Bu guruh topilmadi.")
        return
    text, markup = await _group_students_view(chat_id, page)
    await callback.message.answer(text, parse_mode="HTML", reply_markup=markup)
    await db_save_last_view(callback.from_user.id, f"gst|{chat_id}|0",
                            f"{get_group_title(chat_id)} → o'quvchilar")


@dp.callback_query(IsAdmin(), F.data.startswith("gstp|"))
async def admin_group_students_page_cb(callback: types.CallbackQuery):
    try:
        _, chat_str, page_str = callback.data.split("|")
        chat_id, page = int(chat_str), int(page_str)
    except Exception:
        await callback.answer()
        return
    await callback.answer()
    text, markup = await _group_students_view(chat_id, page)
    await _show(callback, text, markup)


# =====================================================================
# ISM SO'RASH TIZIMI
# =====================================================================
async def _ask_full_name(message: types.Message, state: FSMContext):
    await state.set_state(NameState.waiting_for_name)
    markup = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="✍️ Ism kiritish", callback_data="askname_start")
    ]])
    await message.answer(
        "👋 Botdan to'liq foydalanish uchun to'liq ismingizni kiriting.\n\n"
        "Pastdagi tugmani bosib, ism-familiyangizni yozing:",
        reply_markup=markup
    )


@dp.callback_query(F.data == "askname_start")
async def askname_start_cb(callback: types.CallbackQuery, state: FSMContext):
    await state.set_state(NameState.waiting_for_name)
    await callback.message.answer("✍️ Iltimos, to'liq ismingizni (Ism Familiya) kiriting:")
    await callback.answer()


@dp.message(IsPrivateChat(), F.text == "👤 Ismni o'zgartirish")
async def change_name_btn(message: types.Message, state: FSMContext):
    await state.set_state(NameState.waiting_for_name)
    await message.answer("✍️ Yangi to'liq ismingizni (Ism Familiya) kiriting:")


@dp.message(IsPrivateChat(), NameState.waiting_for_name)
async def receive_full_name(message: types.Message, state: FSMContext):
    if not message.text or not message.text.strip():
        await message.answer("⚠️ Iltimos, ismingizni matn ko'rinishida kiriting:")
        return

    new_name = message.text.strip()
    if is_bad_name(new_name):
        await message.answer(
            "⚠️ Bu ism bo'la olmaydi (menyu tugmasi yoki noto'g'ri matn).\n"
            "Iltimos, o'z <b>Ism Familiyangizni</b> yozing. Masalan: <i>Aliyev Vali</i>",
            parse_mode="HTML"
        )
        return

    user_id = message.from_user.id
    username = f"@{message.from_user.username}" if message.from_user.username else "Foydalanuvchi"

    await db_set_full_name(user_id, username, new_name)

    await state.clear()
    await message.answer(
        f"✅ Ismingiz saqlandi: <b>{esc(new_name)}</b>",
        reply_markup=get_main_menu(user_id), parse_mode="HTML"
    )


# =====================================================================
# START BUYRUG'I VA DEEP LINKING
# =====================================================================
@dp.message(IsPrivateChat(), CommandStart())
async def start_cmd(message: types.Message, command: CommandObject, state: FSMContext):
    user_id = message.from_user.id
    username = f"@{message.from_user.username}" if message.from_user.username else "Foydalanuvchi"
    fullname = message.from_user.full_name

    await db_upsert_user_on_start(user_id, username, fullname)

    if not await is_subscribed(user_id):
        buttons = [[InlineKeyboardButton(text="Kanalga a'zo bo'lish", url=f"https://t.me/{ch.replace('@','')}")]
                   for ch in REQUIRED_CHANNELS]
        buttons.append([InlineKeyboardButton(text="Tasdiqlash ✅", callback_data="confirm_subs")])
        await message.answer(f"Assalomu alaykum {esc(fullname)}! Botdan foydalanish uchun kanallarga a'zo bo'ling.",
                              reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons))
        return

    if not await db_has_name_set(user_id):
        await _ask_full_name(message, state)
        return

    if command.args and command.args.isdigit():
        test_code = command.args
        test = await db_get_test(test_code)
        if test:
            await _route_student_to_code(message, user_id, test_code, test)
            return

    await message.answer(f"Xush kelibsiz {fullname}! SAT Test tizimi faol.", reply_markup=get_main_menu(user_id))
    await _offer_last_view(message, user_id)


@dp.callback_query(F.data == "confirm_subs")
async def confirm_subs(callback: types.CallbackQuery, state: FSMContext):
    user_id = callback.from_user.id
    if await is_subscribed(user_id):
        await callback.message.delete()
        if not await db_has_name_set(user_id):
            await _ask_full_name(callback.message, state)
        else:
            await callback.message.answer("Obuna tasdiqlandi! Menyudan foydalanishingiz mumkin.",
                                           reply_markup=get_main_menu(user_id))
    else:
        await callback.answer("Siz hali barcha kanallarga a'zo bo'lmadingiz!", show_alert=True)


# =====================================================================
# GURUH-KONTEKSTLI YO'NALTIRISH
# =====================================================================
async def _send_test_webapp(target_message: types.Message, code, test, intro_text: str):
    name, type_, level, admin_answers = test
    fmt = build_format_string(admin_answers)
    web_url = f"{NETLIFY_URL}?mode=student&code={code}&type={type_}&level={level}&fmt={fmt}"
    markup = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="✍️ Javob kiritish", web_app=WebAppInfo(url=web_url))],
                  [KeyboardButton(text="🏠 Bosh menyu")]],
        resize_keyboard=True
    )
    await target_message.answer(intro_text, reply_markup=markup, parse_mode="HTML")


async def _group_submission_status(user_id, code):
    chat_ids = await db_get_assigned_group_chat_ids_for_user(user_id, code)
    eligible, exhausted = [], []
    for cid in chat_ids:
        submitted = await db_has_submitted(user_id, code, cid)
        permitted = await db_has_resubmit_permission(user_id, code, cid)
        if not submitted or permitted:
            eligible.append(cid)
        else:
            exhausted.append(cid)
    return eligible, exhausted


async def _student_member_groups(user_id: int):
    """O'quvchi a'zo bo'lgan (bot biladigan) barcha guruhlar - vazifa biriktirilgan-biriktirilmaganidan qat'i nazar."""
    rows = await _fetchall("SELECT DISTINCT chat_id FROM group_members WHERE user_id = ?", (user_id,))
    return [r[0] for r in rows if get_group_title(r[0])]


async def _ask_group_context(message: types.Message, user_id: int, code: str, name: str, member_groups):
    """Bir nechta guruhda o'qiydigan o'quvchidan: bu testni qaysi guruh uchun topshiryapsiz?
    Vazifa hali guruhga biriktirilmagan bo'lsa ham so'raladi (keyin biriktirilsa, o'zi hisobga olinadi)."""
    assigned = set(await db_get_assigned_group_chat_ids_for_user(user_id, code))
    ordered = sorted(member_groups, key=lambda c: (c not in assigned, (get_group_title(c) or "").lower()))
    buttons = []
    for cid in ordered:
        title = get_group_title(cid) or str(cid)
        submitted = await db_has_submitted(user_id, code, cid)
        permitted = await db_has_resubmit_permission(user_id, code, cid)
        if submitted and not permitted:
            buttons.append([InlineKeyboardButton(text=truncate_label(f"🔒 {title} (topshirilgan)"),
                                                 callback_data=f"reqresub_{code}_{cid}")])
        else:
            mark = "📌" if cid in assigned else "👥"
            buttons.append([InlineKeyboardButton(text=truncate_label(f"{mark} {title}"),
                                                 callback_data=f"gctx_{code}_{cid}")])
    none_submitted = await db_has_submitted(user_id, code, 0)
    none_permitted = await db_has_resubmit_permission(user_id, code, 0)
    if none_submitted and not none_permitted:
        buttons.append([InlineKeyboardButton(text="🔒 Hech qaysi guruhdan emas (topshirilgan)",
                                             callback_data=f"reqresub_{code}_0")])
    else:
        buttons.append([InlineKeyboardButton(text="🚫 Hech qaysi guruhdan emas (shunchaki kanaldan)",
                                             callback_data=f"gctx_{code}_0")])
    await message.answer(
        f"📚 Mock: <b>{esc(name)}</b>\n\n"
        f"Siz bir nechta guruhda o'qiysiz.\n"
        f"Bu vazifani <b>qaysi guruh uchun</b> bajaryapsiz?\n\n"
        f"📌 — shu test guruhga biriktirilgan",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons), parse_mode="HTML"
    )


async def _route_student_to_code(message: types.Message, user_id: int, code: str, test):
    name, type_, level, admin_answers = test

    # Bir nechta guruhda o'qiydigan o'quvchidan har safar so'raymiz
    member_groups = await _student_member_groups(user_id)
    if len(member_groups) >= 2:
        await _ask_group_context(message, user_id, code, name, member_groups)
        return

    eligible, exhausted = await _group_submission_status(user_id, code)

    if len(eligible) > 1:
        buttons = []
        for cid in eligible:
            title = get_group_title(cid) or str(cid)
            buttons.append([InlineKeyboardButton(text=title, callback_data=f"gctx_{code}_{cid}")])
        markup = InlineKeyboardMarkup(inline_keyboard=buttons)
        await message.answer(
            f"📚 Mock: <b>{esc(name)}</b>\n\n"
            f"Bu test sizning bir nechta guruhingizga vazifa qilib berilgan.\n"
            f"Qaysi guruh nomidan topshiryapsiz?",
            reply_markup=markup, parse_mode="HTML"
        )
        return

    if len(eligible) == 1:
        chat_id = eligible[0]
        await db_set_pending_submission(user_id, code, chat_id)
        title = get_group_title(chat_id) or ""
        intro = (
            f"✅ Test topildi!\nMock nomi: {esc(name)}\nDarajasi: {level.upper()}\n"
            f"👥 Guruh: {esc(title)}\n\nPastdagi tugmani bosib javoblarni kiriting:"
        )
        await _send_test_webapp(message, code, test, intro)
        return

    if exhausted:
        buttons = []
        for cid in exhausted:
            title = get_group_title(cid) or str(cid)
            buttons.append([InlineKeyboardButton(
                text=truncate_label(f"🔓 {title} uchun ruxsat so'rash"), callback_data=f"reqresub_{code}_{cid}"
            )])
        markup = InlineKeyboardMarkup(inline_keyboard=buttons)
        await message.answer(
            "⚠️ Siz bu testni tegishli guruh(lar)ingizda allaqachon topshirgansiz.\n\n"
            "Qayta topshirish uchun quyidan admindan ruxsat so'rashingiz mumkin:",
            reply_markup=markup
        )
        return

    chat_id = 0
    already_submitted = await db_has_submitted(user_id, code, chat_id)
    has_permission = await db_has_resubmit_permission(user_id, code, chat_id)
    if already_submitted and not has_permission:
        markup = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="🔓 Qayta urinish uchun ruxsat so'rash", callback_data=f"reqresub_{code}_0")
        ]])
        await message.answer(
            "⚠️ Siz bu testni allaqachon topshirgansiz. Har bir test faqat <b>1 marta</b> topshiriladi.\n\n"
            "Qayta topshirmoqchi bo'lsangiz, quyidagi tugma orqali admindan ruxsat so'rashingiz mumkin:",
            reply_markup=markup, parse_mode="HTML"
        )
        return

    await db_set_pending_submission(user_id, code, chat_id)
    intro = (
        f"✅ Test topildi!\nMock nomi: {esc(name)}\nDarajasi: {level.upper()}\n\n"
        f"Pastdagi tugmani bosib javoblarni kiriting:"
    )
    await _send_test_webapp(message, code, test, intro)


@dp.callback_query(F.data.startswith("gctx_"))
async def student_choose_group_context(callback: types.CallbackQuery):
    remainder = callback.data.replace("gctx_", "")
    code, chat_str = remainder.split("_", 1)
    chat_id = int(chat_str)
    user_id = callback.from_user.id

    test = await db_get_test(code)
    if not test:
        await callback.answer("⚠️ Bu test topilmadi.", show_alert=True)
        return

    already = await db_has_submitted(user_id, code, chat_id)
    permitted = await db_has_resubmit_permission(user_id, code, chat_id)
    if already and not permitted:
        await callback.answer("⚠️ Siz bu guruh uchun bu testni allaqachon topshirgansiz.", show_alert=True)
        return

    await db_set_pending_submission(user_id, code, chat_id)
    await callback.answer()
    title = "Hech qaysi guruhdan emas" if chat_id == 0 else (get_group_title(chat_id) or "guruh")
    await _send_test_webapp(
        callback.message, code, test,
        f"✅ Tanlandi: <b>{esc(title)}</b>\n\nJavob kiritish uchun pastdagi tugmani bosing:"
    )


# =====================================================================
# O'QUVCHI: TEST KODINI KIRITISH
# =====================================================================
@dp.message(IsPrivateChat(), F.text == "📱 Web app orqali test topshirish")
async def student_ask_code(message: types.Message, state: FSMContext):
    if not await is_subscribed(message.from_user.id):
        return
    if not await db_has_name_set(message.from_user.id):
        await _ask_full_name(message, state)
        return
    await message.answer("Iltimos, test kodini kiriting:")
    await state.set_state(StudentState.waiting_for_code)


@dp.message(IsPrivateChat(), StudentState.waiting_for_code)
async def student_verify_code(message: types.Message, state: FSMContext):
    if not message.text:
        await message.answer("⚠️ Iltimos, faqat matn ko'rinishida test kodini yuboring:")
        return

    code = message.text.strip()
    if not code.isdigit():
        await message.answer("Kod faqat raqamlardan iborat bo'lishi kerak. Qayta kiriting:")
        return

    test = await db_get_test(code)
    if not test:
        await message.answer("❌ Bunday kodli test bazada topilmadi! Qayta kiriting:")
        return

    await state.clear()
    await _route_student_to_code(message, message.from_user.id, code, test)


# =====================================================================
# ADMIN: YANGI TEST YARATISH
# =====================================================================
@dp.message(IsPrivateChat(), IsAdmin(), F.text == "💻 Web App test kiritish")
async def admin_simple_test(message: types.Message, state: FSMContext):
    await state.set_state(AdminState.waiting_for_name)
    await state.update_data(test_type="simple_22")
    await message.answer("Yangi 22 talik test uchun nom (Mock nomi) kiriting:")


@dp.message(IsPrivateChat(), IsAdmin(), F.text == "✨ Yangi test yaratish")
async def admin_new_test_menu(message: types.Message):
    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📦 Modulli (2 ta Modul 44 ta)", callback_data="create_modulli_44")],
        [InlineKeyboardButton(text="📝 Ketma-ket 44 talik", callback_data="create_ketmaket_44")],
        [InlineKeyboardButton(text="⚙️ Ixtiyoriy test", callback_data="create_ixtiyoriy")]
    ])
    await message.answer("Yaratmoqchi bo'lgan test formatini tanlang:", reply_markup=markup)


@dp.callback_query(IsAdmin(), F.data.startswith("create_"))
async def admin_select_format(callback: types.CallbackQuery, state: FSMContext):
    t_type = callback.data.replace("create_", "")
    await state.set_state(AdminState.waiting_for_name)
    await state.update_data(test_type=t_type)
    await callback.message.answer("Ushbu formatdagi test uchun nom (Mock nomi) kiriting:")
    await callback.answer()


@dp.message(IsPrivateChat(), IsAdmin(), AdminState.waiting_for_name)
async def admin_get_name(message: types.Message, state: FSMContext):
    if not message.text or not message.text.strip():
        await message.answer("⚠️ Iltimos, mock nomini matn ko'rinishida kiriting:")
        return
    await state.update_data(test_name=message.text.strip())
    data = await state.get_data()
    test_type = data.get('test_type', 'simple_22')

    if test_type in ("modulli_44", "ketmaket_44"):
        markup = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="Easy", callback_data="lvl_easy"),
             InlineKeyboardButton(text="Normal", callback_data="lvl_normal")],
            [InlineKeyboardButton(text="Hard", callback_data="lvl_hard")]
        ])
        await message.answer("Testning qiyinchilik darajasini tanlang:", reply_markup=markup)
        await state.set_state(AdminState.waiting_for_level)
    else:
        await _finalize_test_creation(message, state, level="oddiy")


async def _finalize_test_creation(target, state: FSMContext, level: str):
    data = await state.get_data()
    test_type = data.get('test_type', 'simple_22')
    test_name = data.get('test_name', 'SAT MOCK')
    await state.clear()

    safe_name = quote(test_name, safe='')
    url = f"{NETLIFY_URL}?mode=admin&type={test_type}&level={level}&name={safe_name}"
    markup = ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text="🛠 WebApp interfeysini ochish", web_app=WebAppInfo(url=url))]], resize_keyboard=True)
    level_label = "ODDIY (ballsiz)" if level == "oddiy" else level.upper()
    await target.answer(
        f"Test sozlamalari tayyor:\nMock nomi: {test_name}\nDarajasi: {level_label}\n\n"
        f"Javoblarni kiritish uchun WebApp-ga kiring:",
        reply_markup=markup
    )


@dp.callback_query(IsAdmin(), F.data.startswith("lvl_"))
async def admin_get_level(callback: types.CallbackQuery, state: FSMContext):
    level = callback.data.split("_")[1]
    await _finalize_test_creation(callback.message, state, level=level)
    await callback.answer()


# =====================================================================
# WEBAPP MA'LUMOTLARINI QABUL QILISH
# =====================================================================
@dp.message(F.content_type == types.ContentType.WEB_APP_DATA)
async def receive_webapp_data(message: types.Message):
    user_id = message.from_user.id
    try:
        data = json.loads(message.web_app_data.data)
    except Exception:
        await message.answer("❌ Ma'lumotlarni o'qishda xatolik!")
        return

    role = data.get("role")

    if role == "admin":
        if user_id not in all_admin_ids():
            return
        answers_dict = data.get('answers', {})
        empty_qs = [qid for qid, ans in answers_dict.items() if not str(ans).strip() or str(ans).strip() == '-']
        if empty_qs:
            missing_sorted = sorted(empty_qs, key=lambda x: int(x) if x.isdigit() else 0)
            await message.answer(
                f"⚠️ Quyidagi savol(lar)ga to'g'ri javob kiritilmagan: {', '.join(missing_sorted)}\n"
                f"Test saqlanmadi. Iltimos, WebApp'ga qaytib, BARCHA savollarga javob kiriting.",
                reply_markup=get_main_menu(user_id)
            )
            return

        code = await db_generate_unique_code()
        await db_insert_test(code, data['name'], data['type'], data['level'], answers_dict)

        total_questions = len(answers_dict)
        author_name = message.from_user.full_name
        finish_text = build_test_announcement(data['name'], code, total_questions, author_name)
        await message.answer(finish_text, reply_markup=get_main_menu(user_id), parse_mode="HTML")

    elif role == "admin_edit":
        if user_id not in all_admin_ids():
            return
        code = data.get("code")
        answers_dict = data.get('answers', {})
        empty_qs = [qid for qid, ans in answers_dict.items() if not str(ans).strip() or str(ans).strip() == '-']
        if empty_qs:
            missing_sorted = sorted(empty_qs, key=lambda x: int(x) if x.isdigit() else 0)
            await message.answer(
                f"⚠️ Quyidagi savol(lar)ga to'g'ri javob kiritilmagan: {', '.join(missing_sorted)}\n"
                f"O'zgartirish saqlanmadi. Iltimos, WebApp'ga qaytib, BARCHA savollarga javob kiriting.",
                reply_markup=get_main_menu(user_id)
            )
            return

        if not code:
            await message.answer("❌ Xatolik: test kodi topilmadi.", reply_markup=get_main_menu(user_id))
            return

        existing = await db_get_test(code)
        if not existing:
            await message.answer(
                "❌ Xatolik: bu test bazada topilmadi (tahrirlash paytida o'chirilgan bo'lishi mumkin).",
                reply_markup=get_main_menu(user_id)
            )
            return

        test_name, test_type, level, old_answers = existing
        await db_update_test_answers(code, answers_dict)

        # Adminga darhol javob beramiz, o'quvchilarga xabarlar keyin yuboriladi
        await message.answer(
            f"✅ <b>MOCK TEST MUVAFFAQIYATLI O'ZGARTIRILDI!</b>\n\n"
            f"📚 Mock nomi: {esc(test_name)}\n🔢 Test kodi: <code>{esc(code)}</code>\n\n"
            f"Javoblar yangilandi, boshqa barcha ma'lumotlar (kod, nom, turi, darajasi) o'zgarishsiz qoldi.",
            reply_markup=get_main_menu(user_id), parse_mode="HTML"
        )

        all_q_nums = set(old_answers.keys()) | set(answers_dict.keys())
        changed_questions = {
            q: (old_answers.get(q), answers_dict.get(q))
            for q in all_q_nums if old_answers.get(q) != answers_dict.get(q)
        }
        if not changed_questions:
            return

        student_results = await db_get_results_with_student_answers(code)
        notifications = []

        # 1) Avval barcha natijalarni bazada yangilaymiz (bitta commit bilan)
        for rid, s_user_id, old_correct, old_total, old_score, student_answers, _s_chat_id in student_results:
            new_correct, new_total, _ = build_result_body(answers_dict, student_answers, test_type)
            new_score = calculate_sat_score(new_correct, new_total, level)
            result_changed = new_correct != old_correct

            change_lines = []
            for q_num, (old_ans, new_ans) in changed_questions.items():
                old_disp = esc(old_ans) if old_ans else "—"
                new_disp = esc(new_ans) if new_ans else "—"
                label = question_label(test_type, q_num)
                line = f"📝 {label}: avvalgi to'g'ri javob — <b>{old_disp}</b>, yangi to'g'ri javob — <b>{new_disp}</b>"

                s_ans = student_answers.get(q_num)
                if s_ans is not None:
                    was_correct = check_sat_answer(s_ans, old_ans) if old_ans else False
                    now_correct = check_sat_answer(s_ans, new_ans) if new_ans else False
                    if was_correct == now_correct:
                        status = "✅ hali ham TO'G'RI" if now_correct else "❌ hali ham NOTO'G'RI"
                    elif now_correct:
                        status = "✅ ENDI TO'G'RI (avval xato edi)"
                    else:
                        status = "❌ ENDI NOTO'G'RI (avval to'g'ri edi)"
                    line += f"\n   ➡️ Sizning javobingiz ({esc(s_ans)}): {status}"
                change_lines.append(line)

            if result_changed:
                await db_conn.execute(
                    "UPDATE results SET correct_count = ?, total_questions = ?, score = ? WHERE id = ?",
                    (new_correct, new_total, str(new_score), rid)
                )
                direction = "ko'tarildi 📈" if new_correct > old_correct else "pasaydi 📉"
                footer = (
                    f"\n\n📈 Yangi natija: {new_correct}/{new_total} (avvalgi: {old_correct}/{old_total})\n"
                    f"🎯 Balingiz {direction}\nYangi ball: <b>{new_score}</b> (avvalgi: {esc(old_score)})"
                )
                header = "🔔 <b>Diqqat! Sizning natijangiz yangilandi</b>"
            else:
                footer = f"\n\nBu o'zgarish sizning natijangizga ta'sir qilmadi — natijangiz avvalgidek qoladi: <b>{esc(old_score)}</b>."
                header = "ℹ️ <b>Diqqat! Ushbu mock testda o'zgarish bor</b>"

            student_msg = (
                f"{header}\n\n📚 Mock: {esc(test_name)}\n🔢 Test kodi: <code>{esc(code)}</code>\n\n"
                f"✏️ Admin quyidagi savol(lar)ning to'g'ri javobini o'zgartirdi:\n"
                + "\n".join(change_lines) + footer
            )
            notifications.append((s_user_id, student_msg))
        await db_conn.commit()

        # 2) Keyin o'quvchilarga xabar - flood-limitga tushmaslik uchun oraliq bilan
        for s_user_id, student_msg in notifications:
            await safe_send(bot.send_message, chat_id=s_user_id, text=student_msg, parse_mode="HTML")
            await asyncio.sleep(0.05)

    elif role == "student":
        code = data.get("code")
        student_answers = data.get("answers", {})

        chat_id = await db_pop_pending_submission(user_id, code)

        already_submitted = await db_has_submitted(user_id, code, chat_id)
        has_permission = await db_has_resubmit_permission(user_id, code, chat_id)

        if already_submitted and not has_permission:
            markup = InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text="🔓 Qayta urinish uchun ruxsat so'rash", callback_data=f"reqresub_{code}_{chat_id}")
            ]])
            await message.answer(
                "⚠️ Siz bu testni allaqachon topshirgansiz. Har bir test faqat <b>1 marta</b> topshiriladi.\n\n"
                "Qayta topshirmoqchi bo'lsangiz, quyidagi tugma orqali admindan ruxsat so'rashingiz mumkin:",
                reply_markup=markup, parse_mode="HTML"
            )
            return

        test = await db_get_test(code)
        if not test:
            await message.answer("❌ Xatolik: Test topilmadi.", reply_markup=get_main_menu(user_id))
            return

        test_name, test_type, level, admin_answers = test

        missing_qs = [
            q for q in admin_answers.keys()
            if not str(student_answers.get(str(q), "")).strip() or str(student_answers.get(str(q), "")).strip() == "-"
        ]
        if missing_qs:
            missing_sorted = sorted(missing_qs, key=lambda x: int(x) if x.isdigit() else 0)
            await db_set_pending_submission(user_id, code, chat_id)
            await message.answer(
                f"⚠️ Siz quyidagi savol(lar)ga javob bermagansiz: {', '.join(missing_sorted)}\n\n"
                f"Javob qabul qilinmadi. Iltimos, WebApp'ga qaytib, BARCHA savollarga javob bering va qayta yuboring.",
                reply_markup=get_main_menu(user_id)
            )
            return

        correct_count, total_questions, body = build_result_body(admin_answers, student_answers, test_type)
        report = f"📊 <b>Sizning SAT Natijangiz ({esc(test_name)})</b>\nDarajasi: {esc(level.upper())}\nTest Kodi: {esc(code)}\n\n" + body

        final_score = calculate_sat_score(correct_count, total_questions, level)
        report += f"\n📈 To'g'ri: {correct_count}/{total_questions}\n🎯 <b>YAKUNIY BALL: {final_score}</b>"

        fullname = await db_get_user_fullname_if_set(user_id) or message.from_user.full_name
        username = f"@{message.from_user.username}" if message.from_user.username else "Foydalanuvchi"

        result_id = await db_insert_result(
            user_id, fullname, username, code, test_name, correct_count,
            total_questions, final_score, student_answers, chat_id
        )

        if has_permission:
            await db_revoke_resubmit_permission(user_id, code, chat_id)

        await send_long(message, report.split("\n"), reply_markup=get_main_menu(user_id))

        percentage = (correct_count * 10000 // total_questions) / 100 if total_questions else 0
        group_title = get_group_title(chat_id) if chat_id else None
        group_line = f"\n👥 Guruh: {esc(group_title)}" if group_title else ""
        admin_report = (
            f"📝 <b>Testga javob berildi</b>\n📝 Test nomi: {esc(test_name)}\n📌 Test kodi: {esc(code)}\n"
            f"📋 Savollar soni: {total_questions} ta\n👤 Ismi: {user_link(fullname, user_id, username)}\n"
            f"🆔 ID: <code>{user_id}</code>{group_line}\n\n📊 Natijasi: {correct_count} ta ({percentage:.2f}%)"
        )
        admin_markup = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="📊 Batafsil📈", callback_data=f"resview_{result_id}")
        ]])
        for admin_id in all_admin_ids():
            await safe_send(bot.send_message, chat_id=admin_id, text=admin_report,
                            reply_markup=admin_markup, parse_mode="HTML")


# =====================================================================
# QAYTA URINISH UCHUN RUXSAT SO'RASH TIZIMI
# =====================================================================
@dp.callback_query(F.data.startswith("reqresub_"))
async def request_resubmit(callback: types.CallbackQuery):
    remainder = callback.data.replace("reqresub_", "")
    code, chat_str = remainder.rsplit("_", 1)
    chat_id = int(chat_str)
    user_id = callback.from_user.id
    fullname = callback.from_user.full_name
    username = f"@{callback.from_user.username}" if callback.from_user.username else "username yo'q"

    group_title = get_group_title(chat_id) if chat_id else None
    group_line = f"\n👥 Guruh: {esc(group_title)}" if group_title else ""

    markup = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="✅ Ruxsat berish", callback_data=f"resubok:{user_id}:{code}:{chat_id}"),
        InlineKeyboardButton(text="❌ Rad etish", callback_data=f"resubno:{user_id}:{code}:{chat_id}")
    ]])
    for admin_id in all_admin_ids():
        await safe_send(
            bot.send_message, admin_id,
            f"🔁 <b>Qayta urinish so'rovi</b>\n\n👤 {user_link(fullname, user_id, username)} ({esc(username)})\n"
            f"🆔 ID: <code>{user_id}</code>\n🔢 Test kodi: <code>{esc(code)}</code>{group_line}",
            reply_markup=markup, parse_mode="HTML"
        )
    try:
        await callback.message.edit_text("📨 So'rovingiz adminga yuborildi. Ruxsat berilishini kuting...")
    except Exception:
        pass
    await callback.answer()


@dp.callback_query(F.data.startswith("resubok:"))
async def approve_resubmit(callback: types.CallbackQuery):
    if callback.from_user.id not in all_admin_ids():
        await callback.answer()
        return
    _, uid_str, code, chat_str = callback.data.split(":")
    target_user_id = int(uid_str)
    chat_id = int(chat_str)

    await db_grant_resubmit_permission(target_user_id, code, chat_id)

    try:
        await callback.message.edit_text(callback.message.html_text + "\n\n✅ <b>Ruxsat berildi.</b>", parse_mode="HTML")
    except Exception:
        await callback.message.answer("✅ Ruxsat berildi.")
    await safe_send(
        bot.send_message, target_user_id,
        f"✅ Sizga <code>{esc(code)}</code> testini qayta topshirishga ruxsat berildi. Qaytadan urinib ko'rishingiz mumkin.",
        parse_mode="HTML"
    )
    await callback.answer("✅ Ruxsat berildi")


@dp.callback_query(F.data.startswith("resubno:"))
async def deny_resubmit(callback: types.CallbackQuery):
    if callback.from_user.id not in all_admin_ids():
        await callback.answer()
        return
    _, uid_str, code, chat_str = callback.data.split(":")
    target_user_id = int(uid_str)

    try:
        await callback.message.edit_text(callback.message.html_text + "\n\n❌ <b>Rad etildi.</b>", parse_mode="HTML")
    except Exception:
        await callback.message.answer("❌ Rad etildi.")
    await safe_send(bot.send_message, target_user_id,
                    f"❌ Admin <code>{esc(code)}</code> testini qayta topshirishga ruxsat bermadi.",
                    parse_mode="HTML")
    await callback.answer("❌ Rad etildi")


# =====================================================================
# NATIJA VA REYTING
# =====================================================================
async def _build_result_detail_text(rid):
    res = await db_get_result_by_id(rid)
    if not res:
        return None, None

    (owner_id, fullname, username, code, test_name,
     correct_count, total_questions, score, student_answers_raw, chat_id) = res

    test = await db_get_test(code)

    group_title = get_group_title(chat_id) if chat_id else None
    group_line = f"👥 Guruh: {esc(group_title)}\n" if group_title else ""

    header = (
        f"📊 <b>{user_link(fullname, owner_id, username)} — SAT Natijasi ({esc(test_name)})</b>\n"
        f"🆔 ID: <code>{owner_id}</code>\n🔢 Test Kodi: {esc(code)}\n{group_line}\n"
    )

    if not test or not student_answers_raw:
        percentage = (correct_count * 10000 // total_questions) / 100 if total_questions else 0
        text = (
            header
            + f"📈 To'g'ri: {correct_count}/{total_questions} ({percentage:.2f}%)\n🎯 <b>YAKUNIY BALL: {esc(score)}</b>\n\n"
            + "ℹ️ Bu natija uchun savol-savol bo'yicha tafsilotlar saqlanmagan."
        )
        return text, owner_id

    name, type_, level, admin_answers = test
    student_answers = json.loads(student_answers_raw)

    c_correct, c_total, body = build_result_body(admin_answers, student_answers, type_)
    final_score = calculate_sat_score(c_correct, c_total, level)
    percentage = (c_correct * 10000 // c_total) / 100 if c_total else 0
    footer = f"\n📈 To'g'ri: {c_correct}/{c_total} ({percentage:.2f}%)\n🎯 <b>YAKUNIY BALL: {final_score}</b>"
    text = header + f"Darajasi: {esc(level.upper())}\n\n" + body + footer
    return text, owner_id


async def _send_result_detail(target_message, rid, text):
    close_markup = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🔴 Natijani yopish", callback_data=f"resclose_{rid}")
    ]])

    if len(text) <= 4096:
        await target_message.answer(text, parse_mode="HTML", reply_markup=close_markup)
        return

    parts = chunk_lines(text.split("\n"))
    for i, part in enumerate(parts):
        if i == len(parts) - 1:
            await target_message.answer(part, parse_mode="HTML", reply_markup=close_markup)
        else:
            await target_message.answer(part, parse_mode="HTML")


@dp.callback_query(F.data.startswith("resclose_"))
async def close_result_detail(callback: types.CallbackQuery):
    try:
        await callback.message.delete()
    except Exception:
        try:
            await callback.message.edit_text("🔒 Natija yopildi.")
        except Exception:
            pass
    await callback.answer()


async def _send_user_results_list(target_message: types.Message, rows, header: str):
    """Natijalarni har biriga alohida xabar emas, 10 tadan bitta xabarda yuboradi."""
    await target_message.answer(header, parse_mode="HTML")
    for start in range(0, len(rows), 10):
        part = rows[start:start + 10]
        lines, buttons = [], []
        for idx, (rid, test_name, correct, total, score, chat_id) in enumerate(part, start + 1):
            group_title = get_group_title(chat_id) if chat_id else None
            group_tag = f"\n    👥 {esc(group_title)}" if group_title else ""
            lines.append(f"🏅 {ordinal_uz(idx)}: <b>{esc(test_name)}</b> — <b>{esc(score)}</b> ({correct}/{total}){group_tag}")
            buttons.append([InlineKeyboardButton(
                text=truncate_label(f"📊 {idx}. {test_name} — batafsil"), callback_data=f"resview_{rid}"
            )])
        await target_message.answer("\n".join(lines), parse_mode="HTML",
                                    reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons))


@dp.message(IsPrivateChat(), F.text == "📊 Natija")
async def show_results(message: types.Message):
    user_id = message.from_user.id

    if user_id in all_admin_ids():
        mocks = await db_list_tests()
        if not mocks:
            await message.answer("🗂 Hozircha bazada birorta ham mock test yo'q.")
            return
        markup = tests_list_kb(mocks, "admres_test_")
        await message.answer("📊 Natijalarini ko'rmoqchi bo'lgan mock testni tanlang:", reply_markup=markup)
        return

    rows = await db_get_results_for_user(user_id)
    if not rows:
        await message.answer("📊 Sizda hozircha natija yo'q. Test yechgach, shu yerda natijalaringizni ko'rishingiz mumkin bo'ladi.")
        return

    await _send_user_results_list(message, rows, f"📊 <b>Sizning barcha natijalaringiz</b> ({len(rows)} ta):")


def results_list_kb(rows, code, page: int = 0) -> InlineKeyboardMarkup:
    page, total_pages, start, end = _page_bounds(len(rows), page, RESULTS_PAGE_SIZE)
    buttons = []
    for rid, fullname, username, correct, total, score in rows[start:end]:
        label = truncate_label(f"👤 {fullname} — {score}")
        buttons.append([InlineKeyboardButton(text=f"📄 {label}", callback_data=f"resview_{rid}")])
    if total_pages > 1:
        buttons.append(_nav_row(f"rpg|{code}|", page, total_pages))
    return InlineKeyboardMarkup(inline_keyboard=buttons)


@dp.callback_query(F.data.startswith("admres_test_"))
async def admin_results_by_test(callback: types.CallbackQuery):
    if callback.from_user.id not in all_admin_ids():
        await callback.answer()
        return
    code = callback.data.replace("admres_test_", "")

    test_name = await db_get_test_name(code) or code
    rows = await db_get_results_for_test(code)
    await callback.answer()

    if not rows:
        await callback.message.answer(f"📚 <b>{esc(test_name)}</b>\n\nBu testga hali hech kim javob kiritmagan.", parse_mode="HTML")
        return

    await callback.message.answer(
        f"📚 <b>{esc(test_name)}</b>\n\n👥 Javob kiritgan o'quvchilar ({len(rows)} ta):\n"
        f"Har birining to'liq natijasini ko'rish uchun tugmani bosing 👇",
        reply_markup=results_list_kb(rows, code), parse_mode="HTML"
    )


@dp.callback_query(F.data.startswith("rpg|"))
async def paginate_results(callback: types.CallbackQuery):
    if callback.from_user.id not in all_admin_ids():
        await callback.answer()
        return
    try:
        _, code, page_str = callback.data.split("|")
        page = int(page_str)
    except Exception:
        await callback.answer()
        return
    rows = await db_get_results_for_test(code)
    try:
        await callback.message.edit_reply_markup(reply_markup=results_list_kb(rows, code, page))
    except Exception:
        pass
    await callback.answer()


@dp.callback_query(F.data.startswith("resview_"))
async def view_result_detail(callback: types.CallbackQuery):
    rid = callback.data.replace("resview_", "")

    text, owner_id = await _build_result_detail_text(rid)
    if owner_id is None:
        await callback.answer("⚠️ Bu natija topilmadi (o'chirilgan bo'lishi mumkin).", show_alert=True)
        return

    if callback.from_user.id not in all_admin_ids() and callback.from_user.id != owner_id:
        await callback.answer("⛔ Bu natija sizga tegishli emas.", show_alert=True)
        return

    await callback.answer()
    await _send_result_detail(callback.message, rid, text)


@dp.message(IsPrivateChat(), F.text == "🏆 Reyting")
async def show_leaderboard_menu(message: types.Message):
    user_id = message.from_user.id
    mocks = await _tests_for_prefix("lb_", user_id)

    if not mocks:
        if user_id in all_admin_ids():
            await message.answer("Tizimda hozircha mock testlar mavjud emas.")
        else:
            await message.answer("Siz hali birorta ham test yechmagansiz. Test yechgach, shu yerda o'zingiz qatnashgan testlar reytingini ko'rishingiz mumkin bo'ladi.")
        return

    markup = tests_list_kb(mocks, "lb_")
    await message.answer("🏆 Reytingini ko'rmoqchi bo'lgan mock testni tanlang:", reply_markup=markup)


@dp.callback_query(F.data.startswith("lb_"))
async def show_mock_leaderboard(callback: types.CallbackQuery):
    code = callback.data.replace("lb_", "")
    test_name = await db_get_test_name(code)

    if not test_name:
        await callback.answer("Bu mock test topilmadi (admin tomonidan o'chirilgan bo'lishi mumkin).", show_alert=True)
        return

    rows = await db_get_leaderboard_rows(code)
    await callback.answer()

    if not rows:
        await callback.message.answer(f"📚 <b>{esc(test_name)}</b>\n\nBu mock bo'yicha hali natijalar yo'q.", parse_mode="HTML")
        return

    medals = {1: "🥇", 2: "🥈", 3: "🥉"}
    lines = [f"🏆 <b>{esc(test_name)}</b> — Reyting jadvali\n", "<pre>"]
    lines.append(f"{'O‘rin':<6}{'Ism Familiya':<20}{'Natija':<10}{'✅':<4}{'❌':<4}")
    lines.append("-" * 44)
    for place, (fullname, correct, total, score, r_user_id, r_chat_id, r_username) in enumerate(rows, 1):
        wrong = max(total - correct, 0)
        rank_label = f"{place}."
        display_name = fullname if len(fullname) <= 18 else fullname[:16] + ".."
        medal = medals.get(place, "")
        lines.append(f"{esc(rank_label):<6}{esc(display_name):<20}{esc(score):<10}{correct:<4}{wrong:<4}{medal}")
    lines.append("</pre>")
    # Profil havolalari (Telegram akkaunt, guruh nomi) - XAVFSIZLIK uchun faqat adminlarga ko'rinadi
    if callback.from_user.id in all_admin_ids():
        lines.append("\n👥 <b>Profillar:</b>")
        for place, (fullname, correct, total, score, r_user_id, r_chat_id, r_username) in enumerate(rows, 1):
            medal = medals.get(place, "")
            group_title = get_group_title(r_chat_id) if r_chat_id else None
            group_tag = f" ({esc(group_title)})" if group_title else ""
            lines.append(f"{place}. {user_link(fullname, r_user_id, r_username)}{group_tag} {medal}")

    text = "\n".join(lines)
    if len(text) <= 4096:
        await callback.message.answer(text, parse_mode="HTML")
    else:
        # Uzun reyting: jadval va profillar alohida bo'laklarda (<pre> teglari buzilmasin)
        pre_end = lines.index("</pre>")
        table_rows = lines[4:pre_end]
        head = f"🏆 <b>{esc(test_name)}</b> — Reyting jadvali\n"
        for start in range(0, len(table_rows), 40):
            part = table_rows[start:start + 40]
            await callback.message.answer(
                (head if start == 0 else "") + "<pre>" + "\n".join(lines[2:4] + part) + "</pre>",
                parse_mode="HTML"
            )
        rest = lines[pre_end + 1:]
        if rest:
            for chunk in chunk_lines(rest):
                await callback.message.answer(chunk, parse_mode="HTML")


# =====================================================================
# ADMIN: REKLAMA (BROADCAST)
# =====================================================================
@dp.message(IsPrivateChat(), IsAdmin(), F.text == "📢 Reklama yuborish")
async def admin_ad_start(message: types.Message, state: FSMContext):
    await state.set_state(AdState.waiting_for_content)
    await message.answer(
        "📢 <b>Reklama posti yuborish</b>\n\nQuyidagilardan birini yuboring:\n"
        "🖼 Rasm + izoh (caption) - eng chiroyli ko'rinadi\n✍️ Oddiy matn\n"
        "↪️ Yoki kanaldan postni shu yerga <b>forward</b> qiling\n\nBekor qilish uchun /cancel yozing.",
        parse_mode="HTML"
    )


@dp.message(IsPrivateChat(), IsAdmin(), Command("cancel"), AdState.waiting_for_content)
@dp.message(IsPrivateChat(), IsAdmin(), Command("cancel"), AdState.waiting_for_button)
async def admin_ad_cancel_cmd(message: types.Message, state: FSMContext):
    await state.clear()
    await message.answer("❌ Reklama yuborish bekor qilindi.", reply_markup=get_main_menu(message.from_user.id))


@dp.message(IsPrivateChat(), IsAdmin(), AdState.waiting_for_content, F.photo)
async def admin_ad_receive_photo(message: types.Message, state: FSMContext):
    await state.update_data(ad_photo=message.photo[-1].file_id, ad_text=message.caption or "")
    await _ask_for_ad_button(message, state)


@dp.message(IsPrivateChat(), IsAdmin(), AdState.waiting_for_content, F.text)
async def admin_ad_receive_text(message: types.Message, state: FSMContext):
    await state.update_data(ad_photo=None, ad_text=message.text)
    await _ask_for_ad_button(message, state)


async def _ask_for_ad_button(message: types.Message, state: FSMContext):
    await state.set_state(AdState.waiting_for_button)
    await message.answer(
        "🔘 Postga tugma (link) qo'shmoqchimisiz?\n\nQo'shish uchun shu formatda yozing:\n"
        "<code>Tugma matni|https://havola.com</code>\n\nKerak bo'lmasa - <b>yo'q</b> deb yozing.",
        parse_mode="HTML"
    )


@dp.message(IsPrivateChat(), IsAdmin(), AdState.waiting_for_button)
async def admin_ad_receive_button(message: types.Message, state: FSMContext):
    raw = (message.text or "").strip()

    btn_text, btn_url = None, None
    if raw.lower() not in ("yo'q", "yoq", "yo'q.", "-", "skip"):
        if "|" in raw:
            parts = raw.split("|", 1)
            candidate_text, candidate_url = parts[0].strip(), parts[1].strip()
            if candidate_url.startswith("http://") or candidate_url.startswith("https://"):
                btn_text, btn_url = candidate_text, candidate_url
            else:
                await message.answer(
                    "⚠️ Havola http:// yoki https:// bilan boshlanishi kerak. Qaytadan yuboring yoki <b>yo'q</b> deb yozing.",
                    parse_mode="HTML"
                )
                return
        else:
            await message.answer(
                "⚠️ Format noto'g'ri. Namuna: <code>Batafsil|https://t.me/kanalim</code>\n"
                "Yoki tugma kerak bo'lmasa - <b>yo'q</b> deb yozing.", parse_mode="HTML"
            )
            return

    await state.update_data(ad_btn_text=btn_text, ad_btn_url=btn_url)
    data = await state.get_data()

    total_users = await db_count_users()

    preview_markup = None
    if btn_text and btn_url:
        preview_markup = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=btn_text, url=btn_url)]])

    confirm_extra = [[
        InlineKeyboardButton(text="✅ Barchaga yuborish", callback_data="adsend_confirm"),
        InlineKeyboardButton(text="❌ Bekor qilish", callback_data="adsend_cancel")
    ]]
    full_markup = InlineKeyboardMarkup(
        inline_keyboard=(preview_markup.inline_keyboard if preview_markup else []) + confirm_extra
    )

    await message.answer(f"👀 <b>Reklama shunday ko'rinadi</b> (jami {total_users} ta foydalanuvchiga yuboriladi):", parse_mode="HTML")

    if data.get('ad_photo'):
        await message.answer_photo(data['ad_photo'], caption=data.get('ad_text') or None, reply_markup=full_markup, parse_mode="HTML")
    else:
        await message.answer(data.get('ad_text') or "(matnsiz)", reply_markup=full_markup, parse_mode="HTML")


@dp.callback_query(IsAdmin(), F.data == "adsend_cancel")
async def admin_ad_cancel_cb(callback: types.CallbackQuery, state: FSMContext):
    await state.clear()
    await callback.message.edit_reply_markup(reply_markup=None)
    await callback.message.answer("❌ Reklama yuborish bekor qilindi.", reply_markup=get_main_menu(callback.from_user.id))
    await callback.answer()


@dp.callback_query(IsAdmin(), F.data == "adsend_confirm")
async def admin_ad_confirm_cb(callback: types.CallbackQuery, state: FSMContext):
    data = await state.get_data()
    ad_photo = data.get('ad_photo')
    ad_text = data.get('ad_text') or ""
    btn_text = data.get('ad_btn_text')
    btn_url = data.get('ad_btn_url')
    await state.clear()

    markup = None
    if btn_text and btn_url:
        markup = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=btn_text, url=btn_url)]])

    all_users = await db_list_all_user_ids()

    await callback.message.edit_reply_markup(reply_markup=None)
    status_msg = await callback.message.answer(f"🚀 Reklama yuborilmoqda... (0/{len(all_users)})")
    await callback.answer("Yuborish boshlandi")

    sent, failed = 0, 0
    for idx, uid in enumerate(all_users, start=1):
        if ad_photo:
            res = await safe_send(bot.send_photo, uid, ad_photo, caption=ad_text or None,
                                  reply_markup=markup, parse_mode="HTML")
        else:
            res = await safe_send(bot.send_message, uid, ad_text, reply_markup=markup, parse_mode="HTML")
        if res:
            sent += 1
        else:
            failed += 1

        await asyncio.sleep(0.05)  # sekundiga ~20 ta xabar - Telegram limiti (30/s) dan past

        if idx % 100 == 0:
            try:
                await status_msg.edit_text(f"🚀 Reklama yuborilmoqda... ({idx}/{len(all_users)})")
            except Exception:
                pass

    await status_msg.edit_text(
        f"✅ <b>Reklama yuborish yakunlandi!</b>\n\n📨 Yetkazildi: {sent} ta\n"
        f"❌ Yetkazilmadi (botni bloklagan/o'chirilgan akkaunt): {failed} ta\n👥 Jami: {len(all_users)} ta foydalanuvchi",
        parse_mode="HTML"
    )
    await callback.message.answer("Bosh menyu:", reply_markup=get_main_menu(callback.from_user.id))


# =====================================================================
# ADMIN: MAVJUD MOCK TESTNI TAHRIRLASH
# =====================================================================
@dp.message(IsPrivateChat(), IsAdmin(), F.text == "✏️ Tahrirlash")
async def admin_edit_test_menu(message: types.Message, state: FSMContext):
    rows = await db_list_tests()
    if not rows:
        await message.answer("🗂 Hozircha bazada birorta ham mock test yo'q.")
        return
    markup = tests_list_kb(rows, "edittest_")
    # Kod yozib yuborish ham ishlashi uchun holat yoqiladi (faqat raqamli xabarni ushlaydi)
    await state.set_state(AdminEditState.waiting_for_code)
    await message.answer(
        "✏️ Javoblarini tahrirlamoqchi bo'lgan mock testni tanlang\n"
        "yoki <b>test kodini yozib yuboring</b> (masalan: <code>123456</code>):",
        reply_markup=markup, parse_mode="HTML"
    )


async def _open_edit_webapp(target: types.Message, code: str):
    test = await db_get_test(code)
    if not test:
        await target.answer("⚠️ Bunday kodli test topilmadi (o'chirilgan bo'lishi mumkin).")
        return False

    test_name, test_type, level, answers = test
    safe_name = quote(test_name, safe='')
    answers_param = quote(json.dumps(answers), safe='')
    url = (
        f"{NETLIFY_URL}?mode=admin&type={test_type}&level={level}"
        f"&name={safe_name}&edit=1&code={code}&answers={answers_param}"
    )
    markup = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="✏️ Tahrirlash uchun WebApp ochish", web_app=WebAppInfo(url=url))],
                  [KeyboardButton(text="🏠 Bosh menyu")]],
        resize_keyboard=True
    )
    await target.answer(
        f"✏️ <b>Tahrirlash</b>\n📚 Mock nomi: {esc(test_name)}\n🔢 Test kodi: <code>{esc(code)}</code>\n\n"
        f"Pastdagi tugma orqali WebApp'ni oching — barcha hozirgi javoblar tayyor holda ko'rinadi. "
        f"Xato ketgan javob(lar)ni o'zgartirib, qayta yuboring.",
        reply_markup=markup, parse_mode="HTML"
    )
    return True


@dp.callback_query(IsAdmin(), F.data.startswith("edittest_"))
async def admin_edit_test_open(callback: types.CallbackQuery, state: FSMContext):
    code = callback.data.replace("edittest_", "")
    await callback.answer()
    if await _open_edit_webapp(callback.message, code):
        await state.clear()


@dp.message(IsPrivateChat(), IsAdmin(), AdminEditState.waiting_for_code, F.text.regexp(r"^\s*\d+\s*$"))
async def admin_edit_test_by_code(message: types.Message, state: FSMContext):
    code = message.text.strip()
    if await _open_edit_webapp(message, code):
        await state.clear()
    else:
        await message.answer("Boshqa kod yozing yoki ro'yxatdan tanlang. Chiqish uchun \"🏠 Bosh menyu\" ni bosing.")


# =====================================================================
# ADMIN: MOCKLARNI QO'LDA BOSHQARISH (O'CHIRISH)
# =====================================================================
@dp.message(IsPrivateChat(), IsAdmin(), F.text == "🗑 Mocklarni boshqarish")
async def admin_manage_mocks(message: types.Message):
    rows = await db_list_tests()
    if not rows:
        await message.answer("🗂 Hozircha bazada birorta ham mock test yo'q.")
        return

    await message.answer(
        f"🗂 <b>Bazadagi mocklar: {len(rows)} ta</b>\n\n"
        f"ℹ️ Mocklar avtomatik o'chmaydi — faqat siz shu yerdan o'chirsangiz o'chadi.\n"
        f"O'quvchi natijalari esa {RESULT_LIFETIME_DAYS} kundan keyin avtomatik tozalanadi.\n\n"
        f"👇 O'chirmoqchi bo'lgan mockni tanlang (tanlagach, tasdiqlash so'raladi):",
        reply_markup=tests_list_kb(rows, "delmock_"), parse_mode="HTML"
    )


@dp.callback_query(IsAdmin(), F.data.startswith("delmock_"))
async def confirm_delete_mock(callback: types.CallbackQuery):
    code = callback.data.replace("delmock_", "")
    row = await db_get_test_details(code)

    if not row:
        await callback.answer("⚠️ Bu test allaqachon o'chirilgan.", show_alert=True)
        return

    results_count = await db_count_results_for_test(code)
    name, ttype, level, created_at = row
    markup = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="✅ Ha, butunlay o'chirish", callback_data=f"delconfirm_{code}"),
        InlineKeyboardButton(text="❌ Bekor qilish", callback_data="delcancel")
    ]])
    await callback.message.answer(
        f"⚠️ <b>Diqqat!</b>\n\n🔢 Test: <code>{esc(code)}</code> — {esc(name)}\n"
        f"Turi: {esc(ttype)} | Daraja: {esc(level)}\n"
        f"🕒 Yaratilgan: {esc(format_dt(created_at))}\n📊 Bog'liq natijalar: {results_count} ta\n\n"
        f"Ushbu testni va unga tegishli BARCHA natijalarni butunlay o'chirmoqchimisiz? "
        f"Bu amalni ortga qaytarib bo'lmaydi!",
        reply_markup=markup, parse_mode="HTML"
    )
    await callback.answer()


@dp.callback_query(IsAdmin(), F.data.startswith("delconfirm_"))
async def delete_mock_confirmed(callback: types.CallbackQuery):
    code = callback.data.replace("delconfirm_", "")
    await db_delete_test_and_results(code)
    await callback.message.edit_text(f"✅ Test <code>{esc(code)}</code> va uning barcha natijalari bazadan butunlay o'chirildi.", parse_mode="HTML")
    await callback.answer("🗑 O'chirildi")


@dp.callback_query(F.data == "delcancel")
async def delete_mock_cancel(callback: types.CallbackQuery):
    await callback.message.edit_text("❌ Bekor qilindi. Test o'chirilmadi.")
    await callback.answer()


# =====================================================================
# ADMIN: XATOLAR STATISTIKASI
# =====================================================================
@dp.message(IsPrivateChat(), IsAdmin(), F.text == "📉 Xatolar statistikasi")
async def admin_error_stats_menu(message: types.Message):
    mocks = await db_list_tests()
    if not mocks:
        await message.answer("🗂 Hozircha bazada birorta ham mock test yo'q.")
        return
    markup = tests_list_kb(mocks, "errstat_")
    await message.answer("📉 Xatolar statistikasini ko'rmoqchi bo'lgan mock testni tanlang:", reply_markup=markup)


@dp.callback_query(IsAdmin(), F.data.startswith("errstat_"))
async def admin_error_stats_detail(callback: types.CallbackQuery):
    code = callback.data.replace("errstat_", "")
    test = await db_get_test(code)

    if not test:
        await callback.answer("⚠️ Bu test bazada topilmadi (o'chirilgan bo'lishi mumkin).", show_alert=True)
        return

    test_name, test_type, level, admin_answers = test
    all_students = await db_get_error_stats_rows(code)
    await callback.answer()

    total_students = len(all_students)
    if total_students == 0:
        await callback.message.answer(
            f"📉 <b>{esc(test_name)}</b>\n\nBu testga hali hech kim javob kiritmagan — xatolar statistikasi mavjud emas.",
            parse_mode="HTML"
        )
        return

    sorted_nums = _sorted_qnums(admin_answers)

    student_errors = []
    for fullname, student_answers, s_user_id, s_chat_id, s_username in all_students:
        wrong_labels = []
        for q_num in sorted_nums:
            correct_ans = admin_answers[q_num]
            s_ans = student_answers.get(str(q_num), "-")
            if not check_sat_answer(s_ans, correct_ans):
                wrong_labels.append(question_label(test_type, q_num))
        if wrong_labels:
            student_errors.append((fullname, wrong_labels, s_user_id, s_chat_id, s_username))

    student_errors.sort(key=lambda x: (x[0] or "").lower())

    if not student_errors:
        await callback.message.answer(
            f"📉 <b>{esc(test_name)}</b>\n\n✅ Bu mock bo'yicha hech kim xato qilmagan — barcha o'quvchilar hammasini to'g'ri yechgan!",
            parse_mode="HTML"
        )
        return

    lines = [
        f"📉 <b>{esc(test_name)} — Xatolar statistikasi</b>\n"
        f"👥 Jami topshirganlar: {total_students} ta | ❌ Xato qilganlar: {len(student_errors)} ta\n"
    ]
    for fullname, wrong_labels, s_user_id, s_chat_id, s_username in student_errors:
        group_title = get_group_title(s_chat_id) if s_chat_id else None
        group_tag = f" — {esc(group_title)}" if group_title else ""
        lines.append(f"👤 <b>{user_link(fullname, s_user_id, s_username)}</b>{group_tag} (ID: <code>{s_user_id}</code>)")
        for label in wrong_labels:
            lines.append(f"   ❌ {label}")
        lines.append("")

    await send_long(callback.message, lines)


# =====================================================================
# ADMIN: FAQAT JAVOBLARNI (NATIJALARNI) O'CHIRISH
# =====================================================================
@dp.message(IsPrivateChat(), IsAdmin(), F.text == "🧹 Javoblarni o'chirish")
async def admin_clear_answers_menu(message: types.Message):
    mocks = await db_list_tests()
    if not mocks:
        await message.answer("🗂 Hozircha bazada birorta ham mock test yo'q.")
        return
    markup = tests_list_kb(mocks, "clranswers_")
    await message.answer(
        "🧹 Qaysi mockning BARCHA natija/reytingini tozalamoqchisiz?\n"
        "⚠️ Testning o'zi (kodi, savol-javoblari) bazada QOLADI — faqat topshirilgan javoblar/natijalar o'chadi, "
        "shundan keyin shu testni boshqa guruhga qayta berishingiz mumkin bo'ladi (hech kim topshirmagandek bo'ladi).",
        reply_markup=markup
    )


@dp.callback_query(IsAdmin(), F.data.startswith("clranswers_"))
async def admin_clear_answers_confirm(callback: types.CallbackQuery):
    code = callback.data.replace("clranswers_", "")
    test_name = await db_get_test_name(code)

    if not test_name:
        await callback.answer("⚠️ Bu test bazada topilmadi.", show_alert=True)
        return

    results_count = await db_count_results_for_test(code)
    await callback.answer()

    if results_count == 0:
        await callback.message.answer(
            f"ℹ️ <b>{esc(test_name)}</b> ({esc(code)}) bo'yicha hali hech qanday javob/natija yo'q — tozalashga hojat yo'q.",
            parse_mode="HTML"
        )
        return

    markup = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="✅ Ha, natija/reytingni tozalash", callback_data=f"clrconfirm_{code}"),
        InlineKeyboardButton(text="❌ Bekor qilish", callback_data="clrcancel")
    ]])
    await callback.message.answer(
        f"⚠️ <b>Diqqat!</b>\n\n🔢 Test: <code>{esc(code)}</code> — {esc(test_name)}\n"
        f"📊 Topshirilgan javoblar: {results_count} ta\n\n"
        f"Ushbu testga tegishli BARCHA javoblar/natijalar (📊 Natija va 🏆 Reyting'dan) butunlay o'chiriladi. "
        f"Test o'zi (kodi, savol-javoblari) bazada QOLADI — shu kodni boshqa guruhga qayta berib, "
        f"yangidan topshirtirishingiz mumkin bo'ladi. Bu amalni ortga qaytarib bo'lmaydi. Davom etasizmi?",
        reply_markup=markup, parse_mode="HTML"
    )


@dp.callback_query(F.data == "clrcancel")
async def admin_clear_answers_cancel(callback: types.CallbackQuery):
    await callback.message.edit_text("❌ Bekor qilindi. Hech narsa o'chirilmadi.")
    await callback.answer()


@dp.callback_query(IsAdmin(), F.data.startswith("clrconfirm_"))
async def admin_clear_answers_do(callback: types.CallbackQuery):
    code = callback.data.replace("clrconfirm_", "")
    test_name = await db_get_test_name(code)
    if not test_name:
        await callback.answer("⚠️ Bu test bazada topilmadi.", show_alert=True)
        return

    await db_clear_test_results(code)

    await callback.message.edit_text(
        f"✅ <b>{esc(test_name)}</b> ({esc(code)}) bo'yicha barcha javoblar/natijalar tozalandi.\n\n"
        f"📊 Natija va 🏆 Reyting endi bo'sh — go'yo hech kim hali topshirmagandek. "
        f"Test o'zi (kodi, savollari) bazada qoldi — shu kodni boshqa guruhga berib, qaytadan topshirtirishingiz mumkin.",
        parse_mode="HTML"
    )
    await callback.answer("🧹 Tozalandi")


# =====================================================================
# GURUHLAR TIZIMI
# =====================================================================
def _extract_forward_chat(message: types.Message):
    origin = getattr(message, "forward_origin", None)
    if origin is not None:
        chat = getattr(origin, "chat", None)
        if chat is not None:
            return chat
        sender_chat = getattr(origin, "sender_chat", None)
        if sender_chat is not None:
            return sender_chat
        return None
    return getattr(message, "forward_from_chat", None)


def _is_admin_forward(message: types.Message) -> bool:
    if not message.from_user or message.from_user.id not in all_admin_ids():
        return False
    chat = _extract_forward_chat(message)
    return chat is not None and chat.type in ("group", "supergroup", "channel")


async def _is_group_admin(chat_id, user_id) -> bool:
    """Guruh admini/egasimi? Natija 1 kun eslab qolinadi - har xabarda
    Telegram'ga so'rov yubormaslik uchun."""
    key = (chat_id, user_id)
    hit = _group_admin_cache.get(key)
    if hit and time.monotonic() - hit[1] < GROUP_ADMIN_CACHE_SECONDS:
        return hit[0]
    try:
        member = await bot.get_chat_member(chat_id, user_id)
        is_admin = member.status in ("administrator", "creator")
    except Exception:
        return False
    _group_admin_cache[key] = (is_admin, time.monotonic())
    return is_admin


@dp.my_chat_member()
async def bot_membership_update(update: types.ChatMemberUpdated):
    chat = update.chat
    if chat.type not in ("group", "supergroup"):
        return

    new_status = update.new_chat_member.status
    if new_status in ("administrator", "member"):
        await db_register_group(chat.id, chat.title)
        if new_status == "administrator" and update.from_user and update.from_user.id in all_admin_ids():
            await safe_send(
                bot.send_message,
                update.from_user.id,
                f"✅ Bot <b>{esc(chat.title or str(chat.id))}</b> guruhida admin qilindi va ro'yxatga olindi.\n"
                f"Endi 📤 <b>Guruhga yuborish</b> yoki 🗂 <b>Vazifalar</b> orqali shu guruhga mock test yuborishingiz mumkin.\n\n"
                f"⚠️ Eslatma: Telegram bot API guruhning barcha a'zolarini avtomatik ro'yxatga olishga imkon bermaydi. "
                f"O'quvchilar guruhda birinchi marta xabar yozganda (yoki guruhga qo'shilganda) avtomatik ro'yxatga olinadi.",
                parse_mode="HTML"
            )


@dp.message(IsPrivateChat(), _is_admin_forward)
async def admin_register_group_via_forward(message: types.Message):
    chat = _extract_forward_chat(message)
    title = getattr(chat, "title", None) or str(chat.id)
    await db_register_group(chat.id, title)
    await message.answer(
        f"✅ Guruh ro'yxatga olindi: <b>{esc(title)}</b>\n\n"
        f"Endi 👥 <b>Guruhlar</b> bo'limida ko'rishingiz va 📤 <b>Guruhga yuborish</b> / 🗂 <b>Vazifalar</b> orqali "
        f"unga mock test biriktirishingiz mumkin.\n\n"
        f"⚠️ Eslatma: bot shu guruhda ADMIN bo'lishi kerak, aks holda xabar yubora olmaydi. Shuningdek, "
        f"Telegram cheklovi tufayli a'zolar ro'yxati ular guruhda birinchi marta xabar yozgandan keyin to'lib boradi.",
        parse_mode="HTML"
    )


# "Test kodi: 888" kalit so'zi (atrofida boshqa matn bo'lishi mumkin). Bir nechta kod: "Test kodi: 888, 889"
_TASK_CODE_RE = re.compile(
    r"(?:test\s*kod(?:i)?\s*[:：=\-–]?|\bkod(?:i)?\s*[:：=])\s*[`'\"‘’]*\s*(\d+(?:\s*[,;]\s*\d+)*)",
    re.IGNORECASE
)
_channel_link_cache: dict = {}   # kanal chat_id -> bog'langan chat guruh chat_id


def _extract_task_codes(text: str) -> list:
    codes = []
    for m in _TASK_CODE_RE.finditer(text or ""):
        for c in re.findall(r"\d+", m.group(1)):
            if c not in codes:
                codes.append(c)
    return codes


async def _assign_codes_to_group(codes, chat_id: int, title: str, notify_ids, source: str = ""):
    """Kodlarni guruhga biriktiradi (bor bo'lsa o'tkazib yuboradi) va adminlarga qisqa hisobot yuboradi."""
    added, missing = [], []
    for code in codes:
        test_name = await db_get_test_name(code)
        if not test_name:
            missing.append(code)
            continue
        if await db_is_mock_assigned(code, chat_id):
            continue  # allaqachon biriktirilgan - qayta yozmaymiz
        await db_assign_mock_to_group(code, chat_id)
        added.append(f"{code} — {test_name}")

    if not (added or missing):
        return
    lines = [f"🤖 <b>Avto-vazifa</b>{source} | 👥 {esc(title)}"]
    if added:
        lines.append("✅ Biriktirildi (guruhga xabar ketmadi):")
        lines.extend(f"   • {esc(a)}" for a in added)
    if missing:
        lines.append("⚠️ Botda bunday test yo'q, biriktirilmadi: " + ", ".join(missing))
    for admin_id in notify_ids:
        await safe_send(bot.send_message, admin_id, "\n".join(lines), parse_mode="HTML")


async def _auto_assign_tasks_from_message(message: types.Message):
    """CHAT GURUHDA: admin tashlagan/tahrirlagan xabardagi "Test kodi: NNN" ni topib, kodni SHU guruhga biriktiradi.
    Faqat xabar kelganda ishlaydi va matnda "kod" so'zi bo'lmasa darhol qaytadi - botga yuklama tushmaydi."""
    text = message.text or message.caption
    if not text or "kod" not in text.lower():
        return

    user = message.from_user
    chat = message.chat
    # Faqat ishonchli manba: bot adminlari, bog'langan kanaldan avto-forward, yoki guruhdan anonim admin xabari.
    # (Oddiy o'quvchi "Test kodi: 999" yozsa ham hech narsa biriktirilmaydi.)
    trusted = bool(
        (user and user.id in all_admin_ids())
        or getattr(message, "is_automatic_forward", False)
        or (message.sender_chat and message.sender_chat.id == chat.id)
    )
    if not trusted:
        return
    codes = _extract_task_codes(text)
    if not codes:
        return
    notify_ids = {user.id} if (user and user.id in all_admin_ids()) else set(ADMIN_IDS)
    await _assign_codes_to_group(codes, chat.id, chat.title or str(chat.id), notify_ids)


async def _linked_group_id(channel_id: int) -> int:
    """Kanalga bog'langan muhokama (chat) guruhi ID si. Telegram getChat orqali beradi."""
    if channel_id in _channel_link_cache:
        return _channel_link_cache[channel_id]
    try:
        info = await bot.get_chat(channel_id)
    except Exception:
        return 0
    linked = getattr(info, "linked_chat_id", None) or 0
    if linked:
        _channel_link_cache[channel_id] = linked
    return linked


async def _auto_assign_tasks_from_channel_post(message: types.Message):
    """YOPIQ KANALDA: post (yoki uning tahriri)dagi "Test kodi: NNN" ni topib, vazifani shu kanalga bog'langan
    CHAT GURUHga biriktiradi. Kanal postini faqat kanal adminlari qo'ya oladi, shuning uchun ishonchli manba.
    Xavfsizlik: chat guruh botda allaqachon ro'yxatdan o'tgan bo'lishi shart (begona kanal ta'sir qila olmaydi)."""
    text = message.text or message.caption
    if not text or "kod" not in text.lower():
        return
    codes = _extract_task_codes(text)
    if not codes:
        return

    channel = message.chat
    linked = await _linked_group_id(channel.id)
    if not linked or linked not in known_groups:
        for admin_id in set(ADMIN_IDS):
            await safe_send(
                bot.send_message, admin_id,
                f"⚠️ <b>{esc(channel.title or str(channel.id))}</b> kanalida test kodi ({', '.join(codes)}) topildi, "
                f"lekin kanalga bog'langan va botda ro'yxatdan o'tgan chat guruh topilmadi.\n"
                f"Bot chat guruhda ham admin bo'lishi va guruh ro'yxatga olingan bo'lishi kerak.",
                parse_mode="HTML"
            )
        return
    title = get_group_title(linked) or str(linked)
    await _assign_codes_to_group(codes, linked, title, set(ADMIN_IDS), source=f" (kanal: {esc(channel.title or '')})")


@dp.channel_post()
async def channel_post_tracker(message: types.Message):
    try:
        await _auto_assign_tasks_from_channel_post(message)
    except Exception as e:
        print(f"Avto-vazifa (kanal) xatoligi: {e}")


@dp.edited_channel_post()
async def edited_channel_post_tracker(message: types.Message):
    try:
        await _auto_assign_tasks_from_channel_post(message)
    except Exception as e:
        print(f"Avto-vazifa (kanal tahriri) xatoligi: {e}")


@dp.edited_message(IsGroupChat())
async def group_edited_message_tracker(message: types.Message):
    """PDF/rasm tagidagi yozuv (caption) KEYIN tahrirlanib kod qo'shilsa ham vazifa biriktiriladi."""
    try:
        await _auto_assign_tasks_from_message(message)
    except Exception as e:
        print(f"Avto-vazifa (tahrir) xatoligi: {e}")


@dp.message(IsGroupChat())
async def group_activity_tracker(message: types.Message):
    """Guruhdagi HAR BIR xabar shu yerdan o'tadi. Avval bu yerda har xabarda
    bazaga 2 marta yozish bo'lardi - endi faqat yangi guruh/a'zo yoki ism
    o'zgargandagina yoziladi, qolgan hollarda faqat xotira tekshiriladi."""
    chat = message.chat
    await ensure_group_registered(chat.id, chat.title)

    try:
        await _auto_assign_tasks_from_message(message)
    except Exception as e:
        print(f"Avto-vazifa xatoligi: {e}")

    if message.new_chat_members:
        for member in message.new_chat_members:
            if member.is_bot or member.id in all_admin_ids():
                continue
            if await _is_group_admin(chat.id, member.id):
                continue
            await track_group_member(chat.id, member.id, member.full_name, member.username)
        return

    if message.left_chat_member:
        if not message.left_chat_member.is_bot:
            await db_remove_group_member(chat.id, message.left_chat_member.id)
        return

    user = message.from_user
    if user and not user.is_bot and user.id not in all_admin_ids():
        if (chat.id, user.id) not in known_members:
            if await _is_group_admin(chat.id, user.id):
                return
        await track_group_member(chat.id, user.id, user.full_name, user.username)


@dp.message(IsPrivateChat(), IsAdmin(), F.text == "👥 Guruhlar")
async def admin_groups_menu(message: types.Message):
    rows = await db_list_groups()
    if not rows:
        await message.answer(
            "🗂 Hozircha ro'yxatdan o'tgan guruh yo'q.\n\n"
            "Guruhni ro'yxatga olish uchun:\n"
            "1️⃣ Botni yopiq guruhingizga <b>admin</b> qilib qo'shing (avtomatik ro'yxatga olinadi), YOKI\n"
            "2️⃣ O'sha guruhdan istalgan xabarni shu botga <b>forward</b> qiling.",
            parse_mode="HTML"
        )
        return

    buttons = []
    for chat_id, title in rows:
        label = truncate_label(f"👥 {title}")
        buttons.append([InlineKeyboardButton(text=label, callback_data=f"grp_{chat_id}")])
    await message.answer("👥 Ro'yxatdagi guruhlardan birini tanlang:", reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons))


def group_mocks_kb(chat_id, mocks, page: int = 0) -> InlineKeyboardMarkup:
    page, total_pages, start, end = _page_bounds(len(mocks), page, PAGE_SIZE)
    buttons = [
        [InlineKeyboardButton(text="📈 Umumiy statistika (kim nechta vazifa bajardi)", callback_data=f"grpoverall_{chat_id}")],
        [InlineKeyboardButton(text="👥 O'quvchilar (vazifa holati)", callback_data=f"gst|{chat_id}|0")],
    ]
    buttons += [
        [InlineKeyboardButton(text=truncate_label(f"📚 {name} ({code})"), callback_data=f"grpmock_{chat_id}_{code}")]
        for code, name in mocks[start:end]
    ]
    if total_pages > 1:
        buttons.append(_nav_row(f"gpg|{chat_id}|", page, total_pages))
    return InlineKeyboardMarkup(inline_keyboard=buttons)


@dp.callback_query(IsAdmin(), F.data.startswith("grp_"))
async def admin_group_detail(callback: types.CallbackQuery):
    chat_id = int(callback.data.replace("grp_", ""))

    title = get_group_title(chat_id)
    await callback.answer()

    if not title:
        await callback.message.answer("⚠️ Bu guruh topilmadi.")
        return

    member_count = await db_count_group_members(chat_id)
    mocks = await db_get_group_mocks(chat_id)

    text = f"👥 <b>{esc(title)}</b>\n👤 Kuzatilgan a'zolar: {member_count} ta\n\n"
    if not mocks:
        text += "Bu guruhga hali birorta ham mock yuborilmagan.\n\n📤 <b>Guruhga yuborish</b> yoki 🗂 <b>Vazifalar</b> orqali biriktirishingiz mumkin."
        await callback.message.answer(text, parse_mode="HTML")
        return

    text += f"📚 Bu guruhga berilgan mocklar ({len(mocks)} ta):"
    await callback.message.answer(text, reply_markup=group_mocks_kb(chat_id, mocks), parse_mode="HTML")


@dp.callback_query(IsAdmin(), F.data.startswith("gpg|"))
async def paginate_group_mocks(callback: types.CallbackQuery):
    try:
        _, chat_str, page_str = callback.data.split("|")
        chat_id, page = int(chat_str), int(page_str)
    except Exception:
        await callback.answer()
        return
    mocks = await db_get_group_mocks(chat_id)
    try:
        await callback.message.edit_reply_markup(reply_markup=group_mocks_kb(chat_id, mocks, page))
    except Exception:
        pass
    await callback.answer()


@dp.callback_query(IsAdmin(), F.data.startswith("grpoverall_"))
async def admin_group_overall_stats(callback: types.CallbackQuery):
    chat_id = int(callback.data.replace("grpoverall_", ""))
    title = get_group_title(chat_id)
    await callback.answer()

    if not title:
        await callback.message.answer("⚠️ Bu guruh topilmadi.")
        return

    mocks = await db_get_group_mocks(chat_id)
    total_assigned = len(mocks)
    if total_assigned == 0:
        await callback.message.answer(
            f"⚠️ <b>{esc(title)}</b> guruhiga hali birorta ham vazifa biriktirilmagan.",
            parse_mode="HTML"
        )
        return

    rows = await db_get_group_overall_progress(chat_id)
    if not rows:
        await callback.message.answer(
            f"⚠️ <b>{esc(title)}</b> guruhida hozircha kuzatilgan a'zo yo'q.",
            parse_mode="HTML"
        )
        return

    rows_sorted = sorted(rows, key=lambda r: (-r[3], (r[1] or "").lower()))

    lines = [
        f"📈 <b>{esc(title)}</b> — umumiy statistika\n"
        f"🗂 Jami berilgan vazifalar: {total_assigned} ta\n👥 Kuzatilgan a'zolar: {len(rows_sorted)} ta\n"
    ]
    for idx, (user_id, fullname, username, done_count) in enumerate(rows_sorted, 1):
        lines.append(
            f"{idx}. {user_link(fullname, user_id, username)} — "
            f"<b>{done_count}/{total_assigned}</b> ta vazifa bajargan"
        )

    await send_long(callback.message, lines)


@dp.callback_query(IsAdmin(), F.data.startswith("grpmock_"))
async def admin_group_mock_stats(callback: types.CallbackQuery):
    _, chat_id_str, code = callback.data.split("_", 2)
    chat_id = int(chat_id_str)

    test_name = await db_get_test_name(code)
    await callback.answer()

    if not test_name:
        await callback.message.answer("⚠️ Bu mock topilmadi (o'chirilgan bo'lishi mumkin).")
        return

    members = await db_get_group_members(chat_id)
    results_by_user = await db_get_results_index_by_user(code, chat_id)

    done, not_done = [], []
    for user_id, fullname, username in members:
        row = results_by_user.get(user_id)
        if row:
            correct, total, score = row
            done.append((fullname, user_id, username, correct, total, score))
        else:
            not_done.append((fullname, user_id, username))

    lines = [f"📚 <b>{esc(test_name)}</b> — <b>{esc(get_group_title(chat_id) or '')}</b> statistikasi\n"]
    lines.append(f"👥 Guruhda kuzatilgan: {len(members)} ta")
    lines.append(f"✅ Bajardi: {len(done)} ta   |   ❌ Bajarmadi: {len(not_done)} ta\n")

    if done:
        done_sorted = sorted(done, key=lambda x: (-x[3], (x[0] or "").lower()))
        lines.append("✅ <b>Bajarganlar</b> (natija bo'yicha saralangan):")
        pre_rows = []
        for idx, (fullname, uid, username, correct, total, score) in enumerate(done_sorted, 1):
            fullname = fullname or str(uid)
            display_name = fullname if len(fullname) <= 24 else fullname[:22] + ".."
            pre_rows.append(f"{idx:>2}. {esc(display_name, quote=False):<26}{esc(score, quote=False):>8}")
        # <pre> blokini 40 qatordan bo'laklaymiz - uzun xabarda teg buzilmasin
        for start in range(0, len(pre_rows), 40):
            lines.append("<pre>" + "\n".join(pre_rows[start:start + 40]) + "</pre>")
        lines.append("👤 <i>Profilga o'tish uchun ismini bosing:</i>")
        for idx, (fullname, uid, username, correct, total, score) in enumerate(done_sorted, 1):
            lines.append(f"{idx}. {user_link(fullname, uid, username)}")

    if not_done:
        not_done_sorted = sorted(not_done, key=lambda x: (x[0] or "").lower())
        lines.append("\n❌ <b>Bajarmaganlar:</b>")
        for idx, (fullname, uid, username) in enumerate(not_done_sorted, 1):
            lines.append(f"{idx}. {user_link(fullname, uid, username)}")

    await send_long(callback.message, lines)


@dp.message(IsPrivateChat(), IsAdmin(), F.text == "📤 Guruhga yuborish")
async def admin_send_to_group_menu(message: types.Message):
    mocks = await db_list_tests()
    if not mocks:
        await message.answer("🗂 Hozircha bazada birorta ham mock test yo'q.")
        return
    markup = tests_list_kb(mocks, "gsend_test_")
    await message.answer("📤 Qaysi mockni guruh(lar)ga yubormoqchisiz?", reply_markup=markup)


def _build_group_select_markup(groups, selected_chats):
    buttons = []
    for chat_id, title in groups:
        mark = "✅ " if chat_id in selected_chats else "⬜ "
        label = truncate_label(mark + (title or str(chat_id)))
        buttons.append([InlineKeyboardButton(text=label, callback_data=f"gsendtoggle_{chat_id}")])
    buttons.append([
        InlineKeyboardButton(text="🚀 Yuborish", callback_data="gsend_confirm"),
        InlineKeyboardButton(text="❌ Bekor qilish", callback_data="gsend_cancel")
    ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


@dp.callback_query(IsAdmin(), F.data.startswith("gsend_test_"))
async def admin_send_choose_groups(callback: types.CallbackQuery, state: FSMContext):
    code = callback.data.replace("gsend_test_", "")

    test_name = await db_get_test_name(code)
    groups = await db_list_groups()
    await callback.answer()

    if not test_name:
        await callback.message.answer("⚠️ Bu test topilmadi.")
        return

    if not groups:
        await callback.message.answer(
            "🗂 Ro'yxatdagi guruh yo'q.\n\nAvval botni guruhga admin qiling yoki o'sha guruhdan xabar forward qiling "
            "(👥 Guruhlar bo'limidagi ko'rsatma bo'yicha)."
        )
        return

    await state.set_state(GroupSendState.choosing_groups)
    await state.update_data(send_code=code, selected_chats=[])
    await callback.message.answer(
        f"📤 <b>{esc(test_name)}</b> ({esc(code)}) — yubormoqchi bo'lgan guruh(lar)ni belgilang:",
        reply_markup=_build_group_select_markup(groups, []), parse_mode="HTML"
    )


@dp.callback_query(IsAdmin(), F.data.startswith("gsendtoggle_"), GroupSendState.choosing_groups)
async def admin_send_toggle_group(callback: types.CallbackQuery, state: FSMContext):
    chat_id = int(callback.data.replace("gsendtoggle_", ""))
    data = await state.get_data()
    selected = set(data.get("selected_chats", []))
    if chat_id in selected:
        selected.discard(chat_id)
    else:
        selected.add(chat_id)
    await state.update_data(selected_chats=list(selected))

    groups = await db_list_groups()
    try:
        await callback.message.edit_reply_markup(reply_markup=_build_group_select_markup(groups, selected))
    except Exception:
        pass
    await callback.answer()


@dp.callback_query(IsAdmin(), F.data == "gsend_cancel", GroupSendState.choosing_groups)
async def admin_send_cancel(callback: types.CallbackQuery, state: FSMContext):
    await state.clear()
    try:
        await callback.message.edit_text("❌ Bekor qilindi.")
    except Exception:
        pass
    await callback.answer()


@dp.callback_query(IsAdmin(), F.data == "gsend_confirm", GroupSendState.choosing_groups)
async def admin_send_confirm(callback: types.CallbackQuery, state: FSMContext):
    data = await state.get_data()
    code = data.get("send_code")
    selected_chats = data.get("selected_chats", [])

    if not selected_chats:
        await callback.answer("⚠️ Hech qanday guruh belgilanmagan.", show_alert=True)
        return

    await state.clear()

    test = await db_get_test(code)
    if not test:
        await callback.answer("⚠️ Bu test topilmadi.", show_alert=True)
        return

    test_name, test_type, level, admin_answers = test
    total_questions = len(admin_answers)
    group_text = build_test_announcement(test_name, code, total_questions, callback.from_user.full_name)

    await callback.answer()
    sent_titles, failed_titles = [], []
    for chat_id in selected_chats:
        title = get_group_title(chat_id) or str(chat_id)
        res = await safe_send(bot.send_message, chat_id, group_text, parse_mode="HTML")
        if res:
            await db_assign_mock_to_group(code, chat_id)
            sent_titles.append(title)
        else:
            failed_titles.append(title)

    report = f"✅ <b>{esc(test_name)}</b> quyidagi guruh(lar)ga yuborildi:\n" + "\n".join(f"• {esc(t)}" for t in sent_titles)
    if failed_titles:
        report += "\n\n❌ Yuborib bo'lmadi (ehtimol bot u yerda admin/a'zo emas):\n" + "\n".join(f"• {esc(t)}" for t in failed_titles)
    try:
        await callback.message.edit_text(report, parse_mode="HTML")
    except Exception:
        await callback.message.answer(report, parse_mode="HTML")


# =====================================================================
# ADMIN: VAZIFALAR
# =====================================================================
@dp.message(IsPrivateChat(), IsAdmin(), F.text == "🗂 Vazifalar")
async def admin_tasks_menu(message: types.Message):
    rows = await db_list_groups()
    if not rows:
        await message.answer(
            "🗂 Hozircha ro'yxatdan o'tgan guruh yo'q.\n\n"
            "Avval botni guruhingizga admin qiling yoki o'sha guruhdan xabar forward qiling."
        )
        return
    buttons = [
        [InlineKeyboardButton(text=truncate_label(f"👥 {title}"), callback_data=f"task_grp_{chat_id}")]
        for chat_id, title in rows
    ]
    await message.answer(
        "🗂 Qaysi guruh uchun vazifalarni ko'rmoqchisiz yoki yangi vazifa qo'shmoqchisiz?",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons)
    )


@dp.callback_query(IsAdmin(), F.data.startswith("task_grp_"))
async def admin_task_group_detail(callback: types.CallbackQuery):
    chat_id = int(callback.data.replace("task_grp_", ""))
    title = get_group_title(chat_id)
    await callback.answer()

    if not title:
        await callback.message.answer("⚠️ Bu guruh topilmadi.")
        return

    mocks = await db_get_group_mocks(chat_id)
    lines = [f"🗂 <b>{esc(title)}</b> — biriktirilgan vazifalar ({len(mocks)} ta):\n"]
    if mocks:
        for code, name in mocks:
            lines.append(f"🔢 <code>{esc(code)}</code> — {esc(name)}")
    else:
        lines.append("Hozircha hech qanday vazifa biriktirilmagan.")

    markup = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="➕ Yangi vazifa qo'shish", callback_data=f"task_add_{chat_id}")
    ]])
    await send_long(callback.message, lines, reply_markup=markup)


@dp.callback_query(IsAdmin(), F.data.startswith("task_add_"))
async def admin_task_add_start(callback: types.CallbackQuery, state: FSMContext):
    chat_id = int(callback.data.replace("task_add_", ""))
    title = get_group_title(chat_id) or str(chat_id)
    await state.set_state(TaskAssignState.waiting_for_codes)
    await state.update_data(task_chat_id=chat_id)
    await callback.answer()
    await callback.message.answer(
        f"🗂 <b>{esc(title)}</b> guruhiga vazifa biriktirish.\n\n"
        f"Bitta yoki bir nechta test kodini kiriting. Bir nechtasini kiritsangiz, orasini <b>vergul</b> bilan ajrating "
        f"(bo'sh joy qoldirmasangiz ham bo'ladi).\n\nMasalan: <code>101</code> yoki <code>101,205,309</code>\n\n"
        f"Bekor qilish uchun /cancel yozing.",
        parse_mode="HTML"
    )


@dp.message(IsPrivateChat(), IsAdmin(), Command("cancel"), TaskAssignState.waiting_for_codes)
async def admin_task_add_cancel(message: types.Message, state: FSMContext):
    await state.clear()
    await message.answer("❌ Bekor qilindi.", reply_markup=get_main_menu(message.from_user.id))


@dp.message(IsPrivateChat(), IsAdmin(), TaskAssignState.waiting_for_codes)
async def admin_task_add_receive_codes(message: types.Message, state: FSMContext):
    data = await state.get_data()
    chat_id = data.get("task_chat_id")
    await state.clear()

    raw_codes = [c.strip() for c in (message.text or "").split(",") if c.strip()]
    if not raw_codes:
        await message.answer("⚠️ Hech qanday kod kiritilmadi.", reply_markup=get_main_menu(message.from_user.id))
        return

    added, invalid = [], []
    for code in raw_codes:
        if not code.isdigit():
            invalid.append(code)
            continue
        test_name = await db_get_test_name(code)
        if not test_name:
            invalid.append(code)
            continue
        await db_assign_mock_to_group(code, chat_id)
        added.append(f"{code} — {test_name}")

    title = get_group_title(chat_id) or str(chat_id)
    lines = [f"🗂 <b>{esc(title)}</b> guruhiga vazifa biriktirish natijasi:\n"]
    if added:
        lines.append("✅ Biriktirildi (jim, guruhga xabar ketmadi):")
        lines.extend(f"   • {esc(a)}" for a in added)
    if invalid:
        lines.append("\n❌ Topilmadi/noto'g'ri kod:")
        lines.extend(f"   • {esc(i)}" for i in invalid)

    await send_long(message, lines, reply_markup=get_main_menu(message.from_user.id))


# =====================================================================
# ADMIN: ID ORQALI FOYDALANUVCHINI QIDIRISH
# =====================================================================
@dp.message(IsPrivateChat(), IsAdmin(), F.text == "🔍 ID orqali qidirish")
async def admin_search_by_id_start(message: types.Message, state: FSMContext):
    await state.set_state(AdminSearchState.waiting_for_user_id)
    await message.answer(
        "🆔 Qidirmoqchi bo'lgan foydalanuvchining Telegram ID raqamini yuboring:\n\n"
        "Bekor qilish uchun /cancel yozing."
    )


@dp.message(IsPrivateChat(), IsAdmin(), Command("cancel"), AdminSearchState.waiting_for_user_id)
async def admin_search_by_id_cancel(message: types.Message, state: FSMContext):
    await state.clear()
    await message.answer("❌ Bekor qilindi.", reply_markup=get_main_menu(message.from_user.id))


@dp.message(IsPrivateChat(), IsAdmin(), AdminSearchState.waiting_for_user_id)
async def admin_search_by_id_receive(message: types.Message, state: FSMContext):
    await state.clear()
    raw = (message.text or "").strip()

    if not raw.isdigit():
        await message.answer(
            "⚠️ ID faqat raqamlardan iborat bo'lishi kerak. Qaytadan urinish uchun "
            "\"🔍 ID orqali qidirish\" tugmasini bosing.",
            reply_markup=get_main_menu(message.from_user.id)
        )
        return

    target_id = int(raw)

    user_row = await _fetchone("SELECT username, fullname, name_set FROM users WHERE user_id = ?", (target_id,))
    results_count_row = await _fetchone("SELECT COUNT(*) FROM results WHERE user_id = ?", (target_id,))
    results_count = results_count_row[0] if results_count_row else 0
    group_rows = await _fetchall(
        "SELECT g.chat_id, g.title FROM group_members gm "
        "JOIN groups g ON g.chat_id = gm.chat_id WHERE gm.user_id = ?",
        (target_id,)
    )

    if not user_row and not results_count and not group_rows:
        await message.answer(
            f"⚠️ <code>{target_id}</code> haqida botda hech qanday ma'lumot topilmadi.\n\n"
            f"Ehtimol bu odam hali botga <code>/start</code> bosmagan yoki kuzatilayotgan "
            f"guruhlarda xabar yozmagan.",
            reply_markup=get_main_menu(message.from_user.id), parse_mode="HTML"
        )
        return

    if user_row:
        username, fullname, name_set = user_row
    else:
        username, fullname, name_set = None, f"ID {target_id}", 0

    lines = [f"🆔 <code>{target_id}</code>\n👤 {user_link(fullname, target_id, username)}"]
    if username:
        lines.append(f"📛 Username: {esc(username)}")
    if not name_set:
        lines.append("ℹ️ Bu foydalanuvchi hali to'liq ismini botga kiritmagan.")

    lines.append(f"\n📊 Yechgan testlar soni: {results_count} ta")

    if group_rows:
        lines.append("\n👥 A'zo bo'lgan guruhlari:")
        for _cid, title in group_rows:
            lines.append(f"   • {esc(title)}")
    else:
        lines.append("\n👥 Hech qaysi kuzatilayotgan guruhda a'zo emas (yoki hali xabar yozmagan).")

    text = "\n".join(lines)
    if results_count:
        markup = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="📊 Test natijalarini ko'rish", callback_data=f"idsearch_results_{target_id}")
        ]])
        await message.answer(text, reply_markup=markup, parse_mode="HTML")
    else:
        await message.answer(text, parse_mode="HTML")


@dp.callback_query(IsAdmin(), F.data.startswith("idsearch_results_"))
async def admin_search_show_results(callback: types.CallbackQuery):
    target_id = int(callback.data.replace("idsearch_results_", ""))
    rows = await db_get_results_for_user(target_id)
    await callback.answer()

    if not rows:
        await callback.message.answer("📊 Bu foydalanuvchida natijalar yo'q.")
        return

    await _send_user_results_list(
        callback.message, rows, f"📊 <code>{target_id}</code> natijalari ({len(rows)} ta):"
    )


# =====================================================================
# SUPER ADMIN: BOTGA YANGI ADMIN QO'SHISH / OLIB TASHLASH
# =====================================================================
@dp.message(IsPrivateChat(), IsSuperAdmin(), F.text == "➕ Admin qo'shish")
async def admin_add_admin_start(message: types.Message, state: FSMContext):
    await state.set_state(AdminManageState.waiting_for_new_admin_id)
    await message.answer(
        "🆔 Yangi admin qilmoqchi bo'lgan foydalanuvchining Telegram ID raqamini yuboring.\n\n"
        "ℹ️ ID raqamni bilish uchun o'sha odam @userinfobot kabi botga <code>/start</code> bosib olishi mumkin.\n\n"
        "Bekor qilish uchun /cancel yozing.",
        parse_mode="HTML"
    )


@dp.message(IsPrivateChat(), IsSuperAdmin(), Command("cancel"), AdminManageState.waiting_for_new_admin_id)
async def admin_add_admin_cancel(message: types.Message, state: FSMContext):
    await state.clear()
    await message.answer("❌ Bekor qilindi.", reply_markup=get_main_menu(message.from_user.id))


@dp.message(IsPrivateChat(), IsSuperAdmin(), AdminManageState.waiting_for_new_admin_id)
async def admin_add_admin_receive_id(message: types.Message, state: FSMContext):
    await state.clear()
    raw = (message.text or "").strip()

    if not raw.isdigit():
        await message.answer(
            "⚠️ ID faqat raqamlardan iborat bo'lishi kerak. Qaytadan urinib ko'rish uchun "
            "\"➕ Admin qo'shish\" tugmasini qayta bosing.",
            reply_markup=get_main_menu(message.from_user.id)
        )
        return

    new_admin_id = int(raw)

    if new_admin_id in all_admin_ids():
        await message.answer("ℹ️ Bu foydalanuvchi allaqachon admin.", reply_markup=get_main_menu(message.from_user.id))
        return

    fullname = None
    try:
        chat_info = await bot.get_chat(new_admin_id)
        fullname = getattr(chat_info, "full_name", None) or getattr(chat_info, "first_name", None)
    except Exception:
        pass

    await db_add_bot_admin(new_admin_id, fullname, message.from_user.id)
    dynamic_admin_ids.add(new_admin_id)

    name_line = f"\n👤 Ismi: {esc(fullname)}" if fullname else ""
    await message.answer(
        f"✅ <code>{new_admin_id}</code> endi botning admini!{name_line}",
        reply_markup=get_main_menu(message.from_user.id), parse_mode="HTML"
    )
    await safe_send(
        bot.send_message, new_admin_id,
        "🎉 Sizga ushbu SAT bot tizimida <b>admin</b> huquqi berildi!",
        reply_markup=get_main_menu(new_admin_id), parse_mode="HTML"
    )


@dp.message(IsPrivateChat(), IsSuperAdmin(), F.text == "🗑 Adminlar ro'yxati")
async def admin_list_admins(message: types.Message):
    dynamic_rows = await db_list_bot_admins()

    lines = ["👑 <b>Asosiy adminlar</b> (kod ichida, botdan o'chirib bo'lmaydi):"]
    for aid in ADMIN_IDS:
        lines.append(f"   • <code>{aid}</code>")

    if not dynamic_rows:
        lines.append("\n➕ <b>Qo'shilgan adminlar:</b> hozircha yo'q.")
        await message.answer("\n".join(lines), parse_mode="HTML")
        return

    lines.append("\n➕ <b>Qo'shilgan adminlar:</b>")
    buttons = []
    for uid, fullname, added_at in dynamic_rows:
        name_part = f" — {esc(fullname)}" if fullname else ""
        lines.append(f"   • <code>{uid}</code>{name_part} (qo'shilgan: {esc(format_dt(added_at))})")
        buttons.append([InlineKeyboardButton(text=f"🗑 {uid} ni olib tashlash", callback_data=f"rmadmin_{uid}")])

    markup = InlineKeyboardMarkup(inline_keyboard=buttons)
    await message.answer("\n".join(lines), reply_markup=markup, parse_mode="HTML")


@dp.callback_query(IsSuperAdmin(), F.data.startswith("rmadmin_"))
async def admin_remove_admin(callback: types.CallbackQuery):
    target_id = int(callback.data.replace("rmadmin_", ""))

    await db_remove_bot_admin(target_id)
    dynamic_admin_ids.discard(target_id)

    await callback.answer("🗑 Olib tashlandi")
    try:
        await callback.message.edit_text(
            callback.message.html_text + f"\n\n✅ <code>{target_id}</code> adminlikdan olib tashlandi.",
            parse_mode="HTML"
        )
    except Exception:
        await callback.message.answer(f"✅ <code>{target_id}</code> adminlikdan olib tashlandi.", parse_mode="HTML")

    await safe_send(bot.send_message, target_id, "ℹ️ Sizning admin huquqingiz olib tashlandi.")


# =====================================================================
# ISHGA TUSHIRISH
# =====================================================================
async def main():
    global db_conn, BOT_USERNAME, bot

    # Bot (va ichidagi DNS-fix qilingan TCPConnector) shu yerda,
    # event loop allaqachon ishga tushgandan keyin yaratiladi.
    bot = _build_bot()

    db_conn = await aiosqlite.connect(DB_PATH)
    await init_db()

    admin_rows = await db_list_bot_admins()
    dynamic_admin_ids.update(r[0] for r in admin_rows)

    await load_caches()

    # Ishga tushish paytida tarmoq/DNS ishlamay tursa ham bot yiqilib qolmasin - ulanguncha qayta urinadi
    while True:
        try:
            me = await bot.get_me()
            BOT_USERNAME = me.username
            break
        except (asyncio.CancelledError, KeyboardInterrupt):
            raise
        except Exception as e:
            print(f"⚠️ Telegramga ulanib bo'lmadi (get_me), 5 soniyadan keyin qayta urinaman: {e}")
            await asyncio.sleep(5)
    print(f"🚀 Bot ishga tushdi: @{BOT_USERNAME} | versiya: {BOT_VERSION}")

    cleanup_task = asyncio.create_task(cleanup_old_results())
    prune_task = asyncio.create_task(prune_stale_caches())

    try:
        # drop_pending_updates=False: bot qayta ishga tushayotgan paytda
        # o'quvchilar yuborgan javoblar yo'qolib ketmaydi.
        try:
            await bot.delete_webhook(drop_pending_updates=False)
        except Exception as e:
            print(f"delete_webhook xatoligi (davom etamiz): {e}")

        # Tarmoq uzilib qolsa ham jarayon butunlay o'lib qolmasin -
        # xato chiqsa bir necha soniyadan keyin avtomatik qayta urinadi.
        while True:
            try:
                await dp.start_polling(bot, polling_timeout=30, handle_signals=False)
            except (asyncio.CancelledError, KeyboardInterrupt):
                raise
            except Exception as e:
                print(f"⚠️ Polling xatoligi, 3 soniyadan keyin qayta urinaman: {e}")
                await asyncio.sleep(3)
                continue
            else:
                break
    finally:
        cleanup_task.cancel()
        prune_task.cancel()
        try:
            await bot.session.close()
        except Exception:
            pass
        await db_conn.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Bot to'xtatildi.")