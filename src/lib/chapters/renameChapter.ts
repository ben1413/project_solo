import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export async function renameChapter(params: {
  topicId: string;
  chapterId: string;
  title: string;
}) {
  const { topicId, chapterId, title } = params;

  const ref = doc(
    db,
    "projectSolo",
    "default",
    "topics",
    topicId,
    "chapters",
    chapterId
  );

  await updateDoc(ref, {
    title,
    lastTouchedAt: serverTimestamp(),
  });
}
