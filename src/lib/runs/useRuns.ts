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

export type Run = {
  id: string;
  topicId: string;
  chapterId: string;
  title: string | null;
  createdAt: unknown;
  closedAt: unknown | null;
};

export function useRuns(params: { topicId?: string; chapterId?: string }) {
  const { topicId, chapterId } = params;

  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabled = Boolean(topicId && chapterId);

  const runsRef = useMemo(() => {
    if (!enabled) return null;
    return collection(
      db,
      "projectSolo",
      "default",
      "topics",
      topicId as string,
      "chapters",
      chapterId as string,
      "runs"
    );
  }, [enabled, topicId, chapterId]);

  useEffect(() => {
    if (!runsRef) {
      setRuns(null);
      setError(null);
      return;
    }

    const q = query(runsRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap: QuerySnapshot<DocumentData>) => {
        const next: Run[] = snap.docs.map((d) => d.data() as Run);
        setRuns(next);
        setError(null);
      },
      (err) => {
        setError(err.message || "Failed to subscribe to runs");
      }
    );

    return () => unsub();
  }, [runsRef]);

  return { runs, error, enabled };
}
