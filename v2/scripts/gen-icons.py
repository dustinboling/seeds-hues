#!/usr/bin/env python3
"""Generate the Seed Directory icon set from the Option B two-cut masters.

Sources of truth — two full-tile 1024x1024 paintings on the catalogue paper
colour #F8F1E1 ("Three Seeds & a Sprout", Elena, owner pick 2026-11-22):

  public/brand/sown-seeds-touch.png    TOUCH cut (192/512/apple-touch/maskable)
  public/brand/sown-seeds-favicon.png  FAVICON cut (favicon.ico + SVG favicon)

Each master is a complete painting on its paper ground, not a transparent
mark — so the generator downscales whole tiles instead of compositing a mark
onto paper. The tile is part of the icon: the artwork ships only on its paper
tile, never bare (SPEC P1). No typography or lettering appears on the icon
(owner rule).

  any-purpose / apple-touch : direct Lanczos downscale of the whole TOUCH tile
  favicon source (64px)     : direct Lanczos downscale of the whole FAVICON tile
  maskable                  : whole TOUCH tile fitted onto a full-bleed paper
                              (#F8F1E1) canvas at 0.62 of canvas width, keeping
                              the measured subject radius at r = 0.31 of
                              canvas — inside the 0.40 safe-zone circle
                              (SPEC section 4 P4)

Outputs (same `hues-` filenames, referenced by app/layout.tsx,
app/manifest.ts and scripts/sw.template.js — no reference changes needed):

  public/icons/hues-icon-192.png          PWA any-purpose
  public/icons/hues-icon-512.png          PWA any-purpose
  public/icons/hues-icon-maskable-512.png PWA maskable (safe-zone padding)
  public/icons/hues-apple-touch-icon.png  iOS home screen, 180x180, fully opaque
  public/icons/hues-icon.svg              SVG favicon wrapping the 64px PNG
  public/favicon.ico                      16/32/48 multi-size

Run via `npm run icons` (scripts/gen-icons.ts shells out to this file).
Requires Pillow. Option B replaced the poppy pod mark as the site icon on
2026-11-22 (owner direction: the redo mark is custom, in gouache, the site's
painted medium). The Hues logo in the header/footer and the Hues brand mark
in account emails are unaffected.
"""
import base64
import io
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
TOUCH = os.path.join(ROOT, "public", "brand", "sown-seeds-touch.png")
FAVICON = os.path.join(ROOT, "public", "brand", "sown-seeds-favicon.png")
ICONS = os.path.join(ROOT, "public", "icons")
PAPER = (248, 241, 225)  # #F8F1E1
MASKABLE_FRAC = 0.62


def downscale(tile: Image.Image, size: int) -> Image.Image:
    return tile.resize((size, size), Image.LANCZOS).convert("RGB")


def maskable(tile: Image.Image, size: int = 512) -> Image.Image:
    canvas = Image.new("RGB", (size, size), PAPER)
    t = round(size * MASKABLE_FRAC)
    small = tile.resize((t, t), Image.LANCZOS).convert("RGB")
    canvas.paste(small, ((size - t) // 2, (size - t) // 2))
    return canvas


def main() -> None:
    touch = Image.open(TOUCH).convert("RGB")
    favicon = Image.open(FAVICON).convert("RGB")
    os.makedirs(ICONS, exist_ok=True)
    downscale(touch, 192).save(os.path.join(ICONS, "hues-icon-192.png"))
    downscale(touch, 512).save(os.path.join(ICONS, "hues-icon-512.png"))
    maskable(touch).save(os.path.join(ICONS, "hues-icon-maskable-512.png"))
    downscale(touch, 180).save(os.path.join(ICONS, "hues-apple-touch-icon.png"))
    small = downscale(favicon, 64)
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
