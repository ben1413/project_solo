"use client";

import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

const PROJECT_ID = "default";

// System fallback context (always-on chat).
// Serves as the default "scratch" run when no topic is selected (work lane always visible).
// NOTE: This should NOT show up as a normal user topic in the left rail.
const INBOX_TOPIC_ID = "inbox";
const INBOX_CHAPTER_ID = "inbox";

export async function ensureInbox(db: Firestore) {
  const topicRef = doc(db, "projectSolo", PROJECT_ID, "topics", INBOX_TOPIC_ID);

  // Hidden/system topic so UI stays cohesive (chat is the star).
  await setDoc(
    topicRef,
    {
      title: "Inbox",
      order: -1000,
      archived: true, // hide from topic lane
      isSystem: true,
      openChapterId: INBOX_CHAPTER_ID,
      lastTouchedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
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

  // Re-assert pointer (idempotent, keeps invariant stable even if someone edits docs manually)
  await setDoc(
    topicRef,
    {
      openChapterId: INBOX_CHAPTER_ID,
      lastTouchedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export const INBOX = {
  topicId: INBOX_TOPIC_ID,
  chapterId: INBOX_CHAPTER_ID,
} as const;
