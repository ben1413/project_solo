import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export type CreateRunInput = {
  chapterId: string;
  topicId: string;
  title?: string;
};

export async function createRun(input: CreateRunInput) {
  const { chapterId, topicId, title } = input;

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

  const runRef = doc(runsRef);

  await setDoc(runRef, {
    id: runRef.id,
    topicId,
    chapterId,
    title: title ?? null,
    createdAt: serverTimestamp(),
    closedAt: null,
  });

  return runRef.id;
}
