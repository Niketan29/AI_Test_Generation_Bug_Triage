"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/api";
import {
  Zap,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  Loader2,
  ArrowRight,
  Database,
  FileCheck2,
  Bug,
  AlertCircle,
  Sparkles,
} from "lucide-react";

const FEATURES = [
  {
    icon: FileCheck2,
    title: "Test cases from requirements",
    text: "Positive, negative and boundary suites with Word and Excel exports.",
  },
  {
    icon: Bug,
    title: "Bug triage and duplicate detection",
    text: "Severity, priority and matches against the known-bug knowledge base.",
  },
  {
    icon: Database,
    title: "Everything stored and queryable",
    text: "Requirements, cases and verdicts land in Postgres and can be asked in plain English.",
  },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Only ever redirect inside this app (a `next` like "//evil.com" or "https://..." is ignored).
  const rawNext = params.get("next") || "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    auth
      .me()
      .then(() => router.replace(next))
      .catch(() => setChecking(false));
  }, [router, next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await auth.login(email.trim(), password);
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const canSubmit = !busy && email.trim().length > 3 && password.length >= 8;

  if (checking) {
    return (
      <div className="flex min-h-[22rem] flex-col items-center justify-center gap-3 text-sm text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        <span>Checking for an existing session…</span>
      </div>
    );
  }

  return (
    <form className="grid gap-5" onSubmit={submit} noValidate>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">Use your Trinity (MagOneAI) account.</p>
      </div>

      <div className="grid gap-4">
        <label className="grid gap-1.5" htmlFor="email">
          <span className="text-xs font-semibold text-slate-700">Work email</span>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              className="login-input pl-10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@magureinc.com"
              required
              autoFocus
              disabled={busy}
            />
          </div>
        </label>

        <label className="grid gap-1.5" htmlFor="password">
          <span className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Password</span>
            <a
              href="https://trinity.magure.ai"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-teal-700 hover:underline"
            >
              Forgot it? Reset in Trinity
            </a>
          </span>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              className="login-input pl-10 pr-12"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              disabled={busy}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute inset-y-0 right-1.5 my-auto grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label={show ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      <button
        type="submit"
        className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 text-sm font-semibold text-white shadow-lg shadow-teal-600/25 transition-all hover:from-teal-500 hover:to-teal-400 hover:shadow-teal-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        disabled={!canSubmit}
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Signing in…</span>
          </>
        ) : (
          <>
            <span>Continue</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
        <span>
          Your password is sent to Trinity once to verify it and is never stored here. Only members of the
          AI_TestCase_Bug_Traige project can sign in. Sessions last 7 days.
        </span>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="login-bg relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-teal-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-48 -right-32 h-[34rem] w-[34rem] rounded-full bg-indigo-500/20 blur-[120px]" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#0b1120] shadow-2xl shadow-black/50 lg:grid-cols-[1.05fr_1fr]">
        {/* Brand panel */}
        <section className="relative flex flex-col justify-between gap-10 p-8 text-slate-200 sm:p-10 lg:p-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_0%,rgba(20,184,166,0.18),transparent)]" />

          <div className="relative flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 shadow-lg shadow-teal-500/30">
              <Zap className="h-5 w-5 fill-slate-950 stroke-slate-950" />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-2 text-lg font-bold tracking-tight text-white">
                TestPilot
                <span className="rounded-md border border-teal-500/30 bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-300">
                  QA
                </span>
              </div>
              <div className="text-xs text-slate-400">AI test case generation and bug triage</div>
            </div>
          </div>

          <div className="relative">
            <h2 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-[2.1rem]">
              Turn requirements into test suites.
              <br />
              <span className="bg-gradient-to-r from-teal-300 to-emerald-300 bg-clip-text text-transparent">
                Triage bugs in seconds.
              </span>
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
              Built on MagOneAI workflows. Sign in with the same account you use on Trinity.
            </p>

            <ul className="mt-8 hidden gap-3 sm:grid">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <li
                    key={f.title}
                    className="flex gap-3.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5 transition-colors hover:border-teal-500/30 hover:bg-white/[0.05]"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-teal-500/25 bg-teal-500/15 text-teal-300">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{f.title}</div>
                      <div className="mt-0.5 text-xs leading-relaxed text-slate-400">{f.text}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="relative hidden items-center gap-4 border-t border-white/[0.08] pt-5 text-xs text-slate-400 sm:flex">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-teal-400" />
              MagOneAI workflows
            </span>
            <span className="h-3 w-px bg-white/10" />
            <span className="inline-flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-indigo-300" />
              Neon PostgreSQL
            </span>
          </div>
        </section>

        {/* Sign-in panel */}
        <section className="flex items-center bg-white p-8 sm:p-10 lg:p-12">
          <div className="w-full">
            <Suspense
              fallback={
                <div className="flex min-h-[22rem] items-center justify-center text-sm text-slate-500">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin text-teal-600" /> Loading…
                </div>
              }
            >
              <LoginForm />
            </Suspense>
          </div>
        </section>
      </div>

    </div>
  );
}
