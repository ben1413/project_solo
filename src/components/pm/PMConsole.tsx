"use client";

import React from "react";
import { TranscribeComposer } from "@/components/messages/TranscribeComposer";
import { useVoiceTurns } from "@/hooks/useVoiceTurns";
import { savePromotedMeeting } from "@/lib/promotedMeetings/savePromotedMeeting";
import { usePromotedMeetings } from "@/lib/promotedMeetings/usePromotedMeetings";
import { formatMeetingDate } from "@/lib/promotedMeetings/formatMeetingDate";
import type { PromotedMeeting } from "@/lib/promotedMeetings/types";
import { promoteToMemory, notifyP0Promote } from "@/lib/promoteMemory";

type AuthorityMode = "human" | "hitl" | "agent";

type Capability = {
  id: string;
  label: string;
  description: string;
};

type Scope = {
  scopeType: "topic" | "project" | "workspace" | "board" | "custom";
  scopeId: string;
  displayName: string;
};

type AuthorityProfile = Record<string, AuthorityMode>;

type PMConsoleProps = {
  open: boolean;
  onClose: () => void;
  scope: Scope;
  /** All topics for the scope dropdown; when user picks one, onScopeChange is called. */
  topics?: Array<{ id: string; title: string }>;
  /** Called when user selects a different topic in the dropdown; board state is keyed by scopeId so the board refreshes to that topic's state. */
  onScopeChange?: (scope: Scope) => void;
  activated: boolean;
  onActivate: (profile: AuthorityProfile) => void;
  authorityProfile: AuthorityProfile;
  onAuthorityChange: (next: AuthorityProfile) => void;
  chatOpen: boolean;
  onToggleChat: () => void;
  agentOptions?: Array<{ id: string; label: string }>;
  engineOptions?: Array<{ id: string; label: string }>;
  activeAgentId?: string;
  activeEngineId?: string;
  onAgentChange?: (id: string) => void;
  onEngineChange?: (id: string) => void;
};

const CAPABILITIES: Capability[] = [
  {
    id: "create_task",
    label: "Create task",
    description: "Agents can propose or create new tasks.",
  },
  {
    id: "update_task_status",
    label: "Update task status",
    description: "Move tasks between Today / This Sprint / Blocked / Done.",
  },
  {
    id: "edit_task",
    label: "Edit task details",
    description: "Change title, notes, and links.",
  },
  {
    id: "create_decision",
    label: "Create decision",
    description: "Commit decisions to Ledger.",
  },
  {
    id: "supersede_decision",
    label: "Supersede decision",
    description: "Deprecate or reverse a decision.",
  },
  {
    id: "add_risk",
    label: "Add risk",
    description: "Log risks or open questions.",
  },
  {
    id: "resolve_risk",
    label: "Resolve risk",
    description: "Mark risks as resolved.",
  },
  {
    id: "add_milestone",
    label: "Add milestone",
    description: "Create or edit milestones.",
  },
  {
    id: "reprioritize",
    label: "Reorder priorities",
    description: "Change item ordering and priority.",
  },
  {
    id: "assign_owners",
    label: "Assign owners",
    description: "Assign tasks or decisions to humans/agents.",
  },
];

type ColumnId = "tasks" | "decisions" | "risks" | "done";

type BoardItemShape = { id: string; title: string; summary?: string; columnId: string };

/** Format for transcript: "You" or "Name · Role" (agent). Label is "Name / Role"; we display "Name · Role". */
function formatSpeakerLabel(
  authorType: "human" | "agent",
  agentLabel?: string | null,
  agentId?: string | null,
  participants?: Array<{ id: string; label: string }>
): string {
  if (authorType === "human") return "You";
  if (agentLabel) return agentLabel.replace(" / ", " · ");
  if (agentId && participants?.length) {
    const p = participants.find((x) => x.id === agentId);
    if (p) return p.label.replace(" / ", " · ");
  }
  return "Agent";
}

/** Normalize title from voice (often all lowercase): sentence case so "review pr" → "Review pr". */
function normalizeCommandTitle(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/**
 * Parse message for board commands and apply updates. All matching is case-insensitive
 * (so voice transcripts like "add task review pr" work). Supports:
 * - "add task <title>" / "add a task <title>"
 * - "add decision <title>" / "add a risk <title>"
 * - "move <title> to <tasks|decisions|risks|done>"
 */
function applyBoardCommandsFromMessage(
  text: string,
  setItems: (updater: (prev: BoardItemShape[]) => BoardItemShape[]) => void
): void {
  const t = text.trim();
  if (!t) return;

  const addMatch = t.match(/^add\s+(?:a\s+)?(task|decision|risk)\s+(.+)$/i);
  if (addMatch) {
    const [, kind, rest] = addMatch;
    const columnId = kind!.toLowerCase() as "tasks" | "decisions" | "risks";
    const title = normalizeCommandTitle(rest!);
    if (!title) return;
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `cmd-${Date.now()}`;
    setItems((prev) => [...prev, { id, title, summary: "", columnId }]);
    return;
  }

  const moveMatch = t.match(/^move\s+(.+?)\s+to\s+(tasks|decisions|risks|done)$/i);
  if (moveMatch) {
    const [, titlePart, col] = moveMatch;
    const targetColumn = col!.toLowerCase() as ColumnId;
    const search = titlePart!.trim().toLowerCase();
    if (!search) return;
    setItems((prev) => {
      const found = prev.find((i) => i.title.toLowerCase().includes(search) || search.includes(i.title.toLowerCase()));
      if (!found) return prev;
      return prev.map((item) => (item.id === found.id ? { ...item, columnId: targetColumn } : item));
    });
  }
}

function PromotedMeetingsDropdown({
  meetings,
  onSelectMeeting,
  onCloseDetail,
  onContinueMeeting,
  onPromoteToMemory,
  selectedMeeting,
}: {
  meetings: PromotedMeeting[];
  onSelectMeeting: (id: string) => void;
  onCloseDetail: () => void;
  onContinueMeeting?: (meeting: PromotedMeeting) => void;
  onPromoteToMemory?: (meeting: PromotedMeeting) => void;
  selectedMeetingId?: string | null;
  selectedMeeting: PromotedMeeting | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [promoting, setPromoting] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", handle);
    return () => document.removeEventListener("click", handle);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-blue)] hover:bg-white/10"
      >
        Promoted meetings
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 min-w-[240px] rounded-xl border border-white/10 bg-[var(--panel)] py-2 shadow-xl">
          {meetings.length === 0 ? (
            <div className="px-4 py-3 text-xs text-[var(--text-blue)]/60">No promoted meetings yet</div>
          ) : (
            <ul className="max-h-[280px] overflow-y-auto">
              {meetings.map((m) => {
                const isDefaultName = m.title.startsWith("Meeting ");
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectMeeting(m.id);
                        setOpen(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs text-[var(--text-blue)] hover:bg-white/10"
                    >
                      {isDefaultName ? (
                        formatMeetingDate(m.endedAt)
                      ) : (
                        <span className="flex flex-col gap-0.5">
                          <span className="font-medium truncate max-w-[200px]">{m.title}</span>
                          <span className="text-[10px] text-[var(--text-blue)]/50">{formatMeetingDate(m.endedAt)}</span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {selectedMeeting && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6">
          <div className="max-h-[80vh] w-full max-w-lg rounded-2xl border border-white/10 bg-[var(--panel)] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h3 className="text-sm font-semibold text-[var(--text-blue)]">{selectedMeeting.title}</h3>
              <div className="flex items-center gap-2">
                {onPromoteToMemory && (
                  <button
                    type="button"
                    disabled={promoting}
                    onClick={async () => {
                      setPromoting(true);
                      try {
                        await onPromoteToMemory(selectedMeeting);
                      } finally {
                        setPromoting(false);
                      }
                    }}
                    className="rounded-full bg-emerald-600/80 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-white hover:bg-emerald-600 border border-emerald-500/30 disabled:opacity-50"
                  >
                    {promoting ? "Promoting..." : "Promote to Memory"}
                  </button>
                )}
                {onContinueMeeting && (
                  <button
                    type="button"
                    onClick={() => { onCloseDetail(); onContinueMeeting(selectedMeeting); }}
                    className="rounded-full bg-white/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-blue)] hover:bg-white/20 border border-white/10"
                  >
                    Continue this meeting
                  </button>
                )}
                <button type="button" onClick={onCloseDetail} className="text-[var(--text-blue)]/70 hover:text-[var(--text-blue)]">
                  <span className="sr-only">Close</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {selectedMeeting.messages.length === 0 ? (
                <p className="text-xs text-[var(--text-blue)]/60">No messages in this meeting.</p>
              ) : (
                selectedMeeting.messages.map((msg, i) => {
                  const ts = msg.createdAt && typeof (msg.createdAt as { toMillis?: () => number }).toMillis === "function"
                    ? new Date((msg.createdAt as { toMillis: () => number }).toMillis())
                    : msg.createdAt && typeof (msg.createdAt as { seconds?: number }).seconds === "number"
                    ? new Date((msg.createdAt as { seconds: number }).seconds * 1000)
                    : null;
                  return (
                    <div key={i} className={msg.authorType === "agent" ? "text-[var(--text-blue)]/90" : "text-[var(--text-blue)]"}>
                      <span className="text-[10px] font-medium text-[var(--text-blue)]/70 uppercase tracking-wider">
                        {formatSpeakerLabel(msg.authorType, msg.agentLabel)}
                        {ts ? <span className="ml-1.5 font-normal normal-case tracking-normal text-[var(--text-blue)]/50">· {ts.toLocaleTimeString()}</span> : ""}
                      </span>
                      <p className="mt-0.5 text-sm">{msg.text}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskPill({
  item,
  isDragging,
  onDragStart,
  onDragEnd,
  onEdit,
}: {
  item: { id: string; title: string };
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onEdit: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", item.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onEdit}
      className={`
        rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-left text-[11px] text-[var(--text-blue)] cursor-grab active:cursor-grabbing
        hover:border-white/20 hover:bg-black/30 transition-colors
        ${isDragging ? "opacity-50" : ""}
      `}
    >
      {item.title || "Untitled"}
    </div>
  );
}

function TaskEditCard({
  item,
  onSave,
  onCancel,
}: {
  item: { id: string; title: string; summary?: string };
  onSave: (title: string, summary: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = React.useState(item.title);
  const [summary, setSummary] = React.useState(item.summary ?? "");
  return (
    <div className="rounded-xl border border-white/20 bg-black/30 p-3 space-y-3">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-[var(--text-blue)] placeholder:text-[var(--text-blue)]/50 outline-none focus:border-white/30"
      />
      <input
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="Summary (optional)"
        className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[10px] text-[var(--text-blue)]/80 placeholder:text-[var(--text-blue)]/40 outline-none focus:border-white/30"
      />
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="text-[10px] uppercase tracking-wider text-[var(--text-blue)]/70 hover:text-[var(--text-blue)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(title, summary)}
          className="rounded-full bg-white/10 border border-white/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-blue)] hover:bg-white/20"
        >
          Done
        </button>
      </div>
    </div>
  );
}

export function PMConsole({
  open,
  onClose,
  scope,
  activated,
  onActivate,
  authorityProfile,
  onAuthorityChange,
  chatOpen,
  onToggleChat,
  agentOptions = [],
  engineOptions = [],
  activeAgentId,
  activeEngineId,
  onAgentChange,
  onEngineChange,
  topics = [],
  onScopeChange,
}: PMConsoleProps) {
  const [chatText, setChatText] = React.useState("");
  const [chatMode, setChatMode] = React.useState<"text" | "transcribe">("text");

  type MeetingMessageState = {
    id: string;
    text: string;
    authorType: "human" | "agent";
    createdAt: Date;
    agentId?: string;
    agentLabel?: string;
  };
  /** In-progress meeting transcript per topic; cleared when meeting is promoted or topic switches. */
  const [meetingMessagesByScopeId, setMeetingMessagesByScopeId] = React.useState<Record<string, MeetingMessageState[]>>({});
  const [showPromoteModal, setShowPromoteModal] = React.useState(false);
  const [promoteTitle, setPromoteTitle] = React.useState("");
  const [selectedMeetingId, setSelectedMeetingId] = React.useState<string | null>(null);

  /** Meeting mode: when on, shelf shows "Meeting with X, Y" and participants are in the room (first-response-wins for open-ended questions). */
  const [meetingModeOn, setMeetingModeOn] = React.useState(false);
  const [meetingParticipants, setMeetingParticipants] = React.useState<Array<{ id: string; label: string }>>([]);
  const [showStartMeetingPicker, setShowStartMeetingPicker] = React.useState(false);
  /** When set, we're resuming from this promoted meeting; shelf shows "Continuing from [title]". */
  const [contextFromPromotedMeeting, setContextFromPromotedMeeting] = React.useState<PromotedMeeting | null>(null);
  const [pickerSelectedIds, setPickerSelectedIds] = React.useState<Set<string>>(new Set());
  const [pickerMeetingName, setPickerMeetingName] = React.useState("");
  /** The name of the active meeting (persists through the meeting lifecycle). */
  const [activeMeetingName, setActiveMeetingName] = React.useState("");
  /** When the current meeting started; used for elapsed timer. Cleared when meeting ends. */
  const [meetingStartedAt, setMeetingStartedAt] = React.useState<Date | null>(null);
  const [meetingElapsedSeconds, setMeetingElapsedSeconds] = React.useState(0);

  type BoardItem = { id: string; title: string; summary?: string; columnId: string };
  /** Board state per topic (scopeId); switching topic shows that topic's previous state. */
  const [boardStateByScopeId, setBoardStateByScopeId] = React.useState<Record<string, BoardItem[]>>({});
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [dragItemId, setDragItemId] = React.useState<string | null>(null);

  const scopeId = scope.scopeId;
  const boardItems = boardStateByScopeId[scopeId] ?? [];
  const meetingMessages = React.useMemo(
    () => meetingMessagesByScopeId[scopeId] ?? [],
    [meetingMessagesByScopeId, scopeId]
  );

  const { meetings: promotedMeetings } = usePromotedMeetings(activated ? scopeId : null);
  const selectedMeeting = selectedMeetingId ? promotedMeetings.find((m) => m.id === selectedMeetingId) : null;

  React.useEffect(() => {
    setEditingId(null);
  }, [scopeId]);

  const endMeeting = React.useCallback(() => {
    setPromoteTitle(activeMeetingName);
    setShowPromoteModal(true);
  }, [activeMeetingName]);

  const promoteNo = React.useCallback(() => {
    setShowPromoteModal(false);
    setMeetingMessagesByScopeId((prev) => ({ ...prev, [scopeId]: [] }));
    setPromoteTitle("");
    setActiveMeetingName("");
    setMeetingModeOn(false);
    setMeetingParticipants([]);
    setContextFromPromotedMeeting(null);
    setMeetingStartedAt(null);
    setMeetingElapsedSeconds(0);
  }, [scopeId]);

  const promoteYes = React.useCallback(async () => {
    const title = promoteTitle.trim() || activeMeetingName.trim() || `Meeting ${formatMeetingDate(new Date())}`;
    const messages = meetingMessages.map((m) => ({
      text: m.text,
      authorType: m.authorType as "human" | "agent",
      createdAt: m.createdAt,
      ...(m.agentLabel != null && m.agentLabel !== "" ? { agentLabel: m.agentLabel } : {}),
    }));
    await savePromotedMeeting({ topicId: scopeId, title, messages });
    setShowPromoteModal(false);
    setMeetingMessagesByScopeId((prev) => ({ ...prev, [scopeId]: [] }));
    setPromoteTitle("");
    setActiveMeetingName("");
    setMeetingModeOn(false);
    setMeetingParticipants([]);
    setContextFromPromotedMeeting(null);
    setMeetingStartedAt(null);
    setMeetingElapsedSeconds(0);
  }, [scopeId, promoteTitle, activeMeetingName, meetingMessages]);

  const openStartMeetingPicker = React.useCallback((fromPromoted?: PromotedMeeting) => {
    setContextFromPromotedMeeting(fromPromoted ?? null);
    setPickerSelectedIds(new Set());
    // Pre-fill with promoted meeting's title if continuing, otherwise keep current name or empty
    setPickerMeetingName(fromPromoted?.title ?? activeMeetingName ?? "");
    setShowStartMeetingPicker(true);
  }, [activeMeetingName]);

  const startMeetingFromPicker = React.useCallback(() => {
    if (pickerSelectedIds.size === 0) return;
    const participants = (agentOptions ?? []).filter((o) => pickerSelectedIds.has(o.id));
    setMeetingParticipants(participants);
    setActiveMeetingName(pickerMeetingName.trim());
    setMeetingStartedAt(new Date());
    setMeetingElapsedSeconds(0);
    setMeetingModeOn(true);
    setShowStartMeetingPicker(false);
  }, [agentOptions, pickerSelectedIds, pickerMeetingName]);

  React.useEffect(() => {
    if (!meetingModeOn || !meetingStartedAt) return;
    const interval = setInterval(() => {
      setMeetingElapsedSeconds(Math.floor((Date.now() - meetingStartedAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [meetingModeOn, meetingStartedAt]);

  const togglePickerAgent = React.useCallback((id: string) => {
    setPickerSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const formatMeetingElapsed = (totalSeconds: number): string => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const setBoardItems = React.useCallback(
    (updater: (prev: BoardItem[]) => BoardItem[]) => {
      setBoardStateByScopeId((m) => ({
        ...m,
        [scopeId]: updater(m[scopeId] ?? []),
      }));
    },
    [scopeId]
  );

  const [isSendingAgent, setIsSendingAgent] = React.useState(false);

  const sendMessage = React.useCallback(async () => {
    const text = chatText.trim();
    if (!text || isSendingAgent) return;

    // Clear input immediately
    setChatText("");

    // Add human message to transcript
    const humanId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}`;
    const humanMsg: MeetingMessageState = { id: humanId, text, authorType: "human", createdAt: new Date() };
    setMeetingMessagesByScopeId((prev) => ({
      ...prev,
      [scopeId]: [...(prev[scopeId] ?? []), humanMsg],
    }));

    // Apply board commands from message
    applyBoardCommandsFromMessage(text, setBoardItems as (u: (p: BoardItemShape[]) => BoardItemShape[]) => void);

    // Call agent API - in meeting mode use selected participants, otherwise use active agent
    const useAgent = meetingModeOn ? meetingParticipants[0] : (agentOptions?.[0] ?? null);
    if (useAgent) {
      setIsSendingAgent(true);
      try {
        const agentId = useAgent.id || "toni";
        const agentLabel = useAgent.label || "Agent";

        const response = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            agentId,
            memoryScope: 'working',
          }),
        });

        const data = await response.json();
        const agentReply = (data?.text || data?.reply || "").toString().trim();

        if (agentReply) {
          const agentMsgId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}`;
          const agentMsg: MeetingMessageState = {
            id: agentMsgId,
            text: agentReply,
            authorType: "agent",
            createdAt: new Date(),
            agentId,
            agentLabel,
          };
          setMeetingMessagesByScopeId((prev) => ({
            ...prev,
            [scopeId]: [...(prev[scopeId] ?? []), agentMsg],
          }));

          // Also apply board commands from agent reply
          applyBoardCommandsFromMessage(agentReply, setBoardItems as (u: (p: BoardItemShape[]) => BoardItemShape[]) => void);
        }
      } catch (err) {
        console.error("[PM Console Agent Error]:", err);
      } finally {
        setIsSendingAgent(false);
      }
    }
  }, [chatText, scopeId, setBoardItems, meetingModeOn, meetingParticipants, agentOptions, isSendingAgent]);

  const COLUMNS = [
    { id: "tasks", title: "Tasks", addLabel: "Add task" },
    { id: "decisions", title: "Decisions", addLabel: "Add decision" },
    { id: "risks", title: "Risks", addLabel: "Add risk" },
    { id: "done", title: "Done", addLabel: null as string | null },
  ];

  const addTask = () => {
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `task-${Date.now()}`;
    setBoardItems((prev) => [...prev, { id, title: "", summary: "", columnId: "tasks" }]);
    setEditingId(id);
  };

  const saveTask = (id: string, title: string, summary: string) => {
    const t = title.trim() || "Untitled";
    setBoardItems((prev) => prev.map((item) => (item.id === id ? { ...item, title: t, summary: summary.trim() } : item)));
    setEditingId(null);
  };

  const cancelEdit = (id: string, hadTitle: boolean) => {
    setEditingId(null);
    if (!hadTitle) setBoardItems((prev) => prev.filter((item) => item.id !== id));
  };

  const moveItem = (itemId: string, toColumnId: string) => {
    setBoardItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, columnId: toColumnId } : item)));
    setDragItemId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, toColumnId: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) moveItem(id, toColumnId);
  };

  const { voiceSessionOn, voiceTurnState, startVoiceConversation, stopVoiceConversation } = useVoiceTurns({
    isInputReadOnly: false,
    onVoiceSubmit: async ({ audio }) => {
      try {
        const formData = new FormData();
        formData.append('audio', audio, 'audio.webm');
        const res = await fetch('/api/audio/transcribe', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        const transcript = (data?.text || data?.transcript || '').trim();
        if (transcript) {
          setChatText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      } catch (err) {
        console.error('[PM Console Voice Error]:', err);
      }
    },
  });

  React.useEffect(() => {
    if (voiceSessionOn && chatText.trim().length > 0) {
      stopVoiceConversation();
    }
  }, [chatText, voiceSessionOn, stopVoiceConversation]);

  const handleAuthorityChange = (capabilityId: string, mode: AuthorityMode) => {
    onAuthorityChange({
      ...authorityProfile,
      [capabilityId]: mode,
    });
  };

  const readyToActivate = CAPABILITIES.every((cap) => Boolean(authorityProfile[cap.id]));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      {showStartMeetingPicker && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-labelledby="start-meeting-title">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[var(--panel)] p-8 shadow-2xl">
            <h2 id="start-meeting-title" className="text-lg font-semibold text-[var(--text-blue)]">
              {contextFromPromotedMeeting ? `Continue from "${contextFromPromotedMeeting.title}"` : "Start meeting"}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-blue)]/70">
              {contextFromPromotedMeeting ? "Choose who joins this follow-up meeting." : "Select 1 or more agents to join the meeting."}
            </p>
            <div className="mt-6 space-y-2 max-h-[240px] overflow-y-auto">
              {(agentOptions ?? []).map((opt) => (
                <label key={opt.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-4 py-3 cursor-pointer hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={pickerSelectedIds.has(opt.id)}
                    onChange={() => togglePickerAgent(opt.id)}
                    className="rounded border-white/20 bg-black/20 text-[var(--text-blue)] focus:ring-[var(--text-blue)]/50"
                  />
                  <span className="text-sm text-[var(--text-blue)]">{opt.label}</span>
                </label>
              ))}
            </div>
            <label className="mt-4 block text-xs font-medium text-[var(--text-blue)]/80">Meeting name (optional)</label>
            <input
              type="text"
              value={pickerMeetingName}
              onChange={(e) => setPickerMeetingName(e.target.value)}
              placeholder="e.g. Sprint planning"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-[var(--text-blue)] placeholder:text-[var(--text-blue)]/40 focus:border-[var(--text-blue)]/50 focus:outline-none"
            />
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={startMeetingFromPicker}
                disabled={pickerSelectedIds.size === 0}
                className="flex-1 rounded-full bg-white py-2.5 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start
              </button>
              <button
                type="button"
                onClick={() => { setShowStartMeetingPicker(false); setContextFromPromotedMeeting(null); }}
                className="flex-1 rounded-full border border-white/20 bg-white/5 py-2.5 text-sm font-semibold text-[var(--text-blue)] hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showPromoteModal && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-labelledby="promote-meeting-title">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[var(--panel)] p-8 shadow-2xl">
            <h2 id="promote-meeting-title" className="text-lg font-semibold text-[var(--text-blue)]">Promote this Meeting?</h2>
            <p className="mt-2 text-sm text-[var(--text-blue)]/70">Save this meeting to Firebase so you can find it later in Promoted meetings.</p>
            <label className="mt-4 block text-xs font-medium text-[var(--text-blue)]/80">Meeting name (optional)</label>
            <input
              type="text"
              value={promoteTitle}
              onChange={(e) => setPromoteTitle(e.target.value)}
              placeholder="e.g. Sprint planning"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-[var(--text-blue)] placeholder:text-[var(--text-blue)]/40 focus:border-[var(--text-blue)]/50 focus:outline-none"
            />
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={promoteYes}
                className="flex-1 rounded-full bg-white py-2.5 text-sm font-semibold text-black hover:bg-white/90"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={promoteNo}
                className="flex-1 rounded-full border border-white/20 bg-white/5 py-2.5 text-sm font-semibold text-[var(--text-blue)] hover:bg-white/10"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="relative mb-6 h-[82vh] w-[88vw] rounded-[32px] border border-white/10 bg-[var(--panel)] shadow-2xl backdrop-blur-xl">
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between border-b border-white/10 px-8 py-6">
            <div>
              <div className="text-[11px] uppercase tracking-[0.35em] text-[var(--text-blue)]">
                PM Console
              </div>
              {topics.length > 0 && onScopeChange ? (
                <select
                  value={scope.scopeId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const t = topics.find((x) => x.id === id);
                    if (t) onScopeChange({ scopeType: "topic", scopeId: id, displayName: t.title });
                  }}
                  className="mt-2 block w-full max-w-[280px] rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 text-lg font-semibold text-[var(--text-blue)] focus:border-[var(--text-blue)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--text-blue)]/30"
                >
                  {topics.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#111827]">
                      {t.title}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <div className="mt-2 text-lg font-semibold text-[var(--text-blue)]">
                    {scope.displayName}
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-blue)]/70">
                    Scope: {scope.scopeType} · {scope.scopeId}
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              {activated && (
                <>
                  <PromotedMeetingsDropdown
                    meetings={promotedMeetings}
                    onSelectMeeting={setSelectedMeetingId}
                    onCloseDetail={() => setSelectedMeetingId(null)}
                    onContinueMeeting={(m) => { setSelectedMeetingId(null); openStartMeetingPicker(m); }}
                    onPromoteToMemory={async (m) => {
                      const summary = m.messages.map((msg) => {
                        const speaker = msg.authorType === "human" ? "You" : (msg.agentLabel || "Agent");
                        return `${speaker}: ${msg.text}`;
                      }).join("\n");
                      const text = `Meeting: ${m.title}\n\n${summary}`;
                      await promoteToMemory({
                        topicId: scopeId,
                        text,
                        tags: ["meeting", "promoted"],
                      });
                      await notifyP0Promote({
                        text,
                        tags: ["meeting", "promoted"],
                      });
                      setSelectedMeetingId(null);
                    }}
                    selectedMeetingId={selectedMeetingId}
                    selectedMeeting={selectedMeeting ?? null}
                  />
                  {meetingModeOn && (
                    <button
                      type="button"
                      onClick={endMeeting}
                      className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-blue)] hover:bg-white/10"
                    >
                      End meeting
                    </button>
                  )}
                </>
              )}
              <button
                onClick={onClose}
                className="rounded-full bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-black"
              >
                Close
              </button>
            </div>
          </header>

          <div className="flex flex-1 min-h-0 overflow-hidden">
            {!activated ? (
              <div className="flex flex-1 flex-col px-10 py-8 overflow-y-auto">
                <div className="max-w-3xl">
                  <h2 className="text-2xl font-semibold text-[var(--text-blue)]">Activate Project Management</h2>
                  <p className="mt-3 text-sm text-[var(--text-blue)]/70">
                    Choose how much authority agents have on this board. Every setting here is a ledgered decision.
                  </p>
                </div>

                <div className="mt-8 grid gap-4">
                  {CAPABILITIES.map((cap) => (
                    <div key={cap.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                      <div className="flex items-center justify-between gap-6">
                        <div>
                          <div className="text-sm font-semibold text-[var(--text-blue)]">{cap.label}</div>
                          <div className="mt-1 text-xs text-[var(--text-blue)]/70">{cap.description}</div>
                        </div>
                        <select
                          value={authorityProfile[cap.id] ?? ""}
                          onChange={(e) => handleAuthorityChange(cap.id, e.target.value as AuthorityMode)}
                          className="rounded-full border border-white/10 bg-[var(--panel)] px-4 py-2 text-xs text-[var(--text-blue)]"
                        >
                          <option value="" disabled>
                            Select mode
                          </option>
                          <option value="human">Human</option>
                          <option value="hitl">Human-in-the-loop</option>
                          <option value="agent">Agent</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex items-center justify-between">
                  <div className="text-xs text-[var(--text-blue)]/70">
                    We recommend Human or HITL for most capabilities.
                  </div>
                  <button
                    onClick={() => onActivate(authorityProfile)}
                    disabled={!readyToActivate}
                    className="rounded-full bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-black disabled:cursor-not-allowed disabled:bg-white/30"
                  >
                    Activate Board
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 min-h-0 flex-col gap-6 px-8 py-6 overflow-y-auto">
                {/* Asana-style board: columns with headers and cards */}
                <div className="flex flex-1 min-h-0 flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.35em] text-[var(--text-blue)]">Board</h2>
                    <div className="flex items-center gap-3 text-[10px] text-[var(--text-blue)]/70">
                      <span>Participants</span>
                      {meetingModeOn && meetingParticipants.length > 0 ? (
                        meetingParticipants.map((p) => (
                          <span key={p.id} className="rounded-full bg-white/5 px-2 py-0.5 border border-white/10">
                            {p.label.split(" / ")[0]}
                          </span>
                        ))
                      ) : (
                        <>
                          <span className="rounded-full bg-white/5 px-2 py-0.5 border border-white/10">You</span>
                          {agentOptions && agentOptions.length > 0 && (
                            <span className="rounded-full bg-white/5 px-2 py-0.5 border border-white/10">
                              {agentOptions.find((o) => o.id === activeAgentId)?.label.split(" / ")[0] ?? "Agent"}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-6 flex-1 min-h-0">
                    {COLUMNS.map((col) => {
                      const items = boardItems.filter((i) => i.columnId === col.id);
                      return (
                        <div
                          key={col.id}
                          className="flex flex-col rounded-xl border border-white/10 bg-black/10 min-h-[200px]"
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, col.id)}
                        >
                          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-blue)]">
                              {col.title}
                            </span>
                            <span className="text-[10px] text-[var(--text-blue)]/50 tabular-nums">{items.length}</span>
                          </div>
                          <div className="flex-1 p-3 space-y-2 overflow-y-auto min-h-0">
                            {col.id === "tasks" && (
                              <button
                                type="button"
                                onClick={addTask}
                                className="w-full rounded-lg border border-dashed border-white/20 bg-transparent py-3 text-[11px] text-[var(--text-blue)]/60 hover:bg-white/5 hover:border-white/30 transition-colors"
                              >
                                + {col.addLabel}
                              </button>
                            )}
                            {col.id === "decisions" && (
                              <button
                                type="button"
                                className="w-full rounded-lg border border-dashed border-white/20 bg-transparent py-3 text-[11px] text-[var(--text-blue)]/60 hover:bg-white/5 hover:border-white/30 transition-colors"
                              >
                                + {col.addLabel}
                              </button>
                            )}
                            {col.id === "risks" && (
                              <button
                                type="button"
                                className="w-full rounded-lg border border-dashed border-white/20 bg-transparent py-3 text-[11px] text-[var(--text-blue)]/60 hover:bg-white/5 hover:border-white/30 transition-colors"
                              >
                                + {col.addLabel}
                              </button>
                            )}
                            {items.map((item) =>
                              editingId === item.id ? (
                                <TaskEditCard
                                  key={item.id}
                                  item={item}
                                  onSave={(title, summary) => saveTask(item.id, title, summary)}
                                  onCancel={() => cancelEdit(item.id, Boolean(item.title.trim()))}
                                />
                              ) : (
                                <TaskPill
                                  key={item.id}
                                  item={item}
                                  isDragging={dragItemId === item.id}
                                  onDragStart={() => setDragItemId(item.id)}
                                  onDragEnd={() => setDragItemId(null)}
                                  onEdit={() => setEditingId(item.id)}
                                />
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Ledger strip - compact */}
                <div className="shrink-0">
                  <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-[var(--text-blue)]/70 mb-2">Recent ledger</div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    <span className="rounded-full bg-black/20 border border-white/10 px-3 py-1.5 text-[10px] text-[var(--text-blue)] whitespace-nowrap">
                      Authority profile activated
                    </span>
                    <span className="rounded-full bg-black/10 border border-white/10 px-3 py-1.5 text-[10px] text-[var(--text-blue)]/80 whitespace-nowrap">
                      Decision promoted
                    </span>
                  </div>
                </div>

                {/* Chat pill - same pattern as Principles on main page: click to expand */}
                <div
                  className={`
                    w-full shrink-0
                    bg-[var(--panel)] border border-white/10
                    rounded-[2rem] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden
                    ${chatOpen ? "shadow-2xl" : ""}
                  `}
                >
                  <div className="h-[56px] flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                      {meetingModeOn ? (
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="relative flex h-2 w-2" aria-hidden>
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                            </span>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-blue)]">Recording</span>
                          </div>
                          <span className="text-[10px] tabular-nums text-[var(--text-blue)]/80 font-medium" aria-label={`Meeting duration ${formatMeetingElapsed(meetingElapsedSeconds)}`}>
                            {formatMeetingElapsed(meetingElapsedSeconds)}
                          </span>
                          <span className="text-[var(--text-blue)]/30">|</span>
                          <span className="text-[10px] font-semibold text-[var(--text-blue)] truncate">
                            Meeting with {meetingParticipants.map((p) => p.label.split(" / ")[0]).join(", ")}
                            {contextFromPromotedMeeting && (
                              <span className="text-[var(--text-blue)]/70 font-normal"> · Continuing from &quot;{contextFromPromotedMeeting.title}&quot;</span>
                            )}
                          </span>
                        </div>
                      ) : (
                        <>
                          {agentOptions && agentOptions.length > 0 ? (
                            <select
                              value={activeAgentId}
                              onChange={(e) => onAgentChange?.(e.target.value)}
                              className="bg-transparent text-[9px] font-bold tracking-[0.2em] text-[var(--text-blue)] uppercase py-1 outline-none cursor-pointer"
                            >
                              {agentOptions.map((opt) => (
                                <option key={opt.id} value={opt.id} className="bg-[#111827]">{opt.label}</option>
                              ))}
                            </select>
                          ) : null}
                          {agentOptions && agentOptions.length > 0 && engineOptions && engineOptions.length > 0 ? (
                            <span className="text-[var(--text-blue)]/40 text-[10px]">/</span>
                          ) : null}
                          {engineOptions && engineOptions.length > 0 ? (
                            <select
                              value={activeEngineId}
                              onChange={(e) => onEngineChange?.(e.target.value)}
                              className="bg-transparent text-[9px] font-bold tracking-[0.2em] text-[var(--text-blue)] uppercase py-1 outline-none cursor-pointer"
                            >
                              {engineOptions.map((opt) => (
                                <option key={opt.id} value={opt.id} className="bg-[#111827]">{opt.label}</option>
                              ))}
                            </select>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => openStartMeetingPicker()}
                            className="text-[8px] px-3 py-1.5 bg-white/5 rounded-full text-[var(--text-blue)] hover:bg-white/10 uppercase font-bold tracking-widest border border-white/10"
                          >
                            Start meeting
                            </button>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {meetingModeOn && (
                        <button
                          type="button"
                          onClick={endMeeting}
                          className="rounded-full border border-red-500/50 bg-red-500/10 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-400 hover:bg-red-500/20 hover:border-red-500/70"
                        >
                          End meeting
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onToggleChat()}
                        className="text-[8px] px-4 py-1.5 bg-white/5 rounded-full text-[var(--text-blue)] hover:bg-white/10 uppercase font-bold tracking-widest border border-white/10"
                      >
                        {chatOpen ? "Collapse" : "Chat"}
                      </button>
                    </div>
                  </div>
                  {chatOpen && (
                    <div className="px-6 pb-6 pt-4 border-t border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-200">
                      {meetingMessages.length > 0 && (
                        <div className="mb-4 max-h-[200px] overflow-y-auto space-y-3 rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                          {meetingMessages.map((msg) => (
                            <div key={msg.id} className={msg.authorType === "agent" ? "text-[var(--text-blue)]/90" : "text-[var(--text-blue)]"}>
                              <span className="text-[10px] font-medium text-[var(--text-blue)]/70 uppercase tracking-wider">
                                {formatSpeakerLabel(msg.authorType, msg.agentLabel, msg.agentId, meetingParticipants)}
                                <span className="ml-1.5 text-[var(--text-blue)]/50 font-normal normal-case tracking-normal">
                                  {msg.createdAt instanceof Date ? msg.createdAt.toLocaleTimeString() : ""}
                                </span>
                              </span>
                              <p className="mt-0.5 text-sm">{msg.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {chatMode === "transcribe" ? (
                        <TranscribeComposer
                          onCancel={() => setChatMode("text")}
                          onTranscribed={(transcript) => {
                            setChatText((prev) => (prev ? `${prev} ${transcript}` : transcript));
                            setChatMode("text");
                          }}
                        />
                      ) : (
                        <div className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-black/20 px-4 py-3">
                          <button type="button" className="text-[var(--text-blue)]/60 hover:text-[var(--text-blue)]">+</button>
                          <input
                            value={chatText}
                            onChange={(e) => setChatText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                              }
                            }}
                            placeholder="Message… or try “add task Ship feature” / “move X to done”"
                            className="flex-1 bg-transparent text-sm text-[var(--text-blue)] placeholder:text-[var(--text-blue)]/50 outline-none"
                          />
                          <button
                            type="button"
                            className="text-[var(--text-blue)]/70 hover:text-[var(--text-blue)]"
                            title="Transcribe"
                            onClick={() => setChatMode("transcribe")}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                              <line x1="12" y1="19" x2="12" y2="23" />
                              <line x1="8" y1="23" x2="16" y2="23" />
                            </svg>
                          </button>
                          {chatText.trim().length > 0 ? (
                            <button type="button" onClick={sendMessage} className="text-[var(--text-blue)]/70 hover:text-[var(--text-blue)]" title="Send">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={`text-[var(--text-blue)]/70 hover:text-[var(--text-blue)] ${voiceSessionOn ? "text-[var(--text-blue)]" : ""}`}
                              title={voiceSessionOn ? "Stop" : "Voice"}
                              onClick={() => (voiceSessionOn ? stopVoiceConversation() : startVoiceConversation())}
                            >
                              {voiceSessionOn ? (
                                <span className="inline-flex items-center gap-1.5 text-[10px]">
                                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-blue)] animate-pulse" />
                                  {voiceTurnState === "processing" ? "…" : "On"}
                                </span>
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M2 10v3m4-6v9m4-12v15m4-12v9m4-6v3" />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
