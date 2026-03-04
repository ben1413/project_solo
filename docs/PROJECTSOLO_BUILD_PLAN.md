# ProjectSolo Build Plan & Execution Ledger
**Jan 26 → Feb 15 (v0 Working Tool)**

Owner: Ben Williams  
Repo: /Users/benwilliams1413/Projects/project_solo  
Audience: Internal (self + future assistants)  
Status: Actively shipping

---

## North Star

ProjectSolo is a durable, low-cognition project brain for one human.

It exists to:
- reduce context loss
- support interruption and resumption
- make “what’s active” explicit
- preserve high-signal memory (append-only)

Non-goals:
- multi-user support
- AI automation
- beauty or polish
- scale beyond one brain

---

## Chapters & Topics

**Chapters** are micro-topics inside a **Topic**. They’re the conversations (runs + messages) that tie back to the main topic.

- **Throw away or keep:** Chapters can be disposable (close and move on) or keepable (leave open, revisit). Both are valid.
- **Delete ≠ lose knowledge:** If you **Promote** something from a chapter into memory/Ledger and then remove the chapter from the board, the promoted info stays. We **delete** the chapter (and its runs) from Firestore when the user deletes it—no "closed" docs left. Messages in the flat `messages` collection for those runs are left orphaned (not deleted today). **At scale we must prune orphaned messages** (delete messages whose `runId` no longer has a run/chapter); v0 skips this for simplicity. See Engineering Invariants → Data hygiene at scale.
- So: use chapters as lightweight containers. Promote what matters; deleting a chapter doesn’t erase what you already promoted.

---

## PM Console Module Spec v0 (Portable)

**Intent:** A modular PM Console that enables humans + agents to co-author work with explicit authority and ledgered commitment. Portable across products (Solo, P0, P1, PB, CF) via a host-provided `scope`.

### Module Boundary (Portability)
The PM Console must not depend on `Topic`. It accepts a host `scope` object:
- `scopeType`: topic | project | workspace | board | custom
- `scopeId`: string
- `displayName`: string

**PM board is topic-scoped only (in Solo).** The board is tied to the **topic**, not to the current chapter. The user may have a chapter active in the chat lane; the PM board still shows and edits state for the whole topic. When persisting board data to Firestore or exposing APIs, use only topic (e.g. `topics/{topicId}/...`); never scope PM by chapter.

### Activation (First Run)
First open triggers an activation flow with a ledgered decision:
1. Intro
2. Authority profile (capability matrix)
3. Confirm + Activate (writes ledger event `pm_console_activated`)

### Authority Model (Per Capability)
Modes:
- Human
- Human-in-the-loop (agent proposes, human approves)
- Agent (agent can commit)

Capabilities (v0):
1. Create task
2. Update task status
3. Edit task details
4. Create decision
5. Supersede decision
6. Add risk
7. Resolve risk
8. Add milestone
9. Reorder priorities
10. Assign owners

### PM Lift Panel (Summonable Console)
Summoned from main chat via a button. Slides up from bottom.
- Height: 82% viewport
- Width: 88% viewport
- Background dims
- Chat is collapsed by default; can be summoned inside the panel

### Console Sections
- Board: Decisions / Tasks / Risks
- Participants: Humans + agents in the run
- Ledger strip: Recent approvals + commits

### Commit Rules
- Agent proposals are visible but not committed unless mode allows.
- Every approve/deny/commit writes to Ledger with actor + authority.

### Ways to use the PM board (usage modes)

The board supports a spectrum from human-only to multi-agent collaboration. All of the following are in scope; the authority profile (set at activation) governs what agents are allowed to do when they are in the loop.

1. **Human-only, no agent**
   - Open the board, look at tasks/decisions/risks, move items yourself. No chat, no agent. Quick triage or personal organization. The board is just a workspace.

2. **Human + one agent**
   - Human and a single agent interact in the PM Chat. The human can ask the agent to update the board, or the agent can propose changes; depending on authority (HITL vs Agent), the human approves or the agent commits. Classic “me with my PM agent” mode.

3. **Human delegates via chat (no manual board edits)**
   - Human types in the chat only, e.g. “Someone please update the board: add a risk ‘X’ and move task Y to Done.” An agent (or future “someone”) performs the board updates. Slower than moving things yourself but valid: human stays in the chat, board changes happen via agent/automation.

4. **Meeting with multiple agents**
   - Multiple agents participate in the same PM session. They assign tasks, add decisions/risks, and work in the background according to the authority rules set at activation. Human may be in the loop for some capabilities (HITL) or out of the loop (Agent). Agents collaborate with each other and the board; the human sees the result and can step in when needed.

**Design implication:** The board and chat must support (a) human-only board edits, (b) human ↔ one agent in chat with board updates, (c) human instructions that result in board updates without the human touching the board, and (d) multiple agents reading/writing the board and chat in the same session. The authority matrix and ledger apply across all of these; the only difference is who is in the room and who is allowed to commit.

### Meeting mode layout (chosen: Option A – board dominant, chat as shelf)

When meeting mode is active, we use **one layout only**: the board is primary; the meeting lives in a **bottom shelf (strip)**. No second floating layer; everything stays inside the same PM panel.

- **Board:** Uses the majority of vertical space (~70–75% when chat is expanded). All columns (Tasks, Decisions, Risks, Done) remain visible and scrollable. The board is always the visual priority so the user can look at and reference items while talking.
- **Chat/meeting:** A fixed strip along the bottom. Default is compact (e.g. one line of input + “Meeting with X, Y” and latest message or “Agent speaking…”). User can **expand** the shelf (e.g. drag up or tap) to show more transcript; **collapse** again to maximize board. The existing expandable Chat pill pattern is this shelf; meeting mode is the same layout with multi-agent selection and first-response-wins behavior.
- **Mental model:** “The board is the table; the meeting is the conversation at the table.” Pragmatic and already largely wired: we keep and refine the current board-above, chat-below layout rather than introducing a side rail or resizable split.

### PM conversation UX: world-class design from day 1

**Bar:** We're building a tool that either no one will care about or everyone will. So we need **world-class design**, **world-class ease**, and **minimal cognitive load** from day 1. No "we'll polish later."

**Goal:** A human having as close as possible to a **natural conversation with their agent team** on the PM board. Multiple agents (each with their own role and eventually their own LLM) listen and respond; the user absorbs what was said and what was decided without re-reading or piecing together fragments.

---

**Table stakes (non-negotiable)**

1. **One place to read, one place to act.** The transcript is the dialogue; the board is where commitments and tasks live. Don't scatter "who said what" or "what was decided" across multiple surfaces. The user should not have to hunt.
2. **Who said what is always obvious.** Every message is attributed: role + name (e.g. "Toni · Systems Arch"). No anonymous "Agent." At a glance: who, then what. Consistent, scannable.
3. **Conversation → board is frictionless.** When something becomes a task, decision, or risk, it lands on the board (via command today; later via "Add to board" from agent text). The user doesn't re-type or copy-paste. Low cognitive load = "said it, see it on the board."
4. **One input, one send.** The user talks to the room. The same message goes to all selected agents (or is routed by intent later). No "which agent do I ask?" unless we add explicit mention/ask later. Ease from day 1.
5. **Calm, focused UI.** Clear hierarchy: board primary, conversation secondary but always visible when needed. No visual noise. Typography and spacing make the thread easy to read; role/agent differentiation is subtle (e.g. one accent, distinct label or icon per agent—no rainbow).

---

**Concrete UX decisions for the transcript**

- **Single chronological thread** (like Slack/Teams), not one thread per agent. One timeline: You, then Toni, then Izzi, then You, etc.
- **Each message:** Clear **speaker line** (name + role, e.g. "Toni · Systems Arch") then the message body. Enough vertical rhythm that you can scan by speaker.
- **When multiple agents can answer:** Show "Toni is thinking…" / "Izzi replied" or equivalent so the user isn't left wondering. First-response-wins (or round-robin by role) is a product choice; the UI must make "who is responding" and "what they said" obvious.
- **Optional later:** "Summary so far" or "Decisions so far" after N messages so the user doesn't re-read the whole thread. Start with full transcript; add summarization when it reduces cognitive load without hiding important nuance.

---

**Future: agents and LLM choice**

- **Agents picking their own LLMs:** Each agent (role) can eventually be wired to the LLM that fits their domain (e.g. arch → one model, designer → another). Product decision.
- **Orchestration / "best LLM for this request":** Call an orchestrator that checks request type against LLM testing sites (or internal benchmarks), then the agent (or router) decides which model is best for *that* type of answer for *that* role. Spec and implement when we're ready; document as a direction so we don't design the conversation UX in a way that blocks it.

---

**Implementation order (to get to world-class without big-bang)**

1. **Transcript message styling:** Every message shows **speaker (name + role)** and body. Consistent, readable. No anonymous agents.
2. **Single-thread layout:** One scrollable timeline in the shelf when expanded. Chronological. No per-agent tabs for v0.
3. **Board as sink:** Commands and (later) "Add to board" from agent text so the board is where commitments live. User sees the conversation and the board in one place; next steps are on the board.
4. **Polish:** Spacing, type scale, role differentiation (e.g. subtle color or icon per agent), accessibility (focus order, keyboard, screen reader). So "world-class" holds for everyone.

---

**Implemented: transcript speaker labels and live thread**

The following is in place so "who said what" is always obvious and the transcript is a single chronological thread.

- **Speaker label format:** Human messages show **"You"**. Agent messages show **"Name · Role"** (e.g. "Toni · Systems Arch"). We derive this from the agent's label (stored as "Name / Role"; displayed with " · "). If no agent is identified, we fall back to **"Agent"**.
- **Where it's used:** (1) **Live meeting transcript** in the PM shelf—when the chat is expanded and there are messages, a scrollable transcript appears above the input; each message shows speaker (You or Name · Role), time, and body. (2) **Promoted meeting detail view**—when opening a promoted meeting, each message uses the same speaker line and body.
- **Data model:** In-meeting messages (`MeetingMessageState`) include optional **`agentId`** and **`agentLabel`** so when we wire agent replies we can set who spoke. Promoted meetings persist optional **`agentLabel`** on each message so promoted views can show "Name · Role" for agent messages. When promoting, we pass `agentLabel` through so future promoted meetings have it.
- **Single chronological thread:** The live transcript is one list (no per-agent tabs). Order is chronological. Same in the promoted meeting view.
- **Board commands from chat:** User (or voice) can type commands that update the board: "add task X", "add risk Y", "move Z to done". Matching is case-insensitive; added titles are normalized to sentence case for voice. See "Board commands" in code (PMConsole) and table stakes above.

When agent replies are wired, push messages with `authorType: "agent"`, `agentId`, and `agentLabel` (from the replying participant); the existing transcript UI will show "Name · Role" with no further changes.

### Meeting activation: requirements and three design options

**Requirements (any activation design must satisfy)**

- **Select 1 to N agents** from the available personas (each has id, name, job title). At least one agent must be selected to start a meeting.
- **Clear state transition:** User and system must unambiguously know when "meeting is off" vs "meeting is on." Once on, the chat shelf is the meeting thread; selected agents can respond (first-response-wins for open-ended questions).
- **Single surface:** Activation lives inside the PM panel (no new floating window). Board stays visible; activation UI is either inline in the shelf/header or a compact modal/popover within the panel.
- **Reversible:** User can end the meeting (and optionally promote it); after ending, the same chat can be used again for a new meeting or non-meeting use.
- **Auditable (later):** Activation can be ledgered (who was in the meeting, when it started/ended) for FANG-level accountability; v0 can be in-memory only.

---

**Option A: Single entry point + inline agent picker**

- **Flow:** One primary control in the PM board—e.g. a **"Start meeting"** or **"Meet"** button in the chat shelf bar (or header). Click → an **agent picker** appears in context: a popover or a slide-up card *within* the PM panel (does not cover the board). Picker shows the list of available agents (name + role); multi-select (1 to N). Optional: short "Meeting name" field. **"Start"** CTA confirms; picker closes and meeting mode is on. Shelf shows "Meeting with Toni, Izzi" (or similar) and the input becomes the meeting thread.
- **Mental model:** "One button to start; choose who; go." Minimal steps, low cognitive load. Feels like Google Meet "Add people" or Calendly "Select guests" but lighter.
- **FANG-level:** Clear primary action, no mode confusion. Picker is scannable (avatars/names + roles), accessible (keyboard nav, focus trap), and dismissible (Cancel or click outside). No second floating layer.

---

**Option B: Meeting mode toggle + roster, then Start**

- **Flow:** A **"Meeting"** mode toggle or pill in the header/shelf (e.g. "Meeting" off/on). When toggled **on**, the UI does not start the meeting yet; it shows a **roster** (who's in the meeting). User adds/removes agents from the roster; optional meeting name. A separate **"Start meeting"** CTA begins the meeting. So: turn on Meeting mode → adjust roster → Start. When meeting is live, the same roster is visible (e.g. in the shelf) and can be edited (add/remove) for the next segment or left as-is.
- **Mental model:** "Meeting is a mode; you configure the room, then open the door." Two-phase: configure then start. Good for users who want to see "who's invited" before committing.
- **FANG-level:** Explicit state (Meeting mode on but not started vs started). Roster is first-class; add/remove feels like Slack channels or Zoom participants. Clear "Start meeting" as the commit action.

---

**Option C: Command / quick action**

- **Flow:** Activation via **command**: e.g. type **"/meeting"** or **"@meet"** in the chat input, or open a **command palette** (e.g. Cmd+K) and choose "Start meeting." Command opens the agent picker (same as Option A) in a small modal or inline expansion. User selects 1–N agents, optional name, **Start** → meeting begins and the current chat becomes the meeting thread. Alternative: natural language in chat, e.g. "Start a meeting with Toni and Izzi" → system parses and opens picker to confirm or starts directly.
- **Mental model:** "Meeting is an action you invoke like any other command." Power-user and keyboard-first; fits apps where Cmd+K or slash commands are the norm (Linear, Notion, Slack).
- **FANG-level:** Consistent with command-palette patterns (Spotlight, VS Code, Figma). Single gesture to start; picker is confirmation/refinement. Scales to more actions later (e.g. "/promote", "/end meeting").

---

**Summary**

| Option | Entry point | Flow | Best for |
|--------|-------------|------|----------|
| **A** | Single "Start meeting" button | Click → picker (1–N agents, optional name) → Start | Simplicity; one place to start |
| **B** | "Meeting" mode toggle | Toggle on → roster → Start meeting | Deliberate "who's in the room" before start |
| **C** | /meeting or Cmd+K "Start meeting" | Command → picker → Start | Power users; command-driven UI |

All three satisfy the requirements above; choice depends on whether we optimize for fewest clicks (A), explicit roster control (B), or command-driven consistency (C).

### Data Model (Module)
PMItem:
- id, scopeId, type, status, title, summary
- owner { humanId?, agentId? }
- authorityMode, ledgerId?, createdAt, updatedAt

### Board commands from chat (implemented)

When the user sends a message in the PM chat (typed or voice-transcribed), the text is parsed for board commands. All matching is **case-insensitive** so voice transcripts work regardless of capitalization. One command per message (first match wins).

- **Add:** `add task <title>` / `add a task <title>` → new item in Tasks. Same pattern for `add decision <title>` and `add risk <title>`. The title is normalized to sentence case (e.g. "review pr" → "Review pr") so voice output looks correct.
- **Move:** `move <title> to <column>` → find an item whose title contains (or is contained in) the given text and move it to that column. Column is one of: `tasks`, `decisions`, `risks`, `done`. Example: "move fix login to done".

Implementation: `applyBoardCommandsFromMessage` in PMConsole; called from `sendMessage` after appending the message to the transcript.

### Success Criteria (v0)
- Activation flow + ledgered authority profile
- Agent proposals gated by authority
- Board updates ledgered

**Note:** This spec supersedes earlier non-goals for the PM Console surface.

### PM board data: persistence today vs. later

**Right now there is no database link for PM board data.** Both (1) board items (tasks, decisions, risks, done) and (2) conversations/meetings in the PM Chat live only in React state. They are lost on refresh or when the tab is closed. To persist them we must add a Firestore (or other) store and wire reads/writes:

- **Board items:** Store under the topic only, e.g. `topics/{topicId}/pmBoard/items` (or a single doc `topics/{topicId}/pmBoard` with an `items` array). On load, read and set `boardStateByScopeId`; on every add/edit/move/delete, write back. Optionally debounce or batch writes.
- **PM conversations:** See the three mental models below; each implies a different persistence shape.

---

### Three mental models: retaining PM board conversations/meetings

We do **not** want conversations or meetings that happen inside the PM board to be lost. Here are three ways to think about that data and where it lives.

**Model A: Topic-scoped PM run (durable transcript)**  
- Treat PM chat as a first-class run at the **topic** level, not under a chapter.  
- **Where it lives:** e.g. `topics/{topicId}/pmRuns` (or a single long-running `topics/{topicId}/pmConversation`) with the same message shape as chapter runs: append-only messages with runId, authorType, text, createdAt. One “active” PM run per topic, or multiple if you want separate threads.  
- **Retention:** Full conversation history per topic, durable in Firestore. Reopen PM for “Kids” → see the same PM conversation.  
- **Pros:** Nothing lost; same patterns as existing runs/messages. **Cons:** Slightly more to build (run creation, subscription); need to decide “one run vs. many” per topic.

**Model B: Ephemeral unless promoted**  
- PM chat is a scratchpad. We do **not** store the raw transcript long-term. If the user wants to keep something, they “Promote to Ledger” or “Commit decision” and that content goes to memory/Ledger; the rest is temporary.  
- **Where it lives:** In-memory (or a short-lived/temp doc that we prune). Promoted bits live in existing memory/Ledger paths.  
- **Retention:** Only promoted/committed content is retained. The rest is lost when the session ends.  
- **Pros:** Minimal storage; clear signal (what matters is promoted). **Cons:** Users can lose context if they forget to promote; “meeting notes” aren’t a full transcript.

**Model C: Hybrid – durable transcript + ledger for commitments**  
- Store the full PM conversation per topic (as in A) **and** continue to Promote/Commit important decisions to Ledger. So you have both a replayable transcript and canonical commitments.  
- **Where it lives:** Same as A for the transcript (`topics/{topicId}/pmRuns` or equivalent); Ledger/memory as today for promoted items.  
- **Retention:** Full transcript retained; commitments in Ledger. Best of both.  
- **Pros:** Nothing lost; clear audit trail and reuse. **Cons:** More storage and code paths.

**Recommendation (for Solo):** Model A or C. If you want “meetings not lost,” A is enough (topic-scoped PM run + messages). If you also want every commitment to live in Ledger, use C. Avoid B unless you explicitly want “scratchpad only, promote to keep.”

---

### Resume from a promoted meeting (activate meeting from promote)

**Yes:** A user who promotes a meeting can **pick that meeting back up** by activating a new meeting *from* that promoted record. Promoted meetings are not just archives—they're **resumable**.

- **Flow:** From the "Promoted meetings" dropdown, user selects a past meeting. Today they can **view** the transcript (read-only). We add a **"Continue this meeting"** (or "Start meeting from this") action. That action (a) loads the promoted meeting's **breakdown** as context and (b) starts a new meeting so the user and agents can continue the conversation or follow up. The new meeting thread is seeded with or informed by that context.
- **Breakdown today:** The **transcript** (messages) we already store *is* the breakdown: who said what, when. That's enough to resume: user and agents see what was discussed.
- **Breakdown later (optional):** We can add **extracted actions**—e.g. tasks/decisions/risks mentioned or committed in that meeting—so the breakdown view shows "What we decided" / "Action items" as well as the full transcript. That makes "pick it back up" even clearer.
- **Roster:** Today we don't store which agents were in the meeting when we promote. So "Continue this meeting" can pre-fill the roster from the current PM context or ask the user to choose again. Later we can store **participantIds** (agent ids) on the promoted meeting doc so "Continue" can pre-select the same participants.
- **Mental model:** Promote = save this meeting. Later, open Promoted meetings → choose one → see breakdown (transcript + optional actions) → "Continue this meeting" = activate meeting mode with that context. So promote and resume form a single loop: save, then pick back up when you need to.

---

## Definition of Done (v0)

Ben can, reliably:

1. Select a Topic
2. See exactly one open Chapter
3. Create / close Chapters safely
4. Start a Run inside the active Chapter (auto-create if missing)
5. Write and view Messages (append-only)
6. Promote content into append-only memory
7. Track Tasks without guilt or overload
8. Restart the app without losing state
9. Installable on iPhone as a home-screen app (PWA), usable for continuity mode

---

## Current State (Authoritative)

### Completed

Infrastructure
- Next.js app scaffolded
- Firebase client + admin SDK wired
- Dedicated Firebase project (project-solo-6b864)
- .env.local working and ignored
- Local Firebase artifacts ignored in git

Firestore
- projectSolo/default root created
- Topics seeded
- Chapters seeded for all topics
- Exactly one open chapter per topic

UI + UX
- Topics realtime
- Chapters realtime
- Chapter create / close / rename
- Runs + messages plumbing in place
- Message composer is solid-state (always visible)
- Lint and build clean

---

## Circle back: Core + Firebase agent wiring

We will **circle back** to finishing the Solo ↔ P0 Core + Firebase setup (Core env: Firebase Admin, OPENAI_API_KEY, agents in Firestore; Firebase rules if needed). Ben gets stuck on Firebase/rules often and is not ready for that battle right now. **Keep building** other parts of Solo; agent replies will work once Core is configured and we revisit this.

---

## Known Gaps (Active Focus)

*All closed (Feb 2025):*
- ~~Work / Chat lane needs unmistakable “alive” empty state~~ — Empty state added in MessageList when no messages.
- ~~Verify end-to-end flow: topic → chapter → run → message → refresh → persists~~ — `npm run verify:e2e` script; runId/agentId passed from MessageComposer to /api/agent.
- ~~Optional: default “scratch” run when no topic selected~~ — Inbox serves as scratch run (see ensureInbox).

---

## Timeline & Remaining Work

Phase 1 — Chapters  
DONE

Phase 2 — Runs + Messages  
DONE
- createRun helper (ensureRun)
- appendMessage helper (single path: Composer → Firestore → /api/agent → reply write)
- realtime subscriptions (useMessages)
- auto-create run
- message list + alive empty state
- message composer (runId, topicId, agentId, memoryScope to agent)
- E2E persistence: `npm run verify:e2e`

Phase 3 — Promote  
DONE
- Memory store: projectSolo/default/memory (append-only)
- promoteToMemory() + notifyP0Promote() in src/lib/promoteMemory.ts
- “Promote” button per message in MessageList; writes to memory + optional P0 core

Phase 4 — Tasks  
NOT STARTED

Phase 5 — Stabilization  
NOT STARTED

Phase 5.5 — Mobile Packaging (PWA)  
NOT STARTED

Phase 5.7 — Local File Access (Companion App)  
NOT STARTED  
- Web app remains hosted; local companion app provides explicit, user-granted read/write via localhost API  
- Access is folder-scoped, revocable, and logged  
- No background access without user approval

Phase 6 — Guardrails  
NOT STARTED

Phase 7 — Freeze  
NOT STARTED

---

## PM Board / PM Console and git

The **PM Board** (PM Console) in Solo lives under `src/components/pm/`. As of this note: **main** has no PM Console (it has the simpler layout with ChapterTitle, ActiveRun, MessageList, MessageComposer). The **PM Console** exists only on **wip/tonni-sidecar** and the `src/components/pm/` directory was **untracked** (never committed), so there is no earlier committed “build” of the PM Board in this repo to restore from. If something feels ripped out, it may be (1) spec vs current implementation (Board: Tasks/Decisions/Risks, Participants, Ledger strip are in the spec; Phase 4 Tasks is not started), or (2) work that existed only in another clone/branch/machine. Going forward: commit `src/components/pm/` when it’s in a good state so we have history to revert to.

---

## Engineering Invariants

- Append-only where memory matters
- Chapters: we **delete** the chapter (and its runs) from Firestore when the user deletes from the board. Promote first if you want to keep; deleting doesn't erase promoted content.
- **Data hygiene at scale:** When we delete a chapter we remove the chapter doc and its run docs; messages in the flat `messages` collection for those runs are left orphaned. **At scale we must add a prune step** that deletes messages whose `runId` no longer has a run (or batch-delete by runIds of deleted runs). Document this in any runbook or scale checklist.
- **PM board scope:** PM board is **topic-scoped only**. Do not store or key PM board state by chapter in Firestore or API (e.g. use `topics/{topicId}/pmBoard` or similar, never under `chapters/{chapterId}/...` for PM).
- Work lane always visible
- Small commits, always green

**Memory & Ledger:** Three tiers (ephemeral → Brain → Ledger) and Promote buckets are defined in `docs/MEMORY_AND_LEDGER_INVARIANTS.md`. Guard Brain vs Ledger; do not mutate Ledger or Promote handlers casually. Cursor rule: `.cursor/rules/memory-and-ledger.mdc`.

**Cross-context (Core + meeting + board):** Shared summary and “For the Solo surface” instructions live in `docs/CONVO_BREAKDOWN_FOR_SOLO.md` (board actions, meeting vision, naming, chapter bug).

---

## Standard Commands

npm run dev  
npm run lint && npm run build  
npm run seed:topics  
npm run seed:chapters  
npm run verify:e2e
