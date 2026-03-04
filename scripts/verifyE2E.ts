/**
 * Verifies E2E persistence: topic → chapter → run → message → read back.
 * Run: DOTENV_CONFIG_PATH=.env.local npx tsx scripts/verifyE2E.ts
 */
import "dotenv/config";
import { adminDb } from "../src/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

const PROJECT_ID = "default";
const INBOX_TOPIC_ID = "inbox";
const INBOX_CHAPTER_ID = "inbox";

async function main() {
  const projectRef = adminDb.collection("projectSolo").doc(PROJECT_ID);
  const runsRef = projectRef
    .collection("topics")
    .doc(INBOX_TOPIC_ID)
    .collection("chapters")
    .doc(INBOX_CHAPTER_ID)
    .collection("runs");

  // 1) Ensure at least one run exists for inbox/inbox
  const runsSnap = await runsRef.limit(1).get();
  let runId: string;
  if (!runsSnap.empty) {
    runId = runsSnap.docs[0].id;
    console.log("Using existing run:", runId);
  } else {
    const newRun = await runsRef.add({
      topicId: INBOX_TOPIC_ID,
      chapterId: INBOX_CHAPTER_ID,
      title: "E2E verify",
      createdAt: Timestamp.now(),
      closedAt: null,
    });
    runId = newRun.id;
    console.log("Created run:", runId);
  }

  // 2) Write one message to the flat messages collection (same path as MessageComposer)
  const messagesRef = adminDb.collection("messages");
  const payload = {
    topicId: INBOX_TOPIC_ID,
    runId,
    text: "[E2E verify] " + new Date().toISOString(),
    authorType: "human",
    authorName: "Ben",
    createdAt: Timestamp.now(),
  };
  await messagesRef.add(payload);
  console.log("Wrote message to messages/");

  // 3) Read back: query by topicId + runId (same as useMessages)
  const q = messagesRef
    .where("topicId", "==", INBOX_TOPIC_ID)
    .where("runId", "==", runId);
  const readSnap = await q.get();
  const count = readSnap.size;

  if (count >= 1) {
    console.log("OK: Read back", count, "message(s). E2E persistence verified.");
    process.exit(0);
  } else {
    console.error("FAIL: Expected at least 1 message, got", count);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
