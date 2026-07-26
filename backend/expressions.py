"""Expression variants for gym face packs (clean / ooh / knockout)."""

from dataclasses import dataclass


@dataclass(frozen=True)
class FaceExpression:
    id: str
    name: str
    prompt_suffix: str


EXPRESSIONS: dict[str, FaceExpression] = {
    "clean": FaceExpression(
        id="clean",
        name="Clean",
        prompt_suffix=(
            "Neutral confident boxing expression. "
            "Head and neck ONLY on a pure black background — no suit, no shoulders, no torso, no clothing below the chin. "
            "Preserve the person's exact likeness, skin tone, ethnicity, age, and gender."
        ),
    ),
    "ooh": FaceExpression(
        id="ooh",
        name="Ooh",
        prompt_suffix=(
            "Same person, same flat 2D cartoon art style. "
            "Mouth wide open in a punched 'ooh!' reaction, eyes wide with surprise. "
            "Head and neck ONLY on pure black background — no suit or body. "
            "Preserve exact likeness, skin tone, and ethnicity."
        ),
    ),
    "knockout": FaceExpression(
        id="knockout",
        name="Knockout",
        prompt_suffix=(
            "Same person, same flat 2D cartoon art style. "
            "Eyes closed, sad downturned frown, yellow cartoon knockout stars around the head. "
            "Head and neck ONLY on pure black background — no suit or body. "
            "Preserve exact likeness and skin tone on the closed-eye lids."
        ),
    ),
}


def get_expression(expression_id: str) -> FaceExpression:
    if expression_id not in EXPRESSIONS:
        raise ValueError(f"Unknown expression: {expression_id}")
    return EXPRESSIONS[expression_id]
