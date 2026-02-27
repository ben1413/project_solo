import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  type PersonaEnum,
  type ActivityTypeEnum,
  type RiskLevel,
  type EvidenceLink,
  type Traceability,
  type Outcome,
  getPersonaDefaults,
  deriveApproval,
  enforcePersonaPolicy,
} from "@/lib/personas/types";

export type CreateRunInput = {
  chapterId: string;
  topicId: string;
  title?: string;
  // ─── New: Persona Context (optional for backward compat) ───
  primaryPersona?: PersonaEnum;
  supportingPersonas?: PersonaEnum[];
  activityType?: ActivityTypeEnum;
  riskLevel?: RiskLevel;
  policyProfile?: string;
  requiredChecks?: string[];
  evidenceLinks?: EvidenceLink[];
  traceability?: Partial<Traceability>;
  outcome?: Partial<Outcome>;
};

export async function createRun(input: CreateRunInput) {
  const { chapterId, topicId, title } = input;

  const runsRef = collection(
    db,
    "projectSolo",
    "default",
    "topics",
    topicId,
    "chapters",
    chapterId,
    "runs"
  );

  const runRef = doc(runsRef);

  // ─── Derive persona defaults if activity type provided ───
  const activityType = input.activityType ?? null;
  const defaults = activityType ? getPersonaDefaults(activityType) : null;

  const primaryPersona = input.primaryPersona ?? defaults?.primary ?? null;
  const rawSupport = input.supportingPersonas ?? defaults?.support ?? [];

  // Enforce policy rules on supporting personas
  const supportingPersonas =
    activityType && primaryPersona
      ? enforcePersonaPolicy(activityType, primaryPersona, rawSupport)
      : rawSupport;

  // ─── Derive approval from risk level ───
  const riskLevel = input.riskLevel ?? "low";
  const { approvalRequired, approvalState } = deriveApproval(riskLevel);

  // ─── Build traceability with defaults ───
  const traceability: Traceability = {
    sourceRunId: input.traceability?.sourceRunId ?? null,
    relatedRunIds: input.traceability?.relatedRunIds ?? [],
    adrIds: input.traceability?.adrIds ?? [],
    incidentIds: input.traceability?.incidentIds ?? [],
  };

  // ─── Build outcome with defaults ───
  const outcome: Outcome = {
    goal: input.outcome?.goal ?? "",
    successCriteria: input.outcome?.successCriteria ?? [],
    resultSummary: input.outcome?.resultSummary ?? null,
  };

  await setDoc(runRef, {
    // ─── Existing fields (unchanged) ───
    id: runRef.id,
    topicId,
    chapterId,
    title: title ?? null,
    createdAt: serverTimestamp(),
    closedAt: null,

    // ─── New: Status ───
    status: "active",

    // ─── New: Persona Context ───
    primaryPersona,
    supportingPersonas,
    activityType,

    // ─── New: Risk & Governance ───
    riskLevel,
    approvalRequired,
    approvalState,
    policyProfile: input.policyProfile ?? null,

    // ─── New: Checks ───
    requiredChecks: input.requiredChecks ?? [],
    checkResults: {},

    // ─── New: Evidence & Traceability ───
    evidenceLinks: input.evidenceLinks ?? [],
    traceability,

    // ─── New: Outcome ───
    outcome,
  });

  return runRef.id;
}
