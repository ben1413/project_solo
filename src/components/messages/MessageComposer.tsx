"use client";

import { useState } from "react";
import { appendMessage } from "@/lib/messages/appendMessage";

type MessageComposerProps = {
  topicId?: string;
  chapterId?: string;
  runId?: string;
};

export function MessageComposer(props: MessageComposerProps) {
  const { topicId, chapterId, runId } = props;
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);  const hasTarget = Boolean(topicId && chapterId && runId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasTarget) return;
    const next = value.trim();
    if (!next) return;

    setSubmitting(true);
    try {
      await appendMessage({
        topicId: topicId as string,
        chapterId: chapterId as string,
        runId: runId as string,
        role: "human",
        content: next,
      });
      setValue("");
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting;

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
        placeholder={hasTarget ? "Write a message…" : "Preparing run… (select a topic or wait for run)"}
        className="flex-1 resize-none rounded-md border border-neutral-800/60 bg-black/20 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim() || !hasTarget}
        className="rounded-md border border-neutral-800/60 bg-white/10 px-3 py-2 text-sm text-neutral-100 disabled:opacity-50"
      >
        Send
      </button>
    </form>
  );
}
