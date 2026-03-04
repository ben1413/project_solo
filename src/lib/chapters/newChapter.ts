import {
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";

const PROJECT_ID = "default";

export async function createNewChapter(db: Firestore, topicId: string) {
  const topicRef = doc(db, "projectSolo", PROJECT_ID, "topics", topicId);
  const chaptersRef = collection(topicRef, "chapters");
  const newChapterRef = doc(chaptersRef); // auto-id

  // Get chapter count outside transaction (slight race condition acceptable for numbering)
  const chaptersSnap = await getDocs(chaptersRef);
  const nextNum = chaptersSnap.size + 1;
  const chapterTitle = `Chapter ${nextNum}`;

  await runTransaction(db, async (tx) => {
    const topicSnap = await tx.get(topicRef);
    if (!topicSnap.exists()) throw new Error(`Topic not found: ${topicId}`);

    // NOTE: We no longer close the previous chapter when creating a new one.
    // Multiple chapters can remain "open" and visible in the list.
    // The topic's openChapterId just tracks which chapter is currently selected.

    // Create new open chapter with sequential title
    tx.set(
      newChapterRef,
      {
        title: chapterTitle,
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
