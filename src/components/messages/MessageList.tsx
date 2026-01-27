"use client";

import { useEffect, useRef } from "react";
import { useMessages } from "@/lib/messages/useMessages";

type MessageListProps = {
  topicId?: string;
  chapterId?: string;
  runId?: string;
};

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
          {messages.map((m) => (
            <div
              key={m.id}
              className="rounded-md border border-neutral-800/60 bg-neutral-950/30 px-3 py-2 text-sm whitespace-pre-wrap text-neutral-100"
            >
              {m.content}
            </div>
          ))}
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
