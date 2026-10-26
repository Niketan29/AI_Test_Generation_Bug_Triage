"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { Bars, Chip, Empty, PageHeader, Section, Stat, fmtDate } from "@/components/ui";
import {
  FileCheck2,
  Bug,
  Sparkles,
  Layers,
  ShieldAlert,
  Activity,
  RefreshCw,
  TrendingUp,
  FolderGit2,
  Clock,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

interface Summary {
  counts: Record<string, number>;
  by_severity: Record<string, number>;
  by_priority: Record<string, number>;
  by_verdict: Record<string, number>;
  recent_activity: { use_case: string; status: string; input_summary: string; created_at: string }[];
}
interface BugRow {
  id: string;
  title: string;
  severity?: string;
  priority?: string;
  duplicate_verdict?: string;
  top_bug_id?: string;
  needs_human_review?: boolean;
  created_at: string;
}
interface ReqRow {
  id: string;
  feature_name: string;
  total_cases: number;
  coverage_score: number;
  created_at: string;
}

const REFRESH_MS = 30_000;

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [bugs, setBugs] = useState<BugRow[]>([]);
  const [reqs, setReqs] = useState<ReqRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, b, r] = await Promise.all([
        apiGet<Summary>("/api/dashboard/summary"),
        apiGet<BugRow[]>("/api/bugs?limit=8"),
        apiGet<ReqRow[]>("/api/requirements?limit=8"),
      ]);
      setSummary(s);
      setBugs(b);
      setReqs(r);
      setError(null);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const c = summary?.counts ?? {};

  return (
    <div className="grid gap-7">
      {/* Top Header */}
      <PageHeader
        eyebrow="Intelligence Center"
        title="QA Command Dashboard"
        sub="Live metrics, automated triage telemetry, and case generation records stored securely in your Neon database."
        right={
          <>
            <div className="flex items-center gap-2 text-xs text-muted font-medium bg-surface-2 border border-line px-3 py-1.5 rounded-xl">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{loading ? "Syncing…" : updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : "Ready"}</span>
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => void load()}
              disabled={loading}
              title="Refresh dashboard"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
            <Link className="btn" href="/test-cases">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Generate Cases</span>
            </Link>
          </>
        }
      />

      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-950/70 via-slate-900 to-indigo-950/70 border border-teal-500/30 p-6 md:p-8 text-white shadow-xl shadow-teal-950/20">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute right-1/3 -bottom-20 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-300 border border-teal-500/30 mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-ping" />
              MagOneAI Orchestration Active
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
              Accelerate QA with Autonomous Test Generation & Triage
            </h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Transform product requirements into rigorous test suites in seconds, automatically detect duplicate bug reports, and classify priority with high precision.
            </p>
          </div>

          {/* Quick Launch Cards */}
          <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
            <Link
              href="/test-cases"
              className="flex items-center gap-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 px-3.5 py-2.5 text-xs font-medium text-white transition-all hover:scale-105"
            >
              <FileCheck2 className="h-4 w-4 text-teal-300" />
              <span>New Test Case</span>
            </Link>
            <Link
              href="/bugs"
              className="flex items-center gap-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 px-3.5 py-2.5 text-xs font-medium text-white transition-all hover:scale-105"
            >
              <Bug className="h-4 w-4 text-amber-300" />
              <span>Triage Bug</span>
            </Link>
            <Link
              href="/batch"
              className="flex items-center gap-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 px-3.5 py-2.5 text-xs font-medium text-white transition-all hover:scale-105"
            >
              <Layers className="h-4 w-4 text-indigo-300" />
              <span>Batch Triage</span>
            </Link>
            <Link
              href="/chat"
              className="flex items-center gap-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold px-3.5 py-2.5 text-xs transition-all hover:scale-105 shadow-md shadow-teal-500/20"
            >
              <Sparkles className="h-4 w-4" />
              <span>Ask Copilot</span>
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="card border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          <div className="font-semibold mb-1">Telemetry connection error</div>
          {error}
        </div>
      )}

      {!summary && !error && (
        <div className="card p-12 text-center text-sm text-muted">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-accent mb-2" />
          <span>Loading telemetry data from Neon…</span>
        </div>
      )}

      {summary && (
        <>
          {/* Key Stat Tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <Stat
              label="Requirements"
              value={c.requirements ?? 0}
              icon={FolderGit2}
              hint="Indexed feature stories"
            />
            <Stat
              label="Test Cases"
              value={c.test_cases ?? 0}
              icon={FileCheck2}
              hint="Automated suites"
            />
            <Stat
              label="Bug Reports"
              value={c.bug_reports ?? 0}
              icon={Bug}
              hint="Tracked submissions"
            />
            <Stat
              label="Triaged"
              value={c.triage_results ?? 0}
              icon={CheckCircle2}
              hint="Analyzed by AI"
            />
            <Stat
              label="Needs Review"
              value={c.needs_review ?? 0}
              icon={ShieldAlert}
              hint={c.needs_review ? "Awaiting human lead" : "Queue clear"}
            />
            <Stat
              label="Pipeline Runs"
              value={c.activity_log ?? 0}
              icon={Activity}
              hint="Total workflow calls"
            />
          </div>

          {/* Visual Distribution Graphs */}
          <div className="grid gap-4 md:grid-cols-3">
            <Section title="Severity Distribution" icon={TrendingUp}>
              <Bars data={summary.by_severity} order={["Critical", "High", "Medium", "Low"]} />
            </Section>
            <Section title="Priority Breakdown" icon={Layers}>
              <Bars data={summary.by_priority} order={["P0", "P1", "P2", "P3"]} />
            </Section>
            <Section title="Duplicate Verdicts" icon={Sparkles}>
              <Bars data={summary.by_verdict} order={["duplicate", "possible_duplicate", "new"]} />
            </Section>
          </div>

          {/* Split Sections: Latest Bugs & Requirements */}
          <div className="grid gap-6 xl:grid-cols-2">
            <Section
              title="Recent Bug Reports"
              icon={Bug}
              right={
                <Link className="btn-ghost text-xs" href="/bugs">
                  <span>Triage new</span>
                  <ChevronRight className="h-3 w-3" />
                </Link>
              }
            >
              {bugs.length === 0 ? (
                <Empty icon={Bug}>No bug reports triaged yet.</Empty>
              ) : (
                <ul className="grid gap-2 text-sm">
                  {bugs.map((b) => (
                    <li
                      key={b.id}
                      className="group rounded-xl border border-line bg-surface-2/40 p-3 hover:bg-surface-2 hover:border-accent/40 transition-all"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-foreground group-hover:text-accent transition-colors truncate">
                          {b.title}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <Chip value={b.duplicate_verdict} />
                          <Chip value={b.severity} />
                          <Chip value={b.priority} />
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {fmtDate(b.created_at)}
                        </span>
                        <span>•</span>
                        <span className="mono text-[11px]">{b.id}</span>
                        {b.top_bug_id && (
                          <span className="text-purple-600 dark:text-purple-400 font-mono text-[11px]">
                            matches {b.top_bug_id}
                          </span>
                        )}
                        {b.needs_human_review && (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">
                            ⚠️ needs review
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section
              title="Recent Requirements"
              icon={FolderGit2}
              right={
                <Link className="btn-ghost text-xs" href="/test-cases">
                  <span>Generate</span>
                  <ChevronRight className="h-3 w-3" />
                </Link>
              }
            >
              {reqs.length === 0 ? (
                <Empty icon={FolderGit2}>No requirements processed yet.</Empty>
              ) : (
                <ul className="grid gap-2 text-sm">
                  {reqs.map((r) => (
                    <li
                      key={r.id}
                      className="group rounded-xl border border-line bg-surface-2/40 p-3 hover:bg-surface-2 hover:border-accent/40 transition-all"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-foreground group-hover:text-accent transition-colors truncate">
                          {r.feature_name}
                        </span>
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          <span className="rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 px-2 py-0.5 border border-teal-500/20">
                            {r.total_cases} test cases
                          </span>
                          <span className="rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 border border-emerald-500/20">
                            {Math.round((Number(r.coverage_score) || 0) * 100)}% coverage
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {fmtDate(r.created_at)}
                        </span>
                        <span>•</span>
                        <span className="mono text-[11px]">{r.id}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          {/* Workflow Activity Log */}
          <Section title="Live Workflow Execution Feed" icon={Activity}>
            {summary.recent_activity.length === 0 ? (
              <Empty icon={Activity}>No runs recorded yet.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] font-bold uppercase tracking-wider text-muted">
                      <th className="pb-3 pr-4">Workflow Engine</th>
                      <th className="pb-3 pr-4">Input Synopsis</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {summary.recent_activity.map((a, i) => (
                      <tr key={i} className="hover:bg-surface-2/60 transition-colors">
                        <td className="py-2.5 pr-4 font-semibold text-foreground whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-teal-500" />
                            <span>{a.use_case}</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-muted max-w-md truncate">
                          {a.input_summary}
                        </td>
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          <Chip value={a.status || "completed"} />
                        </td>
                        <td className="py-2.5 text-right font-mono text-xs text-muted whitespace-nowrap">
                          {fmtDate(a.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
