"use client";

import { useState } from "react";
import { apiGet, apiPost, type RunResponse } from "@/lib/api";
import { Empty, PageHeader, Section } from "@/components/ui";
import {
  Database,
  Sparkles,
  Search,
  Copy,
  Check,
  Table as TableIcon,
  AlertCircle,
  Loader2,
  Terminal,
} from "lucide-react";

interface Answer {
  is_data_question: boolean;
  answer: string;
  rows: Record<string, unknown>[];
  query_used: string;
}

const EXAMPLES = [
  "How many bug reports were triaged by severity?",
  "List the bugs flagged for human review with their recommendation.",
  "Which requirements have the lowest coverage score?",
  "How many test cases exist per requirement, newest first?",
  "What ran today, by use case?",
];

export default function DataPage() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ans, setAns] = useState<Answer | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  async function ask(question: string) {
    setBusy(true);
    setError(null);
    setAns(null);
    setQ(question);
    try {
      let r = await apiPost<RunResponse>("/api/query", { question });
      // The backend waits up to ~60s; a slow query comes back still running with a poll token.
      while (r.status !== "completed" && r.status !== "failed" && r.poll_token) {
        await new Promise((res) => setTimeout(res, 3000));
        r = await apiGet<RunResponse>(`/api/runs/${r.poll_token}`);
      }
      if (r.status === "failed") throw new Error(typeof r.error === "string" ? r.error : JSON.stringify(r.error));
      if (!r.output) throw new Error(`The query finished with status "${r.status}" but returned no output.`);
      setAns(r.output as unknown as Answer);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const copySql = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const cols = ans?.rows?.length ? Object.keys(ans.rows[0]) : [];

  return (
    <div className="grid gap-6">
      <PageHeader
        icon={Database}
        eyebrow="SQL Intelligence"
        title="Ask the Data"
        sub="Inquire in natural language across test cases, requirements, bug reports, and pipeline activity logs. Translates inquiries into safe read-only SQL queries on Neon."
      />

      {/* Query Formulation Input */}
      <form
        className="card p-5 border-teal-500/20 flex flex-col gap-3 sm:flex-row items-center"
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
      >
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            id="question"
            className="input pl-10 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. Which requirements have less than 80% test coverage?"
            required
            disabled={busy}
          />
        </div>
        <button
          type="submit"
          className="btn h-[42px] px-6 text-sm shrink-0 w-full sm:w-auto"
          disabled={busy || !q.trim()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          <span>{busy ? "Querying DB…" : "Run Query"}</span>
        </button>
      </form>

      {/* Suggestion Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted flex items-center gap-1.5 mr-1">
          <Sparkles className="h-3 w-3 text-accent" />
          Suggested:
        </span>
        {EXAMPLES.map((e) => (
          <button
            key={e}
            type="button"
            className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-muted hover:text-foreground hover:border-accent/40 hover:bg-surface-2 transition-all disabled:opacity-50"
            onClick={() => ask(e)}
            disabled={busy}
          >
            {e}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Response Display */}
      {ans && (
        <div className="grid gap-6">
          <Section title="AI Synthesized Answer" icon={Sparkles}>
            <p className="text-sm text-foreground font-medium bg-surface-2/40 p-4 rounded-xl border border-line leading-relaxed">
              {ans.answer}
            </p>
            {!ans.is_data_question && (
              <p className="mt-2 text-xs text-muted">
                Note: This was classified as a general QA question rather than a database query, so no SQL was executed.
              </p>
            )}
          </Section>

          {ans.rows?.length > 0 && (
            <Section
              title={`Query Results (${ans.rows.length} rows)`}
              icon={TableIcon}
              right={
                <span className="rounded-md bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">
                  {ans.rows.length} row{ans.rows.length === 1 ? "" : "s"} returned
                </span>
              }
            >
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-sm">
                  <thead className="bg-surface-2/60">
                    <tr className="border-b border-line text-left text-[11px] font-bold uppercase tracking-wider text-muted">
                      {cols.map((c) => (
                        <th key={c} className="py-2.5 px-4">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {ans.rows.map((r, i) => (
                      <tr key={i} className="hover:bg-surface-2/40 transition-colors">
                        {cols.map((c) => (
                          <td key={c} className="py-2.5 px-4 text-xs font-mono text-foreground align-top">
                            {String(r[c] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {ans.rows?.length === 0 && ans.is_data_question && (
            <Empty icon={Database}>The SQL query executed successfully but returned 0 rows.</Empty>
          )}

          {ans.query_used && (
            <details className="card group overflow-hidden text-sm">
              <summary className="flex cursor-pointer items-center justify-between p-4 font-semibold text-foreground hover:bg-surface-2/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-accent" />
                  <span>Executed SQL Query</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      copySql(ans.query_used);
                    }}
                    className="flex items-center gap-1 text-xs text-muted hover:text-foreground"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-500" />
                        <span className="text-emerald-500">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy SQL</span>
                      </>
                    )}
                  </button>
                </div>
              </summary>
              <div className="border-t border-line bg-[#070c18] p-4">
                <pre className="font-mono text-xs text-emerald-400 overflow-x-auto leading-relaxed">
                  {ans.query_used}
                </pre>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
