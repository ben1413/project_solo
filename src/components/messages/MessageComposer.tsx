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
  const [submitting, setSubmitting] = useState(false);

  const enabled = Boolean(topicId && chapterId && runId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!enabled) return;
    if (!value.trim()) return;

    setSubmitting(true);
    try {
      await appendMessage({
        topicId: topicId as string,
        chapterId: chapterId as string,
        runId: runId as string,
        role: "human",
        content: value.trim(),
      });
      setValue("");
    } finally {
      setSubmitting(false);
    }
  }

  if (!enabled) return null;

  return (
    <form onSubmit={onSubmit} className="border-t p-3 flex gap-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        placeholder="Write a message…"
        className="flex-1 resize-none rounded-md border px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md border px-3 py-2 text-sm"
      >
        Send
      </button>
    </form>
  );
}
