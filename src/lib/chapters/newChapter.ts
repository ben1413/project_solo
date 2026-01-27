import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";

const PROJECT_ID = "default";

export async function createNewChapter(db: Firestore, topicId: string) {
  const topicRef = doc(db, "projectSolo", PROJECT_ID, "topics", topicId);
  const chaptersRef = collection(topicRef, "chapters");
  const newChapterRef = doc(chaptersRef); // auto-id

  await runTransaction(db, async (tx) => {
    const topicSnap = await tx.get(topicRef);
    if (!topicSnap.exists()) throw new Error(`Topic not found: ${topicId}`);

    const openChapterId = (topicSnap.data() as { openChapterId?: unknown })
      .openChapterId;
    const openId = typeof openChapterId === "string" ? openChapterId : null;

    // Close old open chapter (if any)
    if (openId) {
      const openRef = doc(chaptersRef, openId);
      tx.set(
        openRef,
        {
          status: "closed",
          closedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    // Create new open chapter
    tx.set(
      newChapterRef,
      {
        title: "New Chapter",
        status: "open",
        createdAt: serverTimestamp(),
        closedAt: null,
      },
      { merge: true }
    );

    // Point topic at new open chapter
    tx.set(
      topicRef,
      {
        openChapterId: newChapterRef.id,
        lastTouchedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  return newChapterRef.id;
}
