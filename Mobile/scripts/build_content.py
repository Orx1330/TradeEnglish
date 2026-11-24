"""Builds the mobile app's bundled content from the desktop project's sources.

Reads   ../Source/course.txt, ../Source/Scenarios.cs, ../Source/audio-manifest.json,
        ../Source/Assets/Audio/**  and (if present) src/data/enrich.json
Writes  src/data/course.json, src/data/audioMap.ts,
        assets/audio/<voice>/<id>.mp3 (re-encoded 64 kbps mono), assets/sfx/*.mp3

Usage:  python scripts/build_content.py [--skip-audio]
Needs ffmpeg on PATH for the audio steps.
"""
import hashlib, json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
SRC = os.path.join(os.path.dirname(APP), "Source")
AUDIO_SRC = os.path.join(SRC, "Assets", "Audio")
SKIP_AUDIO = "--skip-audio" in sys.argv

# voice id in the app -> (folder in Source/Assets/Audio, Arabic label, accent tag)
VOICES = [
    ("eric", "", "Eric", "أمريكي واضح"),
    ("brian", "brian", "Brian", "عميق ورزين"),
    ("george", "george", "George", "بريطاني هادئ"),
    ("v4", "Rmv8zCb2IRE895dK1qWB", "صوت 4", "صوت إضافي"),
    ("v5", "SAxJUlDKRc79XAyeWyMu", "صوت 5", "صوت إضافي"),
    ("v6", "Qbw4VpyUrHEG7NigKzty", "صوت 6", "صوت إضافي"),
    ("v7", "507tTFX0IPtqFzGd1CAL", "صوت 7", "تغطية جزئية"),
]

# Presentation data added on top of the original course (unit order = file order).
UNIT_META = [
    dict(level="A1", levelAr="مبتدئ", icon="account-voice", color="#3FAE5A", dark="#2C8743", soft="#DDF3E0"),
    dict(level="A2", levelAr="أساسي", icon="candy-outline", color="#8571C9", dark="#6352A8", soft="#E8E2F8"),
    dict(level="A2", levelAr="أساسي", icon="cart-outline", color="#2E9BC4", dark="#1F789B", soft="#D9EEF7"),
    dict(level="A2+", levelAr="أساسي متقدم", icon="truck-fast-outline", color="#DB9A2E", dark="#B0781A", soft="#FAECD0"),
    dict(level="B1", levelAr="متوسط", icon="handshake-outline", color="#D96C86", dark="#B34C66", soft="#FADFE6"),
    dict(level="B1", levelAr="متوسط", icon="chess-knight", color="#526DB2", dark="#3B538F", soft="#DEE5F6"),
    dict(level="B1+", levelAr="فوق المتوسط", icon="food-apple-outline", color="#27A397", dark="#197E74", soft="#D5F1EE"),
    dict(level="B2", levelAr="متقدم", icon="crown-outline", color="#C9674A", dark="#A04C33", soft="#F8E0D8"),
]
LESSON_ICONS = [
    "hand-wave", "phone-in-talk", "currency-usd", "calendar-clock", "comment-question", "storefront",
    "book-open-variant", "peanut", "calendar-alert", "magnify-scan", "package-variant", "fruit-grapes",
    "file-document-outline", "counter", "sale", "scale-balance", "credit-card-outline", "check-decagram",
    "factory", "shipping-pallet", "truck-delivery", "file-document-multiple", "thermometer", "map-marker-check",
    "package-variant-closed-remove", "cash-refund", "tag-heart", "handshake", "account-group", "email-edit",
    "swap-horizontal-bold", "hand-back-left", "chart-line", "file-search", "arrow-up-bold-circle", "trophy",
    "candy", "label", "clipboard-check", "snowflake-thermometer", "barcode-scan", "chart-bell-curve",
    "calculator-variant", "compare-horizontal", "shield-check", "earth", "palette", "file-sign",
]


def sha(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest() + ".mp3"


def parse_course():
    units, lessons = [], []
    for raw in open(os.path.join(SRC, "course.txt"), encoding="utf-8"):
        line = raw.strip()
        if not line:
            continue
        if line.startswith("# "):
            i, title, tag, goal = line[2:].split("|")
            units.append(dict(id=int(i), title=title, tag=tag, goal=goal, **UNIT_META[int(i)]))
        elif line.startswith("@ "):
            u, title, goal = line[2:].split("|")
            lessons.append(dict(id=len(lessons), unit=int(u), title=title, goal=goal,
                                icon=LESSON_ICONS[len(lessons)], phrases=[]))
        else:
            en, ar = line.split("|")
            lesson = lessons[-1]
            pid = "p%03d" % (lesson["id"] * 6 + len(lesson["phrases"]))
            lesson["phrases"].append(dict(id=pid, en=en, ar=ar))
    assert len(units) == 8 and len(lessons) == 48 and all(len(l["phrases"]) == 6 for l in lessons)
    return units, lessons


def parse_scenarios():
    text = open(os.path.join(SRC, "Scenarios.cs"), encoding="utf-8").read()
    pat = re.compile(r'new Situation\("([^"]*)","([^"]*)",new\[\]\{"([^"]*)","([^"]*)","([^"]*)"\},(\d),"([^"]*)"\)')
    found = pat.findall(text)
    assert len(found) == 24, len(found)
    out = []
    for i, (ctx, supplier, a, b, c, correct, why) in enumerate(found):
        out.append(dict(id="s%02d" % i, unit=i // 3, context=ctx, supplier=supplier,
                        choices=[a, b, c], correct=int(correct), why=why))
    return out


def check_icons(names):
    glyphs = json.load(open(os.path.join(APP, "node_modules", "@expo", "vector-icons", "build", "vendor",
                                         "react-native-vector-icons", "glyphmaps",
                                         "MaterialCommunityIcons.json"), encoding="utf-8"))
    missing = [n for n in names if n not in glyphs]
    assert not missing, "unknown MaterialCommunityIcons: %s" % missing


def ffmpeg(args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error"] + args, check=True)


def convert(job):
    src, dst = job
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return
    ffmpeg(["-i", src, "-ac", "1", "-ar", "44100", "-b:a", "64k", "-map_metadata", "-1", dst])


def tone_chain(notes, volume):
    """notes: [(freq, seconds)] -> ffmpeg args for a soft chime made of consecutive sine notes."""
    args, parts = [], []
    for i, (f, d) in enumerate(notes):
        args += ["-f", "lavfi", "-i", "sine=f=%s:d=%s:r=44100" % (f, d)]
        parts.append("[%d]afade=t=in:st=0:d=0.008,afade=t=out:st=%.3f:d=%.3f[n%d]" % (i, d * 0.35, d * 0.65, i))
    chain = ";".join(parts) + ";" + "".join("[n%d]" % i for i in range(len(notes)))
    chain += "concat=n=%d:v=0:a=1,volume=%s" % (len(notes), volume)
    return args + ["-filter_complex", chain, "-ac", "1", "-b:a", "96k"]


def build_sfx():
    out = os.path.join(APP, "assets", "sfx")
    os.makedirs(out, exist_ok=True)
    sounds = {
        "correct": ([(880, 0.10), (1318.5, 0.26)], 0.45),
        "wrong": ([(311.1, 0.12), (233.1, 0.28)], 0.5),
        "complete": ([(523.25, 0.11), (659.25, 0.11), (783.99, 0.11), (1046.5, 0.45)], 0.45),
        "tap": ([(1244.5, 0.035)], 0.22),
        "start": ([(659.25, 0.07), (987.77, 0.16)], 0.35),
    }
    for name, (notes, volume) in sounds.items():
        ffmpeg(tone_chain(notes, volume) + [os.path.join(out, name + ".mp3")])


def main():
    units, lessons = parse_course()
    scenarios = parse_scenarios()
    check_icons([u["icon"] for u in units] + LESSON_ICONS)

    enrich_path = os.path.join(APP, "src", "data", "enrich.json")
    enrich = json.load(open(enrich_path, encoding="utf-8")) if os.path.exists(enrich_path) else {}
    for item in enrich.get("lessons", []):
        lessons[item["id"]]["tip"] = item["tip"]
        lessons[item["id"]]["keywords"] = item["keywords"]
    sent_ar = enrich.get("sentencesAr", {})
    for s in scenarios:
        s["supplierAr"] = sent_ar.get(s["supplier"], "")
        s["choicesAr"] = [sent_ar.get(c, "") for c in s["choices"]]

    # id -> spoken English text (phrases + supplier lines); every one must be in the manifest
    spoken = {p["id"]: p["en"] for l in lessons for p in l["phrases"]}
    spoken.update({s["id"]: s["supplier"] for s in scenarios})
    manifest = {i["text"] for i in json.load(open(os.path.join(SRC, "audio-manifest.json"), encoding="utf-8"))["items"]}
    assert all(t in manifest for t in spoken.values())

    jobs, have = [], {}
    for vid, folder, _, _ in VOICES:
        os.makedirs(os.path.join(APP, "assets", "audio", vid), exist_ok=True)
        have[vid] = []
        for cid, text in spoken.items():
            src = os.path.join(AUDIO_SRC, folder, sha(text))
            if os.path.exists(src):
                have[vid].append(cid)
                jobs.append((src, os.path.join(APP, "assets", "audio", vid, cid + ".mp3")))

    if not SKIP_AUDIO:
        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(convert, jobs))
        build_sfx()

    data_dir = os.path.join(APP, "src", "data")
    os.makedirs(data_dir, exist_ok=True)
    course = dict(
        units=units, lessons=lessons, scenarios=scenarios,
        voices=[dict(id=v, name=n, note=t, clips=len(have[v])) for v, _, n, t in VOICES],
        glossary=enrich.get("glossary", {}),
    )
    with open(os.path.join(data_dir, "course.json"), "w", encoding="utf-8") as f:
        json.dump(course, f, ensure_ascii=False, separators=(",", ":"))

    with open(os.path.join(data_dir, "audioMap.ts"), "w", encoding="utf-8") as f:
        f.write("// GENERATED by scripts/build_content.py — do not edit.\n")
        f.write("export const AUDIO: Record<string, Record<string, number>> = {\n")
        for vid, _, _, _ in VOICES:
            f.write("  %s: {\n" % vid)
            for cid in have[vid]:
                f.write("    %s: require('../../assets/audio/%s/%s.mp3'),\n" % (cid, vid, cid))
            f.write("  },\n")
        f.write("};\n")

    total = sum(len(v) for v in have.values())
    print("units %d, lessons %d, phrases %d, scenarios %d" % (len(units), len(lessons), len(lessons) * 6, len(scenarios)))
    print("audio clips %d across %d voices; glossary %d words; tips %d" % (
        total, len(VOICES), len(course["glossary"]), sum(1 for l in lessons if l.get("tip"))))


if __name__ == "__main__":
    main()
