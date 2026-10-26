# TestPilot QA — AI Test Case Generation & Bug Triage

Full-stack app over the MagOneAI workflows in project **AI_TestCase_Bug_Traige** (trinity.magure.ai).

- `frontend/` — Next.js 15 (App Router, TypeScript, Tailwind v4). Talks only to the backend.
- `backend/` — FastAPI. Holds the MagOneAI API key, signs every call (HMAC), proxies runs, polling and file downloads, and reads the PostgreSQL tables for the dashboard.

```
browser ──> Next.js (3000) ──> FastAPI (8001) ──HMAC──> MagOneAI hooks API ──> published use cases
                                      └──SQL (optional DATABASE_URL)──> PostgreSQL (same DB the workflows write)
```

## Run it

Backend (Windows PowerShell or Git Bash):

```bash
cd backend
python -m venv .venv            # first time
.venv/Scripts/python -m pip install -r requirements.txt
cp .env.example .env            # then fill MAGONE_API_KEY_ID / MAGONE_API_SECRET (already done on this machine)
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8001
```

Frontend:

```bash
cd frontend
npm install
npm run dev                     # http://localhost:3000  (NEXT_PUBLIC_API_URL in .env.local points at :8001)
```

Interactive API docs: http://localhost:8001/docs

## Pages

| Page | Backend endpoint | MagOneAI use case |
|---|---|---|
| `/` Dashboard | `GET /api/dashboard/summary`, `/api/bugs`, `/api/requirements` (needs `DATABASE_URL`; falls back to `/api/query`) | Triage Data Query (fallback) |
| `/test-cases` | `POST /api/test-cases/generate` → poll `GET /api/runs/{token}`; files via `GET /api/files?key=` | Test Case Generator |
| `/bugs` | `POST /api/bugs/triage` · `/api/bugs/duplicates` · `/api/bugs/severity` | Bug Triage · Duplicate Bug Finder · Severity & Priority Recommender |
| `/batch` | `POST /api/bugs/batch` | Batch Bug Triage |
| `/chat` | `POST /api/chat` (keeps `session_id`) | QA Copilot |
| `/data` | `POST /api/query` (synchronous) | Triage Data Query |

Generic: `POST /api/runs {use_case, input, wait?, session_id?}` for any of the seven allow-listed use cases.

## Environment

`backend/.env` (git-ignored):

| Variable | Purpose |
|---|---|
| `MAGONE_BASE_URL` | `https://trinity.magure.ai` |
| `MAGONE_API_KEY_ID` / `MAGONE_API_SECRET` | Project API key. Secret never leaves the backend. |
| `DATABASE_URL` | Optional. Postgres URI of the same database behind the MCP connection "AI_TestCase_Bug_Triage". Enables the live dashboard tables. |
| `CORS_ORIGINS` | Comma-separated allowed origins (defaults to the dev server). |

`frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8001`.

## Authentication (sign in with Trinity)

- `POST /api/auth/login` forwards the email and password **once** to Trinity's own login route (`/api/v1/auth/login`), reads the profile (`/auth/me`) and checks membership of the project in `TRINITY_PROJECT_ID` (`/projects/{id}/members`). Passwords are never stored.
- On success the backend sets an HttpOnly cookie `tp_session` (signed JWT, `SESSION_DAYS`, default 7). Project role maps to app role: admin → `admin`, member → `tester`.
- Every `/api/*` route except `/api/auth/*` and `/api/health` requires the cookie (401 otherwise). The frontend sends `credentials: "include"` and redirects to `/login` on 401.
- `GET /api/auth/me` returns the session user; `POST /api/auth/logout` clears the cookie.
- Not supported yet: Trinity accounts with MFA, and Microsoft-only accounts without a password.
- Production: serve frontend and backend under one HTTPS domain and set `COOKIE_SECURE=true`.

## Notes

- Runs are asynchronous: the backend returns a `poll_token`, the page polls every 3 s. Test case generation takes about 2 minutes, a triage about 1 minute.
- Files (DOCX/XLSX) are downloaded through the backend by storage key; the hooks API only serves files produced by runs made with this API key.
- Invalid inputs come back as `status: "invalid"` with a message and are not stored.
- Authentication is enforced by the backend session cookie (see above). Requirements generated before the current API key was created (`MAGONE_API_KEY_ID`) show a 404 on their download links because the platform only serves exports to the key that produced them; re-run the generation from the app for a downloadable copy.
