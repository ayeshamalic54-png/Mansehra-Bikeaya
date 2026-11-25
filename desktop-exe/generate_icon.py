from pathlib import Path
from PIL import Image, ImageDraw


def _fallback_logo(size: int = 1024) -> Image.Image:
    """Fallback high-res SafarGo rounded badge if master raster is absent."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = int(size * 0.03)
    draw.rounded_rectangle([(pad, pad), (size - pad, size - pad)], radius=int(size * 0.22), fill=(0, 158, 77, 255))
    # Twin forward speed chevrons
    draw.polygon([(220, 200), (360, 200), (500, 360), (360, 520), (220, 520), (360, 360)], fill=(255, 255, 255, 255))
    draw.polygon([(460, 200), (600, 200), (740, 360), (600, 520), (460, 520), (600, 360)], fill=(251, 191, 36, 255))
    # Stylized car + road base
    draw.rounded_rectangle([(180, 620), (844, 790)], radius=60, fill=(255, 255, 255, 255))
    return img


def load_master_icon() -> Image.Image:
    here = Path(__file__).resolve().parent
    master = here / "safargo-icon-1024.png"
    if master.exists():
        return Image.open(master).convert("RGBA")
    return _fallback_logo(1024)


def make_round(img: Image.Image) -> Image.Image:
    s = img.size[0]
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, s - 1, s - 1), fill=255)
    out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def main() -> None:
    here = Path(__file__).resolve().parent
    root = here.parent
    logo = load_master_icon()

    # 1. Windows Desktop .ico
    logo.save(
        here / "icon.ico",
        format="ICO",
        sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)],
    )

    # 2. Frontend PWA & Browser Favicons
    pub = root / "frontend" / "public"
    pub.mkdir(parents=True, exist_ok=True)
    logo.resize((512, 512), Image.Resampling.LANCZOS).save(pub / "icon-512.png", format="PNG")
    logo.resize((192, 192), Image.Resampling.LANCZOS).save(pub / "icon-192.png", format="PNG")
    logo.resize((180, 180), Image.Resampling.LANCZOS).save(pub / "apple-touch-icon.png", format="PNG")
    logo.resize((32, 32), Image.Resampling.LANCZOS).save(pub / "favicon-32.png", format="PNG")
    logo.save(pub / "favicon.ico", format="ICO", sizes=[(32, 32), (16, 16)])

    # 3. Android Multi-Density Launcher Icons (mdpi..xxxhdpi)
    res_dir = root / "mobile-apk" / "app" / "src" / "main" / "res"
    densities = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    for folder, px in densities.items():
        d = res_dir / folder
        d.mkdir(parents=True, exist_ok=True)
        sq = logo.resize((px, px), Image.Resampling.LANCZOS)
        sq.save(d / "ic_launcher.png", format="PNG")
        make_round(sq).save(d / "ic_launcher_round.png", format="PNG")

    print("Generated HD SafarGo icons for Windows (.ico), Android APK (mdpi-xxxhdpi), and PWA/Browser.")


if __name__ == "__main__":
    main()
