import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

const PROJECT_ID = "default";

export type MeetingMessageInput = {
  text: string;
  authorType: "human" | "agent";
  createdAt: Date;
  agentLabel?: string;
};

export async function savePromotedMeeting(params: {
  topicId: string;
  title: string;
  messages: MeetingMessageInput[];
}): Promise<string> {
  const { topicId, title, messages } = params;
  const ref = collection(
    db,
    "projectSolo",
    PROJECT_ID,
    "topics",
    topicId,
    "promotedMeetings"
  );
  const docRef = await addDoc(ref, {
    title: title.trim() || "Meeting",
    endedAt: serverTimestamp(),
    messages: messages.map((m) => ({
      text: m.text,
      authorType: m.authorType,
      createdAt: Timestamp.fromDate(m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt)),
      ...(m.agentLabel != null && m.agentLabel !== "" ? { agentLabel: m.agentLabel } : {}),
    })),
  });
  return docRef.id;
}
