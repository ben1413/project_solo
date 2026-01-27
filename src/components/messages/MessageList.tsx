"use client";

import { useMessages } from "@/lib/messages/useMessages";

type MessageListProps = {
  topicId?: string;
  chapterId?: string;
  runId?: string;
};

export function MessageList(props: MessageListProps) {
  const { topicId, chapterId, runId } = props;
  const { messages, enabled } = useMessages({ topicId, chapterId, runId });
  if (!enabled) {
    return <div className="p-4 text-sm text-neutral-500">Preparing run…</div>;
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {!messages || messages.length === 0 ? (
        <div className="p-4 text-sm text-neutral-500">No messages yet.</div>
      ) : (
        messages.map((m) => (
          <div
            key={m.id}
            className="rounded-md border border-neutral-800/60 bg-neutral-950/30 px-3 py-2 text-sm whitespace-pre-wrap text-neutral-100"
          >
            {m.content}
          </div>
        ))
      )}
    </div>
  );
}
