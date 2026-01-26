"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

type TopicDoc = {
  title?: unknown;
  order?: unknown;
  archived?: unknown;
  isSystem?: unknown;
  openChapterId?: unknown;
};

type Topic = {
  id: string;
  title: string;
  order: number;
  archived: boolean;
  isSystem: boolean;
  openChapterId: string | null;
};

const PROJECT_ID = "default";

function toBool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function toNum(v: unknown, fallback = 999): number {
  return typeof v === "number" ? v : fallback;
}

function toStr(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim().length ? v : fallback;
}

export default function Home() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeTopic = useMemo(
    () => topics.find((t) => t.id === activeTopicId) || null,
    [topics, activeTopicId]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        const q = query(
          collection(db, "projectSolo", PROJECT_ID, "topics"),
          orderBy("order", "asc")
        );
        const snap = await getDocs(q);

        const rows: Topic[] = snap.docs.map((d) => {
          const data = d.data() as TopicDoc;
          return {
            id: d.id,
            title: toStr(data.title, d.id),
            order: toNum(data.order, 999),
            archived: toBool(data.archived, false),
            isSystem: toBool(data.isSystem, false),
            openChapterId:
              typeof data.openChapterId === "string" ? data.openChapterId : null,
          };
        });

        const visible = rows.filter((t) => !t.archived);

        if (!cancelled) {
          setTopics(visible);
          if (!activeTopicId && visible.length) setActiveTopicId(visible[0].id);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load topics";
        if (!cancelled) setError(msg);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl gap-6 px-6 py-10">
        {/* Left lane */}
        <aside className="w-[280px] rounded-2xl bg-neutral-900/70 p-4 shadow">
          <div className="mb-3 text-sm font-semibold tracking-wide text-neutral-200">
            ProjectSolo
          </div>

          {error ? (
            <div className="rounded-lg bg-red-950/40 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="space-y-1">
            {topics.map((t) => {
              const active = t.id === activeTopicId;
              const isCore = t.id === "runway" || t.id === "partner" || t.id === "kids";
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTopicId(t.id)}
                  className={[
                    "w-full rounded-xl px-3 py-2 text-left text-sm transition",
                    active
                      ? "bg-white text-black"
                      : "bg-neutral-800/40 text-neutral-200 hover:bg-neutral-800/70",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{t.title}</span>
                    {isCore ? (
                      <span className="ml-2 rounded-full bg-neutral-700/60 px-2 py-0.5 text-[10px] text-neutral-200">
                        core
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 text-xs text-neutral-400">
            Loaded {topics.length} topics from Firestore.
          </div>
        </aside>

        {/* Center lane */}
        <section className="flex-1 overflow-hidden rounded-2xl bg-neutral-900/40 shadow">
          <header className="border-b border-neutral-800/60 bg-neutral-950/40 px-6 py-4">
            <div className="text-xs text-neutral-400">ProjectSolo</div>
            <div className="mt-1 text-base font-semibold text-neutral-100">
              {activeTopic ? activeTopic.title : "—"}
            </div>
          </header>

          <div className="p-6">
            <div className="mt-2 rounded-xl bg-neutral-950/40 p-4 text-sm text-neutral-200">
              Next: show this topic’s chapters, then wire “new chapter” + “close chapter”.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
