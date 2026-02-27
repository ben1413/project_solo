// ============================================================
// ProjectSolo — Persona Workflow Type System
// ============================================================
// This is the foundation for the entire persona/governance layer.
// Pure TypeScript — no Firebase, no UI, no side effects.
// ============================================================

// ─── Persona Enum ───
export const PERSONAS = [
  "architect",
  "product_leader",
  "knowledge_steward",
  "operations_lead",
  "governance_lead",
  "agent_engineer",
  "domain_expert",
  "ux_growth",
] as const;

export type PersonaEnum = (typeof PERSONAS)[number];

// ─── Activity Type Enum ───
export const ACTIVITY_TYPES = [
  "code_generation",
  "bug_fixing",
  "testing_automation",
  "project_management",
  "documentation",
  "refactoring_optimization",
  "security_enhancement",
  "devops_cicd",
  "ux_design",
  "architecture_design",
] as const;

export type ActivityTypeEnum = (typeof ACTIVITY_TYPES)[number];

// ─── Risk & Approval ───
export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const APPROVAL_STATES = [
  "not_required",
  "pending",
  "approved",
  "rejected",
] as const;
export type ApprovalState = (typeof APPROVAL_STATES)[number];

// ─── Check Result ───
export type CheckResult = "pass" | "fail" | "pending";

// ─── Evidence Link ───
export type EvidenceLink = {
  type: string; // "pr" | "ci" | "ticket" | "doc" | "screenshot" | custom
  url: string;
  label?: string;
};

// ─── Traceability ───
export type Traceability = {
  sourceRunId: string | null;
  relatedRunIds: string[];
  adrIds: string[];
  incidentIds: string[];
};

// ─── Outcome ───
export type Outcome = {
  goal: string;
  successCriteria: string[];
  resultSummary: string | null;
};

// ─── Persona Display Config ───
export const PERSONA_DISPLAY: Record<
  PersonaEnum,
  { label: string; short: string; color: string }
> = {
  architect:          { label: "Architect",          short: "ARCH",  color: "#a78bfa" },
  product_leader:     { label: "Product Leader",     short: "PROD",  color: "#60a5fa" },
  knowledge_steward:  { label: "Knowledge Steward",  short: "KNOW",  color: "#22d3ee" },
  operations_lead:    { label: "Operations Lead",    short: "OPS",   color: "#fbbf24" },
  governance_lead:    { label: "Governance Lead",    short: "GOV",   color: "#fb7185" },
  agent_engineer:     { label: "Agent Engineer",     short: "ENG",   color: "#34d399" },
  domain_expert:      { label: "Domain Expert",      short: "DOM",   color: "#2dd4bf" },
  ux_growth:          { label: "UX / Growth",        short: "UX",    color: "#fb923c" },
};

// ─── Activity Display Config ───
export const ACTIVITY_DISPLAY: Record<
  ActivityTypeEnum,
  { label: string; short: string }
> = {
  code_generation:          { label: "Code Generation",         short: "CODE" },
  bug_fixing:               { label: "Bug Detection & Fixing",  short: "BUG" },
  testing_automation:        { label: "Testing Automation",      short: "TEST" },
  project_management:        { label: "Project Management",      short: "PM" },
  documentation:             { label: "Documentation",           short: "DOCS" },
  refactoring_optimization:  { label: "Refactoring & Optimization", short: "REFACTOR" },
  security_enhancement:      { label: "Security Enhancement",    short: "SEC" },
  devops_cicd:               { label: "DevOps & CI/CD",          short: "CICD" },
  ux_design:                 { label: "UX Design",               short: "UX" },
  architecture_design:       { label: "Architecture Design",     short: "ARCH" },
};

// ─── Persona-to-Activity Default Assignments ───
// When a user selects an activity type, these auto-populate.
export const PERSONA_DEFAULTS: Record<
  ActivityTypeEnum,
  { primary: PersonaEnum; support: PersonaEnum[] }
> = {
  code_generation:          { primary: "agent_engineer",    support: ["architect", "domain_expert"] },
  bug_fixing:               { primary: "agent_engineer",    support: ["operations_lead"] },
  testing_automation:        { primary: "agent_engineer",    support: ["governance_lead", "domain_expert"] },
  project_management:        { primary: "product_leader",    support: ["operations_lead"] },
  documentation:             { primary: "knowledge_steward", support: ["architect", "ux_growth"] },
  refactoring_optimization:  { primary: "architect",         support: ["agent_engineer", "governance_lead"] },
  security_enhancement:      { primary: "governance_lead",   support: ["architect", "operations_lead"] },
  devops_cicd:               { primary: "operations_lead",   support: ["agent_engineer", "governance_lead"] },
  ux_design:                 { primary: "ux_growth",         support: ["domain_expert", "product_leader"] },
  architecture_design:       { primary: "architect",         support: ["product_leader", "governance_lead"] },
};

// ─── Policy Enforcement ───
// Returns adjusted supporting personas based on activity type rules.
export function enforcePersonaPolicy(
  activityType: ActivityTypeEnum,
  primaryPersona: PersonaEnum,
  supportingPersonas: PersonaEnum[]
): PersonaEnum[] {
  const result = [...supportingPersonas];

  // Rule: security, cicd, architecture => must include governance_lead
  const requiresGovernance: ActivityTypeEnum[] = [
    "security_enhancement",
    "devops_cicd",
    "architecture_design",
  ];
  if (requiresGovernance.includes(activityType)) {
    if (primaryPersona !== "governance_lead" && !result.includes("governance_lead")) {
      result.push("governance_lead");
    }
  }

  // Rule: documentation => must include knowledge_steward
  if (activityType === "documentation") {
    if (primaryPersona !== "knowledge_steward" && !result.includes("knowledge_steward")) {
      result.push("knowledge_steward");
    }
  }

  // Rule: ux_design => must include product_leader or domain_expert
  if (activityType === "ux_design") {
    const hasRequired =
      primaryPersona === "product_leader" ||
      primaryPersona === "domain_expert" ||
      result.includes("product_leader") ||
      result.includes("domain_expert");
    if (!hasRequired) {
      result.push("product_leader");
    }
  }

  return result;
}

// ─── Risk → Approval Logic ───
export function deriveApproval(riskLevel: RiskLevel): {
  approvalRequired: boolean;
  approvalState: ApprovalState;
} {
  const needsApproval = riskLevel === "high" || riskLevel === "critical";
  return {
    approvalRequired: needsApproval,
    approvalState: needsApproval ? "pending" : "not_required",
  };
}

// ─── Get defaults for an activity type ───
export function getPersonaDefaults(activityType: ActivityTypeEnum) {
  const defaults = PERSONA_DEFAULTS[activityType];
  const enforced = enforcePersonaPolicy(
    activityType,
    defaults.primary,
    defaults.support
  );
  return { primary: defaults.primary, support: enforced };
}
