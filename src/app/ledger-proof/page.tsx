"use client";

import { useEffect, useState } from "react";
import {
  collection,
  collectionGroup,
  getDocs,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

type RunDoc = {
  id: string;
  topicId: string;
  chapterId: string;
  title: string | null;
  status: string;
  createdAt: unknown;
  primaryPersona: string | null;
  supportingPersonas: string[];
  activityType: string | null;
  riskLevel: string;
  approvalRequired: boolean;
  approvalState: string;
  requiredChecks: string[];
  checkResults: Record<string, string>;
  evidenceLinks: Array<{ type: string; url: string }>;
  traceability: {
    sourceRunId: string | null;
    relatedRunIds: string[];
    adrIds: string[];
    incidentIds: string[];
  };
  outcome: {
    goal: string;
    successCriteria: string[];
    resultSummary: string | null;
  };
};

const PERSONA_COLORS: Record<string, string> = {
  architect: "#a78bfa",
  product_leader: "#60a5fa",
  knowledge_steward: "#22d3ee",
  operations_lead: "#fbbf24",
  governance_lead: "#fb7185",
  agent_engineer: "#34d399",
  domain_expert: "#2dd4bf",
  ux_growth: "#fb923c",
};

const PERSONA_LABELS: Record<string, string> = {
  architect: "Architect",
  product_leader: "Product Leader",
  knowledge_steward: "Knowledge Steward",
  operations_lead: "Operations Lead",
  governance_lead: "Governance Lead",
  agent_engineer: "Agent Engineer",
  domain_expert: "Domain Expert",
  ux_growth: "UX / Growth",
};

const ACTIVITY_LABELS: Record<string, string> = {
  code_generation: "Code Generation",
  bug_fixing: "Bug Detection & Fixing",
  testing_automation: "Testing Automation",
  project_management: "Project Management",
  documentation: "Documentation",
  refactoring_optimization: "Refactoring & Optimization",
  security_enhancement: "Security Enhancement",
  devops_cicd: "DevOps & CI/CD",
  ux_design: "UX Design",
  architecture_design: "Architecture Design",
};

function formatTs(v: unknown): string {
  if (v instanceof Timestamp) {
    try {
      return v.toDate().toLocaleString();
    } catch {
      return "—";
    }
  }
  return "—";
}

function PersonaBadge({ persona }: { persona: string }) {
  const color = PERSONA_COLORS[persona] ?? "#888";
  const label = PERSONA_LABELS[persona] ?? persona;
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "0.7rem",
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: "4px",
        color,
        backgroundColor: color + "18",
        border: `1px solid ${color}30`,
        marginRight: "4px",
        marginBottom: "2px",
      }}
    >
      {label}
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    low: "#34d399",
    medium: "#fbbf24",
    high: "#fb923c",
    critical: "#fb7185",
  };
  const c = colors[level] ?? "#888";
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "0.65rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        padding: "2px 8px",
        borderRadius: "4px",
        color: c,
        backgroundColor: c + "15",
        border: `1px solid ${c}25`,
      }}
    >
      {level}
    </span>
  );
}

export default function LedgerProofPage() {
  const [runs, setRuns] = useState<RunDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAllRuns() {
      try {
        // We'll scan all topics for runs with persona data
        const topicsSnap = await getDocs(
          collection(db, "projectSolo", "default", "topics")
        );

        const allRuns: RunDoc[] = [];

        for (const topicDoc of topicsSnap.docs) {
          const topicId = topicDoc.id;
          const chaptersSnap = await getDocs(
            collection(
              db,
              "projectSolo",
              "default",
              "topics",
              topicId,
              "chapters"
            )
          );

          for (const chapterDoc of chaptersSnap.docs) {
            const chapterId = chapterDoc.id;
            const runsSnap = await getDocs(
              query(
                collection(
                  db,
                  "projectSolo",
                  "default",
                  "topics",
                  topicId,
                  "chapters",
                  chapterId,
                  "runs"
                ),
                orderBy("createdAt", "desc")
              )
            );

            for (const runDoc of runsSnap.docs) {
              const d = runDoc.data();
              allRuns.push({
                id: runDoc.id,
                topicId,
                chapterId,
                title: d.title ?? null,
                status: d.status ?? "unknown",
                createdAt: d.createdAt,
                primaryPersona: d.primaryPersona ?? null,
                supportingPersonas: d.supportingPersonas ?? [],
                activityType: d.activityType ?? null,
                riskLevel: d.riskLevel ?? "unknown",
                approvalRequired: d.approvalRequired ?? false,
                approvalState: d.approvalState ?? "unknown",
                requiredChecks: d.requiredChecks ?? [],
                checkResults: d.checkResults ?? {},
                evidenceLinks: d.evidenceLinks ?? [],
                traceability: d.traceability ?? {
                  sourceRunId: null,
                  relatedRunIds: [],
                  adrIds: [],
                  incidentIds: [],
                },
                outcome: d.outcome ?? {
                  goal: "",
                  successCriteria: [],
                  resultSummary: null,
                },
              });
            }
          }
        }

        setRuns(allRuns);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }

    loadAllRuns();
  }, []);

  const governedRuns = runs.filter((r) => r.primaryPersona !== null);
  const legacyRuns = runs.filter((r) => r.primaryPersona === null);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#06080c",
        color: "#d8dce8",
        fontFamily:
          "'IBM Plex Mono', 'SF Mono', 'Fira Code', Consolas, monospace",
        padding: "2.5rem",
      }}
    >
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            borderBottom: "1px solid #222838",
            paddingBottom: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.6rem",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "#34d399",
              background: "rgba(52,211,153,0.08)",
              border: "1px solid rgba(52,211,153,0.15)",
              padding: "3px 10px",
              borderRadius: "4px",
              marginBottom: "12px",
            }}
          >
            <span
              style={{
                width: "5px",
                height: "5px",
                borderRadius: "50%",
                background: "#34d399",
              }}
            />
            Live Firestore Data
          </div>
          <h1
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: "2rem",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              margin: "0 0 6px",
            }}
          >
            ProjectSolo — Ledger Proof
          </h1>
          <p style={{ color: "#8892a8", fontSize: "0.9rem", margin: 0 }}>
            Every run document read directly from Firestore. This is the audit
            trail.
          </p>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: "1px",
            background: "#222838",
            border: "1px solid #222838",
            borderRadius: "10px",
            overflow: "hidden",
            marginBottom: "2rem",
          }}
        >
          {[
            { label: "Total Runs", value: runs.length, color: "#d8dce8" },
            {
              label: "Governed Runs",
              value: governedRuns.length,
              color: "#34d399",
            },
            {
              label: "Legacy Runs",
              value: legacyRuns.length,
              color: "#8892a8",
            },
            {
              label: "Approval Required",
              value: runs.filter((r) => r.approvalRequired).length,
              color: "#fb7185",
            },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "#0d1017",
                padding: "1.2rem",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "1.8rem",
                  fontWeight: 700,
                  color: s.color,
                }}
              >
                {loading ? "…" : s.value}
              </div>
              <div
                style={{
                  fontSize: "0.65rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: "#5a6478",
                  marginTop: "4px",
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              background: "rgba(251,113,133,0.08)",
              border: "1px solid rgba(251,113,133,0.15)",
              borderRadius: "8px",
              padding: "1rem",
              color: "#fb7185",
              marginBottom: "1.5rem",
              fontSize: "0.85rem",
            }}
          >
            Error: {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", color: "#5a6478", padding: "3rem" }}>
            Scanning Firestore for run documents…
          </div>
        )}

        {/* Governed Runs */}
        {!loading && governedRuns.length > 0 && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                fontSize: "0.6rem",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "#5a6478",
                margin: "2rem 0 1rem",
              }}
            >
              Governed Runs
              <span style={{ flex: 1, height: "1px", background: "#222838" }} />
            </div>

            {governedRuns.map((run) => (
              <div
                key={run.id}
                style={{
                  background: "#0d1017",
                  border: "1px solid #222838",
                  borderRadius: "10px",
                  padding: "1.5rem",
                  marginBottom: "0.75rem",
                }}
              >
                {/* Top row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "1rem",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "0.65rem",
                        color: "#5a6478",
                        marginBottom: "4px",
                      }}
                    >
                      {run.topicId} / {run.chapterId.slice(0, 8)}… / {run.id.slice(0, 8)}…
                    </div>
                    <div style={{ fontSize: "1rem", fontWeight: 600 }}>
                      {run.activityType
                        ? ACTIVITY_LABELS[run.activityType] ?? run.activityType
                        : "Unknown Activity"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{ fontSize: "0.75rem", color: "#8892a8" }}
                    >
                      {formatTs(run.createdAt)}
                    </div>
                    <div style={{ marginTop: "4px" }}>
                      <RiskBadge level={run.riskLevel} />
                    </div>
                  </div>
                </div>

                {/* Persona row */}
                <div style={{ marginBottom: "0.75rem" }}>
                  <div
                    style={{
                      fontSize: "0.6rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "#5a6478",
                      marginBottom: "6px",
                    }}
                  >
                    Primary
                  </div>
                  {run.primaryPersona && (
                    <PersonaBadge persona={run.primaryPersona} />
                  )}
                </div>

                {run.supportingPersonas.length > 0 && (
                  <div style={{ marginBottom: "0.75rem" }}>
                    <div
                      style={{
                        fontSize: "0.6rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        color: "#5a6478",
                        marginBottom: "6px",
                      }}
                    >
                      Supporting
                    </div>
                    {run.supportingPersonas.map((p) => (
                      <PersonaBadge key={p} persona={p} />
                    ))}
                  </div>
                )}

                {/* Governance row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "0.75rem",
                    marginTop: "1rem",
                    paddingTop: "1rem",
                    borderTop: "1px solid #1a1f2a",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "0.6rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        color: "#5a6478",
                        marginBottom: "4px",
                      }}
                    >
                      Status
                    </div>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color:
                          run.status === "active"
                            ? "#34d399"
                            : run.status === "closed"
                            ? "#8892a8"
                            : "#fbbf24",
                      }}
                    >
                      {run.status}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.6rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        color: "#5a6478",
                        marginBottom: "4px",
                      }}
                    >
                      Approval
                    </div>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: run.approvalRequired
                          ? run.approvalState === "approved"
                            ? "#34d399"
                            : "#fb7185"
                          : "#5a6478",
                      }}
                    >
                      {run.approvalRequired
                        ? run.approvalState
                        : "not required"}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.6rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        color: "#5a6478",
                        marginBottom: "4px",
                      }}
                    >
                      Evidence
                    </div>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color:
                          run.evidenceLinks.length > 0
                            ? "#34d399"
                            : "#5a6478",
                      }}
                    >
                      {run.evidenceLinks.length} link
                      {run.evidenceLinks.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>

                {/* Outcome */}
                {run.outcome.goal && (
                  <div
                    style={{
                      marginTop: "0.75rem",
                      paddingTop: "0.75rem",
                      borderTop: "1px solid #1a1f2a",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.6rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        color: "#5a6478",
                        marginBottom: "4px",
                      }}
                    >
                      Goal
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#8892a8" }}>
                      {run.outcome.goal}
                    </div>
                  </div>
                )}

                {/* Raw ID for Firestore reference */}
                <div
                  style={{
                    marginTop: "0.75rem",
                    fontSize: "0.65rem",
                    color: "#3a4158",
                    fontStyle: "italic",
                  }}
                >
                  Firestore: projectSolo/default/topics/{run.topicId}/chapters/
                  {run.chapterId}/runs/{run.id}
                </div>
              </div>
            ))}
          </>
        )}

        {/* Legacy Runs */}
        {!loading && legacyRuns.length > 0 && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                fontSize: "0.6rem",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "#5a6478",
                margin: "2rem 0 1rem",
              }}
            >
              Legacy Runs (pre-persona)
              <span style={{ flex: 1, height: "1px", background: "#222838" }} />
            </div>

            {legacyRuns.map((run) => (
              <div
                key={run.id}
                style={{
                  background: "#0d1017",
                  border: "1px solid #1a1f2a",
                  borderRadius: "8px",
                  padding: "1rem 1.2rem",
                  marginBottom: "0.5rem",
                  fontSize: "0.82rem",
                  color: "#5a6478",
                }}
              >
                {run.topicId} / {run.chapterId.slice(0, 8)}… / {run.id.slice(0, 8)}…
                <span style={{ marginLeft: "12px" }}>{formatTs(run.createdAt)}</span>
                <span
                  style={{
                    marginLeft: "12px",
                    fontSize: "0.65rem",
                    color: "#3a4158",
                  }}
                >
                  No persona data
                </span>
              </div>
            ))}
          </>
        )}

        {!loading && runs.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: "#5a6478",
              padding: "3rem",
              fontSize: "0.9rem",
            }}
          >
            No runs found. Go to the app, select a persona + activity, and send a
            message to create a governed run.
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: "3rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid #222838",
            fontSize: "0.75rem",
            color: "#3a4158",
            textAlign: "center",
          }}
        >
          ProjectSolo Ledger Proof — Reading live from Firestore (project-solo-85789)
        </div>
      </div>
    </main>
  );
}
