#!/usr/bin/env python3
"""Serviço de sincronização do FieldNotes.

Fala o pedaço da API do Supabase que o cliente já usa: conta, tabelas e arquivos.
Os dados ficam neste servidor, em SQLite e em disco. A chave de assinatura não sai daqui.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import threading
from datetime import datetime, timezone
from email import message_from_bytes
from email.policy import default as email_policy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

TABLES = {
    "users",
    "notes",
    "collections",
    "tasks",
    "attachments",
    "audio_recordings",
    "notifications",
    "settings",
    "devices",
    "templates",
}
OWNED_BY_USER_ID = TABLES - {"users"}
MAX_BODY = 14 * 1024 * 1024
ACCESS_SECONDS = 60 * 60

DATA = Path(os.environ.get("FIELDNOTES_DATA", "/var/lib/fieldnotes"))
DB_PATH = DATA / "fieldnotes.sqlite"
FILES = DATA / "files"
ANON_KEY = os.environ.get("FIELDNOTES_ANON_KEY", "")
JWT_SECRET = os.environ.get("FIELDNOTES_JWT_SECRET", "").encode()
PORT = int(os.environ.get("FIELDNOTES_PORT", "8787"))
BOOT_EMAIL = os.environ.get("FIELDNOTES_BOOT_EMAIL", "").strip().lower()
BOOT_PASSWORD = os.environ.get("FIELDNOTES_BOOT_PASSWORD", "")
BOOT_NAME = os.environ.get("FIELDNOTES_BOOT_NAME", "").strip()
LOCK = threading.Lock()
# A sessão do aparelho não expira sozinha. Só o logout apaga o token.


def now() -> datetime:
    return datetime.now(timezone.utc)


def iso(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def b64(raw: bytes) -> str:
    import base64

    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def b64decode(value: str) -> bytes:
    import base64

    pad = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + pad)


def sign_jwt(account_id: str, email: str, session_id: str) -> tuple[str, int]:
    issued = int(now().timestamp())
    expires = issued + ACCESS_SECONDS
    header = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = b64(
        json.dumps(
            {
                "aud": "authenticated",
                "exp": expires,
                "iat": issued,
                "sub": account_id,
                "email": email,
                "role": "authenticated",
                "jti": session_id,
            },
            separators=(",", ":"),
        ).encode()
    )
    signature = b64(hmac.new(JWT_SECRET, f"{header}.{payload}".encode(), hashlib.sha256).digest())
    return f"{header}.{payload}.{signature}", expires


def read_jwt(token: str) -> dict | None:
    parts = token.split(".")
    if len(parts) != 3 or not JWT_SECRET:
        return None
    expected = b64(hmac.new(JWT_SECRET, f"{parts[0]}.{parts[1]}".encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(expected, parts[2]):
        return None
    try:
        payload = json.loads(b64decode(parts[1]))
    except (json.JSONDecodeError, ValueError):
        return None
    if not isinstance(payload, dict):
        return None
    exp = payload.get("exp")
    if not isinstance(exp, int) or exp < int(now().timestamp()):
        return None
    if payload.get("role") != "authenticated" or not isinstance(payload.get("sub"), str):
        return None
    return payload


def hash_password(password: str, salt: bytes | None = None) -> str:
    used = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), used, 200_000)
    return f"{b64(used)}${b64(digest)}"


def password_ok(password: str, stored: str) -> bool:
    salt_text, _, digest_text = stored.partition("$")
    if not salt_text or not digest_text:
        return False
    try:
        salt = b64decode(salt_text)
    except ValueError:
        return False
    return hmac.compare_digest(hash_password(password, salt), stored)


def connect() -> sqlite3.Connection:
    DATA.mkdir(parents=True, exist_ok=True)
    FILES.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("pragma journal_mode=wal")
    db.execute(
        """
        create table if not exists accounts (
          id text primary key,
          email text not null unique,
          password_hash text not null,
          display_name text,
          created_at text not null
        )
        """
    )
    db.execute(
        """
        create table if not exists sessions (
          refresh_token text primary key,
          account_id text not null,
          expires_at text not null,
          session_id text
        )
        """
    )
    columns = {row[1] for row in db.execute("pragma table_info(sessions)")}
    if "session_id" not in columns:
        db.execute("alter table sessions add column session_id text")
    db.execute(
        """
        create table if not exists records (
          entity text not null,
          id text not null,
          owner_id text not null,
          updated_at text not null,
          body text not null,
          primary key (entity, id)
        )
        """
    )
    db.execute("create index if not exists records_owner on records (entity, owner_id, updated_at)")
    return db


def user_payload(row: sqlite3.Row, signed_at: str) -> dict:
    return {
        "id": row["id"],
        "aud": "authenticated",
        "role": "authenticated",
        "email": row["email"],
        "email_confirmed_at": row["created_at"],
        "confirmed_at": row["created_at"],
        "last_sign_in_at": signed_at,
        "app_metadata": {"provider": "email", "providers": ["email"]},
        "user_metadata": {"display_name": row["display_name"] or row["email"]},
        "created_at": row["created_at"],
        "updated_at": signed_at,
    }


def session_payload(db: sqlite3.Connection, row: sqlite3.Row) -> dict:
    signed_at = iso(now())
    session_id = secrets.token_hex(16)
    token, expires = sign_jwt(row["id"], row["email"], session_id)
    refresh = secrets.token_urlsafe(32)
    db.execute(
        "insert into sessions (refresh_token, account_id, expires_at, session_id) values (?, ?, ?, ?)",
        (refresh, row["id"], "9999-01-01T00:00:00.000Z", session_id),
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": ACCESS_SECONDS,
        "expires_at": expires,
        "refresh_token": refresh,
        "user": user_payload(row, signed_at),
    }


def local_user_ids(db: sqlite3.Connection, account_id: str) -> set[str]:
    rows = db.execute(
        "select id from records where entity = 'users' and owner_id = ?",
        (account_id,),
    ).fetchall()
    return {row["id"] for row in rows}


def owns_record(db: sqlite3.Connection, account_id: str, entity: str, body: dict) -> bool:
    if entity == "users":
        return body.get("remote_id") == account_id
    user_id = body.get("user_id")
    return isinstance(user_id, str) and user_id in local_user_ids(db, account_id)


def file_target(account_id: str, relative: str) -> Path | None:
    cleaned = unquote(relative).replace("\\", "/").lstrip("/")
    if not cleaned or ".." in cleaned.split("/"):
        return None
    if not cleaned.startswith(f"{account_id}/"):
        return None
    root = FILES.resolve()
    target = (FILES / cleaned).resolve()
    if root != target and root not in target.parents:
        return None
    return target


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:
        print(f"{self.address_string()} {fmt % args}", flush=True)

    def cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "authorization, apikey, content-type, prefer, x-upsert, x-client-info")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")

    def send_json(self, status: int, payload, extra: dict | None = None) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.cors()
        if extra:
            for key, value in extra.items():
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(raw)

    def send_error_body(self, status: int, message: str) -> None:
        self.send_json(status, {"message": message, "msg": message, "error_description": message})

    def send_bytes(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "private, max-age=3600")
        self.cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.cors()
        self.end_headers()

    def read_body(self) -> bytes | None:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length < 0 or length > MAX_BODY:
            self.send_error_body(413, "Arquivo grande demais.")
            return None
        return self.rfile.read(length) if length else b""

    def anon_ok(self) -> bool:
        supplied = self.headers.get("apikey", "")
        return bool(ANON_KEY) and hmac.compare_digest(supplied, ANON_KEY)

    def account_from_bearer(self) -> dict | None:
        header = self.headers.get("Authorization", "")
        if not header.lower().startswith("bearer "):
            return None
        return read_jwt(header[7:].strip())

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/auth/v1/health":
            self.send_json(200, {"name": "fieldnotes"})
            return
        if not self.anon_ok():
            self.send_error_body(401, "Chave da aplicação recusada.")
            return
        if parsed.path == "/auth/v1/user":
            self.current_user()
            return
        if parsed.path.startswith("/rest/v1/"):
            self.read_table(parsed)
            return
        if parsed.path.startswith("/storage/v1/object/fieldnotes-files/"):
            self.download_file(parsed.path.removeprefix("/storage/v1/object/fieldnotes-files/"))
            return
        self.send_error_body(404, "Caminho não encontrado.")

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if not self.anon_ok() and parsed.path != "/auth/v1/health":
            self.send_error_body(401, "Chave da aplicação recusada.")
            return
        body = self.read_body()
        if body is None:
            return
        if parsed.path == "/auth/v1/signup":
            self.signup(body)
            return
        if parsed.path == "/auth/v1/token":
            self.token(parse_qs(parsed.query), body)
            return
        if parsed.path.startswith("/auth/v1/logout"):
            self.logout()
            return
        if parsed.path.startswith("/rest/v1/"):
            self.write_table(parsed.path.removeprefix("/rest/v1/"), body)
            return
        if parsed.path.startswith("/storage/v1/object/fieldnotes-files/"):
            self.upload_file(parsed.path.removeprefix("/storage/v1/object/fieldnotes-files/"), body)
            return
        self.send_error_body(404, "Caminho não encontrado.")

    def signup(self, raw: bytes) -> None:
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            self.send_error_body(400, "Pedido inválido.")
            return
        email = str(payload.get("email", "")).strip().lower()
        password = str(payload.get("password", ""))
        meta = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        display = str(meta.get("display_name") or email).strip()[:120]
        if "@" not in email or len(password) < 6:
            self.send_error_body(422, "Use um e-mail e uma senha com pelo menos 6 caracteres.")
            return
        with LOCK:
            db = connect()
            try:
                existing = db.execute("select id from accounts where email = ?", (email,)).fetchone()
                if existing:
                    self.send_error_body(422, "Já existe uma conta com este e-mail.")
                    return
                account_id = secrets.token_hex(16)
                created = iso(now())
                db.execute(
                    "insert into accounts (id, email, password_hash, display_name, created_at) values (?, ?, ?, ?, ?)",
                    (account_id, email, hash_password(password), display, created),
                )
                row = db.execute("select * from accounts where id = ?", (account_id,)).fetchone()
                session = session_payload(db, row)
                db.commit()
            finally:
                db.close()
        self.send_json(200, session)

    def token(self, query: dict, raw: bytes) -> None:
        try:
            payload = json.loads(raw or b"{}")
        except json.JSONDecodeError:
            self.send_error_body(400, "Pedido inválido.")
            return
        grant = (query.get("grant_type") or [""])[0]
        with LOCK:
            db = connect()
            try:
                if grant == "password":
                    email = str(payload.get("email", "")).strip().lower()
                    password = str(payload.get("password", ""))
                    row = db.execute("select * from accounts where email = ?", (email,)).fetchone()
                    if row is None or not password_ok(password, row["password_hash"]):
                        self.send_error_body(400, "E-mail ou senha incorretos.")
                        return
                elif grant == "refresh_token":
                    refresh = str(payload.get("refresh_token", ""))
                    session_row = db.execute(
                        "select * from sessions where refresh_token = ?",
                        (refresh,),
                    ).fetchone()
                    if session_row is None or session_row["expires_at"] < iso(now()):
                        self.send_error_body(401, "A sessão expirou. Entre de novo.")
                        return
                    db.execute("delete from sessions where refresh_token = ?", (refresh,))
                    row = db.execute("select * from accounts where id = ?", (session_row["account_id"],)).fetchone()
                    if row is None:
                        self.send_error_body(401, "A sessão expirou. Entre de novo.")
                        return
                else:
                    self.send_error_body(400, "Pedido inválido.")
                    return
                session = session_payload(db, row)
                db.commit()
            finally:
                db.close()
        self.send_json(200, session)

    def logout(self) -> None:
        claims = self.account_from_bearer()
        if claims:
            scope = (parse_qs(urlparse(self.path).query).get("scope") or ["local"])[0]
            with LOCK:
                db = connect()
                try:
                    session_id = claims.get("jti")
                    if scope == "global":
                        db.execute("delete from sessions where account_id = ?", (claims["sub"],))
                    elif isinstance(session_id, str):
                        db.execute(
                            "delete from sessions where account_id = ? and session_id = ?",
                            (claims["sub"], session_id),
                        )
                    else:
                        db.execute("delete from sessions where account_id = ?", (claims["sub"],))
                    db.commit()
                finally:
                    db.close()
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.cors()
        self.end_headers()

    def current_user(self) -> None:
        claims = self.account_from_bearer()
        if not claims:
            self.send_error_body(401, "Sessão ausente.")
            return
        db = connect()
        try:
            row = db.execute("select * from accounts where id = ?", (claims["sub"],)).fetchone()
        finally:
            db.close()
        if row is None:
            self.send_error_body(401, "Sessão ausente.")
            return
        self.send_json(200, user_payload(row, iso(now())))

    def write_table(self, entity: str, raw: bytes) -> None:
        if entity not in TABLES:
            self.send_error_body(404, "Tabela não encontrada.")
            return
        claims = self.account_from_bearer()
        if not claims:
            self.send_error_body(401, "Entre na conta para sincronizar.")
            return
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            self.send_error_body(400, "Pedido inválido.")
            return
        if not isinstance(body, dict) or not isinstance(body.get("id"), str) or not isinstance(body.get("updated_at"), str):
            self.send_error_body(400, "Registro inválido.")
            return
        account_id = claims["sub"]
        with LOCK:
            db = connect()
            try:
                if entity == "users" and body.get("remote_id") != account_id:
                    db.commit()
                    self.send_json(201, [])
                    return
                if not owns_record(db, account_id, entity, body):
                    self.send_error_body(409, "A ficha da conta ainda não chegou.")
                    return
                db.execute(
                    """
                    insert into records (entity, id, owner_id, updated_at, body)
                    values (?, ?, ?, ?, ?)
                    on conflict(entity, id) do update set
                      owner_id = excluded.owner_id,
                      updated_at = excluded.updated_at,
                      body = excluded.body
                    """,
                    (entity, body["id"], account_id, body["updated_at"], json.dumps(body, ensure_ascii=False)),
                )
                db.commit()
            finally:
                db.close()
        self.send_json(201, [])

    def read_table(self, parsed) -> None:
        entity = parsed.path.removeprefix("/rest/v1/")
        if entity not in TABLES:
            self.send_error_body(404, "Tabela não encontrada.")
            return
        claims = self.account_from_bearer()
        if not claims:
            self.send_error_body(401, "Entre na conta para sincronizar.")
            return
        query = parse_qs(parsed.query)
        since = ""
        marker = (query.get("updated_at") or [""])[0]
        if marker.startswith("gt."):
            since = marker[3:]
        db = connect()
        try:
            rows = db.execute(
                "select body from records where entity = ? and owner_id = ? and updated_at > ? order by updated_at",
                (entity, claims["sub"], since),
            ).fetchall()
        finally:
            db.close()
        self.send_json(200, [json.loads(row["body"]) for row in rows])

    def upload_file(self, relative: str, raw: bytes) -> None:
        claims = self.account_from_bearer()
        if not claims:
            self.send_error_body(401, "Entre na conta para sincronizar.")
            return
        target = file_target(claims["sub"], relative)
        if target is None:
            self.send_error_body(403, "Caminho do arquivo recusado.")
            return
        content = self.file_bytes(raw)
        if content is None:
            self.send_error_body(400, "Arquivo vazio.")
            return
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        path = unquote(relative).lstrip("/")
        self.send_json(200, {"Id": path, "Key": f"fieldnotes-files/{path}"})

    def download_file(self, relative: str) -> None:
        claims = self.account_from_bearer()
        if not claims:
            self.send_error_body(401, "Entre na conta para sincronizar.")
            return
        target = file_target(claims["sub"], relative)
        if target is None or not target.is_file():
            self.send_error_body(404, "Arquivo não encontrado.")
            return
        self.send_bytes(200, target.read_bytes(), "application/octet-stream")

    def file_bytes(self, raw: bytes) -> bytes | None:
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type.lower():
            return raw or None
        header = f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode()
        message = message_from_bytes(header + raw, policy=email_policy)
        chosen = b""
        if message.is_multipart():
            for part in message.iter_parts():
                payload = part.get_payload(decode=True)
                if isinstance(payload, bytes) and len(payload) >= len(chosen):
                    chosen = payload
        return chosen or None


def ensure_default_account() -> None:
    if "@" not in BOOT_EMAIL or len(BOOT_PASSWORD) < 6:
        return
    with LOCK:
        db = connect()
        try:
            existing = db.execute("select id from accounts where email = ?", (BOOT_EMAIL,)).fetchone()
            if existing:
                return
            db.execute(
                "insert into accounts (id, email, password_hash, display_name, created_at) values (?, ?, ?, ?, ?)",
                (secrets.token_hex(16), BOOT_EMAIL, hash_password(BOOT_PASSWORD), BOOT_NAME or BOOT_EMAIL, iso(now())),
            )
            db.commit()
        finally:
            db.close()


def main() -> None:
    if not ANON_KEY or not JWT_SECRET:
        raise SystemExit("FIELDNOTES_ANON_KEY e FIELDNOTES_JWT_SECRET são obrigatórios.")
    ensure_default_account()
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"fieldnotes sync em 127.0.0.1:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
