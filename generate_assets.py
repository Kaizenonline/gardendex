"""
generate_assets.py  —  GardenDex static image assets
Produces three files inside ./public/:
    og-preview.png   1200 × 630   social share card
    icon-192.png      192 × 192   PWA icon (small)
    icon-512.png      512 × 512   PWA icon (large)
"""

from __future__ import annotations
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ── Output directory ──────────────────────────────────────────────────────────
OUT = Path(__file__).parent / "public"
OUT.mkdir(exist_ok=True)

# ── Brand palette ─────────────────────────────────────────────────────────────
BG_DARK    = "#0a140a"   # very dark forest
FOREST     = "#2e7d32"   # rich green — borders / glow
FOREST_MID = "#388e3c"   # slightly lighter
FOREST_LT  = "#4caf50"   # mid green
ACCENT     = "#66bb6a"   # tagline / highlight green
WHITE      = "#ffffff"
OFF_WHITE  = "#e8f5e9"   # faint green-white

def rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[:2], 16), int(h[2:4], 16), int(h[4:6], 16)

def rgba(h: str, a: int) -> tuple[int, int, int, int]:
    return (*rgb(h), a)


# ── Font loaders ──────────────────────────────────────────────────────────────
def font_bold(size: int) -> ImageFont.FreeTypeFont:
    for name in ("arialbd.ttf", "Arial Bold.ttf", "calibrib.ttf", "DejaVuSans-Bold.ttf"):
        try: return ImageFont.truetype(name, size)
        except OSError: pass
    return ImageFont.load_default()

def font_reg(size: int) -> ImageFont.FreeTypeFont:
    for name in ("arial.ttf", "Arial.ttf", "calibri.ttf", "DejaVuSans.ttf"):
        try: return ImageFont.truetype(name, size)
        except OSError: pass
    return ImageFont.load_default()

def font_emoji(size: int) -> ImageFont.FreeTypeFont:
    # seguiemj.ttf ships with Windows and supports full-colour emoji
    for name in ("seguiemj.ttf", "NotoColorEmoji.ttf", "AppleColorEmoji.ttc"):
        try: return ImageFont.truetype(name, size)
        except OSError: pass
    return ImageFont.load_default()


# ── Drawing helpers ───────────────────────────────────────────────────────────

def centered_text(draw: ImageDraw.ImageDraw, text: str, y: int,
                  font: ImageFont.FreeTypeFont, fill: str,
                  canvas_w: int, emoji: bool = False) -> None:
    """Draw text horizontally centred on a canvas of width canvas_w."""
    bb = draw.textbbox((0, 0), text, font=font,
                       embedded_color=emoji)
    x  = (canvas_w - (bb[2] - bb[0])) // 2 - bb[0]
    draw.text((x, y), text, font=font, fill=fill,
              embedded_color=emoji)


def draw_emoji(draw: ImageDraw.ImageDraw, glyph: str,
               cx: int, cy: int, size: int) -> None:
    """Draw a single emoji centred at (cx, cy)."""
    fe   = font_emoji(size)
    bb   = draw.textbbox((0, 0), glyph, font=fe, embedded_color=True)
    x    = cx - (bb[2] - bb[0]) // 2 - bb[0]
    y    = cy - (bb[3] - bb[1]) // 2 - bb[1]
    draw.text((x, y), glyph, font=fe, fill="white", embedded_color=True)


def inner_glow(img: Image.Image, color: str, thickness: int = 22,
               blur: int = 18) -> Image.Image:
    """Paint a soft inner glow along the edges of img (in-place, returns img)."""
    w, h  = img.size
    glow  = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd    = ImageDraw.Draw(glow)
    r, g, b = rgb(color)
    # multiple concentric rectangles fading outward → blurred = soft inner rim
    steps = 6
    for i in range(steps):
        alpha = int(180 * (1 - i / steps) ** 1.6)
        inset = i * (thickness // steps)
        gd.rectangle([inset, inset, w - 1 - inset, h - 1 - inset],
                     outline=(r, g, b, alpha), width=2)
    glow  = glow.filter(ImageFilter.GaussianBlur(blur))
    base  = img.convert("RGBA")
    base  = Image.alpha_composite(base, glow)
    return base.convert("RGB")


def draw_corner_emoji(draw: ImageDraw.ImageDraw,
                      glyphs_and_positions: list[tuple[str, int, int]],
                      size: int) -> None:
    for glyph, cx, cy in glyphs_and_positions:
        draw_emoji(draw, glyph, cx, cy, size)


def radial_vignette(img: Image.Image, strength: float = 0.55) -> Image.Image:
    """Darken the corners with a subtle radial vignette."""
    w, h = img.size
    vig  = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    vd   = ImageDraw.Draw(vig)
    cx, cy = w // 2, h // 2
    max_r  = math.hypot(cx, cy)
    steps  = 12
    for i in range(steps, 0, -1):
        r     = int(max_r * i / steps)
        alpha = int(strength * 255 * (1 - (i / steps) ** 1.5))
        vd.ellipse([cx - r, cy - r, cx + r, cy + r],
                   fill=(0, 0, 0, alpha))
    vig  = vig.filter(ImageFilter.GaussianBlur(max_r // 4))
    base = img.convert("RGBA")
    return Image.alpha_composite(base, vig).convert("RGB")


# ── 1. og-preview.png  1200 × 630 ────────────────────────────────────────────

def make_og() -> None:
    W, H = 1200, 630
    img  = Image.new("RGB", (W, H), rgb(BG_DARK))
    draw = ImageDraw.Draw(img)

    # ── subtle background texture: faint concentric rings ──
    for r in range(60, 420, 55):
        alpha = max(8, 28 - r // 22)
        ring  = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        rd    = ImageDraw.Draw(ring)
        rd.ellipse([W//2 - r, H//2 - r, W//2 + r, H//2 + r],
                   outline=(*rgb(FOREST), alpha), width=1)
        img.paste(Image.new("RGB", (W, H), rgb(BG_DARK)),
                  mask=Image.new("L", (W, H), 0))
        img = Image.alpha_composite(img.convert("RGBA"), ring).convert("RGB")

    draw = ImageDraw.Draw(img)

    # ── corner decorations (small emoji, semi-transparent via alpha paste) ──
    corner_size = 52
    corners = [
        ("🌱",  78,   70),
        ("🍃", W-78,  70),
        ("🌿",  78,  H-70),
        ("🍃", W-78, H-70),
    ]
    draw_corner_emoji(draw, corners, corner_size)

    # ── main plant emoji ──
    draw_emoji(draw, "🌿", W // 2, 188, 180)

    # ── app name ──
    f_title = font_bold(92)
    centered_text(draw, "GardenDex", 340, f_title, WHITE, W)

    # ── tagline ──
    f_tag = font_reg(34)
    centered_text(draw, "AI Plant Collection & Garden Tracker", 454, f_tag, ACCENT, W)

    # ── inner glow border ──
    img = inner_glow(img, FOREST, thickness=28, blur=22)

    # ── thin solid border on top ──
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, W-1, H-1], outline=rgb(FOREST_MID), width=3)

    # ── vignette ──
    img = radial_vignette(img, strength=0.30)

    path = OUT / "og-preview.png"
    img.save(path, "PNG", optimize=True)
    print(f"[ok] {path}  ({W}x{H})")


# ── 2 & 3.  PWA icons  192×192 and 512×512 ───────────────────────────────────

def make_icon(size: int) -> None:
    W = H = size
    img  = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # ── rounded-rectangle background ──
    radius = size // 5          # iOS-style corner radius ≈ 20 % of width
    draw.rounded_rectangle(
        [0, 0, W - 1, H - 1],
        radius=radius,
        fill=rgb(FOREST),
    )

    # ── subtle inner highlight ring ──
    inset = size // 22
    ring  = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rd    = ImageDraw.Draw(ring)
    rd.rounded_rectangle(
        [inset, inset, W - 1 - inset, H - 1 - inset],
        radius=max(4, radius - inset),
        outline=(*rgb(FOREST_LT), 80),
        width=max(2, size // 80),
    )
    ring  = ring.filter(ImageFilter.GaussianBlur(max(1, size // 80)))
    img   = Image.alpha_composite(img, ring)

    # ── darker inner area for depth ──
    inner_margin = size // 10
    inner = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    id_   = ImageDraw.Draw(inner)
    id_.rounded_rectangle(
        [inner_margin, inner_margin, W - inner_margin, H - inner_margin],
        radius=max(4, radius - inner_margin),
        fill=(*rgb(FOREST_MID), 80),
    )
    inner = inner.filter(ImageFilter.GaussianBlur(size // 30))
    img   = Image.alpha_composite(img, inner)

    # ── centred plant emoji ──
    draw2 = ImageDraw.Draw(img)
    emoji_size = int(size * 0.58)
    draw_emoji(draw2, "🌿", W // 2, H // 2, emoji_size)

    # ── apply rounded mask so corners are transparent (proper app icon) ──
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, W - 1, H - 1], radius=radius, fill=255
    )
    img.putalpha(mask)

    name = f"icon-{size}.png"
    path = OUT / name
    img.save(path, "PNG", optimize=True)
    print(f"[ok] {path}  ({W}x{H})")


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"\nGardenDex — generating assets into {OUT}\n")
    make_og()
    make_icon(192)
    make_icon(512)
    print("\nDone.")
