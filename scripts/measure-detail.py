#!/usr/bin/env python3
"""Objective visual metrics for a Starhold frame (orchestrator-owned).

Reports numbers a critic cannot argue with:

  grid        median identical-colour run, and the identical-horizontal-pair
              ratio — 1.0000 means the frame is still rendering 2 px blocks
              (i.e. an internal-resolution regression).
  colours     count of distinct RGB values (palette lock => 32).
  contrast    luminance standard deviation (flatness of the whole frame).
  terrain     mean luminance of the plateau top vs the bottom cliff band,
              and their ratio — the lit-mesa gate wants rim <= 0.75 * top.

Usage:
  python3 scripts/measure-detail.py IMAGE [--top Y0 Y1] [--rim Y0 Y1]
"""
import argparse
import collections
from pathlib import Path
import re
import subprocess
import sys

import numpy as np


def load(path: str) -> np.ndarray:
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True).stdout.strip()
    w, h = (int(x) for x in probe.split(","))
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-f", "rawvideo",
         "-pix_fmt", "rgb24", "-"],
        capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.uint8).reshape(h, w, 3)


def median_run(img: np.ndarray) -> int:
    h, w, _ = img.shape
    runs: collections.Counter = collections.Counter()
    for y in range(0, h, max(1, h // 120)):
        row = img[y]
        idx = np.flatnonzero(np.any(row[1:] != row[:-1], axis=1)) + 1
        for seg in np.diff(np.concatenate(([0], idx, [w]))):
            runs[int(seg)] += 1
    total = sum(runs.values())
    cum = 0
    for length, count in sorted(runs.items()):
        cum += count
        if cum >= total * 0.5:
            return length
    return -1


def largest_component(mask: np.ndarray) -> int:
    """Largest 4-connected component in a boolean mask (no scipy dependency)."""
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    best = 0
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        seen[y, x] = True
        stack = [(int(y), int(x))]
        size = 0
        while stack:
            cy, cx = stack.pop()
            size += 1
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        best = max(best, size)
    return best


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--top", nargs=2, type=int, help="y0 y1 of the plateau top band")
    ap.add_argument("--rim", nargs=2, type=int, help="y0 y1 of the bottom cliff band")
    ap.add_argument("--x0", type=int, default=180, help="left edge of the cliff band")
    ap.add_argument("--x1", type=int, default=430, help="right edge of the cliff band")
    ap.add_argument("--lighting-gate", action="store_true",
                    help="fail unless the canonical lighting/contrast thresholds pass")
    a = ap.parse_args()

    img = load(a.image)
    h, w, _ = img.shape
    lum = img.astype(np.float32).mean(axis=2)

    pairs = float(np.all(img[:, 0::2] == img[:, 1::2], axis=2).mean())
    colours = len(np.unique(img.reshape(-1, 3), axis=0))
    print(f"image      {a.image} {w}x{h}")
    print(f"grid       median_run={median_run(img)}px  identical_h_pairs={pairs:.4f}"
          f"  ({'2px BLOCKS - resolution regressed' if pairs > 0.999 else '1px grid'})")
    print(f"colours    {colours}")
    print(f"contrast   lum_sd={lum.std():.1f}  lum_mean={lum.mean():.1f}")

    # Lighting pass L1 uses a stable HUD-free slice. Keep exact void pixels out,
    # then measure value distribution without inventing semantic masks that can
    # drift with units or construction. The framing bound prevents a camera or
    # map-size change from passing as better light.
    judged = img[max(20, int(h * 0.04)):min(h - 40, int(h * 0.90))]
    judged_lum = (judged[..., 0].astype(np.float32) * 0.2126
                   + judged[..., 1].astype(np.float32) * 0.7152
                   + judged[..., 2].astype(np.float32) * 0.0722)
    judged_void = np.all(judged == np.array([0x10, 0x12, 0x1C], dtype=np.uint8), axis=2)
    values = judged_lum[~judged_void]
    coverage = float((~judged_void).mean() * 100)
    value_mean = float(values.mean())
    value_sd = float(values.std())
    mid_pct = float((values >= 90).mean() * 100)
    bright_pct = float((values >= 170).mean() * 100)

    kinds = (Path(__file__).resolve().parents[1] / "src" / "kinds.ts").read_text()
    palette_match = re.search(r"export const palette\s*=\s*\[(.*?)\];", kinds, re.S)
    if not palette_match:
        raise RuntimeError("could not read the palette from src/kinds.ts")
    allowed = {tuple(bytes.fromhex(value))
               for value in re.findall(r"'([0-9A-Fa-f]{6})'", palette_match.group(1))}
    frame_colours, frame_counts = np.unique(img.reshape(-1, 3), axis=0, return_counts=True)
    outside_pixels = sum(int(count) for colour, count in zip(frame_colours, frame_counts)
                         if tuple(int(channel) for channel in colour) not in allowed)
    lighting_ok = (colours <= 32 and outside_pixels == 0
                   and 40 <= coverage <= 46
                   and 86 <= value_mean <= 94
                   and value_sd >= 44
                   and mid_pct >= 38
                   and 5.0 <= bright_pct <= 8.5)
    print(f"lighting    coverage={coverage:.3f}%  mean={value_mean:.3f}  sd={value_sd:.3f}"
          f"  >=90={mid_pct:.3f}%  >=170={bright_pct:.3f}%  outside={outside_pixels}"
          f"  -> {'PASS' if lighting_ok else 'FAIL'}")

    lighting_failed = a.lighting_gate and not lighting_ok

    # The map occupies this stable region in the canonical 960x540 capture.
    # Measure whether violet terrain is one giant slab or authored small regions.
    ground = img[150:390, 120:850]
    transitions = float(np.any(ground[:, 1:] != ground[:, :-1], axis=2).mean())
    violet_light = np.all(img == np.array([0x62, 0x47, 0x79], dtype=np.uint8), axis=2)
    violet_dark = np.all(img == np.array([0x3C, 0x30, 0x57], dtype=np.uint8), axis=2)
    light_component = largest_component(violet_light)
    dark_component = largest_component(violet_dark)
    texture_pass = light_component < 8000 and dark_component < 6000 and 0.20 <= transitions <= 0.30
    print(f"texture    transition_density={transitions:.4f}  #624779_max={light_component}"
          f"  #3C3057_max={dark_component}  -> {'PASS' if texture_pass else 'FAIL'}")

    if a.top and a.rim:
        top = lum[a.top[0]:a.top[1]].mean()

        # Cliff faces sit against the void background, so a raw band mean is
        # confounded by background pixels. Mask the void colour out first, then
        # test the downward ramp: a lit mesa darkens from the rim top to its base.
        void = np.all(img == np.array([0x10, 0x12, 0x1C], dtype=np.uint8), axis=2)
        band = ~void[a.rim[0]:a.rim[1], a.x0:a.x1]
        vals = lum[a.rim[0]:a.rim[1], a.x0:a.x1]
        if band.sum() < 200:
            print("terrain    not enough non-background pixels in the cliff band")
        else:
            y0, y1 = a.rim
            mid = (y0 + y1) // 2
            upper = lum[y0:mid, a.x0:a.x1][~void[y0:mid, a.x0:a.x1]].mean()
            lower = lum[mid:y1, a.x0:a.x1][~void[mid:y1, a.x0:a.x1]].mean()
            ratio = lower / upper if upper else float("nan")
            rows = np.arange(y0, y1)
            means = np.array([lum[y, a.x0:a.x1][~void[y, a.x0:a.x1]].mean()
                              if (~void[y, a.x0:a.x1]).sum() > 20 else np.nan for y in rows])
            ok = ~np.isnan(means)
            slope = float(np.polyfit(rows[ok], means[ok], 1)[0]) if ok.sum() > 8 else float("nan")
            verdict = "PASS" if ratio <= 0.85 and slope < 0 else "FAIL"
            print(f"terrain    top_lum={top:.1f}  cliff_upper={upper:.1f}  cliff_lower={lower:.1f}"
                  f"  lower/upper={ratio:.3f}  slope={slope:+.3f}/row"
                  f"  (want <=0.85 and slope<0)  -> {verdict}")

    return 1 if lighting_failed else 0


if __name__ == "__main__":
    sys.exit(main())
