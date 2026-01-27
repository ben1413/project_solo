import "dotenv/config";
import { adminDb } from "../src/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

const PROJECT_ID = "default";
const INITIAL_CHAPTER_ID = "initial";

function toStr(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim().length ? v : fallback;
}

async function run() {
  const projectRef = adminDb.collection("projectSolo").doc(PROJECT_ID);
  const topicsSnap = await projectRef.collection("topics").get();

  const seeded: string[] = [];

  for (const topicDoc of topicsSnap.docs) {
    const topicId = topicDoc.id;
    const topicData = topicDoc.data() as { title?: unknown; openChapterId?: unknown };
    const topicTitle = toStr(topicData.title, topicId);

    const chapterRef = projectRef
      .collection("topics")
      .doc(topicId)
      .collection("chapters")
      .doc(INITIAL_CHAPTER_ID);

    const chapterSnap = await chapterRef.get();

    if (!chapterSnap.exists) {
      await chapterRef.set(
        {
          title: `${topicTitle} — Current`,
          topicId,
          status: "open",
          createdAt: Timestamp.now(),
          closedAt: null,
        },
        { merge: true }
      );
      seeded.push(topicId);
    }

    const openId =
      typeof topicData.openChapterId === "string" ? topicData.openChapterId : null;

    if (!openId) {
      await projectRef
        .collection("topics")
        .doc(topicId)
        .set(
          {
            openChapterId: INITIAL_CHAPTER_ID,
            lastTouchedAt: Timestamp.now(),
          },
          { merge: true }
        );
    }
  }

  console.log(
    seeded.length
      ? `✅ Seeded initial chapters for: ${seeded.join(", ")}`
      : "✅ No new chapters needed (all topics already have initial)"
  );

  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Chapter seeding failed", err);
  process.exit(1);
});
