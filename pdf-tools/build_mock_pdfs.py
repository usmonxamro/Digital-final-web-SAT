#!/usr/bin/env python3
"""Mocklarning PDF'ini BIR MARTA tayyorlab saqlaydi — o'quvchi tugmani bossa tayyor fayl bir zumda yuklanadi.

Ikki usul (--engine):
  latex  (asosiy) — savollar haqiqiy LaTeX hujjatiga aylantirilib xelatex bilan yig'iladi: kitob kabi sifat,
                    matn va formulalar TeX shriftlarida, fayl kichik (44 savol ~ 100-200 KB).
  chrome (zaxira) — saytdagi sahifalar Chrome'ning "Print -> Save as PDF" bilan PDF qilinadi (~1 MB).
  auto   (standart) — avval latex; biror mock LaTeX'da yig'ilmasa, o'sha mock uchun chrome.

Bir martalik tayyorgarlik:
    pip install svglib reportlab pillow          (chizmalar uchun)
    xelatex bo'lishi kerak (MiKTeX yoki TeX Live; kitobni yig'ayotgan bo'lsangiz, bor)
    pip install playwright  &&  playwright install chromium     (faqat zaxira "chrome" usuli uchun, ixtiyoriy)

Ishlatish (supabase_config.txt va latex_pdf.py shu papkada bo'lsin):
    python build_mock_pdfs.py                    # PDF yuklab olish YOQILGAN va hali PDF'i yo'q mocklarni tayyorlaydi
    python build_mock_pdfs.py --label "Mock 5"   # bitta mockni (qayta) tayyorlaydi
    python build_mock_pdfs.py --all              # yoqilgan hamma mockni qaytadan tayyorlaydi

supabase_config.txt (4 qator, hech kimga bermang):
    SUPABASE_URL=https://....supabase.co
    SUPABASE_SERVICE_KEY=sb_secret_...
    SITE_URL=https://satbyusmon.com
    PDF_JOB_KEY=<saytdagi (Vercel) PDF_JOB_KEY bilan bir xil uzun maxfiy so'z>
"""
import argparse, hashlib, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def load_cfg():
    cfg = {k: os.environ.get(k) for k in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY", "SITE_URL", "PDF_JOB_KEY")}
    for d in (os.path.dirname(os.path.abspath(__file__)), os.getcwd()):
        path = os.path.join(d, "supabase_config.txt")
        if os.path.exists(path):
            for line in open(path, encoding="utf-8-sig"):
                if "=" in line and not line.lstrip().startswith("#"):
                    k, v = line.split("=", 1)
                    k, v = k.strip(), v.strip().strip('"').strip("'")
                    if k in cfg and not cfg[k]:
                        cfg[k] = v
            break
    missing = [k for k, v in cfg.items() if not v]
    if missing:
        sys.exit("supabase_config.txt da yetishmayapti: " + ", ".join(missing))
    cfg["SITE_URL"] = cfg["SITE_URL"].rstrip("/")
    cfg["SUPABASE_URL"] = cfg["SUPABASE_URL"].rstrip("/")
    return cfg


def http(method, url, key, body=None, headers=None, raw=False):
    h = {"apikey": key}
    if key.startswith("eyJ"):                       # eski service_role (JWT); sb_secret_ kaliti faqat apikey'da
        h["Authorization"] = f"Bearer {key}"
    h.update(headers or {})
    data = body if raw else (json.dumps(body).encode() if body is not None else None)
    if body is not None and not raw:
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            out = r.read()
            return json.loads(out) if out and r.headers.get("Content-Type", "").startswith("application/json") else out
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {url.split('?')[0]} -> {e.code} {e.read()[:300]!r}")


def list_labels(cfg, only_label, rebuild_all):
    q = "test_configs?select=test_label,pdf_path&pdf_download=eq.true&order=test_label"
    if only_label:
        q = "test_configs?select=test_label,pdf_path&test_label=eq." + urllib.parse.quote(only_label, safe="")
    rows = http("GET", f"{cfg['SUPABASE_URL']}/rest/v1/{q}", cfg["SUPABASE_SERVICE_KEY"])
    if only_label or rebuild_all:
        return [r["test_label"] for r in rows]
    return [r["test_label"] for r in rows if not r.get("pdf_path")]


def render_pdf(context, site, label, job_key, timeout_s=300):
    """Sahifani ochadi, tayyor bo'lishini kutadi va Print -> PDF qiladi. bytes qaytaradi."""
    page = context.new_page()
    try:
        url = f"{site}/pdf-job?label={urllib.parse.quote(label, safe='')}&key={urllib.parse.quote(job_key, safe='')}"
        page.goto(url, wait_until="domcontentloaded", timeout=120_000)
        page.wait_for_function("window.__pdfReady === true || !!window.__pdfError", timeout=timeout_s * 1000)
        err = page.evaluate("window.__pdfError || null")
        if err:
            raise RuntimeError(f"sahifa xatosi: {err}")
        page.emulate_media(media="print")
        return page.pdf(prefer_css_page_size=True, print_background=True)
    finally:
        page.close()


def render_latex(cfg, label):
    """Savollarni saytdan olib, LaTeX bilan PDF yig'adi. Biror savol yig'ilmasa — xato (zaxira usulga o'tiladi)."""
    import latex_pdf
    url = f"{cfg['SITE_URL']}/api/pdf-job?label={urllib.parse.quote(label, safe='')}&key={urllib.parse.quote(cfg['PDF_JOB_KEY'], safe='')}"
    req = urllib.request.Request(url, headers={"User-Agent": "SAT PDF job"})
    with urllib.request.urlopen(req, timeout=120) as r:
        items = json.loads(r.read()).get("items") or []
    if not items:
        raise RuntimeError("mockda savol topilmadi")
    pdf, failed = latex_pdf.compile_pdf(label, items, cfg["SITE_URL"])
    if failed:
        lines = []
        for k, why in sorted(failed.items()):
            it = items[k]
            lines.append(f"{(it.get('moduleLabel') or '')} {it['index'] + 1}-savol: {why}")
        raise RuntimeError("LaTeX'da yig'ilmagan savollar: " + " | ".join(lines))
    return pdf


def storage_path(label):
    slug = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")[:40] or "mock"
    return f"{slug}-{hashlib.sha1(label.encode('utf-8')).hexdigest()[:8]}.pdf"


def upload(cfg, label, pdf):
    path = storage_path(label)
    key = cfg["SUPABASE_SERVICE_KEY"]
    http("POST", f"{cfg['SUPABASE_URL']}/storage/v1/object/mock-pdfs/{path}", key, body=pdf, raw=True,
         headers={"Content-Type": "application/pdf", "x-upsert": "true"})
    http("PATCH", f"{cfg['SUPABASE_URL']}/rest/v1/test_configs?test_label=eq." + urllib.parse.quote(label, safe=""), key,
         body={"pdf_path": path, "pdf_built_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
         headers={"Prefer": "return=minimal"})
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--label")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--engine", choices=["auto", "latex", "chrome"], default="auto")
    a = ap.parse_args()
    cfg = load_cfg()
    labels = list_labels(cfg, a.label, a.all)
    if not labels:
        print("Tayyorlanadigan mock yo'q (hammasining PDF'i tayyor yoki 'PDF yuklab olish' hech qaysisida yoqilmagan).")
        return
    print(f"{len(labels)} ta mock tayyorlanadi (usul: {a.engine}).")
    ok = bad = 0
    pw = {"p": None, "browser": None, "context": None}

    def chrome_pdf(label):
        if pw["context"] is None:
            from playwright.sync_api import sync_playwright
            pw["p"] = sync_playwright().start()
            pw["browser"] = pw["p"].chromium.launch()
            pw["context"] = pw["browser"].new_context(viewport={"width": 1100, "height": 1500})
        return render_pdf(pw["context"], cfg["SITE_URL"], label, cfg["PDF_JOB_KEY"])

    try:
        for i, label in enumerate(labels, 1):
            t = time.time()
            used = a.engine
            try:
                if a.engine == "chrome":
                    pdf = chrome_pdf(label)
                else:
                    try:
                        pdf = render_latex(cfg, label)
                        used = "latex"
                    except Exception as e:
                        if a.engine == "latex":
                            raise
                        print(f"      LaTeX ishlamadi ({e}); Chrome usuliga o'tilmoqda...")
                        pdf = chrome_pdf(label)
                        used = "chrome"
                upload(cfg, label, pdf)
                ok += 1
                print(f"[{i}/{len(labels)}] OK  {label}  [{used}, {len(pdf)//1024} KB, {time.time()-t:.0f} soniya]")
            except Exception as e:
                bad += 1
                print(f"[{i}/{len(labels)}] XATO {label}: {e}")
    finally:
        if pw["browser"]:
            pw["browser"].close()
            pw["p"].stop()
    print(f"Tugadi: {ok} ta tayyor, {bad} ta xato.")


if __name__ == "__main__":
    main()
