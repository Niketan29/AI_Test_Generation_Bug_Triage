"use client";

import { useEffect, useState } from "react";
import { useRun } from "@/lib/api";
import { Chip, Field, PageHeader, RunBar, RunHistory, Section } from "@/components/ui";
import {
  Bug,
  Sparkles,
  GitCompare,
  Gauge,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";

type Mode = "triage" | "duplicates" | "severity";
interface Match {
  bug_id: string;
  title: string;
  known_status?: string;
  similarity: number;
  reason: string;
}
interface Output {
  status: string;
  validation_message?: string;
  duplicate_verdict?: string;
  duplicate_message?: string;
  duplicate_matches?: Match[];
  top_bug_id?: string;
  severity?: string;
  priority?: string;
  justification?: string;
  confidence?: number;
  assumptions?: string[];
  needs_human_review?: boolean;
  review_reasons?: string[];
  recommendation?: string;
  bug_report_id?: string;
  verdict?: string;
  message?: string;
  matches?: Match[];
  stored_reports_checked?: number;
}

const SAMPLES: Record<Mode, { title: string; description: string; steps?: string; env?: string }> = {
  triage: {
    title: "Password reset email never arrives for Gmail addresses",
    description:
      "Customers with @gmail.com addresses never receive the password reset email. Other providers work. Affects all Gmail users since yesterday's deploy, production.",
    steps: "1. Click Forgot password.\n2. Enter a valid gmail address.\n3. Wait 30 minutes for delivery.",
    env: "Production, Web & Mobile",
  },
  duplicates: {
    title: "Negative quantity accepted in shopping cart",
    description:
      "If I edit the quantity box in my cart and type -2 then press update, the cart accepts it and my order total goes below zero at checkout.",
  },
  severity: {
    title: "Checkout fails for every customer since this morning",
    description:
      "Since the 9am deploy, clicking Place Order shows 'Something went wrong' for all customers on web and mobile. No orders are being created.",
    env: "Production, web and mobile",
  },
};

const ENDPOINT: Record<Mode, string> = {
  triage: "/api/bugs/triage",
  duplicates: "/api/bugs/duplicates",
  severity: "/api/bugs/severity",
};

export default function BugsPage() {
  const [mode, setMode] = useState<Mode>("triage");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [env, setEnv] = useState("");
  const run = useRun<Output>("bugs");
  const out = run.output;

  useEffect(() => {
    const r = run.run;
    const p = r?.payload as { title?: string; description?: string; steps_to_reproduce?: string; environment?: string } | undefined;
    if (!r || !p?.title) return;
    setTitle(p.title);
    setDescription(p.description ?? "");
    setSteps(p.steps_to_reproduce ?? "");
    setEnv(p.environment ?? "");
    const m = (Object.keys(ENDPOINT) as Mode[]).find((k) => ENDPOINT[k] === r.path);
    if (m) setMode(m);
  }, [run.run?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run.start(
      ENDPOINT[mode],
      { title, description, steps_to_reproduce: steps || undefined, environment: env || undefined },
      title.slice(0, 60)
    );
  };

  const useSample = () => {
    const s = SAMPLES[mode];
    setTitle(s.title);
    setDescription(s.description);
    setSteps(s.steps ?? "");
    setEnv(s.env ?? "");
  };

  const matches = out?.duplicate_matches ?? out?.matches ?? [];
  const verdict = out?.duplicate_verdict ?? out?.verdict;

  return (
    <div className="grid gap-6">
      <PageHeader
        icon={Bug}
        eyebrow="Triage Automation"
        title="Bug Triage & Duplicate Intelligence"
        sub="Perform vector semantic searches against historical defect reports, classify root cause severity (P0-P3), and predict duplicate status with human-in-the-loop review safeguards."
      />

      {/* Mode Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-2">
        {(
          [
            ["triage", "Full Comprehensive Triage", Bug],
            ["duplicates", "Duplicate Detection Only", GitCompare],
            ["severity", "Severity & Priority Estimation", Gauge],
          ] as [Mode, string, React.ElementType][]
        ).map(([m, l, Icon]) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              run.reset();
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
              mode === m
                ? "bg-accent text-white shadow-sm shadow-accent/20"
                : "bg-surface-2 text-muted hover:text-foreground hover:bg-surface-3"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{l}</span>
          </button>
        ))}
      </div>

      {/* Bug Entry Form */}
      <form className="card p-6 grid gap-5 border-teal-500/20" onSubmit={submit}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
            <Bug className="h-4 w-4 text-teal-500" />
            <span>Bug Report Details</span>
          </div>
          <button type="button" className="text-xs text-accent hover:underline font-medium" onClick={useSample}>
            Load Sample Defect
          </button>
        </div>

        <Field label="Defect Title" hint="Clear, concise summary of the failure">
          <input
            id="title"
            className="input text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Password reset link expires immediately in production"
            required
          />
        </Field>

        <Field label="Detailed Description" hint="Observed vs expected outcome, impact radius (minimum 20 characters)">
          <textarea
            id="description"
            rows={4}
            className="input text-sm leading-relaxed"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the failure, who is impacted, and when it started occurring..."
            required
          />
        </Field>

        {mode !== "duplicates" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {mode === "triage" && (
              <Field label="Reproduction Steps (Optional)">
                <textarea
                  id="steps"
                  rows={3}
                  className="input text-sm"
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  placeholder="1. Navigate to...&#10;2. Click on...&#10;3. Observe error"
                />
              </Field>
            )}
            <Field label="Environment Context (Optional)">
              <input
                id="env"
                className="input text-sm"
                value={env}
                onChange={(e) => setEnv(e.target.value)}
                placeholder="e.g. Production, iOS 17, Chrome 124"
              />
            </Field>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="submit" className="btn px-6 text-sm" disabled={run.busy || title.trim().length === 0}>
            <Sparkles className="h-4 w-4" />
            <span>
              {mode === "triage"
                ? "Initiate Full Triage"
                : mode === "duplicates"
                ? "Scan for Duplicates"
                : "Evaluate Severity"}
            </span>
          </button>
        </div>
      </form>

      {/* Execution Status Bar */}
      <RunBar
        status={run.status}
        elapsed={run.elapsed}
        error={run.error}
        label={
          mode === "triage"
            ? "Executing parallel duplicate search & severity rubric evaluation on MagOneAI..."
            : "Running AI analysis..."
        }
      />

      <RunHistory history={run.history} currentId={run.run?.id} onPick={run.show} onClear={run.clearHistory} />

      {out?.status === "invalid" && (
        <div className="card border-amber-500/40 bg-amber-500/10 p-5 text-sm text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>Validation Failure</span>
          </div>
          {out.validation_message}
        </div>
      )}

      {/* Triage Output Cards */}
      {out?.status === "ok" && (
        <div className="grid gap-6 md:grid-cols-2">
          {verdict && (
            <Section
              title="Duplicate Analysis"
              icon={GitCompare}
              right={
                out.stored_reports_checked != null && (
                  <span className="text-xs text-muted font-mono">
                    {out.stored_reports_checked} past reports checked
                  </span>
                )
              }
            >
              <div className="mb-3 flex items-center gap-2.5">
                <Chip value={verdict} />
                {out.top_bug_id && (
                  <span className="mono text-xs font-bold text-accent bg-accent-soft px-2 py-0.5 rounded-md">
                    Top Match: {out.top_bug_id}
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground bg-surface-2/40 p-3.5 rounded-xl border border-line leading-relaxed">
                {out.duplicate_message ?? out.message}
              </p>

              {matches.length > 0 && (
                <div className="mt-4 grid gap-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">
                    Matching Defect Candidates
                  </span>
                  {matches.map((m) => (
                    <div
                      key={m.bug_id}
                      className="rounded-xl border border-line bg-surface-2/30 p-3 transition-colors hover:border-accent/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="mono text-xs font-bold text-accent">{m.bug_id}</span>
                        <span className="font-semibold text-xs md:text-sm text-foreground truncate flex-1">
                          {m.title}
                        </span>
                        <div className="flex items-center gap-2 text-xs">
                          {m.known_status && <Chip value={m.known_status} />}
                          <span className="rounded bg-teal-500/10 px-1.5 py-0.5 font-mono text-teal-600 dark:text-teal-400 font-bold">
                            {Math.round((m.similarity ?? 0) * 100)}% match
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted leading-relaxed">{m.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {out.severity && (
            <Section title="Severity & Priority Matrix" icon={Gauge}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Chip value={out.severity} />
                  <Chip value={out.priority} />
                </div>
                {out.confidence != null && (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    Confidence: {Math.round((out.confidence ?? 0) * 100)}%
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground bg-surface-2/40 p-3.5 rounded-xl border border-line leading-relaxed">
                {out.justification}
              </p>

              {!!out.assumptions?.length && (
                <div className="mt-4">
                  <div className="label text-[11px] text-muted">Evaluation Assumptions</div>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-muted">
                    {out.assumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>
          )}

          {out.recommendation && (
            <div className="md:col-span-2">
              <Section
                title="Triage Recommendation & Human Review Assessment"
                icon={ShieldAlert}
                right={
                  out.bug_report_id && (
                    <span className="mono text-xs text-muted bg-surface-2 px-2.5 py-1 rounded-md border border-line">
                      Stored Defect ID: {out.bug_report_id}
                    </span>
                  )
                }
              >
                <div className="flex flex-col gap-3">
                  <div className="text-sm text-foreground bg-surface-2/50 p-4 rounded-xl border border-line leading-relaxed font-medium">
                    {out.recommendation}
                  </div>

                  {out.needs_human_review && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
                      <div className="flex items-center gap-2 font-bold mb-1">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span>Action Required: Human Review Flagged</span>
                      </div>
                      <div className="text-xs leading-relaxed">
                        {out.review_reasons?.join("; ") || "Ambiguity or critical scope requires lead verification."}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
