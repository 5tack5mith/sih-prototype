"""Identity and case-assignment store, separate from the Neo4j case graph."""
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


def _db_path() -> Path:
    """Resolve at call time so tests and deployments can configure the store."""
    return Path(os.environ.get("AUTH_DB_PATH", Path(__file__).parent / "users.db"))


def init_db() -> None:
    _db_path().parent.mkdir(parents=True, exist_ok=True)
    with _connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('admin', 'investigator'))
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS case_assignments (
                case_id TEXT NOT NULL,
                investigator_username TEXT NOT NULL,
                assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                assigned_by TEXT NOT NULL,
                PRIMARY KEY (case_id, investigator_username),
                FOREIGN KEY (investigator_username) REFERENCES users(username)
            )
        """)
    _bootstrap_admin()


@contextmanager
def _connect() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(_db_path())
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def get_user(username: str) -> dict[str, str] | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT username, password_hash, role FROM users WHERE username = ?",
            (username,),
        ).fetchone()
    if row is None:
        return None
    return {"username": row[0], "password_hash": row[1], "role": row[2]}


def create_user(username: str, password_hash: str, role: str) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            (username, password_hash, role),
        )


def username_exists(username: str) -> bool:
    return get_user(username) is not None


def list_users() -> list[dict[str, str]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT username, role FROM users ORDER BY username",
        ).fetchall()
    return [{"username": row[0], "role": row[1]} for row in rows]


def list_assignments(case_id: str) -> list[dict[str, str]]:
    with _connect() as conn:
        rows = conn.execute(
            """SELECT investigator_username, assigned_at, assigned_by
               FROM case_assignments WHERE case_id = ?
               ORDER BY investigator_username""",
            (case_id,),
        ).fetchall()
    return [{"username": row[0], "assigned_at": row[1], "assigned_by": row[2]} for row in rows]


def assigned_case_ids(username: str) -> list[str]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT case_id FROM case_assignments WHERE investigator_username = ?",
            (username,),
        ).fetchall()
    return [row[0] for row in rows]


def has_assignment(case_id: str, username: str) -> bool:
    with _connect() as conn:
        row = conn.execute(
            "SELECT 1 FROM case_assignments WHERE case_id = ? AND investigator_username = ?",
            (case_id, username),
        ).fetchone()
    return row is not None


def assign_investigator(case_id: str, username: str, assigned_by: str) -> None:
    with _connect() as conn:
        conn.execute(
            """INSERT OR IGNORE INTO case_assignments
               (case_id, investigator_username, assigned_by) VALUES (?, ?, ?)""",
            (case_id, username, assigned_by),
        )


def remove_assignment(case_id: str, username: str) -> bool:
    with _connect() as conn:
        result = conn.execute(
            "DELETE FROM case_assignments WHERE case_id = ? AND investigator_username = ?",
            (case_id, username),
        )
    return result.rowcount > 0


def remove_case_assignments(case_id: str) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM case_assignments WHERE case_id = ?", (case_id,))


def _bootstrap_admin() -> None:
    """Create the configured first administrator once, without weakening registration."""
    username = os.environ.get("AUTH_BOOTSTRAP_ADMIN_USERNAME")
    password = os.environ.get("AUTH_BOOTSTRAP_ADMIN_PASSWORD")
    if bool(username) != bool(password):
        raise RuntimeError("AUTH_BOOTSTRAP_ADMIN_USERNAME and AUTH_BOOTSTRAP_ADMIN_PASSWORD must be set together")
    if not username:
        return
    user = get_user(username)
    if user is not None:
        if user["role"] != "admin":
            raise RuntimeError("bootstrap username already belongs to a non-admin user")
        return
    with _connect() as conn:
        user_count = conn.execute("SELECT count(*) FROM users").fetchone()[0]
    if user_count:
        return
    from .security import hash_password
    create_user(username, hash_password(password), "admin")
