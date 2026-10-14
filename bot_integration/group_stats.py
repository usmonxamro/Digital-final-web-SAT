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
