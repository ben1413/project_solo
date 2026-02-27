"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type QuerySnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type {
  PersonaEnum,
  ActivityTypeEnum,
  RiskLevel,
  ApprovalState,
  CheckResult,
  EvidenceLink,
  Traceability,
  Outcome,
} from "@/lib/personas/types";

export type Run = {
  id: string;
  topicId: string;
  chapterId: string;
  title: string | null;
  createdAt: unknown;
  closedAt: unknown | null;

  // ─── Persona Context (may be null on legacy runs) ───
  status?: "active" | "blocked" | "closed";
  primaryPersona?: PersonaEnum | null;
  supportingPersonas?: PersonaEnum[];
  activityType?: ActivityTypeEnum | null;

  // ─── Risk & Governance ───
  riskLevel?: RiskLevel;
  approvalRequired?: boolean;
  approvalState?: ApprovalState;
  policyProfile?: string | null;

  // ─── Checks ───
  requiredChecks?: string[];
  checkResults?: Record<string, CheckResult>;

  // ─── Evidence & Traceability ───
  evidenceLinks?: EvidenceLink[];
  traceability?: Traceability;

  // ─── Outcome ───
  outcome?: Outcome;
};

export function useRuns(params: { topicId?: string; chapterId?: string }) {
  const { topicId, chapterId } = params;

  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabled = Boolean(topicId && chapterId);

  const runsRef = useMemo(() => {
    if (!enabled) return null;
    return collection(
      db,
      "projectSolo",
      "default",
      "topics",
      topicId as string,
      "chapters",
      chapterId as string,
      "runs"
    );
  }, [enabled, topicId, chapterId]);

  useEffect(() => {
    if (!runsRef) return;

    const q = query(runsRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap: QuerySnapshot<DocumentData>) => {
        const next: Run[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Run, "id">),
        }));
        setRuns(next);
        setError(null);
      },
      (err) => {
        setError(err.message || "Failed to subscribe to runs");
      }
    );

    return () => unsub();
  }, [runsRef]);

  if (!enabled) {
    return { runs: null, error: null, enabled };
  }

  return { runs, error, enabled };
}
