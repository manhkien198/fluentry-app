from pydantic import BaseModel, EmailStr


class AuthRequest(BaseModel):
    email: EmailStr
    password: str


class UserProfile(BaseModel):
    id: str
    email: EmailStr
    display_name: str


class AuthResponse(BaseModel):
    access_token: str
    user: UserProfile
