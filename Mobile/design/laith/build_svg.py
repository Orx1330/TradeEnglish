"""Exports Laith, the lion-cub mascot, as SVG for review and for import into Rive.

The geometry mirrors src/ui/Laith.tsx (one 200x200 artboard, the same layers and pivots).

Writes, next to this script:
  laith-rive.svg    one artboard, every layer a named group; alternates (eyes, mouths) stacked
                    on top of each other so Rive can switch them from a state machine
  laith-moods.svg   a review sheet: the six moods posed side by side

Usage:  python build_svg.py
"""
import math, os

HERE = os.path.dirname(os.path.abspath(__file__))
FUR, FUR_DARK, MANE, MANE_DARK = "#F6C262", "#E9A73F", "#D9812A", "#BF6A1C"
CREAM, INK, PINK = "#FDEBC6", "#4A2610", "#F4A3A0"

# pivots (artboard units) — the same points the app rotates each layer around
PIVOT = {"tail": (126, 164), "head": (100, 132), "eyes": (100, 85), "arm-left": (72, 142), "arm-right": (128, 142)}


def g(name, body, transform="", hidden=False):
    attrs = ' id="%s"' % name
    if transform:
        attrs += ' transform="%s"' % transform
    if hidden:
        attrs += ' opacity="0"'
    return "<g%s>%s</g>" % (attrs, body)


def rot(deg, pivot):
    return "rotate(%s %s %s)" % (deg, pivot[0], pivot[1])


SHADOW = '<ellipse cx="100" cy="193" rx="46" ry="6" fill="#1D3229" opacity="0.12"/>'
TAIL = ('<path d="M126 164 C158 170 174 146 160 122" stroke="%s" stroke-width="9" stroke-linecap="round" fill="none"/>'
        '<ellipse cx="158" cy="115" rx="10.5" ry="14" fill="%s" transform="rotate(-18 158 115)"/>') % (FUR_DARK, MANE_DARK)
BODY = ('<ellipse cx="82" cy="188" rx="15" ry="8.5" fill="%s"/><ellipse cx="118" cy="188" rx="15" ry="8.5" fill="%s"/>'
        '<ellipse cx="100" cy="158" rx="37" ry="34" fill="%s"/><ellipse cx="100" cy="166" rx="22" ry="21" fill="%s"/>') % (FUR_DARK, FUR_DARK, FUR, CREAM)
BOOK = ('<rect x="78" y="148" width="44" height="31" rx="5" fill="#2E9BC4"/><rect x="78" y="148" width="7" height="31" rx="3" fill="#1F789B"/>'
        '<rect x="85" y="173" width="34" height="3.5" rx="1.5" fill="#EAF6FB"/>'
        '<text x="102.5" y="167" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="700" fill="#FFFFFF" text-anchor="middle">ABC</text>')
ARM_L = ('<ellipse cx="71" cy="160" rx="9.5" ry="19.5" fill="%s" transform="rotate(22 71 160)"/><ellipse cx="77" cy="174" rx="8" ry="6.5" fill="%s"/>') % (FUR, FUR_DARK)
ARM_R = ('<ellipse cx="129" cy="160" rx="9.5" ry="19.5" fill="%s" transform="rotate(-22 129 160)"/><ellipse cx="123" cy="174" rx="8" ry="6.5" fill="%s"/>') % (FUR, FUR_DARK)

tufts = "".join(
    '<circle cx="%.1f" cy="%.1f" r="17" fill="%s"/>' % (100 + math.cos(i / 12 * math.tau) * 49, 88 + math.sin(i / 12 * math.tau) * 47, MANE if i % 2 else MANE_DARK)
    for i in range(12))
HEAD = (tufts + '<circle cx="100" cy="88" r="51" fill="%s"/>' % MANE
        + '<circle cx="60" cy="48" r="15" fill="%s"/><circle cx="140" cy="48" r="15" fill="%s"/>' % (FUR, FUR)
        + '<circle cx="60" cy="49" r="8" fill="%s"/><circle cx="140" cy="49" r="8" fill="%s"/>' % (PINK, PINK)
        + '<ellipse cx="100" cy="91" rx="45" ry="42" fill="%s"/>' % FUR
        + '<path d="M92 52 Q100 40 108 52 Q100 58 92 52 Z" fill="%s"/>' % MANE
        + '<ellipse cx="100" cy="106" rx="23" ry="16.5" fill="%s"/>' % CREAM
        + '<circle cx="69" cy="103" r="8.5" fill="#F59C84" opacity="0.5"/><circle cx="131" cy="103" r="8.5" fill="#F59C84" opacity="0.5"/>'
        + '<path d="M92 95 Q100 90.5 108 95 Q105 102.5 100 103.5 Q95 102.5 92 95 Z" fill="%s"/>' % INK)


def eyes_open(look=0):
    return ('<ellipse cx="80" cy="%s" rx="8" ry="10" fill="%s"/><ellipse cx="120" cy="%s" rx="8" ry="10" fill="%s"/>' % (85 + look, INK, 85 + look, INK)
            + '<circle cx="83" cy="%s" r="3.2" fill="#fff"/><circle cx="123" cy="%s" r="3.2" fill="#fff"/>' % (81 + look, 81 + look)
            + '<circle cx="77.5" cy="%s" r="1.5" fill="#fff" opacity="0.8"/><circle cx="117.5" cy="%s" r="1.5" fill="#fff" opacity="0.8"/>' % (89 + look, 89 + look))


EYES_HAPPY = ('<path d="M71 87 Q80 76 89 87" stroke="%s" stroke-width="4.2" stroke-linecap="round" fill="none"/>'
              '<path d="M111 87 Q120 76 129 87" stroke="%s" stroke-width="4.2" stroke-linecap="round" fill="none"/>') % (INK, INK)
BROWS_SAD = ('<path d="M70 73 L88 68" stroke="%s" stroke-width="3" stroke-linecap="round"/>'
             '<path d="M130 73 L112 68" stroke="%s" stroke-width="3" stroke-linecap="round"/>') % (INK, INK)
MOUTH = {
    "idle": '<path d="M100 103 L100 107 M89 107 Q94.5 114 100 107 Q105.5 114 111 107" stroke="%s" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' % INK,
    "happy": '<path d="M86 106 Q100 126 114 106 Q100 111 86 106 Z" fill="%s"/><path d="M93 114 Q100 121 107 114 Q100 111 93 114 Z" fill="#F08D8A"/>' % INK,
    "sad": '<path d="M91 115 Q100 107 109 115" stroke="%s" stroke-width="3.2" stroke-linecap="round" fill="none"/>' % INK,
    "listen": '<ellipse cx="100" cy="112" rx="5" ry="5.5" fill="%s"/>' % INK,
}

# mood -> pose (a still frame of what the app animates)
POSES = {
    "idle": dict(label="هادئ · idle", note="يتنفس ويرمش ويهز ذيله"),
    "wave": dict(label="يلوّح · wave", note="شاشة الترحيب", mouth="happy", arm_r=-128, head=5),
    "listen": dict(label="يستمع · listen", note="أثناء تشغيل الجملة", mouth="listen", head=6),
    "happy": dict(label="فرحان · happy", note="إجابة صحيحة", mouth="happy", eyes="happy", hop=-10),
    "sad": dict(label="حزين · sad", note="إجابة خاطئة", mouth="sad", eyes="sad", head=-11, nod=5),
    "cheer": dict(label="يحتفل · cheer", note="إنهاء الدرس", mouth="happy", eyes="happy", arm_r=-138, arm_l=138, hop=-14, book=False),
}


def pose(mouth="idle", eyes="open", head=0, nod=0, hop=0, arm_r=0, arm_l=0, book=True, **_):
    eye_art = EYES_HAPPY if eyes == "happy" else eyes_open(2 if eyes == "sad" else 0) + (BROWS_SAD if eyes == "sad" else "")
    head_tf = "translate(0 %s) %s" % (nod, rot(head, PIVOT["head"]))
    moving = (g("tail", TAIL) + g("body", BODY) + (g("book", BOOK) if book else "")
              + g("head", HEAD + MOUTH[mouth] + eye_art, head_tf)
              + g("arm-left", ARM_L, rot(arm_l, PIVOT["arm-left"])) + g("arm-right", ARM_R, rot(arm_r, PIVOT["arm-right"])))
    return SHADOW + '<g transform="translate(0 %s)">%s</g>' % (hop, moving)


def write(name, text):
    open(os.path.join(HERE, name), "w", encoding="utf-8").write(text)
    print(name, len(text) // 1024 + 1, "KB")


def main():
    # 1. master artboard for Rive: every part a named group, alternates stacked (hidden ones at opacity 0)
    master = (g("shadow", SHADOW) + g("tail", TAIL) + g("body", BODY) + g("book", BOOK)
              + g("head", g("head-base", HEAD)
                  + g("mouth-idle", MOUTH["idle"]) + g("mouth-happy", MOUTH["happy"], hidden=True)
                  + g("mouth-sad", MOUTH["sad"], hidden=True) + g("mouth-listen", MOUTH["listen"], hidden=True)
                  + g("eyes-open", eyes_open()) + g("eyes-happy", EYES_HAPPY, hidden=True) + g("brows-sad", BROWS_SAD, hidden=True))
              + g("arm-left", ARM_L) + g("arm-right", ARM_R))
    write("laith-rive.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="800" height="800">%s</svg>' % master)

    # 2. review sheet: six moods
    cell, cols = 250, 3
    cards = ""
    for i, (mood, p) in enumerate(POSES.items()):
        x, y = 40 + (i % cols) * (cell + 24), 96 + (i // cols) * (cell + 78)
        cards += ('<g transform="translate(%d %d)"><rect width="%d" height="%d" rx="28" fill="#FFFFFF" stroke="#E7E2D2" stroke-width="1.5"/>'
                  '<g transform="translate(25 14)">%s</g>'
                  '<text x="%d" y="%d" font-family="Segoe UI, Tahoma, Arial, sans-serif" font-size="20" font-weight="700" fill="#1D3229" text-anchor="middle" direction="rtl">%s</text>'
                  '<text x="%d" y="%d" font-family="Segoe UI, Tahoma, Arial, sans-serif" font-size="15" fill="#55685F" text-anchor="middle" direction="rtl">%s</text></g>') % (
                      x, y, cell, cell + 54, pose(**p), cell // 2, cell + 6, p["label"], cell // 2, cell + 32, p["note"])
    w, h = 40 * 2 + cols * cell + (cols - 1) * 24, 96 + 2 * (cell + 78) + 6
    sheet = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d"><rect width="%d" height="%d" fill="#F4F2E9"/>'
             '<text x="%d" y="46" font-family="Segoe UI, Tahoma, Arial, sans-serif" font-size="30" font-weight="700" fill="#1D3229" text-anchor="middle" direction="rtl">ليث · الشبل الذي يتعلّم الإنجليزية معك</text>'
             '<text x="%d" y="74" font-family="Segoe UI, Tahoma, Arial, sans-serif" font-size="16" fill="#55685F" text-anchor="middle" direction="rtl">الحالات الست التي يتنقل بينها داخل التطبيق</text>%s</svg>') % (
                 w, h, w, h, w, h, w // 2, w // 2, cards)
    write("laith-moods.svg", sheet)


if __name__ == "__main__":
    main()
