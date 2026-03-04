import type { Timestamp } from "firebase/firestore";

export type PromotedMeetingMessage = {
  text: string;
  authorType: "human" | "agent";
  createdAt: Timestamp | { seconds: number; nanoseconds: number };
  /** When authorType is "agent", who said it: "Name · Role" display (stored as "Name / Role"). */
  agentLabel?: string;
};

export type PromotedMeetingDoc = {
  title: string;
  endedAt: Timestamp | { seconds: number; nanoseconds: number };
  messages: PromotedMeetingMessage[];
};

export type PromotedMeeting = {
  id: string;
  title: string;
  endedAt: Date;
  messages: PromotedMeetingMessage[];
};
