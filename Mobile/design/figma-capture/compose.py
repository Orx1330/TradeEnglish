"""Joins the captured screens into one self-contained HTML document for Figma.

Each capture (NN-name.html, written by cap.js) holds one screen as plain divs with inlined
computed styles. This script:
  - swaps icon-font placeholders (<svg data-cp="f0xxx">) for real vector paths,
  - maps the app's fonts to families Figma can load (Thmanyah is not available there),
  - replaces wording that only exists in the browser preview,
  - wraps every screen in a 393x852 frame laid out on a grid.

Usage:  python compose.py [--preview]     (run from this folder; writes screens.html)
--preview adds a Google Fonts link so the result can be eyeballed in a browser.
"""
import glob, html, os, re, sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(os.path.dirname(HERE))
ICON_FONT = os.path.join(APP, "node_modules", "@expo", "vector-icons", "build", "vendor",
                         "react-native-vector-icons", "Fonts", "MaterialCommunityIcons.ttf")
PREVIEW = "--preview" in sys.argv

# Arabic text face in Figma. Thmanyah runs 11-26% wider than Markazi Text at the same size (measured on
# sample UI strings), so 1.12 brings the two close without ever making a line longer than in the app.
AR_FAMILY = "Markazi Text"
AR_SCALE = 1.12
AR_WEIGHT = {"Light": 400, "Regular": 400, "Medium": 500, "Bold": 600, "Black": 700}
TEXT_PROPS = {"font-family", "font-size", "font-weight", "line-height", "letter-spacing", "text-align",
              "white-space", "text-overflow", "unicode-bidi", "overflow-wrap", "direction"}

TITLES = {
    "00-greeting": "00 · ليث يرحّب عند الفتح", "01-welcome": "01 · الترحيب الأول", "02-path": "02 · مسار المراحل", "03-lesson-sheet": "03 · بطاقة الدرس",
    "04-learn": "04 · جملة جديدة + تسجيل الصوت", "06-correct": "06 · إجابة صحيحة",
    "07-listen": "07 · ماذا سمعت؟", "08-wrong": "08 · إجابة خاطئة", "09-arrange": "09 · رتّب الكلمات",
    "10-match": "10 · المطابقة", "11-typing": "11 · اكتب بالإنجليزية", "12-complete": "12 · إنهاء المرحلة · ليث واللبؤة",
    "13-scenario": "13 · مختبر الصفقات", "14-scenario-solved": "14 · مختبر الصفقات · الشرح",
    "15-review": "15 · المراجعة الذكية", "16-phrasebook": "16 · قاموس الجمل", "17-phrase-sheet": "17 · تفاصيل الجملة",
    "18-profile": "18 · الملف الشخصي", "19-profile-badges": "19 · الأوسمة والصوت", "20-profile-settings": "20 · الإعدادات",
}
WORDING = {
    "معاينة المتصفح: التسجيلات مؤقتة حتى إغلاق الصفحة.": "تسجيلاتك: 4 تسجيلات · 312 ك.ب",
    "معاينة المتصفح: يبقى التسجيل حتى إغلاق الصفحة": "محفوظ على جهازك · اضغط الميكروفون لتسجيل محاولة جديدة",
}


def icon_paths():
    font = TTFont(ICON_FONT)
    glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
    ascent, descent = font["hhea"].ascent, font["hhea"].descent
    height = ascent - descent

    def path(cp):
        name = cmap[int(cp, 16)]
        pen = SVGPathPen(glyphs)
        # font outlines are y-up from the baseline; flip into a y-down box of the full line height
        glyphs[name].draw(TransformPen(pen, (1, 0, 0, -1, 0, ascent)))
        return glyphs[name].width, height, pen.getCommands()

    return path


def fix_style(style):
    props = []
    for part in html.unescape(style).split(";"):
        if ":" in part:
            k, v = part.split(":", 1)
            props.append([k.strip(), v.strip()])
    family = next((v for k, v in props if k == "font-family"), "")
    if "Thmanyah-" in family:
        weight = AR_WEIGHT[re.search(r"Thmanyah-(\w+)", family).group(1)]
        for p in props:
            if p[0] == "font-family":
                p[1] = AR_FAMILY
            elif p[0] == "font-weight":
                p[1] = str(weight)
            elif p[0] == "font-size":
                p[1] = "%.1fpx" % (float(p[1].replace("px", "")) * AR_SCALE)
    elif family.startswith("Inter"):
        for p in props:
            if p[0] == "font-family":
                p[1] = "Inter"
            elif p[0] == "font-size":
                # a hair smaller, so a label that exactly filled its box never wraps on a rounding difference
                p[1] = "%.2fpx" % (float(p[1].replace("px", "")) * 0.985)
    elif family:
        # a layout box, not text: the inherited browser-default font is noise
        props = [p for p in props if p[0] not in TEXT_PROPS]
    if "Thmanyah-" in family or family.startswith("Inter"):
        # text keeps flowing inside its parent; a width measured with another font would force wraps
        props = [p for p in props if p[0] != "width"]
    for p in props:
        if p[0] in ("overflow-x", "overflow-y") and p[1] in ("auto", "scroll"):
            p[1] = "hidden"
    # A pure move (no scale or rotation) becomes plain left/top offsets: importers place layers by
    # their box, and one moved a long way by a transform alone can be dropped off the frame.
    d = dict(props)
    move = re.fullmatch(r"matrix\(1, 0, 0, 1, (-?[\d.]+), (-?[\d.]+)\)", d.get("transform", ""))
    if move and d.get("position") in ("absolute", "relative"):
        px = lambda v: float(v[:-2]) if v.endswith("px") else 0.0
        left, top = px(d.get("left", "0px")) + float(move.group(1)), px(d.get("top", "0px")) + float(move.group(2))
        props = [p for p in props if p[0] not in ("transform", "transform-origin", "left", "top", "right", "bottom")]
        props += [["left", "%.2fpx" % left], ["top", "%.2fpx" % top]]
    return html.escape(";".join("%s:%s" % (k, v) for k, v in props), quote=True)


def main():
    path = icon_paths()

    def icon(m):
        cp, size, fill = m.group(1), m.group(2), m.group(3)
        w, h, d = path(cp)
        return '<svg width="%s" height="%s" viewBox="0 0 %d %d" fill="%s"><path d="%s"/></svg>' % (size, size, w, h, fill, d)

    screens = []
    only = [a for a in sys.argv[1:] if not a.startswith("--")]  # e.g. "19 20" rebuilds just those screens
    for file in sorted(glob.glob(os.path.join(HERE, "[0-9][0-9]-*.html"))):
        key = os.path.splitext(os.path.basename(file))[0]
        if only and key[:2] not in only:
            continue
        body = open(file, encoding="utf-8").read()
        for old, new in WORDING.items():
            body = body.replace(old, new)
        if key[:2] in ("19", "20"):
            # the web build's switches carry a hidden checkbox whose value ("on") is not part of the design
            body = body.replace(">on</div>", "></div>")
        body = re.sub(r'<svg data-cp="([0-9a-f]+)" width="([\d.]+)" height="[\d.]+" fill="([^"]*)"></svg>', icon, body)
        body = re.sub(r'style="([^"]*)"', lambda m: 'style="%s"' % fix_style(m.group(1)), body)
        # a single English word (a word tile, a number, a tag) must never break across lines
        body = re.sub(r'<div style="([^"]*font-family:Inter[^"]*)">([^<\s]+)</div>',
                      lambda m: '<div style="%s">%s</div>' % (re.sub(r'white-space:[^;]*', 'white-space:nowrap', m.group(1)), m.group(2)), body)
        screens.append(
            '<section class="screen" id="s%s" data-name="%s" aria-label="%s">%s</section>'
            % (key[:2], TITLES[key], TITLES[key], body))

    fonts = ('<link href="https://fonts.googleapis.com/css2?family=Markazi+Text:wght@400;500;600;700&'
             'family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">') if PREVIEW else ""
    doc = """<!doctype html><html lang="ar"><head><meta charset="utf-8"><title>Trade English · Mobile UI</title>%s
<style>
  body{margin:0;padding:80px;background:#E9E6DA;display:grid;grid-template-columns:repeat(5,393px);gap:120px 100px;width:max-content}
  .screen{position:relative;width:393px;height:852px;overflow:hidden;background:#F4F2E9;border-radius:44px;transform:translateZ(0)}
</style></head><body>
%s
</body></html>""" % (fonts, "\n".join(screens))
    out = os.path.join(HERE, "screens-preview.html" if PREVIEW else "screens-part.html" if only else "screens.html")
    open(out, "w", encoding="utf-8").write(doc)
    print("%d screens, %d KB -> %s" % (len(screens), len(doc.encode("utf-8")) // 1024, os.path.basename(out)))


if __name__ == "__main__":
    main()
