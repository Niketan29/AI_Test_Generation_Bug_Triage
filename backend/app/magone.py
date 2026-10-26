"""HMAC-signed client for the MagOneAI external trigger API (project API keys).

Signature scheme (verified live): X-Signature = hex(HMAC_SHA256(secret, f"{timestamp}.{raw_body}")),
X-Timestamp = unix seconds. GET requests sign an empty body ("{timestamp}.").
The use case must be PUBLISHED; the hook returns 404 for every failure by design.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any

import httpx
from fastapi import HTTPException

from .config import settings

_lenient = json.JSONDecoder(strict=False)


def _parse(text: str) -> Any:
    try:
        return _lenient.decode(text)
    except Exception:
        return {"raw": text}


class MagOneClient:
    def __init__(self) -> None:
        self.base = settings.magone_base_url.rstrip("/") + "/api/v1"
        self.key_id = settings.magone_api_key_id
        self.secret = settings.magone_api_secret.encode()
        # The instance occasionally drops connections; retry connects at the transport level.
        self._http = httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=20.0), transport=httpx.AsyncHTTPTransport(retries=3))

    async def _request(self, method: str, url: str, **kw) -> httpx.Response:
        last: Exception | None = None
        for attempt in range(3):
            try:
                return await self._http.request(method, url, **kw)
            except httpx.RequestError as e:  # connect/read errors, not HTTP status errors
                last = e
                await __import__("asyncio").sleep(1.5 * (attempt + 1))
        raise HTTPException(502, f"Could not reach MagOneAI after 3 attempts: {type(last).__name__}: {last}")

    def _headers(self, raw_body: str) -> dict[str, str]:
        ts = str(int(time.time()))
        sig = hmac.new(self.secret, f"{ts}.{raw_body}".encode(), hashlib.sha256).hexdigest()
        return {"X-Signature": sig, "X-Timestamp": ts}

    @property
    def hook(self) -> str:
        return f"{self.base}/hooks/{self.key_id}"

    async def run(self, use_case: str, input: dict[str, Any], wait: bool = False, session_id: str | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {"use_case_id": use_case, "input": input}
        if session_id:
            body["session_id"] = session_id
        raw = json.dumps(body, separators=(",", ":"), ensure_ascii=False)
        headers = {**self._headers(raw), "Content-Type": "application/json"}
        r = await self._request("POST", self.hook, params={"wait": "true"} if wait else None, content=raw.encode(), headers=headers)
        if r.status_code == 404:
            raise HTTPException(502, "MagOneAI rejected the run (404): the use case is unpublished, the key is wrong, or the signature failed.")
        if r.status_code == 422:
            raise HTTPException(422, _parse(r.text))
        if r.status_code >= 400:
            raise HTTPException(502, f"MagOneAI error {r.status_code}: {r.text[:500]}")
        return _parse(r.text)

    async def poll(self, token: str) -> dict[str, Any]:
        r = await self._request("GET", f"{self.base}/poll/{token}")
        if r.status_code == 404:
            raise HTTPException(404, "Unknown or expired poll token.")
        if r.status_code >= 400:
            raise HTTPException(502, f"MagOneAI poll error {r.status_code}: {r.text[:300]}")
        return _parse(r.text)

    async def export(self, key: str) -> httpx.Response:
        """Download a file rendered by a workflow (DOCX/XLSX) by its storage key."""
        r = await self._request("GET", f"{self.hook}/exports", params={"key": key}, headers=self._headers(""))
        if r.status_code == 404:
            # The platform only serves exports to the API key whose run produced them.
            raise HTTPException(404, "File not available: it was produced by a run made outside this app (or with a different API key), so the platform will not serve it here. Re-run the generation from this app to get a downloadable copy.")
        if r.status_code >= 400:
            raise HTTPException(502, f"MagOneAI export error {r.status_code}: {r.text[:300]}")
        return r

    async def sessions(self, use_case: str) -> dict[str, Any]:
        r = await self._request("GET", f"{self.hook}/sessions", params={"use_case_id": use_case}, headers=self._headers(""))
        if r.status_code >= 400:
            raise HTTPException(502, f"MagOneAI sessions error {r.status_code}: {r.text[:300]}")
        return _parse(r.text)

    async def session_messages(self, session_id: str) -> dict[str, Any]:
        r = await self._request("GET", f"{self.hook}/sessions/{session_id}/messages", headers=self._headers(""))
        if r.status_code >= 400:
            raise HTTPException(502, f"MagOneAI messages error {r.status_code}: {r.text[:300]}")
        return _parse(r.text)

    async def upload_file(self, filename: str, content: bytes, content_type: str) -> dict[str, Any]:
        r = await self._request("POST", f"{self.hook}/files", files={"file": (filename, content, content_type)}, headers=self._headers(""))
        if r.status_code >= 400:
            raise HTTPException(502, f"MagOneAI upload error {r.status_code}: {r.text[:300]}")
        return _parse(r.text)

    async def aclose(self) -> None:
        await self._http.aclose()


client = MagOneClient()
