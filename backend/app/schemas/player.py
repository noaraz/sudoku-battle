from datetime import datetime

from pydantic import BaseModel, field_validator


class PlayerCreate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name cannot be empty")
        return v


class PlayerOut(BaseModel):
    name: str
    wins: int
    played: int
    created_at: datetime
