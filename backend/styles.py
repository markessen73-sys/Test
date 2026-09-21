"""Caricature style definitions for photo transformation."""

from dataclasses import dataclass

# Valid values from Replicate model schemas
KONTEXT_STYLES = frozenset({
    "Anime", "Cartoon", "Clay", "Gothic", "Graphic Novel", "Lego", "Memoji",
    "Minecraft", "Minimalist", "Pixel Art", "Random", "Simpsons", "Sketch",
    "South Park", "Toy", "Watercolor",
})

FACE_TO_MANY_STYLES = frozenset({
    "3D", "Emoji", "Video game", "Pixels", "Clay", "Toy",
})


@dataclass(frozen=True)
class CaricatureStyle:
    id: str
    name: str
    description: str
    prompt: str
    negative_prompt: str
    kontext_style: str
    face_to_many_style: str | None = None
    preview_color: str = "#6366f1"


STYLES: dict[str, CaricatureStyle] = {
    "mickeys_gym": CaricatureStyle(
        id="mickeys_gym",
        name="Mickey's Gym",
        description="Flat 2D boxing caricature — head only on black, bold outlines",
        prompt=(
            "flat 2D cartoon boxing caricature portrait, head and neck only on pure black "
            "background, bold black outlines, exaggerated features, warm skin tones, "
            "clean cel-shaded colors, humorous sports caricature, no body, no text, "
            "same style as classic punch-out cartoon boxer faces"
        ),
        negative_prompt="realistic, photograph, 3d render, full body, white background, blurry, text",
        kontext_style="Cartoon",
        preview_color="#E8C840",
    ),
    "simpsons": CaricatureStyle(
        id="simpsons",
        name="The Simpsons",
        description="Yellow skin, overbite, bold outlines — Springfield style",
        prompt=(
            "portrait in the style of The Simpsons cartoon, yellow skin, "
            "large round eyes, overbite, thick black outlines, flat colors, "
            "Matt Groening animation style"
        ),
        negative_prompt="realistic, photograph, 3d render, blurry, ugly",
        kontext_style="Simpsons",
        preview_color="#FFD90F",
    ),
    "family_guy": CaricatureStyle(
        id="family_guy",
        name="Family Guy",
        description="Seth MacFarlane's rounded, satirical cartoon look",
        prompt=(
            "portrait in the style of Family Guy cartoon, rounded features, "
            "simple shapes, thick outlines, Seth MacFarlane animation style, "
            "satirical American cartoon"
        ),
        negative_prompt="realistic, photograph, anime, blurry",
        kontext_style="Cartoon",
        preview_color="#4A90D9",
    ),
    "exaggerated": CaricatureStyle(
        id="exaggerated",
        name="Exaggerated",
        description="Big head, oversized features — classic caricature",
        prompt=(
            "exaggerated caricature portrait, oversized head, enlarged nose and eyes, "
            "distorted proportions, humorous cartoon caricature, bold colors, "
            "street artist caricature style"
        ),
        negative_prompt="realistic, photograph, subtle, normal proportions",
        kontext_style="Cartoon",
        preview_color="#EF4444",
    ),
    "south_park": CaricatureStyle(
        id="south_park",
        name="South Park",
        description="Paper cutout animation with simple geometric shapes",
        prompt=(
            "portrait in South Park cartoon style, paper cutout animation, "
            "simple geometric shapes, small body large head, flat colors, "
            "Trey Parker Matt Stone style"
        ),
        negative_prompt="realistic, photograph, detailed, 3d",
        kontext_style="South Park",
        preview_color="#8B4513",
    ),
    "anime": CaricatureStyle(
        id="anime",
        name="Anime",
        description="Japanese animation with expressive eyes and clean lines",
        prompt=(
            "anime portrait, large expressive eyes, clean line art, "
            "vibrant colors, Japanese animation style, cel shading"
        ),
        negative_prompt="realistic, photograph, western cartoon, blurry",
        kontext_style="Anime",
        preview_color="#EC4899",
    ),
    "pixar": CaricatureStyle(
        id="pixar",
        name="Pixar 3D",
        description="Warm, rounded 3D animated movie character",
        prompt=(
            "Pixar 3D animated character portrait, smooth rendering, "
            "expressive eyes, warm lighting, Disney Pixar movie style, "
            "high quality 3D animation"
        ),
        negative_prompt="realistic, photograph, 2d, flat, blurry",
        kontext_style="Toy",
        face_to_many_style="3D",
        preview_color="#06B6D4",
    ),
    "disney": CaricatureStyle(
        id="disney",
        name="Disney Classic",
        description="Hand-drawn golden-age Disney animation",
        prompt=(
            "classic Disney animation portrait, hand-drawn style, "
            "soft colors, expressive features, golden age Disney cartoon, "
            "princess or prince character style"
        ),
        negative_prompt="realistic, photograph, 3d, modern anime",
        kontext_style="Cartoon",
        preview_color="#A855F7",
    ),
    "comic": CaricatureStyle(
        id="comic",
        name="Comic Book",
        description="Bold ink lines, halftone dots, superhero comic art",
        prompt=(
            "comic book portrait, bold ink outlines, halftone dots, "
            "dynamic shading, Marvel DC comic art style, pop art colors"
        ),
        negative_prompt="realistic, photograph, blurry, soft",
        kontext_style="Graphic Novel",
        preview_color="#F97316",
    ),
    "clay": CaricatureStyle(
        id="clay",
        name="Claymation",
        description="Stop-motion clay figure with tactile texture",
        prompt=(
            "claymation character portrait, stop motion style, "
            "clay texture, Wallace and Gromit style, handmade look"
        ),
        negative_prompt="realistic, photograph, 2d, flat",
        kontext_style="Clay",
        face_to_many_style="Clay",
        preview_color="#84CC16",
    ),
    "retro": CaricatureStyle(
        id="retro",
        name="Retro Cartoon",
        description="1930s rubber-hose vintage animation",
        prompt=(
            "1930s rubber hose cartoon style, vintage animation, "
            "pie eyes, black and white or muted colors, Fleischer studios style"
        ),
        negative_prompt="realistic, photograph, modern, 3d",
        kontext_style="Sketch",
        preview_color="#78716C",
    ),
}


def get_style(style_id: str) -> CaricatureStyle:
    if style_id not in STYLES:
        raise ValueError(f"Unknown style: {style_id}")
    return STYLES[style_id]


def list_styles() -> list[dict]:
    return [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "preview_color": s.preview_color,
        }
        for s in STYLES.values()
    ]
