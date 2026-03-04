import {
  collection,
  doc,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

const PROJECT_ID = "default";

/**
 * Permanently delete a chapter and its runs from Firestore.
 * Messages in the flat "messages" collection for those runIds are left orphaned.
 * At scale we must prune orphaned messages (see docs/PROJECTSOLO_BUILD_PLAN.md →
 * Engineering Invariants → Data hygiene at scale).
 */
export async function deleteChapter(params: {
  topicId: string;
  chapterId: string;
}) {
  const { topicId, chapterId } = params;

  const chapterRef = doc(
    db,
    "projectSolo",
    PROJECT_ID,
    "topics",
    topicId,
    "chapters",
    chapterId
  );
  const runsRef = collection(chapterRef, "runs");

  const runsSnap = await getDocs(runsRef);
  for (const d of runsSnap.docs) {
    await deleteDoc(d.ref);
  }

  await deleteDoc(chapterRef);
}
