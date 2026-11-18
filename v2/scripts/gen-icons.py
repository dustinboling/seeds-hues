#!/usr/bin/env python3
"""Generate the Seed Directory icon set from the poppy pod mark.

Source of truth: public/brand/poppy-pod-mark.png — the ripe breadseed poppy
pod (plump pale capsule, flat golden rayed crown, pore-dot ring, bristly
stem), extracted transparent from the owner-approved photo-referenced
painting (pod-ornaments-real/icon-poppy-pod.png). The painting itself is
unaltered; no typography or lettering appears on the icon (owner rule).

Every icon is the mark centred on the catalogue paper colour #F8F1E1. The
mark is tall (585x1031), so it is fitted by its LONGEST side with aspect
preserved — never stretched:

  any-purpose / apple-touch : longest side = 0.80 of canvas
  favicon source (64px)     : longest side = 0.84 of canvas
  maskable                  : longest side = 0.62 of canvas, which keeps the
                              whole pod's bounding circle at r = 0.36 of
                              canvas — inside the 0.40 safe-zone circle

Outputs (same `hues-` filenames, referenced by app/layout.tsx,
app/manifest.ts and scripts/sw.template.js — no reference changes needed):

  public/icons/hues-icon-192.png          PWA any-purpose
  public/icons/hues-icon-512.png          PWA any-purpose
  public/icons/hues-icon-maskable-512.png PWA maskable (safe-zone padding)
  public/icons/hues-apple-touch-icon.png  iOS home screen, 180x180, fully opaque
  public/icons/hues-icon.svg              SVG favicon wrapping the 64px PNG
  public/favicon.ico                      16/32/48 multi-size

Run via `npm run icons` (scripts/gen-icons.ts shells out to this file).
Requires Pillow. The poppy pod replaced the Hues dahlia mark as the site
icon on 2026-11-17 (owner direction: the Directory's icons are custom, not
the dahlia). The Hues logo in the header/footer and the Hues brand mark in
account emails are unaffected.
"""
import base64
import io
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
MARK = os.path.join(ROOT, "public", "brand", "poppy-pod-mark.png")
ICONS = os.path.join(ROOT, "public", "icons")
PAPER = (248, 241, 225, 255)  # #F8F1E1


def compose(mark: Image.Image, size: int, longest_frac: float) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), PAPER)
    scale = (size * longest_frac) / max(mark.width, mark.height)
    tw = max(1, round(mark.width * scale))
    th = max(1, round(mark.height * scale))
    m = mark.resize((tw, th), Image.LANCZOS)
    canvas.alpha_composite(m, ((size - tw) // 2, (size - th) // 2))
    return canvas.convert("RGB")


def main() -> None:
    mark = Image.open(MARK).convert("RGBA")
    os.makedirs(ICONS, exist_ok=True)
    compose(mark, 192, 0.80).save(os.path.join(ICONS, "hues-icon-192.png"))
    compose(mark, 512, 0.80).save(os.path.join(ICONS, "hues-icon-512.png"))
    compose(mark, 512, 0.62).save(os.path.join(ICONS, "hues-icon-maskable-512.png"))
    compose(mark, 180, 0.80).save(os.path.join(ICONS, "hues-apple-touch-icon.png"))
    small = compose(mark, 64, 0.84)
    small.save(os.path.join(ROOT, "public", "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
    buf = io.BytesIO()
    small.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image href="data:image/png;base64,{b64}" width="64" height="64"/></svg>\n'
    with open(os.path.join(ICONS, "hues-icon.svg"), "w") as f:
        f.write(svg)
    print("icons written to public/icons/ (hues-* set) + public/favicon.ico")


if __name__ == "__main__":
    main()
