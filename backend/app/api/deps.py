from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.utils.security import decode_access_token
from app.models.entities import User, Store

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception

    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise credentials_exception
    return user


def verify_store_access(
    store_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Store:
    """
    Ensures the authenticated user has authorization for the specified store.
    Prevents cross-tenant data access.
    """
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    if current_user.role != "admin" and store.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this store")

    return store

