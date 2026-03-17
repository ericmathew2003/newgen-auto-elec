"""
Shared database connection utility.
Supports local Postgres and hosted Neon via DATABASE_URL.
Handles Neon's idle connection termination with keepalive settings.
"""

import os
import re
import psycopg2
import logging

logger = logging.getLogger(__name__)


def get_connection():
    """
    Returns a psycopg2 connection.
    - Prefers DATABASE_URL (Neon/Render)
    - Strips unsupported params (channel_binding)
    - Adds TCP keepalive to prevent Neon from dropping idle connections
    """
    database_url = os.getenv("DATABASE_URL")

    if database_url:
        # Strip channel_binding — not supported by psycopg2
        clean_url = re.sub(r"[&?]channel_binding=[^&]*", "", database_url)
        # Ensure sslmode=require
        if "sslmode" not in clean_url:
            sep = "&" if "?" in clean_url else "?"
            clean_url = f"{clean_url}{sep}sslmode=require"
        try:
            conn = psycopg2.connect(
                clean_url,
                keepalives=1,
                keepalives_idle=30,
                keepalives_interval=10,
                keepalives_count=5,
            )
            return conn
        except Exception as e:
            logger.error(f"Database connection failed (DATABASE_URL): {e}")
            raise
    else:
        try:
            conn = psycopg2.connect(
                host=os.getenv("DB_HOST", "localhost"),
                port=os.getenv("DB_PORT", "5433"),
                database=os.getenv("DB_NAME", "newgen"),
                user=os.getenv("DB_USER", "postgres"),
                password=os.getenv("DB_PASSWORD", "admin"),
                keepalives=1,
                keepalives_idle=30,
                keepalives_interval=10,
                keepalives_count=5,
            )
            return conn
        except Exception as e:
            logger.error(f"Database connection failed (env vars): {e}")
            raise
