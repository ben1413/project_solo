import { db } from "../firebase/client";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export const appendMessage = async ({
  runId,
  text,
  authorType,
  topicId,
}: {
  runId: string;
  text: string;
  authorType: "human" | "agent";
  topicId?: string;
}) => {
  if (!runId) {
    throw new Error("appendMessage: runId is required");
  }

  console.log("📝 FLAT MESSAGE WRITE:", {
    collection: "messages",
    runId,
    authorType,
    textLength: text?.length,
  });

  const docRef = await addDoc(collection(db, "messages"), {
    runId,
    text,
    authorType,
    topicId: topicId ?? "runway",
    createdAt: serverTimestamp(),
  });

  // Agent is only summoned from MessageComposer (single path: human → Firestore → /api/agent → agent reply write).
  // Callers that use appendMessage for human messages must call /api/agent separately if they want a reply.

  return docRef;
};
