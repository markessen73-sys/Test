"""Monetization: credit packs and Stripe billing."""

import os
from dataclasses import dataclass

import stripe

from database import add_credits, transaction_exists

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")


@dataclass(frozen=True)
class CreditPack:
    id: str
    name: str
    credits: int
    price_cents: int
    description: str


# Configurable via env; defaults are sensible starting points
CREDIT_PACKS: list[CreditPack] = [
    CreditPack("starter", "Starter", 5, 299, "5 AI caricatures"),
    CreditPack("popular", "Popular", 15, 699, "15 AI caricatures — best value"),
    CreditPack("pro", "Pro", 50, 1999, "50 AI caricatures"),
]

CREDITS_PER_TRANSFORM = int(os.environ.get("CREDITS_PER_TRANSFORM", "1"))
FREE_TRIAL_CREDITS = int(os.environ.get("FREE_TRIAL_CREDITS", "1"))
APP_URL = os.environ.get("APP_URL", "http://localhost:5173")


def is_stripe_configured() -> bool:
    return bool(stripe.api_key and stripe.api_key.startswith("sk_"))


def get_pricing() -> dict:
    return {
        "credits_per_transform": CREDITS_PER_TRANSFORM,
        "free_trial_credits": FREE_TRIAL_CREDITS,
        "packs": [
            {
                "id": p.id,
                "name": p.name,
                "credits": p.credits,
                "price_cents": p.price_cents,
                "price_display": f"${p.price_cents / 100:.2f}",
                "description": p.description,
                "per_credit_cents": round(p.price_cents / p.credits),
            }
            for p in CREDIT_PACKS
        ],
        "stripe_enabled": is_stripe_configured(),
    }


def get_pack(pack_id: str) -> CreditPack | None:
    return next((p for p in CREDIT_PACKS if p.id == pack_id), None)


def create_checkout_session(customer_id: str, pack_id: str) -> str:
    if not is_stripe_configured():
        raise ValueError("Stripe is not configured. Set STRIPE_SECRET_KEY.")

    pack = get_pack(pack_id)
    if not pack:
        raise ValueError(f"Unknown pack: {pack_id}")

    session = stripe.checkout.Session.create(
        mode="payment",
        line_items=[
            {
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": f"Caricature Studio — {pack.name}",
                        "description": pack.description,
                    },
                    "unit_amount": pack.price_cents,
                },
                "quantity": 1,
            }
        ],
        metadata={
            "customer_id": customer_id,
            "pack_id": pack.id,
            "credits": str(pack.credits),
        },
        success_url=f"{APP_URL}?purchase=success",
        cancel_url=f"{APP_URL}?purchase=cancelled",
    )
    return session.url


def handle_checkout_completed(session: dict) -> bool:
    """Process Stripe checkout.session.completed. Returns True if credits added."""
    session_id = session.get("id")
    metadata = session.get("metadata") or {}

    if not session_id or session.get("payment_status") != "paid":
        return False
    if transaction_exists(session_id):
        return False

    customer_id = metadata.get("customer_id")
    credits = int(metadata.get("credits", 0))
    if not customer_id or credits <= 0:
        return False

    add_credits(customer_id, credits, reason="purchase", stripe_session_id=session_id)
    return True


def verify_webhook(payload: bytes, sig_header: str) -> dict:
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    if not secret:
        raise ValueError("STRIPE_WEBHOOK_SECRET is not set")
    return stripe.Webhook.construct_event(payload, sig_header, secret)
