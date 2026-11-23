from pathlib import Path
from PIL import Image, ImageDraw


def draw_logo(size: int = 256) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded emerald square (#00A651)
    draw.rounded_rectangle([(12, 12), (244, 244)], radius=56, fill=(0, 166, 81, 255))

    # Geometric motorbike wheels & frame in white
    draw.ellipse([(48, 138), (112, 202)], outline=(255, 255, 255, 255), width=14)
    draw.ellipse([(144, 138), (208, 202)], outline=(255, 255, 255, 255), width=14)
    draw.line([(80, 170), (116, 102), (160, 102), (176, 170)], fill=(255, 255, 255, 255), width=14)
    draw.line([(106, 102), (90, 74), (66, 74)], fill=(255, 255, 255, 255), width=12)
    draw.line([(160, 102), (174, 78), (200, 78)], fill=(255, 255, 255, 255), width=12)

    # Support.Monster magenta accent badge
    draw.ellipse([(192, 28), (232, 68)], fill=(236, 31, 168, 255), outline=(255, 255, 255, 255), width=6)
    return img


def main() -> None:
    here = Path(__file__).resolve().parent
    logo = draw_logo(256)
    logo.save(
        here / "icon.ico",
        format="ICO",
        sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)],
    )

    android_mipmap = here.parent / "mobile-apk" / "app" / "src" / "main" / "res" / "mipmap-xxhdpi"
    android_mipmap.mkdir(parents=True, exist_ok=True)
    png_icon = logo.resize((144, 144), Image.Resampling.LANCZOS)
    png_icon.save(android_mipmap / "ic_launcher.png", format="PNG")
    png_icon.save(android_mipmap / "ic_launcher_round.png", format="PNG")
    print("Generated icon.ico and Android mipmap PNG icons.")


if __name__ == "__main__":
    main()
