from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
    )

    app_env: Literal["local", "production"] = "local"
    gcp_project_id: str = "sudoku-battle-local"
    firestore_emulator_host: str | None = None
    cors_origins: list[str] = ["http://localhost:5174"]
    port: int = 8001


@lru_cache
def get_settings() -> Settings:
    return Settings()
