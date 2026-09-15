#!/usr/bin/env python3
"""iconize.py — slice a concept sheet into palette-locked HUD icons.

Usage:
  python3 scripts/iconize.py --sheet art/concept/dawnward-roster.png \
      --cols 5 --rows 3 --kinds 10,11,12,15,13,14,16,17,20,21,22,23,24,25,26 \
      --out art/icons --size 24

Each source cell is cropped, box-downscaled to --size, then quantised to the
32-colour palette in src/kinds.ts. Output: <out>/<kind>.png, plus a contact
sheet <out>/_contact.png for review. No new colours are ever introduced.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KINDS_TS = ROOT / "src" / "kinds.ts"


def palette() -> list[tuple[int, int, int]]:
    text = KINDS_TS.read_text()
    body = re.search(r"export const palette\s*=\s*\[(.*?)\];", text, re.S).group(1)
    hexes = re.findall(r"'([0-9A-Fa-f]{6})'", body)
    return [tuple(bytes.fromhex(h)) for h in hexes]


def magick(*args: str) -> None:
    result = subprocess.run(["magick", *args], capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f"magick failed: {' '.join(args)}\n{result.stderr}")


def build_colormap(pal: list[tuple[int, int, int]], path: Path) -> None:
    pixels = "".join(f"<rect x='{i}' y='0' width='1' height='1' fill='#{r:02X}{g:02X}{b:02X}'/>" for i, (r, g, b) in enumerate(pal))
    svg = f"<svg xmlns='http://www.w3.org/2000/svg' width='{len(pal)}' height='1'>{pixels}</svg>"
    tmp = path.with_suffix(".svg")
    tmp.write_text(svg)
    magick(str(tmp), "-colorspace", "sRGB", str(path))
    tmp.unlink()
    # A 1-pixel-tall remap image would drop the rest of the destination, so the
    # caller tiles it vertically before use.


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet", required=True)
    ap.add_argument("--cols", type=int, required=True)
    ap.add_argument("--rows", type=int, required=True)
    ap.add_argument("--kinds", required=True, help="comma list, row-major order")
    ap.add_argument("--out", required=True)
    ap.add_argument("--size", type=int, default=24)
    ap.add_argument("--inset", type=float, default=0.08, help="fraction of cell to trim")
    args = ap.parse_args()

    kinds = [int(k) for k in args.kinds.split(",") if k.strip()]
    sheet = Path(args.sheet)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    if len(kinds) > args.cols * args.rows:
        raise SystemExit("more kinds than cells")

    pal = palette()
    cell_w = sheet_width = None

    # Cell geometry from the sheet.
    info = subprocess.run(
        ["magick", "identify", "-format", "%w %h", str(sheet)],
        capture_output=True, text=True, check=True).stdout.split()
    sheet_width, sheet_height = int(info[0]), int(info[1])
    cell_w = sheet_width // args.cols
    cell_h = sheet_height // args.rows
    ix = int(cell_w * args.inset)
    iy = int(cell_h * args.inset)

    colormap = out / "_colormap.png"
    build_colormap(pal, colormap)

    made = []
    for index, kind in enumerate(kinds):
        col = index % args.cols
        row = index // args.cols
        x = col * cell_w + ix
        y = row * cell_h + iy
        w = cell_w - 2 * ix
        h = cell_h - 2 * iy
        target = out / f"{kind}.png"
        magick(
            str(sheet), "-crop", f"{w}x{h}+{x}+{y}", "+repage",
            "-resize", f"{args.size}x{args.size}!",
            "-filter", "point", "-resize", f"{args.size}x{args.size}!",
            "-dither", "None", "-remap", str(colormap),
            str(target))
        made.append(target)

    if made:
        magick(*[str(p) for p in made], "+append", "-scale", "400%", str(out / "_contact.png"))
    colormap.unlink(missing_ok=True)
    print(json.dumps({"icons": [str(p) for p in made], "contact": str(out / "_contact.png")}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
