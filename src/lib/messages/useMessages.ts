"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type QuerySnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export type Message = {
  id: string;
  topicId: string;
  chapterId: string;
  runId: string;
  role: "human";
  content: string;
  createdAt: unknown;
  meta: unknown | null;
};

export function useMessages(params: {
  topicId?: string;
  chapterId?: string;
  runId?: string;
}) {
  const { topicId, chapterId, runId } = params;

  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabled = Boolean(topicId && chapterId && runId);

  const messagesRef = useMemo(() => {
    if (!enabled) return null;
    return collection(
      db,
      "projectSolo",
      "default",
      "topics",
      topicId as string,
      "chapters",
      chapterId as string,
      "runs",
      runId as string,
      "messages"
    );
  }, [enabled, topicId, chapterId, runId]);

  useEffect(() => {
    if (!messagesRef) return;

    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(
      q,
      (snap: QuerySnapshot<DocumentData>) => {
        const next: Message[] = snap.docs.map((d) => d.data() as Message);
        setMessages(next);
        setError(null);
      },
      (err) => {
        setError(err.message || "Failed to subscribe to messages");
      }
    );

    return () => unsub();
  }, [messagesRef]);

  if (!enabled) {
    return { messages: null, error: null, enabled };
  }

  return { messages, error, enabled };
}
