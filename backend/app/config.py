"""Backend settings. Values come from environment variables or backend/.env (never commit .env)."""
from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # MagOneAI external trigger API (project API key)
    magone_base_url: str = "https://trinity.magure.ai"
    magone_api_key_id: str = Field(..., description="API key id (uuid) from the MagOneAI project API keys page")
    magone_api_secret: str = Field(..., description="The magk_ secret; shown once at creation")

    # Direct PostgreSQL access for dashboard reads (the same database the workflows write to).
    # Optional: without it the dashboard endpoints fall back to the Triage Data Query use case.
    database_url: str | None = None

    # Comma-separated origins allowed to call this API (the Next.js dev server by default)
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Use case slugs on the MagOneAI project. Slugs are stable; ids would work too.
    uc_test_case_generator: str = "test-case-generator"
    uc_bug_triage: str = "bug-triage"
    uc_batch_bug_triage: str = "batch-bug-triage"
    uc_duplicate_finder: str = "duplicate-bug-finder"
    uc_severity: str = "severity-priority-recommender"
    uc_data_query: str = "triage-data-query"
    uc_copilot: str = "qa-copilot"
    uc_dashboard: str = "dashboard-data"  # fixed-SQL feed used when DATABASE_URL is not set
    dashboard_cache_seconds: int = 20

    # Sign-in with Trinity (MagOneAI) credentials: the backend verifies them against the platform,
    # requires membership of this project, then issues its own session cookie.
    app_secret: str = Field(..., description="Long random string used to sign app session tokens")
    session_days: int = 7
    trinity_project_id: str = Field(..., description="Only members of this MagOneAI project may sign in")
    cookie_secure: bool = False  # set true behind HTTPS in production

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def runnable_use_cases(self) -> dict[str, str]:
        """Friendly name -> slug. Only these can be triggered through /api/runs."""
        return {
            "test-case-generator": self.uc_test_case_generator,
            "bug-triage": self.uc_bug_triage,
            "batch-bug-triage": self.uc_batch_bug_triage,
            "duplicate-bug-finder": self.uc_duplicate_finder,
            "severity-priority-recommender": self.uc_severity,
            "triage-data-query": self.uc_data_query,
            "qa-copilot": self.uc_copilot,
        }


settings = Settings()
