import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/client";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export interface Message {
  id: string;
  text: string;
  authorType: 'human' | 'agent';
  createdAt?: { seconds: number; nanoseconds: number };
  topicId: string;
  runId: string;
}

export function useMessages(topicId?: string, runId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const tId = topicId ?? "runway";
    const rId = runId ?? "";

    // REMOVED orderBy to prevent Index Error
    if (!rId) {
      queueMicrotask(() => setMessages([]));
      return () => {};
    }

    const q = query(
      collection(db, "messages"),
      where("topicId", "==", tId),
      where("runId", "==", rId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rawMsgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];

      // SORT CLIENT-SIDE: Ascending order for chat history
      const sorted = rawMsgs.sort((a, b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tA - tB;
      });

      setMessages(sorted);
    });

    return () => unsubscribe();
  }, [topicId, runId]);

  return messages;
}
