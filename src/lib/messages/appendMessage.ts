import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export type AppendMessageInput = {
  topicId: string;
  chapterId: string;
  runId: string;
  role: "human";
  content: string;
};

export async function appendMessage(input: AppendMessageInput) {
  const { topicId, chapterId, runId, role, content } = input;

  const messagesRef = collection(
    db,
    "projectSolo",
    "default",
    "topics",
    topicId,
    "chapters",
    chapterId,
    "runs",
    runId,
    "messages"
  );

  const messageRef = doc(messagesRef);

  await setDoc(messageRef, {
    id: messageRef.id,
    topicId,
    chapterId,
    runId,
    role,
    content,
    createdAt: serverTimestamp(),
    meta: null,
  });

  return messageRef.id;
}
