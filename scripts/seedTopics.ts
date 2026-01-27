import "dotenv/config";
import { adminDb } from "../src/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

const PROJECT_ID = "default";

type SeedTopic = {
  id: string;
  title: string;
  order: number;
  isSystem?: boolean;
};

const TOPICS: SeedTopic[] = [
  { id: "runway", title: "Runway", order: 1, isSystem: true },
  { id: "partner", title: "Partner", order: 2, isSystem: true },
  { id: "kids", title: "Kids", order: 3, isSystem: true },
  { id: "work", title: "Work", order: 4 },
  { id: "ideas", title: "Ideas", order: 5 },
];

async function main() {
  const batch = adminDb.batch();
  const baseRef = adminDb.collection("projectSolo").doc(PROJECT_ID);

  for (const t of TOPICS) {
    const ref = baseRef.collection("topics").doc(t.id);
    batch.set(
      ref,
      {
        title: t.title,
        order: t.order,
        archived: false,
        isSystem: !!t.isSystem,
        openChapterId: null,
        createdAt: Timestamp.now(),
      },
      { merge: true }
    );
  }

  await batch.commit();
  console.log("✅ Topics seeded");
}

main().catch((err) => {
  console.error("❌ Topic seeding failed", err);
  process.exit(1);
});
