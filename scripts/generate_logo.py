#!/usr/bin/env python3
"""
Generate high-resolution branding logo for AgentSubseaCable.
"""

from PIL import Image, ImageDraw, ImageFont
import math
from pathlib import Path


def generate_logo():
    width = 800
    height = 800
    # Abyssal Marine background (#040914)
    image = Image.new("RGBA", (width, height), (4, 9, 20, 255))
    draw = ImageDraw.Draw(image)

    cx, cy = 400, 360

    # Background ambient circular glow
    for r in range(330, 140, -5):
        alpha = int(35 * (1 - (r - 140) / 190))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(6, 182, 212, alpha), width=3)

    # Ocean Floor Trench Bathymetry Rings
    for r in [260, 220, 180]:
        draw.ellipse([cx - r, cy - int(r * 0.65), cx + r, cy + int(r * 0.65)], outline=(14, 165, 233, 70), width=2)

    # Transoceanic Fiber Optic Cable Arc across globe
    points_cable = []
    for deg in range(-120, 121, 5):
        rad = math.radians(deg)
        x = cx + int(240 * math.cos(rad))
        y = cy + int(110 * math.sin(rad))
        points_cable.append((x, y))

    # Outer cable sheath
    for i in range(len(points_cable) - 1):
        draw.line([points_cable[i], points_cable[i + 1]], fill=(10, 37, 64, 255), width=16)
        draw.line([points_cable[i], points_cable[i + 1]], fill=(6, 182, 212, 180), width=8)
        draw.line([points_cable[i], points_cable[i + 1]], fill=(255, 255, 255, 240), width=3)

    # Optical Repeater Nodes
    for idx in [6, 18, 30, 42]:
        nx, ny = points_cable[idx]
        for gr in range(22, 10, -2):
            draw.ellipse([nx - gr, ny - gr, nx + gr, ny + gr], outline=(6, 182, 212, 60), width=2)
        draw.ellipse([nx - 12, ny - 12, nx + 12, ny + 12], fill=(4, 9, 20, 255), outline=(6, 182, 212, 255), width=3)
        draw.ellipse([nx - 5, ny - 5, nx + 5, ny + 5], fill=(16, 185, 129, 255))

    # Seismic Fault Line / Earthquake Richter Waves across seabed
    seismic_pts = [
        (cx - 200, cy + 90),
        (cx - 130, cy + 85),
        (cx - 80, cy + 125),
        (cx - 40, cy + 55),
        (cx, cy + 140),
        (cx + 40, cy + 60),
        (cx + 90, cy + 120),
        (cx + 150, cy + 85),
        (cx + 210, cy + 90),
    ]
    for i in range(len(seismic_pts) - 1):
        draw.line([seismic_pts[i], seismic_pts[i + 1]], fill=(245, 158, 11, 220), width=4)
        draw.line([seismic_pts[i], seismic_pts[i + 1]], fill=(255, 255, 255, 180), width=1)

    # Center Shield / Escrow Lock Icon
    sx, sy = cx, cy - 20
    shield_pts = [
        (sx - 40, sy - 40),
        (sx + 40, sy - 40),
        (sx + 40, sy + 15),
        (sx, sy + 55),
        (sx - 40, sy + 15),
    ]
    draw.polygon(shield_pts, fill=(10, 21, 38, 230), outline=(6, 182, 212, 255))
    draw.line([(sx - 15, sy), (sx - 3, sy + 15), (sx + 18, sy - 15)], fill=(16, 185, 129, 255), width=5)

    # Typography
    try:
        font_title = ImageFont.truetype("arial.ttf", 46)
        font_sub = ImageFont.truetype("arial.ttf", 22)
    except Exception:
        font_title = ImageFont.load_default()
        font_sub = ImageFont.load_default()

    draw.text((cx, 670), "AGENTSUBSEACABLE", fill=(255, 255, 255, 255), font=font_title, anchor="mm")
    draw.text((cx, 725), "AUTONOMOUS SUBSEA SLA & SEISMIC ESCROW", fill=(6, 182, 212, 220), font=font_sub, anchor="mm")

    out_file = Path(__file__).parent.parent / "logo.png"
    image.save(out_file)
    print(f"[+] Branding logo successfully generated at {out_file}")


if __name__ == "__main__":
    generate_logo()
