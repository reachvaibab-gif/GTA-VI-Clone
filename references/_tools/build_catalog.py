"""Rebuild references/catalog.js from the folders. Run: python3 references/_tools/build_catalog.py"""
import glob, json, os, re
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
REF = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(REF)


def thumb(f):
    t = "_thumbs/" + os.path.splitext(f)[0] + ".jpg"
    return t if os.path.exists(t) else f


def size(f):
    try:
        with Image.open(f) as im:
            return list(im.size)
    except Exception:
        return None


def pretty(s):
    s = re.sub(r"[_-]+", " ", s)
    s = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", s)
    return s.strip()


items = []


def add(section, group, f, title, **extra):
    items.append(dict(s=section, g=group, f=f, t=thumb(f), n=title, wh=size(f), **extra))


# Official Rockstar
ORDER = {"places": 0, "people": 1, "editions": 2, "key_art": 3}
for f in sorted(glob.glob("official_rockstar/**/*.*", recursive=True), key=lambda p: (ORDER[p.split("/")[1]], p)):
    parts = f.split("/")
    group = pretty(parts[2]) if parts[1] in ("places", "people") else pretty(parts[-2])
    kind = {"places": "Places", "people": "People", "editions": "Editions", "key_art": "Key art"}[parts[1]]
    add("official", f"{kind}: {group}" if kind in ("Places", "People", "Editions") else kind, f, pretty(os.path.splitext(parts[-1])[0]))

# Maps
labels = {
    "leonida_yanis-16_z4": "Yanis V16 community map, full, 10752px",
    "leonida_yanis-16_z3": "Yanis V16 community map, full, 5376px",
    "leonida_yanis-16_z2": "Yanis V16 community map with legend and frame index",
    "leonida_dupzor-51_z4": "Dupzor v0.051 map, full, 9984px",
    "leonida_dupzor-51_z3": "Dupzor v0.051 map, 5120px",
    "leonida_landmarks_annotated_z3": "All 2,716 gtadb landmarks plotted, labelled by ID",
    "leonida_yanis-16-aiwe-1-martipk-5-rickrick-3_z4": "Yanis V16 with detail overlays",
    "detail_rickrick-3_z6": "RickRick Vice City street map V3, 12800px",
    "detail_martipk-5_z6": "martipk V5 detail map",
    "detail_aiwe-1_z6": "aiwe V1 detail map",
    "GTA6Relief": "GTA VI relief (elevation)",
    "GTA456Relief": "GTA IV / V / VI relief size comparison",
    "LeonidaV15GainsAndLosses": "Leonida map V15 changes",
}
for f in sorted(glob.glob("maps/*.*")):
    b = os.path.splitext(os.path.basename(f))[0]
    add("maps", "Full maps", f, labels.get(b, pretty(b)))
for f in sorted(glob.glob("maps/areas_hires/*.jpg")):
    b = os.path.splitext(os.path.basename(f))[0]
    add("maps", "Area crops (1 px = 1 game unit)", f, pretty(re.sub(r"_z\d$", "", b)))

# Landmarks (gtadb), one card per landmark
rows = json.load(open("landmarks/landmarks_gta6.json"))
for r in rows:
    if not (r["ingame_photo"] or r["reallife_photo"]):
        continue
    main = r["ingame_photo"] or r["reallife_photo"]
    items.append(dict(
        s="landmarks", g=r["region"], f=main, t=thumb(main), n=r["ig_address"] or r["id"],
        wh=None, id=r["id"], rl=r["real_life"], tags=r["tags"],
        ig=r["ingame_photo"], igt=thumb(r["ingame_photo"]) if r["ingame_photo"] else "",
        rp=r["reallife_photo"], rpt=thumb(r["reallife_photo"]) if r["reallife_photo"] else "",
        xy=[round(r["game_x"]), round(r["game_y"])] if r["game_x"] is not None else None,
        ll=[r["real_lat"], r["real_lng"]] if r["real_lat"] is not None else None,
    ))

# Wiki
wiki_groups = {
    "trailer_frames/trailer1": ("trailers", "Trailer 1 (Dec 2023)"),
    "trailer_frames/trailer2": ("trailers", "Trailer 2 (May 2025)"),
    "vehicles": ("vehicles", "Vehicles"),
    "weapons": ("vehicles", "Weapons"),
    "details_buildings_brands_signs": ("details", "Buildings, brands, signs"),
    "characters": ("details", "Characters"),
    "artwork": ("details", "Artwork"),
}
for sub, (sec, grp) in wiki_groups.items():
    for f in sorted(glob.glob(f"wiki_gta6/{sub}/*.*")):
        if f.endswith(".mp4"):
            continue
        b = os.path.splitext(os.path.basename(f))[0]
        title = pretty(b.split("-GTAVI")[0])
        src = re.sub(r"^.*?-GTAVI-?", "", b)
        add(sec, grp, f, title, src=pretty(src))

# Screenshots from gtadb guessr and site banners
for f in sorted(glob.glob("screenshots/gtadb_guessr/*.jpg")):
    b = os.path.splitext(os.path.basename(f))[0]
    add("trailers", "gtadb guessr frames", f, pretty(b))
for f in sorted(glob.glob("gtadb_site/*.*")):
    add("details", "gtadb site images", f, pretty(os.path.splitext(os.path.basename(f))[0]))
for f in sorted(glob.glob("game_info/*.png")):
    add("details", "Palettes", f, "Colour palettes from official screenshots")

with open("catalog.js", "w") as fh:
    fh.write("window.CATALOG=")
    json.dump(items, fh, separators=(",", ":"), ensure_ascii=False)
    fh.write(";")
from collections import Counter
print(len(items), Counter(i["s"] for i in items))

with open("catalog.js", "a") as fh:
    fh.write("window.INFO_MD=")
    json.dump(open("game_info/GTA6_game_info.md").read(), fh, ensure_ascii=False)
    fh.write(";window.WIKI_LISTS=")
    json.dump(json.load(open("game_info/wiki_lists.json")), fh, ensure_ascii=False)
    fh.write(";")
