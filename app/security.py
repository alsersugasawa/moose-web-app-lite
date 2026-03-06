import re
import time
from collections import defaultdict
from datetime import datetime, timedelta
from threading import Lock
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from app.settings import settings


# --- Password ---

class PasswordValidator:
    MIN_LENGTH = 8
    MAX_LENGTH = 128
    COMMON_PASSWORDS = {"password", "password1", "123456789", "qwerty123", "letmein"}

    @classmethod
    def validate(cls, password: str) -> list[str]:
        errors = []
        if len(password) < cls.MIN_LENGTH:
            errors.append(f"Password must be at least {cls.MIN_LENGTH} characters")
        if len(password) > cls.MAX_LENGTH:
            errors.append(f"Password must not exceed {cls.MAX_LENGTH} characters")
        if not re.search(r"[A-Z]", password):
            errors.append("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", password):
            errors.append("Password must contain at least one lowercase letter")
        if not re.search(r"\d", password):
            errors.append("Password must contain at least one digit")
        if password.lower() in cls.COMMON_PASSWORDS:
            errors.append("Password is too common")
        return errors


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# --- JWT ---

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    payload = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload["exp"] = expire
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None


# --- Rate limiter (in-memory, sliding window) ---

class _RateLimiter:
    def __init__(self) -> None:
        self._store: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> bool:
        if not settings.rate_limit_enabled:
            return True
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            timestamps = self._store[key]
            # Remove expired entries
            self._store[key] = [t for t in timestamps if t > cutoff]
            if len(self._store[key]) >= max_requests:
                return False
            self._store[key].append(now)
            return True


rate_limiter = _RateLimiter()


# --- Input sanitization ---

def sanitize_input(value: str, max_length: int = 1000) -> str:
    value = value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    value = value.replace('"', "&quot;").replace("'", "&#x27;")
    value = value.replace("\x00", "")
    return value[:max_length]
