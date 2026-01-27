"use client";

import { useEffect, useRef } from "react";
import { Timestamp } from "firebase/firestore";
import { useMessages } from "@/lib/messages/useMessages";

type MessageListProps = {
  topicId?: string;
  chapterId?: string;
  runId?: string;
};

function formatCreatedAt(v: unknown): string | null {
  if (v instanceof Timestamp) {
    try {
      return v.toDate().toLocaleString();
    } catch {
      return null;
    }
  }
  return null;
}

function roleLabel(role: unknown): string {
  return role === "assistant" ? "Assistant" : "You";
}

export function MessageList(props: MessageListProps) {
  const { topicId, chapterId, runId } = props;
  const { messages, enabled } = useMessages({ topicId, chapterId, runId });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Only autoscroll if user is already near the bottom.
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  return (
    <div
      ref={containerRef}
      className="flex min-h-0 flex-1 flex-col overflow-auto p-4"
    >
      {!enabled ? (
        <div className="text-sm text-neutral-500">Preparing run…</div>
      ) : !messages || messages.length === 0 ? (
        <div className="text-sm text-neutral-500">No messages yet.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {messages.map((m) => {
            const role = (m as unknown as { role?: unknown }).role;
            const isAssistant = role === "assistant";
            const when = formatCreatedAt(
              (m as unknown as { createdAt?: unknown }).createdAt
            );

            return (
              <div
                key={m.id}
                className={[
                  "rounded-xl border px-3 py-2 text-sm whitespace-pre-wrap",
                  isAssistant
                    ? "border-neutral-700/60 bg-neutral-900/50 text-neutral-100"
                    : "border-neutral-800/60 bg-neutral-950/30 text-neutral-100",
                ].join(" ")}
              >
                <div className="mb-1 flex items-center justify-between text-[11px] text-neutral-400">
                  <span className="font-medium">{roleLabel(role)}</span>
                  {when ? <span>{when}</span> : <span />}
                </div>
                <div>{m.content}</div>
              </div>
            );
          })}
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
