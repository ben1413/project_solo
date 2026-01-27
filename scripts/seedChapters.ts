import "dotenv/config";
import { adminDb } from "../src/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

const PROJECT_ID = "default";

// This creates an initial empty/open chapter per core topic.
// Chapters are append-only; nothing is ever deleted.
const CORE_TOPICS = [
  { id: "runway", title: "Runway" },
  { id: "partner", title: "Partner" },
  { id: "kids", title: "Kids" },
];

async function run() {
  const projectRef = adminDb.collection("projectSolo").doc(PROJECT_ID);

  for (const topic of CORE_TOPICS) {
    const chaptersRef = projectRef
      .collection("topics")
      .doc(topic.id)
      .collection("chapters");

    const chapterId = "initial";

    await chaptersRef.doc(chapterId).set(
      {
        title: `${topic.title} — Current`,
        topicId: topic.id,
        status: "open",
        createdAt: Timestamp.now(),
        closedAt: null,
      },
      { merge: true }
    );

    await projectRef
      .collection("topics")
      .doc(topic.id)
      .set(
        {
          openChapterId: chapterId,
          lastTouchedAt: Timestamp.now(),
        },
        { merge: true }
      );
  }

  console.log("✅ Initial chapters seeded for core topics");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
