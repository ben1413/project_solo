import { db } from "@/lib/firebase/client";
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

export async function ensureRun(topicId: string, chapterId: string): Promise<string> {
  // Runs are stored under the selected topic/chapter (authoritative for UI state)
  const runsRef = collection(
    db,
    "projectSolo",
    "default",
    "topics",
    topicId,
    "chapters",
    chapterId,
    "runs"
  );

  // Look for an existing "open" run (no orderBy to avoid composite-index requirements)
  const q = query(runsRef, where("closedAt", "==", null), limit(1));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    return snapshot.docs[0].id;
  }

  // Create a new run
  const docRef = await addDoc(runsRef, {
    topicId,
    chapterId,
    title: "New Session",
    createdAt: serverTimestamp(),
    closedAt: null,
  });

  return docRef.id;
}
