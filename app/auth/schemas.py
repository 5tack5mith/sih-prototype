"""Request/response models for the authorization module."""
from pydantic import BaseModel
from typing import Literal

Role = Literal["admin", "investigator"]


class RegisterRequest(BaseModel):
    username: str
    password: str
    role: Role


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: Role
    username: str


class UserOut(BaseModel):
    username: str
    role: Role
