"""SQLite persistence for customers, credits, and usage."""

import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(os.environ.get("DATABASE_PATH", Path(__file__).parent.parent / "data" / "app.db"))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS customers (
                id TEXT PRIMARY KEY,
                email TEXT,
                credits INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS credit_transactions (
                id TEXT PRIMARY KEY,
                customer_id TEXT NOT NULL,
                amount INTEGER NOT NULL,
                reason TEXT NOT NULL,
                stripe_session_id TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (customer_id) REFERENCES customers(id)
            );

            CREATE TABLE IF NOT EXISTS usage_log (
                id TEXT PRIMARY KEY,
                customer_id TEXT NOT NULL,
                style_id TEXT NOT NULL,
                provider TEXT NOT NULL,
                credits_charged INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (customer_id) REFERENCES customers(id)
            );

            CREATE INDEX IF NOT EXISTS idx_transactions_customer
                ON credit_transactions(customer_id);
            CREATE INDEX IF NOT EXISTS idx_usage_customer
                ON usage_log(customer_id);
            """
        )


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def create_customer(free_trial_credits: int = 0) -> dict:
    customer_id = str(uuid.uuid4())
    now = _now()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO customers (id, credits, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (customer_id, free_trial_credits, now, now),
        )
        if free_trial_credits > 0:
            conn.execute(
                """INSERT INTO credit_transactions
                   (id, customer_id, amount, reason, created_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (str(uuid.uuid4()), customer_id, free_trial_credits, "free_trial", now),
            )
    return get_customer(customer_id)


def get_customer(customer_id: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
        return dict(row) if row else None


def add_credits(customer_id: str, amount: int, reason: str, stripe_session_id: str | None = None) -> int:
    now = _now()
    with get_db() as conn:
        conn.execute(
            "UPDATE customers SET credits = credits + ?, updated_at = ? WHERE id = ?",
            (amount, now, customer_id),
        )
        conn.execute(
            """INSERT INTO credit_transactions
               (id, customer_id, amount, reason, stripe_session_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (str(uuid.uuid4()), customer_id, amount, reason, stripe_session_id, now),
        )
        row = conn.execute("SELECT credits FROM customers WHERE id = ?", (customer_id,)).fetchone()
        return row["credits"]


def deduct_credits(customer_id: str, amount: int) -> bool:
    with get_db() as conn:
        row = conn.execute("SELECT credits FROM customers WHERE id = ?", (customer_id,)).fetchone()
        if not row or row["credits"] < amount:
            return False
        now = _now()
        conn.execute(
            "UPDATE customers SET credits = credits - ?, updated_at = ? WHERE id = ?",
            (amount, now, customer_id),
        )
        conn.execute(
            """INSERT INTO credit_transactions
               (id, customer_id, amount, reason, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (str(uuid.uuid4()), customer_id, -amount, "transform", now),
        )
        return True


def log_usage(customer_id: str, style_id: str, provider: str, credits_charged: int) -> None:
    with get_db() as conn:
        conn.execute(
            """INSERT INTO usage_log
               (id, customer_id, style_id, provider, credits_charged, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (str(uuid.uuid4()), customer_id, style_id, provider, credits_charged, _now()),
        )


def transaction_exists(stripe_session_id: str) -> bool:
    with get_db() as conn:
        row = conn.execute(
            "SELECT 1 FROM credit_transactions WHERE stripe_session_id = ?",
            (stripe_session_id,),
        ).fetchone()
        return row is not None
