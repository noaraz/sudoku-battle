from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    firestore_project_id: str = "sudoku-battle"
    cors_origins: list[str] = ["http://localhost:5173"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
