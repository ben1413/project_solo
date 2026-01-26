export type ChapterStatus = "open" | "closed";

export type Chapter = {
  id: string;
  topicId: string;
  title: string;
  status: ChapterStatus;
  createdAt: unknown;
  closedAt: unknown | null;
};
