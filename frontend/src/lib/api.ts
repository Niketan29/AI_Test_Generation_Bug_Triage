"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

export type RunStatus = "idle" | "starting" | "pending" | "running" | "waiting_for_input" | "completed" | "failed";

export interface RunResponse {
  execution_id: string;
  status: string;
  output: Record<string, unknown> | null;
  error: unknown;
  poll_token?: string;
  session_id?: string | null;
  files?: unknown[];
}

/** A run as persisted in the browser so it survives navigation and refresh. */
export interface StoredRun<TOut = Record<string, unknown>> {
  id: string;            // execution id
  token: string | null;  // poll token (null once finished)
  path: string;          // backend endpoint used
  payload: unknown;      // what was submitted (to refill the form)
  label: string;         // short human label
  startedAt: number;     // epoch ms
  finishedAt?: number;
  status: RunStatus;
  output: TOut | null;
  error: string | null;
}

export interface SessionUser { id: string; email: string; name: string; role: "admin" | "tester"; trinity_role: string; org_role: string | null; expires_at: string }

/** Send the viewer to the login page when the backend says the session is missing or expired. */
function toLogin() {
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.assign(`/login?next=${next}`);
  }
}

async function parse(res: Response) {
  if (res.status === 401 && !res.url.includes("/api/auth/")) toLogin();
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text.replace(/[\u0000-\u001F]/g, " "));
  } catch {
    /* keep text */
  }
  if (!res.ok) {
    const detail = typeof body === "object" && body && "detail" in body ? (body as { detail: unknown }).detail : body;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return body;
}

export async function apiPost<T = unknown>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  return (await parse(res)) as T;
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  return (await parse(res)) as T;
}

export const auth = {
  me: () => apiGet<SessionUser>("/api/auth/me"),
  login: (email: string, password: string) => apiPost<SessionUser>("/api/auth/login", { email, password }),
  logout: () => apiPost<{ ok: boolean }>("/api/auth/logout", {}),
};

export function fileUrl(key: string) {
  return `${API_BASE}/api/files?key=${encodeURIComponent(key)}`;
}

// ---------- localStorage helpers (every access guarded: private mode, quota, SSR) ----------
const HISTORY_LIMIT = 12;

export function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or blocked storage: the page still works, it just will not remember */
  }
}

const curKey = (k: string) => `run:${k}:current`;
const histKey = (k: string) => `run:${k}:history`;

function errorText(e: unknown): string {
  return typeof e === "string" ? e : e instanceof Error ? e.message : JSON.stringify(e ?? "Run failed");
}

/**
 * Start a backend run and poll until it finishes. The run is persisted under `key`
 * (one per page), so leaving the page or refreshing resumes polling and restores the result.
 */
export function useRun<TOut = Record<string, unknown>>(key: string) {
  const [run, setRun] = useState<StoredRun<TOut> | null>(null);
  const [history, setHistory] = useState<StoredRun<TOut>[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  // The run currently being polled by this mount. `gen` identifies the loop instance, so a loop that
  // was cancelled (unmount, reset, React strict-mode double effect) stops even if the same run is resumed.
  const polling = useRef<{ id: string; gen: number } | null>(null);
  const gen = useRef(0);

  const persist = useCallback((r: StoredRun<TOut> | null) => {
    setRun(r);
    saveJSON(curKey(key), r);
  }, [key]);

  const pushHistory = useCallback((r: StoredRun<TOut>) => {
    setHistory((h) => {
      const next = [r, ...h.filter((x) => x.id !== r.id)].slice(0, HISTORY_LIMIT);
      saveJSON(histKey(key), next);
      return next;
    });
  }, [key]);

  const pollLoop = useCallback(async (r: StoredRun<TOut>) => {
    if (!r.token || polling.current?.id === r.id) return;
    const mine = { id: r.id, gen: ++gen.current };
    polling.current = mine;
    let cur: StoredRun<TOut> = r;
    try {
      while (polling.current === mine) {
        await new Promise((res) => setTimeout(res, 3000));
        if (polling.current !== mine) break;
        const p = await apiGet<RunResponse>(`/api/runs/${r.token}`);
        if (polling.current !== mine) break;
        if (p.status === "completed" || p.status === "failed") {
          cur = {
            ...cur, token: null, finishedAt: Date.now(),
            status: p.status === "failed" ? "failed" : "completed",
            output: p.status === "failed" ? null : ((p.output ?? null) as TOut | null),
            error: p.status === "failed" ? errorText(p.error) : null,
          };
          persist(cur); pushHistory(cur);
          break;
        }
        const st = (p.status as RunStatus) || "running";
        if (st !== cur.status) { cur = { ...cur, status: st }; persist(cur); }
      }
    } catch (e) {
      if (polling.current !== mine) return;
      cur = { ...cur, token: null, status: "failed", error: errorText(e), finishedAt: Date.now() };
      persist(cur); pushHistory(cur);
    } finally {
      if (polling.current === mine) polling.current = null;
    }
  }, [persist, pushHistory]);

  // Hydrate from storage on mount; resume an unfinished run.
  useEffect(() => {
    const cur = loadJSON<StoredRun<TOut> | null>(curKey(key), null);
    const hist = loadJSON<StoredRun<TOut>[]>(histKey(key), []);
    setRun(cur); setHistory(hist); setHydrated(true);
    if (cur && cur.token && cur.status !== "completed" && cur.status !== "failed") void pollLoop(cur);
    return () => { polling.current = null; };
  }, [key, pollLoop]);

  // Elapsed timer derived from startedAt, so it is right after a refresh too.
  useEffect(() => {
    if (!run) { setElapsed(0); return; }
    const tick = () => setElapsed(Math.max(0, Math.round(((run.finishedAt ?? Date.now()) - run.startedAt) / 1000)));
    tick();
    if (run.status === "completed" || run.status === "failed") return;
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [run]);

  const start = useCallback(async (path: string, payload: unknown, label: string) => {
    const startedAt = Date.now();
    const temp: StoredRun<TOut> = { id: `pending-${startedAt}`, token: null, path, payload, label, startedAt, status: "starting", output: null, error: null };
    persist(temp);
    try {
      const first = await apiPost<RunResponse>(path, payload);
      const r: StoredRun<TOut> = { ...temp, id: first.execution_id, token: first.poll_token ?? null, status: (first.status as RunStatus) || "pending" };
      if (first.status === "completed" || first.status === "failed") {
        const done: StoredRun<TOut> = { ...r, token: null, finishedAt: Date.now(), status: first.status === "failed" ? "failed" : "completed", output: (first.output ?? null) as TOut | null, error: first.status === "failed" ? errorText(first.error) : null };
        persist(done); pushHistory(done); return done;
      }
      persist(r);
      void pollLoop(r);
      return r;
    } catch (e) {
      const failed: StoredRun<TOut> = { ...temp, status: "failed", error: errorText(e), finishedAt: Date.now() };
      persist(failed);
      return failed;
    }
  }, [persist, pushHistory, pollLoop]);

  const show = useCallback((r: StoredRun<TOut>) => { persist(r); if (r.token) void pollLoop(r); }, [persist, pollLoop]);
  const reset = useCallback(() => { polling.current = null; persist(null); }, [persist]);
  const clearHistory = useCallback(() => { setHistory([]); saveJSON(histKey(key), []); }, [key]);

  const status: RunStatus = run?.status ?? "idle";
  return {
    run, status, output: run?.output ?? null, error: run?.error ?? null, elapsed, hydrated, history,
    start, show, reset, clearHistory,
    busy: status === "starting" || status === "pending" || status === "running" || status === "waiting_for_input",
  };
}
