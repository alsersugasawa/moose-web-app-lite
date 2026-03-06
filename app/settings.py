import os
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Moose Web App Lite"
    app_env: str = "development"
    secret_key: str = "change-me-in-production-use-a-long-random-string"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    database_url: str = "sqlite+aiosqlite:///./data/app.db"

    # Registration
    invite_only: bool = False

    # Security
    rate_limit_enabled: bool = True
    security_headers_enabled: bool = True

    # App
    app_base_url: str = "http://localhost:8000"

    # Optional SMTP (leave blank to get reset tokens in API response)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@example.com"
    smtp_tls: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
