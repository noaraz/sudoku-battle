from functools import lru_cache
from typing import Literal

from pydantic import model_validator
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
    cors_origin_regex: str = ""  # e.g. https://sudoku-battle-[a-z0-9]+-zf\.a\.run\.app
    port: int = 8001
    firestore_database: str = "(default)"

    @model_validator(mode="after")
    def cors_origins_not_wildcard(self) -> "Settings":
        if "*" in self.cors_origins:
            raise ValueError(
                "cors_origins must not contain '*' — required because "
                "allow_credentials=True is set in the CORS middleware"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
