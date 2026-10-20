# -*- coding: utf-8 -*-
"""Mock savollarini (sayt JSON'i) haqiqiy LaTeX hujjatiga aylantirib, xelatex bilan PDF qiladi.

Natija kitob (Kitob.tex) kabi sifatli: matn va formulalar haqiqiy TeX shriftlarida, vektor, kichik hajmli.
Talab qilinadi: xelatex (MiKTeX yoki TeX Live). Chizmalar (SVG) uchun: pip install svglib reportlab pillow
"""
import datetime as dt
import hashlib
import os
import re
import shutil
import subprocess
import tempfile
import urllib.request

SITE_LINKS = [("satbyusmon.com", "https://satbyusmon.com"),
              ("@satbyusmon", "https://t.me/satbyusmon"),
              ("@sat\\_surxon", "https://t.me/sat_surxon")]

# ----------------------------------------------------------------------------- matn -> LaTeX
SPECIAL = {"\\": r"\textbackslash{}", "{": r"\{", "}": r"\}", "$": r"\$", "&": r"\&", "#": r"\#",
           "^": r"\^{}", "_": r"\_", "%": r"\%", "~": r"\textasciitilde{}"}
UNI_TEXT = {"ʻ": "’", "ʼ": "’", "‘": "’", "`": "’", "−": "$-$", "≤": r"$\le$", "≥": r"$\ge$", "≠": r"$\ne$",
            "×": r"$\times$", "÷": r"$\div$", "±": r"$\pm$", "π": r"$\pi$", "θ": r"$\theta$", "°": r"\textdegree{}",
            "²": r"$^2$", "³": r"$^3$", "∞": r"$\infty$", "Δ": r"$\Delta$", "∠": r"$\angle$", "→": r"$\to$",
            "μ": r"$\mu$", "√": r"$\surd$", " ": "~", " ": r"\,", " ": r"\,", "​": "",
            "﻿": "", "−": "$-$"}
UNI_MATH = {"−": "-", "≤": r"\le ", "≥": r"\ge ", "≠": r"\ne ", "×": r"\times ", "÷": r"\div ", "±": r"\pm ",
            "π": r"\pi ", "θ": r"\theta ", "°": r"^\circ ", "²": "^2", "³": "^3", "√": r"\surd ", "∞": r"\infty ",
            "Δ": r"\Delta ", "∠": r"\angle ", "→": r"\to ", "·": r"\cdot ", "…": r"\ldots ", "ʻ": "'", "’": "'",
            "‘": "'", "μ": r"\mu ", "σ": r"\sigma ", "α": r"\alpha ", "β": r"\beta ", " ": " ",
            " ": r"\, ", " ": r"\, ", "​": "", "﻿": ""}
FIGURE_MARKER = re.compile(r"\s*\[\s*CHIZMA\s*BOR\s*\]", re.I)


def fix_math(tex):
    tex = "".join(UNI_MATH.get(c, c) for c in tex.strip())
    tex = re.sub(r"\\degree(?![a-zA-Z])", r"^\\circ ", tex)
    return tex


def esc_text(s):
    return "".join(UNI_TEXT.get(c) or SPECIAL.get(c, c) for c in s)


def tex_inline(text):
    """Aralash matn: `$...$` formulalar + oddiy matn (+ eski usul: \\buyruq bor so'z formula deb olinadi)."""
    text = FIGURE_MARKER.sub("", text).strip()
    out = []
    for part in re.split(r"(\$[^$\n]+\$)", text):
        if len(part) > 1 and part.startswith("$") and part.endswith("$"):
            out.append(r"\(" + fix_math(part[1:-1]) + r"\)")
            continue
        for tok in re.split(r"(\s+)", part):
            if re.search(r"\\[a-zA-Z]", tok):
                out.append(r"\(" + fix_math(tok) + r"\)")
            else:
                out.append(esc_text(tok))
    return "".join(out)


def tex_paragraphs(text):
    """Har bir bo'sh bo'lmagan qator — alohida paragraf (saytdagi kabi)."""
    return "\n\n".join(tex_inline(l) for l in text.split("\n") if l.strip())


# ----------------------------------------------------------------------------- jadvallar (saytdagi parseRichText)
def is_table_row(line):
    return "|" in line and len(line.split("|")) >= 2 and len(line.strip()) > 1


def parse_rich_text(text):
    out, textbuf, rowbuf = [], [], []

    def flush_text():
        nonlocal textbuf
        if textbuf:
            out.append(("text", "\n".join(textbuf)))
        textbuf = []

    def flush_rows():
        nonlocal rowbuf
        if len(rowbuf) >= 2:
            flush_text()
            out.append(("table", rowbuf))
        elif len(rowbuf) == 1:
            textbuf.append(" | ".join(rowbuf[0]))
        rowbuf = []

    for line in text.split("\n"):
        if is_table_row(line):
            rowbuf.append([c.strip() for c in line.split("|")])
        else:
            flush_rows()
            textbuf.append(line)
    flush_rows()
    flush_text()
    return out


def tex_table(rows):
    ncol = max(len(r) for r in rows)
    lines = [r"\par\medskip\noindent\begin{center}\renewcommand{\arraystretch}{1.35}",
             r"\begin{tabular}{|" + "|".join(["c"] * ncol) + "|}\\hline"]
    for i, r in enumerate(rows):
        cells = [tex_inline(c) for c in r] + [""] * (ncol - len(r))
        if i == 0:
            cells = [r"\textbf{" + c + "}" if c else c for c in cells]
            lines.append(r"\rowcolor{gray!14} " + " & ".join(cells) + r" \\ \hline")
        else:
            lines.append(" & ".join(cells) + r" \\ \hline")
    lines.append(r"\end{tabular}\end{center}\par")
    return "\n".join(lines)


def prompt_blocks(prompt, has_layout):
    """Saytdagi promptBlocks: [(id, kind, content)]."""
    contents = []
    if has_layout:
        for chunk in re.split(r"\n[ \t]*\n", prompt):
            c = chunk.strip("\n")
            if c.strip():
                contents.append(c)
    else:
        for kind, val in parse_rich_text(prompt):
            if kind == "table":
                contents.append("\n".join(" | ".join(r) for r in val))
            else:
                contents.extend(l for l in val.split("\n") if l.strip())
    blocks = []
    for i, c in enumerate(contents):
        lines = [l for l in c.split("\n") if l.strip()]
        kind = "table" if len(lines) >= 2 and all(is_table_row(l) for l in lines) else "text"
        blocks.append((f"p{i}", kind, c))
    return blocks


# ----------------------------------------------------------------------------- rasmlar
class ImageError(Exception):
    pass


def _fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (SAT PDF job)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


SIZE_CACHE = {}


def get_image(src, site, cache):
    """Rasmni yuklab PDF/PNG/JPG qilib beradi: (fayl nomi, kenglik_pt, balandlik_pt)."""
    if src.startswith("http"):
        url = src
    else:
        url = site.rstrip("/") + "/" + src.lstrip("/")
    key = hashlib.sha1(url.encode()).hexdigest()[:16]
    ck = (cache, key)
    if ck in SIZE_CACHE:
        return SIZE_CACHE[ck]
    res = _get_image(url, key, cache)
    SIZE_CACHE[ck] = res
    return res


def _get_image(url, key, cache):
    try:
        data = _fetch(url)
    except Exception as e:
        raise ImageError(f"rasm yuklanmadi ({e})")
    head = data[:300].lstrip()
    if head.startswith(b"<") and b"<svg" in data[:2000].lower() + data[2000:6000].lower():
        try:
            from svglib.svglib import svg2rlg
            from reportlab.graphics import renderPDF
        except ImportError:
            raise ImageError("SVG uchun kerak: pip install svglib reportlab pillow")
        tmp = os.path.join(cache, key + ".svg")
        open(tmp, "wb").write(data)
        d = svg2rlg(tmp)
        if d is None:
            raise ImageError("SVG o'qilmadi")
        fn = os.path.join(cache, key + ".pdf")
        renderPDF.drawToFile(d, fn)
        return _size(fn, "pdf", (d.width, d.height))
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        ext = "png"
    elif data[:3] == b"\xff\xd8\xff":
        ext = "jpg"
    else:
        try:
            from PIL import Image
            import io
            im = Image.open(io.BytesIO(data)).convert("RGB")
            fn = os.path.join(cache, key + ".png")
            im.save(fn)
            return _size(fn, "png")
        except Exception:
            raise ImageError("rasm formati tanilmadi")
    fn = os.path.join(cache, f"{key}.{ext}")
    open(fn, "wb").write(data)
    return _size(fn, ext)


def _size(fn, ext, wh=None):
    if wh:
        return os.path.basename(fn), wh[0], wh[1]
    try:
        if ext == "pdf":
            import pypdf  # ixtiyoriy
            box = pypdf.PdfReader(fn).pages[0].mediabox
            return os.path.basename(fn), float(box.width), float(box.height)
        from PIL import Image
        w, h = Image.open(fn).size
        return os.path.basename(fn), w, h
    except Exception:
        return os.path.basename(fn), 300.0, 200.0


TEXTW = 487.0   # matn kengligi (pt): A4 210 mm - 2 x 19 mm


def tex_image(src, site, cache, scale=1.0, max_frac=0.9, max_h_cm=9.0):
    fn, w, h = get_image(src, site, cache)
    wpt = min(w * 0.75 * 1.2 * (scale or 1.0), max_frac * TEXTW)   # CSS px -> pt, biroz kattaroq (o'qish qulay bo'lsin)
    return (r"\par\medskip\begin{center}\includegraphics[keepaspectratio,width=%.1fpt,height=%.1fcm]{%s}\end{center}\par"
            % (wpt, max_h_cm, fn.replace("\\", "/")))


# ----------------------------------------------------------------------------- savol -> LaTeX
def uline(text):
    """Chiziq tagiga olish: so'zma-so'z (qator oxirida uzilishi mumkin), qo'shimcha paket kerak emas."""
    out = []
    for tok in re.split(r"(\$[^$\n]+\$|\s+)", text):
        if not tok:
            continue
        if tok.isspace():
            out.append(r"\underline{\ }\hskip0pt\relax ")
        else:
            out.append(r"\underline{" + tex_inline(tok) + r"}\hskip0pt\relax ")
    return "".join(out)


def underlined(passage, underline):
    if underline and underline in passage:
        i = passage.index(underline)
        return tex_paragraphs(passage[:i]) + " " + uline(underline) + " " + tex_paragraphs(passage[i + len(underline):])
    return tex_paragraphs(passage)


def choice_tex(c, site, cache):
    parts = []
    if c.get("text"):
        parts.append(tex_inline(c["text"]))
    if c.get("tex"):
        parts.append(r"\(" + fix_math(c["tex"]) + r"\)")
    if c.get("image"):
        fn, w, h = get_image(c["image"], site, cache)
        parts.append(r"\par\smallskip\includegraphics[keepaspectratio,height=3.2cm,width=0.8\linewidth]{%s}" % fn.replace("\\", "/"))
    return r"\choice{%s}{%s}" % (c.get("id", "?"), "\n".join(parts) if parts else "")


def question_tex(item, site, cache):
    q = item["question"]
    reading = item.get("sectionKind") == "reading" or (not item.get("sectionKind") and bool(q.get("passage")))
    num = item["index"] + 1
    diff = (q.get("difficulty") or "").upper()
    out = [r"\qhead{%d}{%s}" % (num, diff)]
    scale = (q.get("layout") or {}).get("img", {}).get("scale") if isinstance(q.get("layout"), dict) else None

    if reading and q.get("passage"):
        out.append(r"\begin{leftbar}\fontfamily{cmr}\selectfont " + underlined(q["passage"], q.get("underline")) + r"\end{leftbar}")
    if reading and q.get("image"):
        out.append(tex_image(q["image"], site, cache, scale))

    # stimul: (matematikada) rasm + formulalar + savol matni — saytdagi saqlangan tartib bo'yicha
    blocks = {}
    order = []
    if not reading and q.get("image"):
        blocks["img"] = ("image", q["image"]); order.append("img")
    if not reading:
        for i, e in enumerate(q.get("equations") or []):
            blocks[f"eq{i}"] = ("equation", e); order.append(f"eq{i}")
    for bid, kind, content in prompt_blocks(q.get("prompt", ""), bool(q.get("layout"))):
        blocks[bid] = (kind, content); order.append(bid)
    rows = []
    seen = set()
    lay = q.get("layout") if isinstance(q.get("layout"), dict) else {}
    for row in (lay.get("rows") or []):
        clean = [i for i in (row if isinstance(row, list) else []) if i in blocks and i not in seen][:3]
        seen.update(clean)
        if clean:
            rows.append(clean)
    rows += [[i] for i in order if i not in seen]

    def block_tex(bid, frac):
        kind, content = blocks[bid]
        if kind == "image":
            return tex_image(content, site, cache, scale, max_frac=frac)
        if kind == "equation":
            return r"\[" + fix_math(content) + r"\]"
        if kind == "table":
            return tex_table([[c.strip() for c in l.split("|")] for l in content.split("\n") if l.strip()])
        return tex_paragraphs(content)

    for row in rows:
        if len(row) == 1:
            out.append(block_tex(row[0], 0.9))
        else:
            w = 0.96 / len(row)
            cells = [r"\begin{minipage}[t]{%.3f\linewidth}%s\end{minipage}" % (w, block_tex(b, 0.95)) for b in row]
            out.append(r"\par\noindent" + r"\hfill".join(cells) + r"\par")

    if q.get("type") == "gridin":
        out.append(r"\par\bigskip\noindent\fbox{\rule{0pt}{1.3cm}\hspace{5.5cm}}\par")
    else:
        out.append(r"\par\medskip")
        out.extend(choice_tex(c, site, cache) for c in (q.get("choices") or []))
    return "\n".join(out)


def est_height_cm(item):
    q = item["question"]
    h = 2.2 + len(q.get("prompt", "")) / 85 * 0.62 + len(q.get("equations") or []) * 1.3
    if q.get("passage"):
        h += len(q["passage"]) / 90 * 0.55 + 1.5
    if q.get("image"):
        h += 6.5
    h += sum(1.0 + (len((c.get("text") or "") + (c.get("tex") or "")) // 60) * 0.5 + (3.4 if c.get("image") else 0)
             for c in (q.get("choices") or []))
    if q.get("type") == "gridin":
        h += 2.5
    h += sum(0.8 for l in (q.get("prompt", "")).split("\n") if is_table_row(l))
    return h


# ----------------------------------------------------------------------------- hujjat
PREAMBLE = r"""\documentclass[11pt,a4paper]{article}
\usepackage[a4paper,top=24mm,bottom=22mm,left=19mm,right=19mm,headheight=14pt]{geometry}
\usepackage{fontspec}
\usepackage{amsmath,amssymb,amsfonts,cancel,textcomp}
\usepackage[table]{xcolor}
\usepackage{graphicx,fancyhdr,lastpage,framed,array,tikz}
\IfFileExists{qrcode.sty}{\usepackage{qrcode}\def\hasqr{1}}{}
\usepackage[hidelinks,unicode]{hyperref}
\providecommand{\degree}{{}^\circ}
\graphicspath{{img/}}
\definecolor{brand}{HTML}{0E7C75}
\definecolor{brandlight}{HTML}{E6F2F1}
\setlength{\parindent}{0pt}\setlength{\parskip}{5pt}\setlength{\fboxsep}{5pt}\setlength{\fboxrule}{0.5pt}
\renewcommand{\arraystretch}{1.2}
\renewcommand{\FrameCommand}{{\color{brand}\vrule width 2.2pt}\hspace{9pt}}
\newcommand{\qhead}[2]{\par\noindent\tikz[baseline=(n.base)]\node[fill=black,text=white,minimum width=7.5mm,minimum height=8mm,inner sep=0,font=\bfseries\sffamily](n){#1};%
  \hfill{\sffamily\scriptsize\bfseries\color{gray}#2}\par\vspace{-2.2mm}\noindent{\color{black!70}\rule{\linewidth}{0.6pt}}\par\vspace{2.5mm}}
\newcommand{\choice}[2]{\par\noindent\fbox{\parbox{\dimexpr\linewidth-2\fboxsep-2\fboxrule\relax}{\tikz[baseline=(c.base)]\node[circle,draw,inner sep=1.5pt,minimum size=4.6mm,font=\sffamily\scriptsize\bfseries](c){#1};\hspace{3.2mm}#2}}\par\vspace{1.6mm}}
\newcommand{\modbanner}[1]{\par\vspace*{2cm}\noindent\colorbox{brandlight}{\parbox{\dimexpr\linewidth-2\fboxsep\relax}{\centering\sffamily\Large\bfseries\color{brand}\vspace{4mm}#1\vspace{4mm}}}\par\vspace{1cm}}
\pagestyle{fancy}\fancyhf{}
\renewcommand{\headrulewidth}{0.5pt}\renewcommand{\footrulewidth}{0pt}
\fancyhead[L]{\sffamily\small\bfseries SAT AKADEMIYASI}
\fancyhead[R]{\sffamily\small @@TITLE@@}
\fancyfoot[L]{\sffamily\scriptsize @@LINKS@@}
\fancyfoot[R]{\sffamily\scriptsize \thepage\,/\,\pageref{LastPage}}
\begin{document}
"""


def build_tex(label, items, site, cache, failed):
    links = r" \;\textbullet\; ".join(r"\href{%s}{%s}" % (u, t) for t, u in SITE_LINKS)
    pre = PREAMBLE.replace("@@TITLE@@", esc_text(label)).replace("@@LINKS@@", links)
    date = dt.datetime.now(dt.timezone(dt.timedelta(hours=5))).strftime("%d.%m.%Y")
    cover = [r"\thispagestyle{empty}", r"\vspace*{3.2cm}\begin{center}",
             r"{\sffamily\fontsize{34}{40}\selectfont\bfseries\color{brand} SAT AKADEMIYASI}\\[10mm]",
             r"{\sffamily\LARGE\bfseries %s}\\[6mm]" % esc_text(label),
             r"{\sffamily\large %d ta savol \;\textbullet\; %s}\\[16mm]" % (len(items), date),
             r"\ifx\hasqr\undefined\else\qrcode[height=3.2cm]{https://satbyusmon.com}\\[4mm]\fi",
             r"{\sffamily\large\href{https://satbyusmon.com}{satbyusmon.com}}\\[3mm]",
             r"{\sffamily \href{https://t.me/satbyusmon}{@satbyusmon} \;\textbullet\; \href{https://t.me/sat_surxon}{@sat\_surxon}}",
             r"\end{center}\newpage"]
    body, last_mod, i, n = [], None, 0, len(items)
    while i < n:
        it = items[i]
        mod = it.get("moduleLabel")
        starts_module = mod != last_mod
        if mod and starts_module:
            body.append(r"\clearpage\modbanner{%s}" % esc_text(mod))
        elif i > 0:
            body.append(r"\clearpage")
        last_mod = mod

        def block(k):
            if k in failed:
                return "%%@@Q%d\n\\qhead{%d}{}\n\\textit{Bu savol PDF'ga o'tkazilmadi.}\\par" % (k, items[k]["index"] + 1)
            return "%%@@Q%d\n%s" % (k, question_tex(items[k], site, cache))

        group = [i]
        # ikki qisqa savol bir sahifaga sig'sa — birga (reklama PDF uchun hajmni tejaydi)
        if i + 1 < n and items[i + 1].get("moduleLabel") == mod and not starts_module:
            a, b = items[i], items[i + 1]
            qa, qb = a["question"], b["question"]
            if (not qa.get("passage") and not qb.get("passage") and not qa.get("image") and not qb.get("image")
                    and est_height_cm(a) + est_height_cm(b) <= 21.5):
                group = [i, i + 1]
        parts = [block(k) for k in group]
        body.append(("\n\\par\\vspace{3mm}\\noindent{\\color{black!35}\\dotfill}\\par\\vspace{4mm}\n").join(parts))
        i += len(group)
    return pre + "\n".join(cover) + "\n" + "\n".join(body) + "\n\\end{document}\n"


ERR_RE = re.compile(r"^! (.*)$")
LINE_RE = re.compile(r"^l\.(\d+)")


def compile_pdf(label, items, site, workdir=None):
    """(pdf_bytes, failed{idx: sabab}) qaytaradi. Formulasi xato bergan savol bo'lsa, uni sinab chiqib ajratib, qolganini yig'adi."""
    if not shutil.which("xelatex"):
        raise RuntimeError("xelatex topilmadi. MiKTeX yoki TeX Live o'rnating (kitobni yig'ayotgan bo'lsangiz, bor).")
    own = workdir is None
    work = workdir or tempfile.mkdtemp(prefix="satpdf_")
    cache = os.path.join(work, "img")
    os.makedirs(cache, exist_ok=True)
    failed = {}
    try:
        for attempt in range(5):
            # rasmlar yuklanmagan savollarni oldindan aniqlaymiz
            tex_lines = None
            while True:
                try:
                    tex = build_tex(label, items, site, cache, set(failed))
                    break
                except ImageError as e:
                    # qaysi savolda ekanini topish uchun savollarni alohida sinaymiz
                    bad = None
                    for k, it in enumerate(items):
                        if k in failed:
                            continue
                        try:
                            question_tex(it, site, cache)
                        except ImageError as e2:
                            bad, why = k, str(e2)
                            break
                    if bad is None:
                        raise
                    failed[bad] = why
            path = os.path.join(work, "mock.tex")
            open(path, "w", encoding="utf-8").write(tex)
            tex_lines = tex.split("\n")
            r = subprocess.run(["xelatex", "-interaction=nonstopmode", "mock.tex"],
                               cwd=work, capture_output=True, timeout=600)
            log = r.stdout.decode("utf-8", "replace")
            errs = []
            lines = log.split("\n")
            for j, l in enumerate(lines):
                if ERR_RE.match(l):
                    ln = None
                    for l2 in lines[j + 1:j + 8]:
                        m = LINE_RE.match(l2)
                        if m:
                            ln = int(m.group(1))
                            break
                    errs.append((l[2:], ln))
            if not errs and os.path.exists(os.path.join(work, "mock.pdf")):
                subprocess.run(["xelatex", "-interaction=nonstopmode", "mock.tex"], cwd=work, capture_output=True, timeout=600)
                return open(os.path.join(work, "mock.pdf"), "rb").read(), failed
            newly = False
            for msg, ln in errs:
                k = None
                if ln:
                    for idx in range(min(ln, len(tex_lines)) - 1, -1, -1):
                        m = re.match(r"%@@Q(\d+)", tex_lines[idx])
                        if m:
                            k = int(m.group(1))
                            break
                if k is not None and k not in failed:
                    failed[k] = msg
                    newly = True
            if not newly:
                raise RuntimeError("LaTeX xatosi: " + "; ".join(m for m, _ in errs[:3]))
        raise RuntimeError("LaTeX: xatolarni bartaraf qilib bo'lmadi")
    finally:
        if own:
            shutil.rmtree(work, ignore_errors=True)
