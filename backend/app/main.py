"""FastAPI backend for the AI Test Case Generation & Bug Triage app.

Responsibilities:
- Keep the MagOneAI API secret server-side and sign every call (the browser never sees it).
- Expose typed endpoints per use case plus a generic run/poll pair.
- Proxy file downloads (DOCX/XLSX rendered by the Test Case Generator).
- Serve dashboard reads from PostgreSQL when DATABASE_URL is set, otherwise via the Dashboard Data use case.
- Require the app session cookie on every /api/* route except auth and health (see auth.py).
"""
from __future__ import annotations

import re
from contextlib import asynccontextmanager
from typing import Any, Literal

from fastapi import Depends, FastAPI, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import db
from .config import settings
from .magone import client

UseCaseName = Literal[
    "test-case-generator", "bug-triage", "batch-bug-triage", "duplicate-bug-finder",
    "severity-priority-recommender", "triage-data-query", "qa-copilot",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await client.aclose()
    await db.close()


app = FastAPI(title="AI Test Case & Bug Triage API", version="0.2.0", lifespan=lifespan)
# Order matters: the session check runs inside CORS, so preflights and 401s still carry CORS headers.
from .auth import SessionMiddleware, router as auth_router  # noqa: E402

app.add_middleware(SessionMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_list, allow_methods=["*"], allow_headers=["*"], allow_credentials=True)
app.include_router(auth_router)


# ---------- models ----------
class RunRequest(BaseModel):
    use_case: UseCaseName
    input: dict[str, Any]
    wait: bool = Field(False, description="Wait up to ~60s for the result instead of returning a poll token")
    session_id: str | None = Field(None, description="Chat session to continue (qa-copilot only)")


class GenerateRequest(BaseModel):
    requirement: str = Field(..., min_length=1)
    feature_name: str | None = None


class BugRequest(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    steps_to_reproduce: str | None = None
    environment: str | None = None
    affected_users: str | None = None


class BatchRequest(BaseModel):
    bugs: list[BugRequest] = Field(..., min_length=1, max_length=25)


class QuestionRequest(BaseModel):
    question: str = Field(..., min_length=1)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    session_id: str | None = None


def _clean(d: dict[str, Any]) -> dict[str, Any]:
    """Drop None/empty optional fields so the START schema sees only provided values."""
    return {k: v for k, v in d.items() if v not in (None, "")}


# ---------- generic run / poll ----------
@app.post("/api/runs", tags=["runs"])
async def start_run(req: RunRequest):
    slug = settings.runnable_use_cases[req.use_case]
    return await client.run(slug, req.input, wait=req.wait, session_id=req.session_id)


@app.get("/api/runs/{poll_token}", tags=["runs"])
async def poll_run(poll_token: str):
    return await client.poll(poll_token)


# ---------- typed convenience endpoints (all async: they return a poll_token) ----------
@app.post("/api/test-cases/generate", tags=["test cases"])
async def generate_test_cases(req: GenerateRequest):
    return await client.run(settings.uc_test_case_generator, _clean(req.model_dump()))


@app.post("/api/bugs/triage", tags=["bugs"])
async def triage_bug(req: BugRequest):
    payload = _clean(req.model_dump(exclude={"affected_users"}))
    return await client.run(settings.uc_bug_triage, payload)


@app.post("/api/bugs/batch", tags=["bugs"])
async def triage_batch(req: BatchRequest):
    return await client.run(settings.uc_batch_bug_triage, {"bugs": [_clean(b.model_dump(exclude={"affected_users"})) for b in req.bugs]})


@app.post("/api/bugs/duplicates", tags=["bugs"])
async def find_duplicates(req: BugRequest):
    return await client.run(settings.uc_duplicate_finder, {"title": req.title, "description": req.description})


@app.post("/api/bugs/severity", tags=["bugs"])
async def recommend_severity(req: BugRequest):
    return await client.run(settings.uc_severity, _clean(req.model_dump(exclude={"steps_to_reproduce"})))


@app.post("/api/query", tags=["data"])
async def ask_data(req: QuestionRequest):
    """Natural-language question over the stored QA data. Synchronous: usually answers in under 60s."""
    return await client.run(settings.uc_data_query, {"question": req.question}, wait=True)


@app.post("/api/chat", tags=["chat"])
async def chat(req: ChatRequest):
    """QA Copilot turn. Pass back session_id from the first response to keep the conversation."""
    return await client.run(settings.uc_copilot, {"message": req.message}, session_id=req.session_id)


@app.get("/api/chat/sessions", tags=["chat"])
async def chat_sessions():
    return await client.sessions(settings.uc_copilot)


@app.get("/api/chat/sessions/{session_id}/messages", tags=["chat"])
async def chat_messages(session_id: str):
    return await client.session_messages(session_id)


# ---------- files ----------
@app.get("/api/files", tags=["files"])
async def download_file(key: str = Query(..., description="Storage key returned as docx_key / xlsx_key")):
    r = await client.export(key)
    # Keys look like exports/<project>/<uuid>_<name>.docx; keep the human name (which may itself contain "_").
    filename = key.rsplit("/", 1)[-1]
    filename = re.sub(r"^[0-9a-fA-F-]{32,36}_", "", filename) or "download"
    mime = {
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".pdf": "application/pdf", ".csv": "text/csv", ".md": "text/markdown", ".json": "application/json", ".txt": "text/plain",
    }
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    ct = mime.get(ext) or r.headers.get("content-type", "application/octet-stream")
    return StreamingResponse(iter([r.content]), media_type=ct, headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@app.post("/api/files/upload", tags=["files"])
async def upload(file: UploadFile):
    return await client.upload_file(file.filename or "upload", await file.read(), file.content_type or "application/octet-stream")


# ---------- dashboard reads ----------
# Two sources, same response shapes: direct SQL when DATABASE_URL is set, otherwise the "Dashboard Data"
# workflow (fixed SQL through the MagOneAI database connection, no LLM), cached briefly.
import asyncio
import time as _time

_feed_cache: dict[str, Any] = {"at": 0.0, "data": None}
_feed_lock = asyncio.Lock()


def _num(v: Any) -> Any:
    if isinstance(v, str):
        try:
            return int(v) if v.isdigit() else float(v)
        except ValueError:
            return v
    return v


def _norm_rows(rows: list[dict[str, Any]] | None, desc_key: str | None = None) -> list[dict[str, Any]]:
    out = []
    for r in rows or []:
        d = {k: (_num(v) if k in ("confidence", "coverage_score", "total_cases", "n") else v) for k, v in r.items()}
        if "needs_human_review" in d and isinstance(d["needs_human_review"], str):
            d["needs_human_review"] = d["needs_human_review"].lower() in ("true", "t", "1")
        out.append(d)
    if desc_key:
        out.sort(key=lambda x: str(x.get(desc_key) or ""), reverse=True)
    return out


async def _feed() -> dict[str, Any]:
    """The Dashboard Data workflow output, cached for a few seconds."""
    async with _feed_lock:
        if _feed_cache["data"] is not None and _time.time() - _feed_cache["at"] < settings.dashboard_cache_seconds:
            return _feed_cache["data"]
        r = await client.run(settings.uc_dashboard, {}, wait=True)
        if r.get("status") != "completed":
            raise HTTPException(502, f"Dashboard feed did not complete: {r.get('error') or r.get('status')}")
        o = r.get("output") or {}
        counts_row = (o.get("counts") or [{}])[0]
        data = {
            "counts": {k: _num(v) for k, v in counts_row.items()},
            "by_severity": {x["severity"]: _num(x["n"]) for x in o.get("by_severity") or [] if x.get("severity")},
            "by_priority": {x["priority"]: _num(x["n"]) for x in o.get("by_priority") or [] if x.get("priority")},
            "by_verdict": {x["duplicate_verdict"]: _num(x["n"]) for x in o.get("by_verdict") or [] if x.get("duplicate_verdict")},
            "activity": _norm_rows(o.get("recent_activity"), "created_at"),
            "bugs": _norm_rows(o.get("recent_bugs"), "created_at"),
            "requirements": _norm_rows(o.get("recent_requirements"), "created_at"),
        }
        _feed_cache.update(at=_time.time(), data=data)
        return data


@app.get("/api/dashboard/summary", tags=["dashboard"])
async def dashboard_summary():
    p = await db.pool()
    if p:
        return await db.summary(p)
    f = await _feed()
    return {"counts": f["counts"], "by_severity": f["by_severity"], "by_priority": f["by_priority"], "by_verdict": f["by_verdict"], "recent_activity": f["activity"][:12], "source": "workflow"}


@app.get("/api/bugs", tags=["dashboard"])
async def list_bugs(limit: int = 50, offset: int = 0, severity: str | None = None, review_only: bool = False):
    p = await db.pool()
    if p:
        return await db.bugs(p, limit=min(limit, 200), offset=offset, severity=severity, review_only=review_only)
    rows = (await _feed())["bugs"]
    if severity:
        rows = [r for r in rows if r.get("severity") == severity]
    if review_only:
        rows = [r for r in rows if r.get("needs_human_review")]
    return rows[offset: offset + min(limit, 200)]


@app.get("/api/bugs/{bug_id}", tags=["dashboard"])
async def get_bug(bug_id: str):
    p = await db.pool()
    if p:
        r = await db.bug(p, bug_id)
    else:
        row = next((b for b in (await _feed())["bugs"] if b.get("id") == bug_id), None)
        r = {"bug": row, "triage": row} if row else None
    if not r:
        raise HTTPException(404, "Bug report not found")
    return r


@app.get("/api/requirements", tags=["dashboard"])
async def list_requirements(limit: int = 50, offset: int = 0):
    p = await db.pool()
    if p:
        return await db.requirements(p, limit=min(limit, 200), offset=offset)
    return (await _feed())["requirements"][offset: offset + min(limit, 200)]


@app.get("/api/requirements/{req_id}", tags=["dashboard"])
async def get_requirement(req_id: str):
    p = await db.pool()
    if not p:
        raise HTTPException(503, "Test case listing per requirement needs DATABASE_URL; the dashboard feed carries requirement summaries only.")
    r = await db.requirement(p, req_id)
    if not r:
        raise HTTPException(404, "Requirement not found")
    return r


@app.get("/api/activity", tags=["dashboard"])
async def list_activity(limit: int = 100):
    p = await db.pool()
    if p:
        return await db.activity(p, limit=min(limit, 500))
    return (await _feed())["activity"][: min(limit, 500)]


@app.get("/api/health", tags=["meta"])
async def health():
    return {"ok": True, "database": bool(settings.database_url), "use_cases": list(settings.runnable_use_cases)}
