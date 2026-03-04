import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { PromotedMeeting, PromotedMeetingDoc } from "./types";
import type { Timestamp } from "firebase/firestore";

const PROJECT_ID = "default";

function toDate(v: Timestamp | { seconds: number; nanoseconds: number } | null | undefined): Date {
  if (!v) return new Date();
  try {
    if (typeof (v as Timestamp).toMillis === "function") {
      const ms = (v as Timestamp).toMillis();
      if (typeof ms === "number" && !isNaN(ms)) {
        return new Date(ms);
      }
    }
    const s = (v as { seconds: number }).seconds;
    if (typeof s === "number" && !isNaN(s)) {
      return new Date(s * 1000);
    }
  } catch {
    // Fall through to default
  }
  return new Date();
}

export function usePromotedMeetings(topicId: string | null): {
  meetings: PromotedMeeting[];
  error: string | null;
} {
  const [meetings, setMeetings] = useState<PromotedMeeting[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!topicId) {
      queueMicrotask(() => {
        setMeetings([]);
        setError(null);
      });
      return;
    }
    const ref = collection(
      db,
      "projectSolo",
      PROJECT_ID,
      "topics",
      topicId,
      "promotedMeetings"
    );
    const q = query(ref, orderBy("endedAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: PromotedMeeting[] = snap.docs.map((d) => {
          const data = d.data() as PromotedMeetingDoc;
          return {
            id: d.id,
            title: data.title ?? "Meeting",
            endedAt: toDate(data.endedAt),
            messages: data.messages ?? [],
          };
        });
        setMeetings(list);
        setError(null);
      },
      (err) => {
        setError(err.message ?? "Failed to load promoted meetings");
      }
    );
    return () => unsub();
  }, [topicId]);

  return { meetings, error };
}
