import { db } from "@/lib/firebase/client";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const PROJECT_ID = "default";

export type PromoteInput = {
  topicId: string;
  runId?: string;
  sourceMessageId?: string;
  text: string;
  tags?: string[];
  promotedByPersona?: string;
  promotedByJobTitle?: string;
};

export async function promoteToMemory(input: PromoteInput): Promise<string> {
  const ref = collection(db, "projectSolo", PROJECT_ID, "memory");
  const docRef = await addDoc(ref, {
    topicId: input.topicId,
    runId: input.runId ?? null,
    sourceMessageId: input.sourceMessageId ?? null,
    text: input.text,
    tags: input.tags ?? [],
    promotedByPersona: input.promotedByPersona ?? null,
    promotedByJobTitle: input.promotedByJobTitle ?? null,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function notifyP0Promote(params: {
  runId?: string;
  text: string;
  tags?: string[];
  persona?: string;
  jobTitle?: string;
}): Promise<void> {
  try {
    await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: params.text,
        runId: params.runId,
        memoryScope: "core",
        writeMemory: true,
        writeMemoryTags: params.tags,
        writeMemoryPersona: params.persona,
        writeMemoryJobTitle: params.jobTitle,
      }),
    });
  } catch (err) {
    console.warn("[Promote] P0 notify failed:", err);
  }
}
