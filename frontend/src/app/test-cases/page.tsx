"use client";

import { useEffect, useState } from "react";
import { fileUrl, useRun } from "@/lib/api";
import { Chip, Empty, Field, PageHeader, RunBar, RunHistory, Section, Stat } from "@/components/ui";
import {
  FileCheck2,
  Sparkles,
  Download,
  FileSpreadsheet,
  FileText,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ChevronDown,
  ListOrdered,
  Percent,
} from "lucide-react";

interface TestCase {
  id: string;
  type: string;
  priority: string;
  title: string;
  preconditions: string;
  steps: string[];
  expected_result: string;
  criteria_ref: string;
}

interface Output {
  status: string;
  validation_message?: string;
  feature_name?: string;
  summary?: string;
  acceptance_criteria?: string[];
  ambiguities?: string[];
  test_cases?: TestCase[];
  total?: number;
  counts?: Record<string, number>;
  coverage_gaps?: string[];
  coverage_score?: number;
  review_notes?: string;
  docx_key?: string;
  xlsx_key?: string;
  docx_filename?: string;
  xlsx_filename?: string;
  requirement_id?: string;
}

const SAMPLE =
  "As a registered customer I want to log in with my email and password so that I can access my account. The account must be locked for 15 minutes after 5 consecutive failed login attempts, and the user must see a message explaining the lockout. Successful login redirects to the account dashboard. The 'Remember me' option keeps the session for 30 days.";

export default function TestCasesPage() {
  const [requirement, setRequirement] = useState("");
  const [feature, setFeature] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const run = useRun<Output>("test-cases");
  const out = run.output;
  const cases = (out?.test_cases ?? []).filter((c) => filter === "all" || c.type === filter);

  useEffect(() => {
    const p = run.run?.payload as { requirement?: string; feature_name?: string } | undefined;
    if (p?.requirement) {
      setRequirement(p.requirement);
      setFeature(p.feature_name ?? "");
    }
  }, [run.run?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const copyCase = (c: TestCase) => {
    const text = `Test Case: [${c.id}] ${c.title}\nType: ${c.type} | Priority: ${c.priority}\nPreconditions: ${c.preconditions || "None"}\nSteps:\n${(c.steps ?? []).map((s, i) => `${i + 1}. ${s}`).join("\n")}\nExpected: ${c.expected_result}`;
    navigator.clipboard.writeText(text);
    setCopiedId(c.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        icon={FileCheck2}
        eyebrow="AI Automation"
        title="Test Case Generator"
        sub="Synthesize exhaustive positive, negative, and boundary test scenarios from natural language specs. Generates formatted Word (.docx) & Excel (.xlsx) files automatically."
      />

      {/* Input Formulation Card */}
      <form
        className="card p-6 grid gap-5 border-teal-500/20"
        onSubmit={(e) => {
          e.preventDefault();
          run.start(
            "/api/test-cases/generate",
            { requirement, feature_name: feature || undefined },
            feature || requirement.slice(0, 60)
          );
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
            <Sparkles className="h-4 w-4 text-teal-500" />
            <span>Specification & Requirements</span>
          </div>
          <button
            type="button"
            className="text-xs text-accent hover:underline font-medium"
            onClick={() => {
              setRequirement(SAMPLE);
              setFeature("Customer Authentication & Lockout");
            }}
          >
            Load Sample Story
          </button>
        </div>

        <Field
          label="Requirement Specification / User Story"
          hint="Detail user stories, business rules, edge conditions, or validation constraints. The agent analyzes subtleties automatically."
        >
          <textarea
            id="requirement"
            rows={5}
            className="input font-sans text-sm leading-relaxed"
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            placeholder="e.g. As a customer, I want to add items to my cart and apply discount coupons..."
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Feature Identifier (Optional)" hint="Inferred automatically by the LLM if left blank">
            <input
              id="feature"
              className="input text-sm"
              value={feature}
              onChange={(e) => setFeature(e.target.value)}
              placeholder="e.g. Checkout & Coupon Flow"
            />
          </Field>
          
          <div className="flex gap-2.5">
            <button
              type="submit"
              className="btn h-[42px] px-6 text-sm"
              disabled={run.busy || requirement.trim().length < 4}
            >
              <Sparkles className="h-4 w-4" />
              <span>Generate Test Suite</span>
            </button>
          </div>
        </div>
      </form>

      {/* Progress & Run Bar */}
      <RunBar
        status={run.status}
        elapsed={run.elapsed}
        error={run.error}
        label="Analyzing criteria, generating 3 test suites concurrently, verifying coverage gaps, and generating DOCX + XLSX files..."
      />

      <RunHistory history={run.history} currentId={run.run?.id} onPick={run.show} onClear={run.clearHistory} />

      {out?.status === "invalid" && (
        <div className="card border-amber-500/40 bg-amber-500/10 p-5 text-sm text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>Specification Insufficient</span>
          </div>
          {out.validation_message}
        </div>
      )}

      {out?.status === "ok" && (
        <>
          {/* Key Metric Tiles */}
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat
              label="Total Test Cases"
              value={out.total ?? 0}
              icon={Layers}
              hint={`${out.counts?.positive ?? 0} pos · ${out.counts?.negative ?? 0} neg · ${out.counts?.boundary ?? 0} bnd`}
            />
            <Stat
              label="Requirement Coverage"
              value={`${Math.round((out.coverage_score ?? 0) * 100)}%`}
              icon={Percent}
              hint={`${out.coverage_gaps?.length ?? 0} identified gaps`}
            />
            <Stat
              label="High Priority"
              value={out.counts?.High ?? 0}
              icon={AlertTriangle}
              hint={`${out.counts?.Medium ?? 0} med · ${out.counts?.Low ?? 0} low`}
            />

            {/* Downloads Card */}
            <div className="tile justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Suite Artifacts
              </span>
              <div className="flex flex-col gap-2 mt-1">
                {out.docx_key && (
                  <a
                    className="flex items-center justify-between rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 px-3 py-1.5 text-xs font-semibold transition-colors"
                    href={fileUrl(out.docx_key)}
                    download
                  >
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      <span>Word (.docx)</span>
                    </span>
                    <Download className="h-3 w-3" />
                  </a>
                )}
                {out.xlsx_key && (
                  <a
                    className="flex items-center justify-between rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold transition-colors"
                    href={fileUrl(out.xlsx_key)}
                    download
                  >
                    <span className="flex items-center gap-1.5">
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      <span>Excel (.xlsx)</span>
                    </span>
                    <Download className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Feature Summary & Analysis */}
          <Section
            title={`${out.feature_name ?? "Feature"} · Requirements Analysis`}
            icon={FileCheck2}
            right={
              out.requirement_id && (
                <span className="mono text-xs bg-surface-2 border border-line px-2.5 py-1 rounded-md text-muted">
                  ID: {out.requirement_id}
                </span>
              )
            }
          >
            <p className="text-sm text-foreground leading-relaxed font-medium bg-surface-2/60 p-4 rounded-xl border border-line">
              {out.summary}
            </p>

            <div className="mt-5 grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-line p-4 bg-surface-2/30">
                <div className="label text-teal-600 dark:text-teal-400 font-bold mb-3 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Synthesized Acceptance Criteria</span>
                </div>
                <ol className="list-decimal space-y-2 pl-4 text-xs md:text-sm text-foreground">
                  {out.acceptance_criteria?.map((c, i) => (
                    <li key={i} className="pl-1">
                      {c}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-xl border border-line p-4 bg-surface-2/30 flex flex-col justify-between">
                <div>
                  <div className="label text-amber-600 dark:text-amber-400 font-bold mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Ambiguities to Clarify</span>
                  </div>
                  {out.ambiguities?.length ? (
                    <ul className="list-disc space-y-1.5 pl-4 text-xs md:text-sm text-muted">
                      {out.ambiguities.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted">No ambiguities found.</p>
                  )}

                  <div className="label text-rose-600 dark:text-rose-400 font-bold mt-4 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Coverage Gaps</span>
                  </div>
                  {out.coverage_gaps?.length ? (
                    <ul className="list-disc space-y-1.5 pl-4 text-xs md:text-sm text-muted">
                      {out.coverage_gaps.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      ✓ All criteria fully verified by generated cases.
                    </p>
                  )}
                </div>

                {out.review_notes && (
                  <div className="mt-4 pt-3 border-t border-line text-xs text-muted italic">
                    Note: {out.review_notes}
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* Test Cases Table / List */}
          <Section
            title="Generated Test Cases"
            icon={ListOrdered}
            right={
              <div className="flex items-center gap-1.5 bg-surface-2 p-1 rounded-xl border border-line">
                {(["all", "positive", "negative", "boundary"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFilter(t)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-all ${
                      filter === t
                        ? "bg-accent text-white shadow-sm"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            }
          >
            {cases.length === 0 ? (
              <Empty icon={FileCheck2}>No test cases matching the selected filter.</Empty>
            ) : (
              <div className="grid gap-3">
                {cases.map((c) => (
                  <details
                    key={c.id}
                    className="group rounded-2xl border border-line bg-surface-2/30 p-4 transition-all hover:border-accent/40"
                  >
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                        <span className="mono text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-md">
                          {c.id}
                        </span>
                        <Chip value={c.type} />
                        <Chip value={c.priority} />
                        <span className="font-semibold text-foreground">{c.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            copyCase(c);
                          }}
                          className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-muted hover:text-foreground transition-colors"
                          title="Copy test case steps"
                        >
                          {copiedId === c.id ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-500" />
                              <span className="text-emerald-500">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                        <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
                      </div>
                    </summary>

                    <div className="mt-4 pt-3 border-t border-line/60 grid gap-3.5 text-xs md:text-sm">
                      <div className="bg-surface p-3 rounded-xl border border-line">
                        <span className="font-bold text-muted uppercase text-[10px] tracking-wider block mb-1">
                          Preconditions
                        </span>
                        <div className="text-foreground">{c.preconditions || "None specified"}</div>
                      </div>

                      <div className="bg-surface p-3 rounded-xl border border-line">
                        <span className="font-bold text-muted uppercase text-[10px] tracking-wider block mb-2">
                          Test Steps
                        </span>
                        <ol className="list-decimal pl-5 space-y-1 text-foreground">
                          {(c.steps ?? []).map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ol>
                      </div>

                      <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase text-[10px] tracking-wider block mb-1">
                          Expected Result
                        </span>
                        <div className="text-foreground font-medium">{c.expected_result}</div>
                      </div>

                      <div className="text-[11px] text-muted flex items-center justify-between">
                        <span>Verifies: <span className="font-semibold text-foreground">{c.criteria_ref}</span></span>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
