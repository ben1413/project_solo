// ============================================================
// ProjectSolo — Run Closure Validator
// ============================================================
// Pure function. No Firebase. No side effects. Unit-testable.
// This is the governance gate that prevents closing a run
// unless all checks pass, approval is granted, and evidence exists.
// ============================================================

import type { CheckResult, EvidenceLink, ApprovalState } from "@/lib/personas/types";

export type ValidatableRun = {
  requiredChecks: string[];
  checkResults: Record<string, CheckResult>;
  approvalRequired: boolean;
  approvalState: ApprovalState;
  evidenceLinks: EvidenceLink[];
};

export type ValidationResult = {
  ok: boolean;
  reason?: string;
  details?: string;
};

/**
 * Validates whether a run can be closed.
 * Called before any status="closed" write to Firestore.
 *
 * Rules:
 * 1. All requiredChecks must have checkResults[check] === "pass"
 * 2. If approvalRequired, approvalState must be "approved"
 * 3. Must have at least 1 evidenceLink
 */
export function validateRunForClose(run: ValidatableRun): ValidationResult {
  // Rule 1: All required checks must pass
  for (const check of run.requiredChecks) {
    const result = run.checkResults[check];
    if (result !== "pass") {
      return {
        ok: false,
        reason: "check_failed",
        details: `${check} is ${result ?? "missing"}`,
      };
    }
  }

  // Rule 2: Approval required → must be approved
  if (run.approvalRequired && run.approvalState !== "approved") {
    return {
      ok: false,
      reason: "approval_missing",
      details: `Approval state is "${run.approvalState}", needs "approved"`,
    };
  }

  // Rule 3: Must have evidence
  if (!run.evidenceLinks || run.evidenceLinks.length === 0) {
    return {
      ok: false,
      reason: "evidence_missing",
      details: "At least 1 evidence link is required to close a run",
    };
  }

  return { ok: true };
}

/**
 * Returns a human-readable summary of what's blocking closure.
 * Useful for UI display.
 */
export function getClosureBlockers(run: ValidatableRun): string[] {
  const blockers: string[] = [];

  for (const check of run.requiredChecks) {
    const result = run.checkResults[check];
    if (result !== "pass") {
      blockers.push(`Check "${check}" is ${result ?? "not started"}`);
    }
  }

  if (run.approvalRequired && run.approvalState !== "approved") {
    blockers.push(`Approval is ${run.approvalState}`);
  }

  if (!run.evidenceLinks || run.evidenceLinks.length === 0) {
    blockers.push("No evidence links attached");
  }

  return blockers;
}
