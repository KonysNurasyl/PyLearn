from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "presentation_assets" / "diploma_figures"
OUTPUT_DIR = ROOT / "presentation_assets" / "diploma_figures_white_bg"


def to_white_theme(image: Image.Image) -> Image.Image:
    """Convert dark UI screenshots into light-background document figures.

    This is a deterministic pixel transform, not AI generation. It keeps
    saturated brand/accent colors, replaces dark neutral surfaces with white or
    light gray, and makes light neutral text dark so it remains readable.
    """

    arr = np.asarray(image.convert("RGB")).astype(np.float32)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    chroma = arr.max(axis=2) - arr.min(axis=2)

    out = arr.copy()

    neutral = chroma < 42
    almost_neutral = chroma < 64
    dark = luma < 52
    mid_dark = (luma >= 52) & (luma < 96)
    mid = (luma >= 96) & (luma < 178)
    light = luma >= 178

    # Main dark backgrounds/nav/sidebar/editor surfaces -> white.
    mask = dark & almost_neutral
    out[mask] = np.array([255, 255, 255])

    # Secondary dark panels/cards -> very light gray.
    mask = mid_dark & neutral
    out[mask] = np.array([244, 247, 251])

    # Low-contrast gray UI/text on dark screenshots -> readable dark gray.
    mask = mid & neutral
    out[mask] = np.array([55, 65, 81])

    # White/near-white text from the dark screenshot -> dark text.
    mask = light & neutral
    out[mask] = np.array([17, 24, 39])

    # Slightly blue-gray borders/surfaces that are not vivid accents -> soft lines.
    mask = (luma >= 70) & (luma < 130) & (chroma >= 42) & (chroma < 72)
    out[mask] = np.array([203, 213, 225])

    # Keep vivid accent colors but lift very dark colored code/background marks.
    vivid_dark = (luma < 65) & (chroma >= 64)
    out[vivid_dark] = np.clip(out[vivid_dark] * 1.45 + 28, 0, 255)

    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    files = sorted(
        path
        for path in SOURCE_DIR.glob("*.png")
        if path.name[:2].isdigit() and 9 <= int(path.name[:2]) <= 26
    )

    if not files:
        raise SystemExit("No section 3 figure screenshots were found.")

    for src in files:
        dest = OUTPUT_DIR / src.name
        with Image.open(src) as image:
            converted = to_white_theme(image)
            converted.save(dest, optimize=True)
        print(f"{src.name} -> {dest.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
