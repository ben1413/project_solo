"use client";

import { useState } from "react";
import { appendMessage } from "@/lib/messages/appendMessage";
import { createRun } from "@/lib/runs/createRun";
import type { PersonaEnum, ActivityTypeEnum, RiskLevel } from "@/lib/personas/types";

type MessageComposerProps = {
  topicId?: string;
  chapterId?: string;
  runId?: string;
  // ─── Persona Context ───
  primaryPersona?: PersonaEnum | null;
  supportingPersonas?: PersonaEnum[];
  activityType?: ActivityTypeEnum | null;
  riskLevel?: RiskLevel;
};

export function MessageComposer(props: MessageComposerProps) {
  const {
    topicId,
    chapterId,
    runId,
    primaryPersona,
    supportingPersonas,
    activityType,
    riskLevel,
  } = props;

  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const hasContext = Boolean(topicId && chapterId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const next = value.trim();
    if (!next) return;
    if (!hasContext) return;

    setSubmitting(true);
    try {
      let targetRunId = runId;

      // If the run isn't ready yet, create it on-demand (solid-state chat lane).
      if (!targetRunId) {
        targetRunId = await createRun({
          topicId: topicId as string,
          chapterId: chapterId as string,
          // ─── Pass persona context into on-demand runs ───
          primaryPersona: primaryPersona ?? undefined,
          supportingPersonas: supportingPersonas ?? undefined,
          activityType: activityType ?? undefined,
          riskLevel: riskLevel ?? undefined,
        });
      }

      await appendMessage({
        topicId: topicId as string,
        chapterId: chapterId as string,
        runId: targetRunId as string,
        role: "human",
        content: next,
      });

      setValue("");
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting || !hasContext;

  return (
    <form
      onSubmit={onSubmit}
      className="border-t border-neutral-800/60 bg-neutral-950/30 p-3 flex gap-2"
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        disabled={disabled}
        placeholder={
          hasContext
            ? "Write a message…"
            : "Select a topic to start chatting…"
        }
        className="flex-1 resize-none rounded-md border border-neutral-800/60 bg-black/20 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="rounded-md border border-neutral-800/60 bg-white/10 px-3 py-2 text-sm text-neutral-100 disabled:opacity-50"
      >
        Send
      </button>
    </form>
  );
}
