"use client";

import { useState, useCallback, useMemo } from "react";
import {
  type PersonaEnum,
  type ActivityTypeEnum,
  type RiskLevel,
  getPersonaDefaults,
  deriveApproval,
  PERSONA_DISPLAY,
  ACTIVITY_DISPLAY,
} from "@/lib/personas/types";

export type PersonaContext = {
  // Current selections
  primaryPersona: PersonaEnum | null;
  supportingPersonas: PersonaEnum[];
  activityType: ActivityTypeEnum | null;
  riskLevel: RiskLevel;

  // Derived
  approvalRequired: boolean;
  displayLabel: string;

  // Actions
  setActivityType: (activity: ActivityTypeEnum) => void;
  setPrimaryPersona: (persona: PersonaEnum) => void;
  setSupportingPersonas: (personas: PersonaEnum[]) => void;
  setRiskLevel: (level: RiskLevel) => void;
  reset: () => void;
};

/**
 * Hook that manages persona context for the current work session.
 * When activityType changes, it auto-populates primary + supporting personas.
 */
export function usePersonaContext(): PersonaContext {
  const [primaryPersona, setPrimaryPersona] = useState<PersonaEnum | null>(null);
  const [supportingPersonas, setSupportingPersonas] = useState<PersonaEnum[]>([]);
  const [activityType, setActivityTypeRaw] = useState<ActivityTypeEnum | null>(null);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("low");

  // When activity type changes, auto-populate persona defaults
  const setActivityType = useCallback((activity: ActivityTypeEnum) => {
    setActivityTypeRaw(activity);
    const defaults = getPersonaDefaults(activity);
    setPrimaryPersona(defaults.primary);
    setSupportingPersonas(defaults.support);
  }, []);

  // Derived approval state
  const { approvalRequired } = useMemo(() => deriveApproval(riskLevel), [riskLevel]);

  // Display label for the persona bar
  const displayLabel = useMemo(() => {
    const parts: string[] = [];
    if (primaryPersona) {
      parts.push(PERSONA_DISPLAY[primaryPersona].short);
    }
    if (activityType) {
      parts.push(ACTIVITY_DISPLAY[activityType].short);
    }
    return parts.length > 0 ? parts.join(" / ") : "No role selected";
  }, [primaryPersona, activityType]);

  const reset = useCallback(() => {
    setPrimaryPersona(null);
    setSupportingPersonas([]);
    setActivityTypeRaw(null);
    setRiskLevel("low");
  }, []);

  return {
    primaryPersona,
    supportingPersonas,
    activityType,
    riskLevel,
    approvalRequired,
    displayLabel,
    setActivityType,
    setPrimaryPersona,
    setSupportingPersonas,
    setRiskLevel,
    reset,
  };
}
