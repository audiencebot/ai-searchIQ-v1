"""Regenerate report-cover.png (800x1000) and og-image.png (1200x630) in the navy palette.

Composition mirrors the previous terracotta assets; colors per v2 palette:
navy #07161D / #0B1A21 / #10242D, icy #BDEAFF, signal #83D6FA,
editorial #3289AE, slate #344148, cloud #F8FBFC.
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont

S = 2  # supersample factor

NAVY = (7, 22, 29)
MIDNIGHT = (11, 26, 33)
ICY = (189, 234, 255)
SIGNAL = (131, 214, 250)
EDITORIAL = (50, 137, 174)
SLATE = (52, 65, 72)
CLOUD = (248, 251, 252)

NOTO = "/usr/share/fonts/truetype/noto/"
F_THIN = NOTO + "NotoSans-Thin.ttf"
F_LIGHT = NOTO + "NotoSans-Light.ttf"


def font(path, size):
    return ImageFont.truetype(path, size * S)


def tracked(draw, xy, text, fnt, fill, tracking=0):
    """Draw text with letter tracking (tracking in final px)."""
    x, y = xy[0] * S, xy[1] * S
    tr = tracking * S
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tr
    return x


def rgba(c, a):
    return (c[0], c[1], c[2], int(a * 255))


# ---------------------------------------------------------------- report cover
def report_cover():
    W, H = 800, 1000
    img = Image.new("RGBA", (W * S, H * S), rgba(CLOUD, 1))

    # baked soft shadow
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle([34 * S, 40 * S, 774 * S, 976 * S], fill=rgba(NAVY, 0.16))
    sh = sh.filter(ImageFilter.GaussianBlur(14 * S))
    img.alpha_composite(sh)

    d = ImageDraw.Draw(img)
    # cover card
    d.rectangle([30 * S, 30 * S, 770 * S, 970 * S], fill=rgba(NAVY, 1))

    # eyebrow: accent square + tracked label + rule
    d.rectangle([92 * S, 93 * S, 104 * S, 105 * S], fill=rgba(EDITORIAL, 1))
    tracked(d, (118, 92), "AI VISIBILITY INTELLIGENCE", font(F_LIGHT, 15), rgba(SIGNAL, 1), 5)
    d.rectangle([92 * S, 131 * S, 234 * S, 133 * S], fill=rgba(EDITORIAL, 1))

    # headline
    f_head = font(F_THIN, 66)
    for i, line in enumerate(["HOW AI SEES", "YOUR", "BUSINESS."]):
        tracked(d, (92, 222 + i * 92), line, f_head, rgba(CLOUD, 1), 2)

    # radar motif (center lower-right of headline)
    cx, cy = 618 * S, 588 * S
    arc_col = rgba(ICY, 0.42)
    for r in range(62, 290, 38):
        d.arc([cx - r * S, cy - r * S, cx + r * S, cy + r * S], 180, 360, fill=arc_col, width=S)
    # accent dots along a ray at ~247 deg
    import math
    for r, dr in [(100, 5), (138, 6), (214, 6), (252, 7)]:
        a = math.radians(247)
        x, y = cx + r * S * math.cos(a), cy + r * S * math.sin(a)
        d.ellipse([x - dr * S, y - dr * S, x + dr * S, y + dr * S], fill=rgba(EDITORIAL, 1))
    # sweep ray at 305 deg with tip dot (kept inside the card)
    a = math.radians(305)
    x2, y2 = cx + 240 * S * math.cos(a), cy + 240 * S * math.sin(a)
    d.line([cx, cy, x2, y2], fill=rgba(EDITORIAL, 1), width=2 * S)
    d.ellipse([x2 - 6 * S, y2 - 6 * S, x2 + 6 * S, y2 + 6 * S], fill=rgba(EDITORIAL, 1))

    # meta grid
    d.rectangle([92 * S, 790 * S, 708 * S, 791 * S], fill=rgba(ICY, 0.35))
    labels = ["PREPARED FOR", "ENGINES MONITORED", "REPORT PERIOD"]
    values = ["Northwind Advisory", "Six \u00b7 Daily scans", "January 2026"]
    xs = [92, 300, 508]
    for x, lab, val in zip(xs, labels, values):
        tracked(d, (x, 816), lab, font(F_LIGHT, 11), rgba(ICY, 0.55), 2.5)
        tracked(d, (x, 846), val, font(F_LIGHT, 15), rgba(CLOUD, 0.92), 0.5)

    # footer brand
    tracked(d, (92, 920), "AI SEARCH IQ", font(F_LIGHT, 13), rgba(ICY, 0.5), 4)

    return img.resize((W, H), Image.LANCZOS).convert("RGB")


# ------------------------------------------------------------------ og image
def og_image():
    import math
    W, H = 1200, 630
    img = Image.new("RGBA", (W * S, H * S), rgba(CLOUD, 1))
    d = ImageDraw.Draw(img)

    # faint grid
    grid = rgba(NAVY, 0.035)
    for x in range(0, W + 1, 120):
        d.line([x * S, 0, x * S, H * S], fill=grid, width=S)
    for y in range(0, H + 1, 120):
        d.line([0, y * S, W * S, y * S], fill=grid, width=S)

    # eyebrow
    d.rectangle([80 * S, 78 * S, 93 * S, 91 * S], fill=rgba(EDITORIAL, 1))
    tracked(d, (108, 76), "AI SEARCH IQ", font(F_LIGHT, 17), rgba(NAVY, 1), 6)
    d.rectangle([80 * S, 122 * S, 272 * S, 124 * S], fill=rgba(EDITORIAL, 1))

    # headline
    f_head = font(F_THIN, 74)
    tracked(d, (76, 228), "HOW AI SEES", f_head, rgba(NAVY, 1), 1)
    tracked(d, (76, 348), "YOUR BUSINESS.", f_head, rgba(NAVY, 1), 1)

    # radar motif centered off-canvas bottom-left
    cx, cy = -60 * S, 690 * S
    arc_col = rgba(SLATE, 0.30)
    for r in range(150, 690, 62):
        d.arc([cx - r * S, cy - r * S, cx + r * S, cy + r * S], 270, 360, fill=arc_col, width=S)

    # sweep ray at ~324 deg, tip just left of the second headline line
    a = math.radians(324)
    x2, y2 = cx + 530 * S * math.cos(a), cy + 530 * S * math.sin(a)
    d.line([cx, cy, x2, y2], fill=rgba(EDITORIAL, 1), width=2 * S)
    d.ellipse([x2 - 6 * S, y2 - 6 * S, x2 + 6 * S, y2 + 6 * S], fill=rgba(EDITORIAL, 1))

    # accent dots scattered on arcs (positions mirror previous asset)
    for px, py, pr in [(167, 320, 6), (327, 352, 6), (165, 445, 5), (168, 530, 6),
                       (295, 508, 6), (485, 505, 6), (60, 618, 5)]:
        d.ellipse([(px - pr) * S, (py - pr) * S, (px + pr) * S, (py + pr) * S],
                  fill=rgba(EDITORIAL, 1))

    # tagline
    tracked(d, (452, 560), "AI VISIBILITY INTELLIGENCE FOR THE NEXT ERA OF SEARCH.",
            font(F_LIGHT, 15), rgba(SLATE, 1), 4)

    return img.resize((W, H), Image.LANCZOS).convert("RGB")


if __name__ == "__main__":
    report_cover().save("public/report-cover.png", optimize=True)
    og_image().save("public/og-image.png", optimize=True)
    print("done")
