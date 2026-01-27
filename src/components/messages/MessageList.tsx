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
    return null;
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No messages yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {messages.map((m) => (
        <div
          key={m.id}
          className="rounded-md border px-3 py-2 text-sm whitespace-pre-wrap"
        >
          {m.content}
        </div>
      ))}
    </div>
  );
}
