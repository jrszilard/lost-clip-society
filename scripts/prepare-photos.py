#!/usr/bin/env python3
"""
prepare-photos.py — crop & grade the workshop evidence photos for the site.

Sources live in the (private) 3d-car-parts-maker repo — real photos of the OEM
sun-visor clip taken for photogrammetry testing (2026-07-15). This script crops
them 4:3, applies a light warm grade (brochure stock), and writes sized JPEGs
into public/images/. Renders (public/images/parts/*.png) are converted to JPEG
in place.

Usage:  python3 scripts/prepare-photos.py
"""
from pathlib import Path
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
SRC = (ROOT.parent / "3d-car-parts-maker" / "parts" / "interior" / "sun-visor-clip"
       / "3d-picture-test" / "Download 2026-07-15T02-26-53-559Z")
OUT = ROOT / "public" / "images"

# (source file, destination, crop box L,T,R,B on the 3072x4080 original)
CROPS = [
    # hero "measured" — original clip standing in profile, caliper rule in front
    ("PXL_20260715_022325453.jpg", OUT / "hero" / "measured.jpg",  (0, 204, 3072, 2508)),
    # filmstrip 01 "the original" — close on the part, caliper scale across frame
    ("PXL_20260715_022238131.jpg", OUT / "process" / "original.jpg", (336, 500, 2736, 2300)),
    # filmstrip 02 "the measurement" — caliper jaw + bench ruler, part in bokeh
    ("PXL_20260715_022030934.jpg", OUT / "process" / "measurement.jpg", (0, 550, 3072, 2854)),
]

TARGET_W = 1280  # 1280x960 out — 2x for ~640px display slots


def warm_grade(im: Image.Image) -> Image.Image:
    """Subtle brochure warmth — the scene stays honest, just printed on warmer stock."""
    im = ImageEnhance.Color(im).enhance(1.07)
    im = ImageEnhance.Contrast(im).enhance(1.04)
    warm = Image.new("RGB", im.size, (18, 9, 0))
    return Image.blend(im, Image.composite(warm, im, im.convert("L").point(lambda v: 38)), 0.5)


for name, dest, box in CROPS:
    im = Image.open(SRC / name).convert("RGB").crop(box)
    w, h = im.size
    im = im.resize((TARGET_W, round(TARGET_W * h / w)), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    warm_grade(im).save(dest, "JPEG", quality=84, progressive=True, optimize=True)
    print(f"wrote {dest.relative_to(ROOT)}  {im.size[0]}x{im.size[1]}")

for png in (OUT / "parts").glob("*.png"):
    im = Image.open(png).convert("RGB")
    jpg = png.with_suffix(".jpg")
    im.save(jpg, "JPEG", quality=86, progressive=True, optimize=True)
    png.unlink()
    print(f"wrote {jpg.relative_to(ROOT)}  (png removed)")
