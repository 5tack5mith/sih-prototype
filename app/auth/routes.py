from fastapi import APIRouter, Depends, HTTPException

from .database import get_user, create_user, username_exists
from .security import hash_password, verify_password, create_access_token
from .schemas import RegisterRequest, LoginRequest, TokenResponse, UserOut
from .dependencies import get_current_user, require_admin

router = APIRouter(tags=["auth"])


@router.post("/register", response_model=UserOut)
def register(payload: RegisterRequest, _admin=Depends(require_admin)):
    if username_exists(payload.username):
        raise HTTPException(status_code=400, detail="Username already taken")
    create_user(payload.username, hash_password(payload.password), payload.role)
    return UserOut(username=payload.username, role=payload.role)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    user = get_user(payload.username)
    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    token = create_access_token(username=user["username"], role=user["role"])
    return TokenResponse(access_token=token, role=user["role"], username=user["username"])


@router.get("/me", response_model=UserOut)
def me(user: dict = Depends(get_current_user)):
    return UserOut(username=user["username"], role=user["role"])
