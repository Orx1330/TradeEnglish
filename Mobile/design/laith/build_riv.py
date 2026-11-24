"""Generates assets/rive/laith.riv — Laith and the lioness as real Rive artboards — without the Rive editor.

A .riv file is a flat list of objects: each is a type key followed by (property key, value) pairs.
This script writes that list directly: the vector artwork, the timelines, and one state machine
per artboard ("Mood") with
    mood   number   0 idle · 1 wait · 2 happy · 3 sad · 4 cheer · 5 listen · 6 wave
    pat    trigger  a giggle and a squash            (also fired by touching the head)
    tail   trigger  a startled jump and a fast wag   (also fired by touching the tail)
    book   trigger  the ABC book lifted to be read   (also fired by touching the book; Laith only)

Artboards: Laith, LaithMirror (facing the other way, book still readable) and Lioness.
The artwork mirrors src/ui/Laith.tsx: one 200x200 artboard, the same layers and pivots.

Usage:  python build_riv.py [--stage shapes|anims|machine|all]
Needs fontTools (the three letters on the book are outlines taken from the app's own font).
"""
import math, os, re, struct, sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(APP, "assets", "rive", "laith.riv")
STAGE = sys.argv[sys.argv.index("--stage") + 1] if "--stage" in sys.argv else "all"
LEVEL = ["shapes", "anims", "machine", "all"].index(STAGE)

# ---------------------------------------------------------------- format: type keys
BACKBOARD, ARTBOARD, NODE, SHAPE, ELLIPSE, STRAIGHT, CUBIC, RECT = 23, 1, 2, 3, 4, 5, 6, 7
POINTS_PATH, SOLID, FILL, STROKE = 16, 18, 20, 24
KEYED_OBJECT, KEYED_PROPERTY, KEYFRAME, LINEAR_ANIMATION = 25, 26, 30, 31
STATE_MACHINE, SM_NUMBER, SM_LAYER, SM_TRIGGER = 53, 56, 57, 58
ANIMATION_STATE, ANY_STATE, ENTRY_STATE, EXIT_STATE, TRANSITION = 61, 62, 63, 64, 65
COND_TRIGGER, COND_NUMBER = 68, 70
LISTENER, LISTENER_TRIGGER = 114, 115

# ---------------------------------------------------------------- format: property keys -> (key, encoding)
# u = unsigned LEB128 · s = string · f = float32 · c = colour (ARGB uint32) · b = bool byte
P = {
    "name": (4, "s"), "parentId": (5, "u"), "width": (7, "f"), "height": (8, "f"),
    "x": (13, "f"), "y": (14, "f"), "rotation": (15, "f"), "scaleX": (16, "f"), "scaleY": (17, "f"), "opacity": (18, "f"),
    "pathWidth": (20, "f"), "pathHeight": (21, "f"), "vx": (24, "f"), "vy": (25, "f"),
    "cornerRadius": (31, "f"), "isClosed": (32, "b"), "color": (37, "c"),
    "thickness": (47, "f"), "cap": (48, "u"), "join": (49, "u"),
    "objectId": (51, "u"), "propertyKey": (53, "u"),
    "animName": (55, "s"), "fps": (56, "u"), "duration": (57, "u"), "loop": (59, "u"),
    "frame": (67, "u"), "interpolation": (68, "u"), "value": (70, "f"),
    "inRotation": (84, "f"), "inDistance": (85, "f"), "outRotation": (86, "f"), "outDistance": (87, "f"),
    "smName": (138, "s"), "numberValue": (140, "f"), "animationId": (149, "u"),
    "stateToId": (151, "u"), "flags": (152, "u"), "inputId": (155, "u"), "op": (156, "u"), "condValue": (157, "f"),
    "mixDuration": (158, "u"), "exitTime": (160, "u"),
    "targetId": (224, "u"), "listenerType": (225, "u"), "listenerInputId": (227, "u"),
}
ANIMATABLE = {"x": 13, "y": 14, "rotation": 15, "scaleX": 16, "scaleY": 17, "opacity": 18}


def varuint(n):
    out = bytearray()
    while True:
        byte = n & 0x7F
        n >>= 7
        out.append(byte | (0x80 if n else 0))
        if not n:
            return bytes(out)


class Writer:
    def __init__(self):
        # fingerprint, major 7, minor 0, file id 0, then an empty table of non-core property keys
        self.data = bytearray(b"RIVE") + varuint(7) + varuint(0) + varuint(0) + varuint(0)

    def obj(self, type_key, **props):
        self.data += varuint(type_key)
        for name, value in props.items():
            key, kind = P[name]
            self.data += varuint(key)
            if kind == "u":
                self.data += varuint(int(value))
            elif kind == "f":
                self.data += struct.pack("<f", float(value))
            elif kind == "c":
                self.data += struct.pack("<I", value)
            elif kind == "b":
                self.data += bytes([1 if value else 0])
            else:
                raw = value.encode("utf-8")
                self.data += varuint(len(raw)) + raw
        self.data += varuint(0)


def argb(hex_color, alpha=1.0):
    return (int(round(alpha * 255)) << 24) | int(hex_color.lstrip("#"), 16)


# ---------------------------------------------------------------- svg path data -> Rive vertices
def parse_path(d):
    """Absolute M/L/H/V/Q/C/Z path data -> [(cubic segments, closed)], a segment being (p0, c1, c2, p1)."""
    tokens = re.findall(r"[MLHVQCZ]|-?\d*\.?\d+(?:e-?\d+)?", d)
    subs, segs, pos, start, i, cmd = [], [], None, None, 0, None

    def num():
        nonlocal i
        i += 1
        return float(tokens[i - 1])

    while i < len(tokens):
        if re.match(r"[MLHVQCZ]", tokens[i]):
            cmd = tokens[i]
            i += 1
        if cmd == "M":
            if segs:
                subs.append((segs, False))
            segs, pos = [], (num(), num())
            start, cmd = pos, "L"
        elif cmd == "L":
            p = (num(), num())
            segs.append((pos, pos, p, p))
            pos = p
        elif cmd == "H":
            p = (num(), pos[1])
            segs.append((pos, pos, p, p))
            pos = p
        elif cmd == "V":
            p = (pos[0], num())
            segs.append((pos, pos, p, p))
            pos = p
        elif cmd == "Q":
            q, p = (num(), num()), (num(), num())
            c1 = (pos[0] + 2 / 3 * (q[0] - pos[0]), pos[1] + 2 / 3 * (q[1] - pos[1]))
            c2 = (p[0] + 2 / 3 * (q[0] - p[0]), p[1] + 2 / 3 * (q[1] - p[1]))
            segs.append((pos, c1, c2, p))
            pos = p
        elif cmd == "C":
            c1, c2, p = (num(), num()), (num(), num()), (num(), num())
            segs.append((pos, c1, c2, p))
            pos = p
        elif cmd == "Z":
            if segs:
                subs.append((segs, True))
            segs, pos = [], start
    if segs:
        subs.append((segs, False))
    return subs


def vertices(segs, closed):
    """[(x, y, in handle, out handle)] for one sub-path."""
    anchors = [segs[0][0]] + [s[3] for s in segs]
    ins = [anchors[0]] + [s[2] for s in segs]
    outs = [s[1] for s in segs] + [anchors[-1]]
    if closed and math.dist(anchors[0], anchors[-1]) < 1e-4:
        # the last curve lands back on the start: one vertex, taking the incoming handle of the last
        ins[0] = ins[-1]
        anchors, ins, outs = anchors[:-1], ins[:-1], outs[:-1]
    return [(a[0], a[1], i, o) for a, i, o in zip(anchors, ins, outs)]


# ---------------------------------------------------------------- scene
class Item:
    def __init__(self, type_key, parent, props):
        self.type, self.parent, self.props, self.children, self.index = type_key, parent, props, [], None
        self.px = self.py = 0.0  # pivot in artboard coordinates (nodes and shapes)
        if parent is not None:
            parent.children.append(self)


class Artboard:
    def __init__(self, name, size=200):
        self.root = Item(ARTBOARD, None, dict(name=name, width=size, height=size))
        self.animations, self.machine = [], None

    # -- structure
    def node(self, parent, name, px, py, **extra):
        it = Item(NODE, parent, dict(name=name, x=px - parent.px, y=py - parent.py, **extra))
        it.px, it.py, it.base = px, py, dict(x=px - parent.px, y=py - parent.py, rotation=0.0, scaleX=1.0, scaleY=1.0, opacity=extra.get("opacity", 1.0))
        return it

    def shape(self, parent, name=None, opacity=1.0):
        props = dict(x=0.0, y=0.0)
        if name:
            props = dict(name=name, **props)
        if opacity != 1.0:
            props["opacity"] = opacity
        it = Item(SHAPE, parent, props)
        it.px, it.py = parent.px, parent.py
        return it

    def _paint(self, shape, fill=None, stroke=None, width=3.0):
        if fill is not None:
            Item(SOLID, Item(FILL, shape, {}), dict(color=fill if isinstance(fill, int) else argb(fill)))
        if stroke is not None:
            Item(SOLID, Item(STROKE, shape, dict(thickness=width, cap=1, join=1)), dict(color=argb(stroke)))

    # -- drawing (all coordinates are artboard coordinates)
    def ellipses(self, parent, items, fill, opacity=1.0, name=None):
        sh = self.shape(parent, name, opacity)
        for cx, cy, rx, ry, *rot in items:
            props = dict(x=cx - sh.px, y=cy - sh.py, pathWidth=rx * 2, pathHeight=ry * 2)
            if rot and rot[0]:
                props["rotation"] = math.radians(rot[0])
            Item(ELLIPSE, sh, props)
        self._paint(sh, fill=fill)
        return sh

    def rect(self, parent, x, y, w, h, radius, fill, name=None):
        sh = self.shape(parent, name)
        Item(RECT, sh, dict(x=x + w / 2 - sh.px, y=y + h / 2 - sh.py, pathWidth=w, pathHeight=h, cornerRadius=radius))
        self._paint(sh, fill=fill)
        return sh

    def path(self, parent, d, fill=None, stroke=None, width=3.0, name=None):
        sh = self.shape(parent, name)
        for segs, closed in parse_path(d):
            path = Item(POINTS_PATH, sh, dict(x=0.0, y=0.0, isClosed=closed))
            for x, y, i, o in vertices(segs, closed):
                vx, vy = x - sh.px, y - sh.py
                di, do = math.dist((x, y), i), math.dist((x, y), o)
                if di < 1e-4 and do < 1e-4:
                    Item(STRAIGHT, path, dict(vx=vx, vy=vy))
                else:
                    Item(CUBIC, path, dict(vx=vx, vy=vy,
                                           inRotation=math.atan2(i[1] - y, i[0] - x) if di > 1e-4 else 0.0, inDistance=di,
                                           outRotation=math.atan2(o[1] - y, o[0] - x) if do > 1e-4 else 0.0, outDistance=do))
        self._paint(sh, fill=fill, stroke=stroke, width=width)
        return sh

    # -- output
    def order(self):
        """Depth-first. Rive draws the first drawable in the file on top, so the children of the
        artboard and of groups go out last-to-first; a path's vertices must keep their own order."""
        flat = []

        def walk(item):
            item.index = len(flat)
            flat.append(item)
            stacked = item.type in (ARTBOARD, NODE)
            for child in (reversed(item.children) if stacked else item.children):
                walk(child)

        walk(self.root)
        return flat

    def write(self, w):
        flat = self.order()
        for item in flat:
            props = dict(item.props)
            if item.parent is not None:
                props = {"parentId": item.parent.index, **props}
            w.obj(item.type, **props)
        if LEVEL >= 1:
            for anim in self.animations:
                anim.write(w)
        if LEVEL >= 2 and self.machine:
            self.machine.write(w, self.animations)
        return len(flat)


# ---------------------------------------------------------------- timelines
FPS = 60


class Anim:
    ONE_SHOT, LOOP = 0, 1

    def __init__(self, name, seconds, loop=LOOP):
        self.name, self.frames, self.loop, self.tracks = name, max(1, round(seconds * FPS)), loop, []

    def hold(self, item, prop, value):
        self.tracks.append((item, prop, [(0, value)]))
        return self

    def curve(self, item, prop, fn, step=2):
        """fn(seconds) sampled every `step` frames; straight lines between samples follow any easing."""
        frames = sorted(set(list(range(0, self.frames, step)) + [self.frames]))
        self.tracks.append((item, prop, [(f, fn(f / FPS)) for f in frames]))
        return self

    def write(self, w):
        w.obj(LINEAR_ANIMATION, animName=self.name, fps=FPS, duration=self.frames, loop=self.loop)
        by_item = {}
        for item, prop, keys in self.tracks:
            by_item.setdefault(id(item), (item, []))[1].append((prop, keys))
        for item, tracks in by_item.values():
            w.obj(KEYED_OBJECT, objectId=item.index)
            for prop, keys in tracks:
                w.obj(KEYED_PROPERTY, propertyKey=ANIMATABLE[prop])
                for frame, value in keys:
                    w.obj(KEYFRAME, frame=frame, interpolation=1, value=value)


class Machine:
    """One state machine: looping base layers, a mood layer switched by a number, a touch layer fired by triggers."""

    def __init__(self, name="Mood"):
        self.name, self.base, self.moods, self.touches, self.listeners = name, [], [], [], []

    def write(self, w, animations):
        index = {a.name: i for i, a in enumerate(animations)}
        inputs = ["mood"] + [t[0] for t in self.touches]
        w.obj(STATE_MACHINE, animName=self.name)
        w.obj(SM_NUMBER, smName="mood", numberValue=0.0)
        for trigger, _ in self.touches:
            w.obj(SM_TRIGGER, smName=trigger)

        for anim in self.base:  # each: Any, Entry, Exit, then the loop the entry state leads to
            w.obj(SM_LAYER, smName=anim)
            w.obj(ANY_STATE)
            w.obj(ENTRY_STATE)
            w.obj(TRANSITION, stateToId=3)
            w.obj(EXIT_STATE)
            w.obj(ANIMATION_STATE, animationId=index[anim])

        w.obj(SM_LAYER, smName="mood")
        w.obj(ANY_STATE)
        for k, _ in enumerate(self.moods):  # from anywhere, go to mood k when the input equals k
            w.obj(TRANSITION, stateToId=3 + k, mixDuration=140)
            w.obj(COND_NUMBER, inputId=0, op=0, condValue=float(k))
        w.obj(ENTRY_STATE)
        w.obj(TRANSITION, stateToId=3)
        w.obj(EXIT_STATE)
        for anim in self.moods:
            w.obj(ANIMATION_STATE, animationId=index[anim])

        w.obj(SM_LAYER, smName="touch")
        w.obj(ANY_STATE)
        for k, (trigger, _) in enumerate(self.touches):
            w.obj(TRANSITION, stateToId=4 + k, mixDuration=60)
            w.obj(COND_TRIGGER, inputId=inputs.index(trigger))
        w.obj(ENTRY_STATE)
        w.obj(TRANSITION, stateToId=3)
        w.obj(EXIT_STATE)
        w.obj(ANIMATION_STATE, animationId=index["rest"])
        for _, anim in self.touches:  # play once, then back to rest when the clip has run to its end
            w.obj(ANIMATION_STATE, animationId=index[anim])
            w.obj(TRANSITION, stateToId=3, flags=4 | 8, exitTime=100, mixDuration=120)

        if LEVEL >= 3:
            for trigger, target in self.listeners:  # pointer down on a body part fires its trigger
                w.obj(LISTENER, smName=trigger + "-touch", targetId=target.index, listenerType=2)
                w.obj(LISTENER_TRIGGER, listenerInputId=inputs.index(trigger))


# ---------------------------------------------------------------- the characters
INK, CREAM, PINK = "#4A2610", "#FDEBC6", "#F4A3A0"
LOOK = {
    "Laith": dict(fur="#F6C262", dark="#E9A73F", mane="#D9812A", mane_dark="#BF6A1C", tuft="#BF6A1C", blush="#F59C84"),
    "Lioness": dict(fur="#F9D892", dark="#EDBC62", mane="#EDBC62", mane_dark="#E0A94B", tuft="#C98A3A", blush="#F58FA0"),
}


def abc_outline():
    """'ABC' as path data, 13 px tall, centred on x = 102.5 with its baseline at y = 167 (the book cover)."""
    font = TTFont(os.path.join(APP, "assets", "fonts", "thmanyah-serif-text-black.otf"))
    glyphs, cmap, upm = font.getGlyphSet(), font.getBestCmap(), font["head"].unitsPerEm
    scale = 13 / upm
    total = sum(glyphs[cmap[ord(ch)]].width for ch in "ABC") * scale
    x, parts = 102.5 - total / 2, []
    for ch in "ABC":
        glyph = glyphs[cmap[ord(ch)]]
        pen = SVGPathPen(glyphs)
        glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, x, 167)))
        parts.append(pen.getCommands())
        x += glyph.width * scale
    return " ".join(parts)


def ease_out(t):
    return 1 - (1 - t) ** 2


def ease_in_out(t):
    return 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, t)))


def build(name, look="Laith", mirror=False):
    """One artboard. `mirror` faces the character the other way while keeping the book readable."""
    c, lioness = LOOK[look], look == "Lioness"
    side = -1.0 if mirror else 1.0
    ab = Artboard(name)
    art = ab.root

    ab.ellipses(art, [(100, 193, 46, 6)], argb("#1D3229", 0.12), name="shadow")
    root = ab.node(art, "root", 100, 193, **({"scaleX": -1.0} if mirror else {}))  # feet: hops and squashes happen about the ground

    tail = ab.node(root, "tail", 126, 164)
    ab.path(tail, "M126 164 C158 170 174 146 160 122", stroke=c["dark"], width=9)
    ab.ellipses(tail, [(158, 115, 10.5, 14, -18)], c["tuft"])

    body = ab.node(root, "body", 100, 158)
    ab.ellipses(body, [(82, 188, 15, 8.5), (118, 188, 15, 8.5)], c["dark"])
    ab.ellipses(body, [(100, 158, 37, 34)], c["fur"])
    ab.ellipses(body, [(100, 166, 22, 21)], CREAM)

    head = ab.node(root, "head", 100, 132)  # neck: tilts and nods
    if lioness:
        ab.ellipses(head, [(58, 54, 18, 18), (142, 54, 18, 18)], c["fur"])
        ab.ellipses(head, [(58, 55, 10, 10), (142, 55, 10, 10)], PINK)
        ab.ellipses(head, [(100, 90, 48, 45)], c["fur"])
        ab.ellipses(head, [(128, 45, 11, 7.5, -28), (150, 41, 11, 7.5, 34)], "#EE6C8A", name="bow")
        ab.ellipses(head, [(139, 44, 5.5, 5.5)], "#D9567A")
    else:
        ring = [(100 + math.cos(i / 12 * math.tau) * 49, 88 + math.sin(i / 12 * math.tau) * 47, 17, 17) for i in range(12)]
        ab.ellipses(head, ring[0::2], c["mane_dark"], name="mane")
        ab.ellipses(head, ring[1::2], c["mane"])
        ab.ellipses(head, [(100, 88, 51, 51)], c["mane"])
        ab.ellipses(head, [(60, 48, 15, 15), (140, 48, 15, 15)], c["fur"])
        ab.ellipses(head, [(60, 49, 8, 8), (140, 49, 8, 8)], PINK)
        ab.ellipses(head, [(100, 91, 45, 42)], c["fur"])
        ab.path(head, "M92 52 Q100 40 108 52 Q100 58 92 52 Z", fill=c["mane"])
    ab.ellipses(head, [(100, 106, 23, 16.5)], CREAM)
    ab.ellipses(head, [(69, 103, 8.5, 8.5), (131, 103, 8.5, 8.5)], argb(c["blush"], 0.5))
    ab.path(head, "M92 95 Q100 90.5 108 95 Q105 102.5 100 103.5 Q95 102.5 92 95 Z", fill=INK, name="nose")

    # four mouths stacked; the mood timelines fade the right one in
    mouth = {}
    mouth["calm"] = ab.node(head, "mouth-calm", 100, 108)
    ab.path(mouth["calm"], "M100 103 L100 107 M89 107 Q94.5 114 100 107 Q105.5 114 111 107", stroke=INK, width=3)
    mouth["smile"] = ab.node(head, "mouth-smile", 100, 108, opacity=0.0)
    ab.path(mouth["smile"], "M86 106 Q100 126 114 106 Q100 111 86 106 Z", fill=INK)
    ab.path(mouth["smile"], "M93 114 Q100 121 107 114 Q100 111 93 114 Z", fill="#F08D8A")
    mouth["sad"] = ab.node(head, "mouth-sad", 100, 108, opacity=0.0)
    ab.path(mouth["sad"], "M91 115 Q100 107 109 115", stroke=INK, width=3.2)
    mouth["ooh"] = ab.node(head, "mouth-ooh", 100, 108, opacity=0.0)
    ab.ellipses(mouth["ooh"], [(100, 112, 5, 5.5)], INK)

    eyes = ab.node(head, "eyes", 100, 85)  # blinks squash this about the eye line
    eyes_open = ab.node(eyes, "eyes-open", 100, 85)
    ab.ellipses(eyes_open, [(80, 85, 8, 10), (120, 85, 8, 10)], INK)
    ab.ellipses(eyes_open, [(83, 81, 3.2, 3.2), (123, 81, 3.2, 3.2), (77.5, 89, 1.5, 1.5), (117.5, 89, 1.5, 1.5)], "#FFFFFF")
    if lioness:
        ab.path(eyes_open, "M72 79 L66 74 M71 85 L64 83 M128 79 L134 74 M129 85 L136 83", stroke=INK, width=2.4)
    eyes_smile = ab.node(eyes, "eyes-smile", 100, 85, opacity=0.0)
    ab.path(eyes_smile, "M71 87 Q80 76 89 87 M111 87 Q120 76 129 87", stroke=INK, width=4.2)
    if lioness:
        ab.path(eyes_smile, "M70 86 L64 83 M130 86 L136 83", stroke=INK, width=2.4)
    brows = ab.node(head, "brows-sad", 100, 70, opacity=0.0)
    ab.path(brows, "M70 73 L88 68 M130 73 L112 68", stroke=INK, width=3)

    book = None
    if not lioness:
        book = ab.node(root, "book", 100, 164, **({"scaleX": -1.0} if mirror else {}))  # flipped back, so ABC still reads
        ab.rect(book, 78, 148, 44, 31, 5, "#2E9BC4")
        ab.rect(book, 78, 148, 7, 31, 3, "#1F789B")
        ab.rect(book, 85, 173, 34, 3.5, 1.5, "#EAF6FB")
        ab.path(book, abc_outline(), fill="#FFFFFF", name="ABC")

    arm_l = ab.node(root, "arm-left", 72, 142)
    ab.ellipses(arm_l, [(71, 160, 9.5, 19.5, 22)], c["fur"])
    ab.ellipses(arm_l, [(77, 174, 8, 6.5)], c["dark"])
    arm_r = ab.node(root, "arm-right", 128, 142)
    ab.ellipses(arm_r, [(129, 160, 9.5, 19.5, -22)], c["fur"])
    ab.ellipses(arm_r, [(123, 174, 8, 6.5)], c["dark"])

    # ---------------- timelines
    deg, tau = math.radians, math.tau
    A = ab.animations
    ry, hy, by = root.base["y"], head.base["y"], (book.base["y"] if book else 0)

    # base layers: always running, each on its own property
    A.append(Anim("breathe", 3.4).curve(root, "scaleY", lambda t: 1 + 0.012 * (0.5 - 0.5 * math.cos(tau * t / 3.4)), 4))
    A.append(Anim("tail-sway", 2.6).curve(tail, "rotation", lambda t: deg(1 - 10 * math.cos(tau * t / 2.6)), 3))

    def blink(t):
        for at in (2.6, 3.0):  # a double blink near the end of the loop
            if at <= t < at + 0.18:
                return 1 - 0.92 * math.sin(math.pi * (t - at) / 0.18)
        return 1.0

    A.append(Anim("blink", 3.6).curve(eyes, "scaleY", blink, 1))

    def mood(name, seconds, loop, face="calm", eye="open", book_on=True):
        """A mood clip keys every property the mood layer owns, so leaving a mood always resets it."""
        a = Anim(name, seconds, loop)
        for kind, node in mouth.items():
            a.hold(node, "opacity", 1.0 if kind == face else 0.0)
        a.hold(eyes_open, "opacity", 0.0 if eye == "smile" else 1.0)
        a.hold(eyes_smile, "opacity", 1.0 if eye == "smile" else 0.0)
        a.hold(brows, "opacity", 1.0 if eye == "sad" else 0.0)
        if book:
            a.hold(book, "opacity", 1.0 if book_on else 0.0)
        A.append(a)
        return a

    m = mood("idle", 4.4, Anim.LOOP)
    m.curve(head, "rotation", lambda t: deg(2.5 * math.sin(tau * t / 4.4)), 4).hold(head, "y", hy)
    m.hold(root, "y", ry).hold(arm_l, "rotation", 0).hold(arm_r, "rotation", 0)

    def eager(t):  # two quick hops at the end of each three seconds of waiting
        for at, height, dur in ((2.3, 11, 0.30), (2.6, 8, 0.26)):
            if at <= t < at + dur:
                return -height * math.sin(math.pi * (t - at) / dur)
        return 0.0

    m = mood("wait", 3.0, Anim.LOOP)
    m.curve(head, "rotation", lambda t: deg(0.5 + 3.5 * math.sin(tau * t / 3.0)), 4).hold(head, "y", hy)
    m.curve(root, "y", lambda t: ry + eager(t), 1).hold(arm_l, "rotation", 0).hold(arm_r, "rotation", 0)

    def bounce(t):  # up fast, then settle with a small second bounce
        if t < 0.17:
            return -16 * ease_out(t / 0.17)
        s = t - 0.17
        return -16 * math.exp(-7 * s) * math.cos(11 * s)

    m = mood("happy", 0.9, Anim.ONE_SHOT, face="smile", eye="smile")
    m.curve(root, "y", lambda t: ry + (0.0 if t >= 0.9 else bounce(t)), 1)
    m.hold(head, "rotation", 0).hold(head, "y", hy).hold(arm_l, "rotation", 0).hold(arm_r, "rotation", 0)

    m = mood("sad", 0.4, Anim.ONE_SHOT, face="sad", eye="sad")
    m.curve(head, "rotation", lambda t: deg(-11 * ease_out(min(1, t / 0.38))), 2)
    m.curve(head, "y", lambda t: hy + 5 * ease_out(min(1, t / 0.26)), 2)
    m.hold(root, "y", ry).hold(arm_l, "rotation", 0).hold(arm_r, "rotation", 0)

    def jump(t):
        if t < 0.26:
            return -18 * ease_out(t / 0.26)
        if t < 0.52:
            return -18 * (1 - ((t - 0.26) / 0.26) ** 2)
        return 0.0

    m = mood("cheer", 0.78, Anim.LOOP, face="smile", eye="smile", book_on=False)
    m.curve(root, "y", lambda t: ry + jump(t), 1).hold(head, "rotation", 0).hold(head, "y", hy)
    m.hold(arm_l, "rotation", deg(138)).hold(arm_r, "rotation", deg(-138))

    m = mood("listen", 1.68, Anim.LOOP, face="ooh")
    m.curve(head, "rotation", lambda t: deg(6 * math.sin(tau * t / 1.68)), 2)
    m.curve(head, "y", lambda t: hy + 1.5 - 1.5 * math.cos(tau * t / 0.42), 2)
    m.hold(root, "y", ry).hold(arm_l, "rotation", 0).hold(arm_r, "rotation", 0)

    m = mood("wave", 0.6, Anim.LOOP, face="smile")
    m.curve(arm_r, "rotation", lambda t: deg(-118.5 - 19.5 * math.cos(tau * t / 0.6)), 2)
    m.hold(head, "rotation", deg(5)).hold(head, "y", hy).hold(root, "y", ry).hold(arm_l, "rotation", 0)

    # touch layer: short one-shots on top of whatever mood is showing
    A.append(Anim("rest", 1 / FPS, Anim.ONE_SHOT))

    def wobble(t):
        return math.exp(-6 * t) * math.cos(16 * t) if t < 0.95 else 0.0

    pat = Anim("pat", 1.0, Anim.ONE_SHOT)
    pat.curve(root, "scaleX", lambda t: side * (1 + 0.10 * wobble(t)), 1).curve(root, "scaleY", lambda t: 1 - 0.10 * wobble(t), 1)
    for kind, node in mouth.items():
        pat.hold(node, "opacity", 1.0 if kind == "smile" else 0.0)
    pat.hold(eyes_open, "opacity", 0.0).hold(eyes_smile, "opacity", 1.0).hold(brows, "opacity", 0.0)
    A.append(pat)

    flick = Anim("tail-flick", 1.0, Anim.ONE_SHOT)
    flick.curve(tail, "rotation", lambda t: deg(26 * math.sin(tau * 6 * t) * (1 - t)), 1)
    flick.curve(root, "y", lambda t: ry - 12 * math.sin(math.pi * min(1, t / 0.34)) if t < 0.34 else ry, 1)
    flick.curve(eyes, "scaleY", lambda t: 1.16 if t < 0.8 else 1.0, 1)
    for kind, node in mouth.items():
        flick.hold(node, "opacity", 1.0 if kind == "ooh" else 0.0)
    flick.hold(eyes_open, "opacity", 1.0).hold(eyes_smile, "opacity", 0.0).hold(brows, "opacity", 0.0)
    A.append(flick)

    if book:
        def lift(t):  # up with a little overshoot, held, then back down
            if t < 0.32:
                p = t / 0.32
                return 1 + 2.6 * (p - 1) ** 3 + 1.6 * (p - 1) ** 2
            if t < 1.14:
                return 1.0
            return max(0.0, 1 - ((t - 1.14) / 0.26) ** 2)

        read = Anim("book-up", 1.4, Anim.ONE_SHOT)
        read.curve(book, "y", lambda t: by - 20 * lift(t), 1)
        read.curve(book, "scaleX", lambda t: side * (1 + 0.28 * lift(t)), 1).curve(book, "scaleY", lambda t: 1 + 0.28 * lift(t), 1)
        read.curve(book, "rotation", lambda t: deg(7 * math.sin(3 * math.pi * lift(t))), 1)
        read.curve(arm_l, "rotation", lambda t: deg(30 * lift(t)), 1).curve(arm_r, "rotation", lambda t: deg(-30 * lift(t)), 1)
        for kind, node in mouth.items():
            read.hold(node, "opacity", 1.0 if kind == "ooh" else 0.0)
        A.append(read)

    # ---------------- state machine
    sm = Machine()
    sm.base = ["breathe", "tail-sway", "blink"]
    sm.moods = ["idle", "wait", "happy", "sad", "cheer", "listen", "wave"]
    sm.touches = [("pat", "pat"), ("tail", "tail-flick")] + ([("book", "book-up")] if book else [])
    sm.listeners = [("pat", head), ("tail", tail)] + ([("book", book)] if book else [])
    ab.machine = sm
    return ab


def main():
    w = Writer()
    w.obj(BACKBOARD)
    boards = [("Laith", "Laith", False), ("LaithMirror", "Laith", True), ("Lioness", "Lioness", False)]
    counts = [(name, build(name, look, mirror).write(w)) for name, look, mirror in boards]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, "wb").write(w.data)
    print("%s  %d bytes  stage=%s  %s" % (os.path.relpath(OUT, APP), len(w.data), STAGE, counts))


if __name__ == "__main__":
    main()
