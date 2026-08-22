import hashlib
import os
import re
import secrets
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import bcrypt
from fastapi import HTTPException, Request, Response, status


DATABASE_PATH = Path(os.getenv("DATABASE_PATH", "data/app.db"))
DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
SESSION_COOKIE = "clarity_session"
SESSION_DAYS = int(os.getenv("SESSION_DAYS", "30"))
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def connection() -> sqlite3.Connection:
    database = sqlite3.connect(DATABASE_PATH)
    database.row_factory = sqlite3.Row
    database.execute("PRAGMA foreign_keys = ON")
    return database


def initialize_auth_database() -> None:
    with connection() as database:
        database.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash BLOB NOT NULL,
                is_owner INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
            """
        )


def public_user(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "is_owner": bool(row["is_owner"]),
    }


def normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if not EMAIL_PATTERN.match(normalized):
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    return normalized


def validate_password(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if len(password) > 128:
        raise HTTPException(status_code=400, detail="Password is too long")


def create_user(name: str, email: str, password: str) -> dict:
    clean_name = name.strip()
    if len(clean_name) < 2 or len(clean_name) > 80:
        raise HTTPException(status_code=400, detail="Name must be between 2 and 80 characters")
    normalized_email = normalize_email(email)
    validate_password(password)
    now = datetime.now(timezone.utc).isoformat()
    user_id = str(uuid.uuid4())
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12))

    try:
        with connection() as database:
            database.execute("BEGIN IMMEDIATE")
            is_owner = database.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
            database.execute(
                "INSERT INTO users (id, name, email, password_hash, is_owner, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (user_id, clean_name, normalized_email, password_hash, int(is_owner), now),
            )
            row = database.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            return public_user(row)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="An account with that email already exists") from exc


def verify_user(email: str, password: str) -> dict:
    normalized_email = normalize_email(email)
    with connection() as database:
        row = database.execute("SELECT * FROM users WHERE email = ?", (normalized_email,)).fetchone()
    valid = row is not None and bcrypt.checkpw(password.encode("utf-8"), row["password_hash"])
    if not valid:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return public_user(row)


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(48)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=SESSION_DAYS)
    with connection() as database:
        database.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (token_digest(token), user_id, expires_at.isoformat(), now.isoformat()),
        )
    return token


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",
        samesite="lax",
        path="/",
    )


def delete_session(token: Optional[str]) -> None:
    if not token:
        return
    with connection() as database:
        database.execute("DELETE FROM sessions WHERE token_hash = ?", (token_digest(token),))


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/", samesite="lax")


def current_user(request: Request) -> dict:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in required")
    now = datetime.now(timezone.utc).isoformat()
    with connection() as database:
        row = database.execute(
            """
            SELECT users.* FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token_hash = ? AND sessions.expires_at > ?
            """,
            (token_digest(token), now),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    return public_user(row)
