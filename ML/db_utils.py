"""
Shared database connection utility.
Supports both local Postgres and hosted Neon/Supabase via DATABASE_URL.
"""

import os
import re
import psycopg2
import logging

logger = logging.getLogger(__name__)


def get_connection():
    """
    Returns a psycopg2 connection.
    Prefers DATABASE_URL env var (Neon/Render), falls back to individual vars.
    Strips unsupported params like channel_binding before connecting.
    """
    database_url = os.getenv("DATABASE_URL")

    if database_url:
        # psycopg2 doesn't support channel_binding — strip it from the URL
        clean_url = re.sub(r"[&?]channel_binding=[^&]*", "", database_url)
        # Ensure sslmode=require is present for Neon
        if "sslmode" not in clean_url:
            sep = "&" if "?" in clean_url else "?"
            clean_url = f"{clean_url}{sep}sslmode=require"
        try:
            return psycopg2.connect(clean_url)
        except Exception as e:
            logger.error(f"Database connection failed (DATABASE_URL): {e}")
            raise
    else:
        try:
            return psycopg2.connect(
                host=os.getenv("DB_HOST", "localhost"),
                port=os.getenv("DB_PORT", "5433"),
                database=os.getenv("DB_NAME", "newgen"),
                user=os.getenv("DB_USER", "postgres"),
                password=os.getenv("DB_PASSWORD", "admin"),
            )
        except Exception as e:
            logger.error(f"Database connection failed (env vars): {e}")
            raise
