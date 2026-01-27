"use client";

import { doc, setDoc, serverTimestamp, type Firestore } from "firebase/firestore";

const PROJECT_ID = "default";
const INBOX_TOPIC_ID = "inbox";
const INBOX_CHAPTER_ID = "inbox";

export async function ensureInbox(db: Firestore) {
  const topicRef = doc(db, "projectSolo", PROJECT_ID, "topics", INBOX_TOPIC_ID);

  await setDoc(
    topicRef,
    {
      title: "Inbox",
      order: -1000,
      archived: false,
      isSystem: true,
      openChapterId: INBOX_CHAPTER_ID,
      lastTouchedAt: serverTimestamp(),
    },
    { merge: true }
  );

  const chapterRef = doc(
    db,
    "projectSolo",
    PROJECT_ID,
    "topics",
    INBOX_TOPIC_ID,
    "chapters",
    INBOX_CHAPTER_ID
  );

  await setDoc(
    chapterRef,
    {
      title: "Inbox",
      topicId: INBOX_TOPIC_ID,
      status: "open",
      createdAt: serverTimestamp(),
      closedAt: null,
      lastTouchedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export const INBOX = {
  topicId: INBOX_TOPIC_ID,
  chapterId: INBOX_CHAPTER_ID,
} as const;
