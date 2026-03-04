import { db } from "@/lib/firebase/client";
import { collection, query, where, onSnapshot, type Timestamp } from "firebase/firestore";

type Msg = Record<string, unknown> & { id: string };

function tsMillis(v: unknown): number | null {
  // Firestore Timestamp has toMillis()
  if (v && typeof v === "object" && "toMillis" in (v as Record<string, unknown>)) {
    try {
      const n = (v as Timestamp).toMillis();
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function subscribeMessages(
  runId: string,
  onUpdate: (messages: Msg[]) => void
) {
  // NOTE: Avoid Firestore composite-index requirement (where + orderBy on different fields)
  // by sorting client-side for v0.
  const q = query(collection(db, "messages"), where("runId", "==", runId));

  return onSnapshot(
    q,
    (snapshot) => {
      const msgs: Msg[] = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));

      msgs.sort((a, b) => {
        const am = tsMillis(a.createdAt);
        const bm = tsMillis(b.createdAt);
        if (am !== null && bm !== null && am !== bm) return am - bm;
        return a.id.localeCompare(b.id);
      });

      onUpdate(msgs);
    },
    (err) => {
      console.error("subscribeMessages failed:", err);
      onUpdate([]);
    }
  );
}
