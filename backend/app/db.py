"""Read-only access to the AI_TestCase_Bug_Triage PostgreSQL database for dashboard views.

The workflows write these tables through the MagOneAI Data Store child; this module only reads.
Every query is parameterised. If DATABASE_URL is not configured, `pool()` returns None and the
API falls back to the Triage Data Query use case (slower, LLM-backed).
"""
from __future__ import annotations

import json
from typing import Any

import asyncpg

from .config import settings

_pool: asyncpg.Pool | None = None


async def pool() -> asyncpg.Pool | None:
    global _pool
    if not settings.database_url:
        return None
    if _pool is None:
        _pool = await asyncpg.create_pool(settings.database_url, min_size=1, max_size=5, command_timeout=30)
    return _pool


async def close() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def _row(r: asyncpg.Record) -> dict[str, Any]:
    d = dict(r)
    for k, v in list(d.items()):
        if hasattr(v, "isoformat"):
            d[k] = v.isoformat()
        elif isinstance(v, str) and k in ("acceptance_criteria", "ambiguities", "coverage_gaps", "matches", "assumptions", "review_reasons"):
            try:
                d[k] = json.loads(v)
            except Exception:
                pass
    return d


async def summary(p: asyncpg.Pool) -> dict[str, Any]:
    async with p.acquire() as c:
        counts = await c.fetchrow(
            """SELECT (SELECT count(*) FROM requirements) AS requirements,
                      (SELECT count(*) FROM test_cases) AS test_cases,
                      (SELECT count(*) FROM bug_reports) AS bug_reports,
                      (SELECT count(*) FROM triage_results) AS triage_results,
                      (SELECT count(*) FROM activity_log) AS activity_log,
                      (SELECT count(*) FROM triage_results WHERE needs_human_review) AS needs_review"""
        )
        sev = await c.fetch("SELECT severity, count(*) AS n FROM triage_results GROUP BY severity")
        pri = await c.fetch("SELECT priority, count(*) AS n FROM triage_results GROUP BY priority")
        ver = await c.fetch("SELECT duplicate_verdict, count(*) AS n FROM triage_results GROUP BY duplicate_verdict")
        recent = await c.fetch(
            """SELECT use_case, status, input_summary, created_at FROM activity_log ORDER BY created_at DESC LIMIT 12"""
        )
    return {
        "counts": dict(counts),
        "by_severity": {r["severity"]: r["n"] for r in sev},
        "by_priority": {r["priority"]: r["n"] for r in pri},
        "by_verdict": {r["duplicate_verdict"]: r["n"] for r in ver},
        "recent_activity": [_row(r) for r in recent],
    }


async def bugs(p: asyncpg.Pool, limit: int = 50, offset: int = 0, severity: str | None = None, review_only: bool = False) -> list[dict[str, Any]]:
    where = ["TRUE"]
    args: list[Any] = []
    if severity:
        args.append(severity); where.append(f"t.severity = ${len(args)}")
    if review_only:
        where.append("t.needs_human_review = TRUE")
    args += [limit, offset]
    sql = f"""SELECT b.id, b.title, b.description, b.environment, b.source, b.created_at,
                     t.duplicate_verdict, t.top_bug_id, t.severity, t.priority, t.confidence, t.needs_human_review, t.recommendation
              FROM bug_reports b LEFT JOIN triage_results t ON t.bug_report_id = b.id
              WHERE {' AND '.join(where)} ORDER BY b.created_at DESC LIMIT ${len(args)-1} OFFSET ${len(args)}"""
    async with p.acquire() as c:
        return [_row(r) for r in await c.fetch(sql, *args)]


async def bug(p: asyncpg.Pool, bug_id: str) -> dict[str, Any] | None:
    async with p.acquire() as c:
        b = await c.fetchrow("SELECT * FROM bug_reports WHERE id = $1", bug_id)
        if not b:
            return None
        t = await c.fetchrow("SELECT * FROM triage_results WHERE bug_report_id = $1 ORDER BY created_at DESC LIMIT 1", bug_id)
    return {"bug": _row(b), "triage": _row(t) if t else None}


async def requirements(p: asyncpg.Pool, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
    async with p.acquire() as c:
        rows = await c.fetch(
            """SELECT id, feature_name, summary, total_cases, coverage_score, docx_key, xlsx_key, created_at
               FROM requirements ORDER BY created_at DESC LIMIT $1 OFFSET $2""", limit, offset)
    return [_row(r) for r in rows]


async def requirement(p: asyncpg.Pool, req_id: str) -> dict[str, Any] | None:
    async with p.acquire() as c:
        r = await c.fetchrow("SELECT * FROM requirements WHERE id = $1", req_id)
        if not r:
            return None
        cases = await c.fetch("SELECT * FROM test_cases WHERE requirement_id = $1 ORDER BY tc_id", req_id)
    return {"requirement": _row(r), "test_cases": [_row(x) for x in cases]}


async def activity(p: asyncpg.Pool, limit: int = 100) -> list[dict[str, Any]]:
    async with p.acquire() as c:
        rows = await c.fetch("SELECT * FROM activity_log ORDER BY created_at DESC LIMIT $1", limit)
    return [_row(r) for r in rows]
