"use client";

import { useEffect, useState } from "react";
import { useRun } from "@/lib/api";
import { Chip, Empty, PageHeader, RunBar, RunHistory, Section, Stat } from "@/components/ui";
import {
  Layers,
  Sparkles,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  GitCompare,
  ShieldAlert,
} from "lucide-react";

interface Row {
  index: number;
  title: string;
  status: string;
  duplicate_verdict?: string;
  top_bug_id?: string;
  severity?: string;
  priority?: string;
  confidence?: number;
  needs_human_review?: boolean;
  recommendation?: string;
}

interface Output {
  status: string;
  validation_message?: string;
  skipped?: { index: number; title?: string; reason: string }[];
  results?: Row[];
  total?: number;
  summary?: {
    triaged: number;
    rejected: number;
    failed: number;
    by_severity: Record<string, number>;
    by_priority: Record<string, number>;
    by_duplicate_verdict: Record<string, number>;
    needs_human_review: number;
    most_urgent: { title: string; severity: string; priority: string }[];
  };
}

interface Draft {
  title: string;
  description: string;
  environment: string;
}

const SAMPLE: Draft[] = [
  {
    title: "Order confirmation page shows error but payment is taken",
    description: "During the flash sale customers see 'Something went wrong' after paying, no order appears, and retrying charges them again. Production, all platforms.",
    environment: "Production",
  },
  {
    title: "Wishlist heart does not fill in until refresh",
    description: "Clicking the heart on a product card adds the item to the wishlist but the icon stays empty until the page is reloaded.",
    environment: "Web, Safari",
  },
  {
    title: "Promo banner overlaps the cookie consent bar on tablets",
    description: "On iPad in landscape, the homepage promo banner is drawn on top of the cookie consent bar so the Accept button cannot be tapped.",
    environment: "iPad, Safari 17",
  },
];

export default function BatchPage() {
  const [rows, setRows] = useState<Draft[]>([{ title: "", description: "", environment: "" }]);
  const run = useRun<Output>("batch");
  const out = run.output;

  const update = (i: number, k: keyof Draft, v: string) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  useEffect(() => {
    const p = run.run?.payload as { bugs?: { title: string; description: string; environment?: string }[] } | undefined;
    if (p?.bugs?.length) {
      setRows(p.bugs.map((b) => ({ title: b.title, description: b.description, environment: b.environment ?? "" })));
    }
  }, [run.run?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid gap-6">
      <PageHeader
        icon={Layers}
        eyebrow="Mass Ingestion"
        title="High-Volume Batch Triage"
        sub="Dispatch up to 25 bug submissions simultaneously. The pipeline concurrently inspects duplicates, assesses severity, and stores each report into your Neon database."
      />

      {/* Batch Form */}
      <form
        className="card p-6 grid gap-4 border-teal-500/20"
        onSubmit={(e) => {
          e.preventDefault();
          run.start(
            "/api/bugs/batch",
            {
              bugs: rows.map((r) => ({
                title: r.title,
                description: r.description,
                environment: r.environment || undefined,
              })),
            },
            `${rows.length} reports: ${rows[0]?.title.slice(0, 40) ?? ""}`
          );
        }}
      >
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
            <Layers className="h-4 w-4 text-teal-500" />
            <span>Bug Batch Queue ({rows.length} / 25)</span>
          </div>
          <button
            type="button"
            className="text-xs text-accent hover:underline font-medium"
            onClick={() => setRows(SAMPLE)}
          >
            Load Sample Batch (3 items)
          </button>
        </div>

        <div className="grid gap-3 max-h-[500px] overflow-y-auto pr-1">
          {rows.map((r, i) => (
            <div
              key={i}
              className="group rounded-xl border border-line bg-surface-2/40 p-3.5 grid gap-2.5 sm:grid-cols-[1.2fr_2fr_1fr_auto] items-center hover:border-accent/40 transition-colors"
            >
              <div className="relative">
                <span className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white shadow-sm">
                  {i + 1}
                </span>
                <input
                  className="input text-xs"
                  placeholder="Bug title *"
                  value={r.title}
                  onChange={(e) => update(i, "title", e.target.value)}
                  required
                />
              </div>
              <input
                className="input text-xs"
                placeholder="Description (observed vs expected) *"
                value={r.description}
                onChange={(e) => update(i, "description", e.target.value)}
                required
              />
              <input
                className="input text-xs"
                placeholder="Environment (optional)"
                value={r.environment}
                onChange={(e) => update(i, "environment", e.target.value)}
              />
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface text-muted hover:text-red-500 hover:border-red-500/30 transition-colors disabled:opacity-40"
                onClick={() => setRows((x) => x.filter((_, j) => j !== i))}
                disabled={rows.length === 1}
                title="Remove entry"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() =>
                setRows((x) => (x.length < 25 ? [...x, { title: "", description: "", environment: "" }] : x))
              }
              disabled={rows.length >= 25}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Entry</span>
            </button>
          </div>

          <button type="submit" className="btn px-6 text-sm" disabled={run.busy}>
            <Sparkles className="h-4 w-4" />
            <span>Process {rows.length} Defect{rows.length === 1 ? "" : "s"}</span>
          </button>
        </div>
      </form>

      {/* Execution Tracker */}
      <RunBar
        status={run.status}
        elapsed={run.elapsed}
        error={run.error}
        label={`Triaging ${rows.length} reports concurrently on MagOneAI. You may navigate away; state is saved.`}
      />

      <RunHistory history={run.history} currentId={run.run?.id} onPick={run.show} onClear={run.clearHistory} />

      {out?.status === "invalid" && (
        <div className="card border-amber-500/40 bg-amber-500/10 p-5 text-sm text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>Batch Validation Notice</span>
          </div>
          {out.validation_message}
        </div>
      )}

      {out?.status === "ok" && out.summary && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat
              label="Successfully Triaged"
              value={out.summary.triaged}
              icon={CheckCircle2}
              hint={`${out.skipped?.length ?? 0} skipped · ${out.summary.failed} failed`}
            />
            <Stat
              label="Human Review Flags"
              value={out.summary.needs_human_review}
              icon={ShieldAlert}
              hint={out.summary.needs_human_review ? "Requires QA attention" : "None flagged"}
            />
            <Stat
              label="P0 / P1 Critical"
              value={`${out.summary.by_priority.P0 ?? 0} / ${out.summary.by_priority.P1 ?? 0}`}
              icon={TrendingUp}
              hint={`${out.summary.by_priority.P2 ?? 0} P2 · ${out.summary.by_priority.P3 ?? 0} P3`}
            />
            <Stat
              label="Duplicate Detections"
              value={out.summary.by_duplicate_verdict.duplicate ?? 0}
              icon={GitCompare}
              hint={`${out.summary.by_duplicate_verdict.possible_duplicate ?? 0} possible · ${out.summary.by_duplicate_verdict.new ?? 0} new`}
            />
          </div>

          <Section title="Batch Triage Matrix" icon={Layers}>
            {!out.results?.length ? (
              <Empty icon={Layers}>No triage results returned.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] font-bold uppercase tracking-wider text-muted">
                      <th className="py-2.5 pr-3">#</th>
                      <th className="py-2.5 pr-3">Defect Title</th>
                      <th className="py-2.5 pr-3">Verdict</th>
                      <th className="py-2.5 pr-3">Severity</th>
                      <th className="py-2.5 pr-3">Priority</th>
                      <th className="py-2.5 pr-3">Review</th>
                      <th className="py-2.5">Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {out.results.map((r) => (
                      <tr key={r.index} className="hover:bg-surface-2/60 transition-colors align-top">
                        <td className="py-3 pr-3 text-muted font-mono text-xs">{r.index + 1}</td>
                        <td className="py-3 pr-3 font-semibold text-foreground max-w-xs">{r.title}</td>
                        <td className="py-3 pr-3 whitespace-nowrap">
                          <Chip value={r.duplicate_verdict} />
                          {r.top_bug_id && (
                            <div className="mono text-[10px] text-accent mt-1">match: {r.top_bug_id}</div>
                          )}
                        </td>
                        <td className="py-3 pr-3 whitespace-nowrap">
                          <Chip value={r.severity} />
                        </td>
                        <td className="py-3 pr-3 whitespace-nowrap">
                          <Chip value={r.priority} />
                        </td>
                        <td className="py-3 pr-3 whitespace-nowrap">
                          {r.needs_human_review ? (
                            <span className="rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 text-xs">
                              Yes
                            </span>
                          ) : (
                            <span className="text-muted text-xs">No</span>
                          )}
                        </td>
                        <td className="py-3 text-xs text-muted leading-relaxed">{r.recommendation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!!out.skipped?.length && (
              <div className="mt-4 rounded-xl border border-line bg-surface-2/50 p-3 text-xs text-muted">
                <span className="font-semibold text-foreground">Skipped records: </span>
                {out.skipped.map((s) => `#${s.index + 1} (${s.reason})`).join(", ")}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
