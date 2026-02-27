"use client";

import { useState } from "react";
import {
  PERSONAS,
  ACTIVITY_TYPES,
  PERSONA_DISPLAY,
  ACTIVITY_DISPLAY,
  RISK_LEVELS,
  type PersonaEnum,
  type ActivityTypeEnum,
  type RiskLevel,
} from "@/lib/personas/types";
import type { PersonaContext } from "@/lib/personas/usePersonaContext";

type PersonaBarProps = {
  ctx: PersonaContext;
};

export function PersonaBar({ ctx }: PersonaBarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-neutral-800/60 bg-neutral-950/50">
      {/* Collapsed bar */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-2 text-left transition hover:bg-neutral-900/50"
      >
        <div className="flex items-center gap-3">
          {/* Persona badge */}
          {ctx.primaryPersona ? (
            <span
              className="rounded px-2 py-0.5 text-xs font-semibold"
              style={{
                color: PERSONA_DISPLAY[ctx.primaryPersona].color,
                backgroundColor: PERSONA_DISPLAY[ctx.primaryPersona].color + "15",
                border: `1px solid ${PERSONA_DISPLAY[ctx.primaryPersona].color}30`,
              }}
            >
              {PERSONA_DISPLAY[ctx.primaryPersona].short}
            </span>
          ) : (
            <span className="rounded bg-neutral-800/60 px-2 py-0.5 text-xs text-neutral-500">
              NO ROLE
            </span>
          )}

          {/* Activity badge */}
          {ctx.activityType ? (
            <span className="text-xs text-neutral-400">
              {ACTIVITY_DISPLAY[ctx.activityType].label}
            </span>
          ) : (
            <span className="text-xs text-neutral-600">Select activity…</span>
          )}

          {/* Risk indicator */}
          {ctx.riskLevel !== "low" && (
            <span
              className={[
                "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                ctx.riskLevel === "critical"
                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                  : ctx.riskLevel === "high"
                  ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                  : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
              ].join(" ")}
            >
              {ctx.riskLevel}
            </span>
          )}

          {/* Approval indicator */}
          {ctx.approvalRequired && (
            <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-400 border border-rose-500/20">
              Approval Required
            </span>
          )}
        </div>

        <span className="text-xs text-neutral-600">
          {expanded ? "▲ Collapse" : "▼ Configure"}
        </span>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-neutral-800/40 px-4 py-3 space-y-3">
          {/* Activity Type Selector */}
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
              Activity Type
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ACTIVITY_TYPES.map((at) => {
                const active = ctx.activityType === at;
                return (
                  <button
                    key={at}
                    type="button"
                    onClick={() => ctx.setActivityType(at)}
                    className={[
                      "rounded-md px-2.5 py-1 text-xs font-medium transition",
                      active
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-neutral-800/40 text-neutral-400 border border-transparent hover:bg-neutral-800/70 hover:text-neutral-300",
                    ].join(" ")}
                  >
                    {ACTIVITY_DISPLAY[at].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary Persona */}
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
              Primary Persona
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PERSONAS.map((p) => {
                const active = ctx.primaryPersona === p;
                const display = PERSONA_DISPLAY[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => ctx.setPrimaryPersona(p)}
                    className={[
                      "rounded-md px-2.5 py-1 text-xs font-medium transition",
                      active
                        ? "border"
                        : "bg-neutral-800/40 text-neutral-400 border border-transparent hover:bg-neutral-800/70",
                    ].join(" ")}
                    style={
                      active
                        ? {
                            color: display.color,
                            backgroundColor: display.color + "15",
                            borderColor: display.color + "30",
                          }
                        : undefined
                    }
                  >
                    {display.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Supporting Personas */}
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
              Supporting Personas
              <span className="ml-2 text-neutral-600 normal-case tracking-normal">
                (auto-populated by policy)
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PERSONAS.filter((p) => p !== ctx.primaryPersona).map((p) => {
                const active = ctx.supportingPersonas.includes(p);
                const display = PERSONA_DISPLAY[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      if (active) {
                        ctx.setSupportingPersonas(
                          ctx.supportingPersonas.filter((x) => x !== p)
                        );
                      } else {
                        ctx.setSupportingPersonas([...ctx.supportingPersonas, p]);
                      }
                    }}
                    className={[
                      "rounded-md px-2.5 py-1 text-xs font-medium transition",
                      active
                        ? "border"
                        : "bg-neutral-800/40 text-neutral-400 border border-transparent hover:bg-neutral-800/70",
                    ].join(" ")}
                    style={
                      active
                        ? {
                            color: display.color,
                            backgroundColor: display.color + "10",
                            borderColor: display.color + "25",
                          }
                        : undefined
                    }
                  >
                    {display.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Risk Level */}
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
              Risk Level
            </div>
            <div className="flex gap-1.5">
              {RISK_LEVELS.map((rl) => {
                const active = ctx.riskLevel === rl;
                const colors: Record<string, string> = {
                  low: "#34d399",
                  medium: "#fbbf24",
                  high: "#fb923c",
                  critical: "#fb7185",
                };
                return (
                  <button
                    key={rl}
                    type="button"
                    onClick={() => ctx.setRiskLevel(rl)}
                    className={[
                      "rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wider transition",
                      active
                        ? "border"
                        : "bg-neutral-800/40 text-neutral-500 border border-transparent hover:bg-neutral-800/70",
                    ].join(" ")}
                    style={
                      active
                        ? {
                            color: colors[rl],
                            backgroundColor: colors[rl] + "12",
                            borderColor: colors[rl] + "30",
                          }
                        : undefined
                    }
                  >
                    {rl}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
