"""Sign in with Trinity (MagOneAI) credentials.

Flow: POST /api/auth/login forwards email+password ONCE to Trinity's login route (never stored),
reads the profile, checks membership of the configured project, then issues this app's own
session cookie (signed JWT, HttpOnly). Every /api/* route except /api/auth/* and /api/health
requires that cookie; the middleware below enforces it.
"""
from __future__ import annotations

import datetime as dt
from typing import Any

import httpx
import jwt
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.base import BaseHTTPMiddleware

from .config import settings

COOKIE = "tp_session"
PUBLIC_PREFIXES = ("/api/auth/", "/api/health", "/docs", "/openapi.json", "/redoc")
router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Trinity passwords are at least 8 characters")


class SessionUser(BaseModel):
    id: str
    email: str
    name: str
    role: str  # admin | tester
    trinity_role: str  # admin | member on the project
    org_role: str | None = None
    expires_at: str


# ---------- token helpers ----------
def _issue(user: dict[str, Any]) -> tuple[str, dt.datetime]:
    exp = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=settings.session_days)
    payload = {**user, "exp": exp, "iat": dt.datetime.now(dt.timezone.utc), "iss": "testpilot-qa"}
    return jwt.encode(payload, settings.app_secret, algorithm="HS256"), exp


def _verify(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.app_secret, algorithms=["HS256"], issuer="testpilot-qa")
    except jwt.PyJWTError:
        return None


def _set_cookie(resp: Response, token: str, exp: dt.datetime) -> None:
    resp.set_cookie(COOKIE, token, httponly=True, samesite="lax", secure=settings.cookie_secure, expires=exp, path="/")


# ---------- Trinity calls ----------
async def _trinity_verify(email: str, password: str) -> dict[str, Any]:
    """Return {profile, membership} or raise HTTPException with a user-facing message."""
    base = settings.magone_base_url.rstrip("/") + "/api/v1"
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=15.0), transport=httpx.AsyncHTTPTransport(retries=2)) as c:
        try:
            r = await c.post(f"{base}/auth/login", json={"email": email, "password": password}, headers={"X-Requested-With": "XMLHttpRequest"})
        except httpx.RequestError as e:
            raise HTTPException(502, f"Could not reach Trinity to verify the login ({type(e).__name__}). Try again in a moment.")
        if r.status_code == 401:
            raise HTTPException(401, "Email or password is incorrect.")
        if r.status_code == 429:
            raise HTTPException(429, "Too many login attempts. Wait a minute and try again.")
        if r.status_code != 200:
            raise HTTPException(502, f"Trinity login failed ({r.status_code}).")
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if body.get("mfa_required"):
            raise HTTPException(403, "This Trinity account has two-factor authentication enabled, which this app does not support yet.")

        me = await c.get(f"{base}/auth/me")
        if me.status_code != 200:
            raise HTTPException(502, "Trinity accepted the password but did not return a profile.")
        profile = me.json()
        if not profile.get("is_active", True):
            raise HTTPException(403, "This Trinity account is inactive.")

        mem = await c.get(f"{base}/projects/{settings.trinity_project_id}/members")
        rows = mem.json() if mem.status_code == 200 and mem.headers.get("content-type", "").startswith("application/json") else []
        rows = rows if isinstance(rows, list) else rows.get("items", [])
        mine = next((m for m in rows if m.get("user_id") == profile.get("id")), None)
        if not mine and mem.status_code != 200:
            # Non-admin members may not be allowed to list members; fall back to "can this account see the project?".
            projs = await c.get(f"{base}/projects/", params={"limit": 100})
            plist = projs.json() if projs.status_code == 200 else []
            plist = plist if isinstance(plist, list) else plist.get("items", [])
            if any(p.get("id") == settings.trinity_project_id for p in plist):
                mine = {"user_id": profile.get("id"), "role": "member"}
        if not mine:
            raise HTTPException(403, "Your Trinity account is not a member of the AI_TestCase_Bug_Traige project. Ask a project admin to add you.")
        try:
            await c.post(f"{base}/auth/logout", json={}, headers={"X-Requested-With": "XMLHttpRequest"})
        except httpx.RequestError:
            pass
    return {"profile": profile, "membership": mine}


# ---------- routes ----------
@router.post("/login", response_model=SessionUser)
async def login(req: LoginRequest, response: Response):
    data = await _trinity_verify(str(req.email), req.password)
    p, m = data["profile"], data["membership"]
    trinity_role = str(m.get("role") or "member")
    user = {
        "sub": p["id"], "email": p.get("email", str(req.email)), "name": p.get("display_name") or p.get("email"),
        "role": "admin" if trinity_role == "admin" else "tester", "trinity_role": trinity_role, "org_role": m.get("org_role"),
    }
    token, exp = _issue(user)
    _set_cookie(response, token, exp)
    return SessionUser(id=user["sub"], email=user["email"], name=user["name"], role=user["role"], trinity_role=trinity_role, org_role=user["org_role"], expires_at=exp.isoformat())


@router.get("/me", response_model=SessionUser)
async def me(request: Request):
    u = getattr(request.state, "user", None) or _verify(request.cookies.get(COOKIE, ""))
    if not u:
        raise HTTPException(401, "Not signed in.")
    exp = dt.datetime.fromtimestamp(u["exp"], dt.timezone.utc) if isinstance(u.get("exp"), (int, float)) else u.get("exp")
    return SessionUser(id=u["sub"], email=u["email"], name=u["name"], role=u["role"], trinity_role=u.get("trinity_role", ""), org_role=u.get("org_role"), expires_at=exp.isoformat() if hasattr(exp, "isoformat") else str(exp))


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


# ---------- enforcement ----------
class SessionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if request.method == "OPTIONS" or not path.startswith("/api/") or path.startswith(PUBLIC_PREFIXES):
            return await call_next(request)
        u = _verify(request.cookies.get(COOKIE, ""))
        if not u:
            from fastapi.responses import JSONResponse
            return JSONResponse({"detail": "Not signed in."}, status_code=401)
        request.state.user = u
        return await call_next(request)


def current_user(request: Request) -> dict[str, Any]:
    u = getattr(request.state, "user", None)
    if not u:
        raise HTTPException(401, "Not signed in.")
    return u
