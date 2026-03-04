# Solo handoff: Multi-agent meeting orchestration (Core)

**Solo copy.** Original: Core repo `docs/SOLO_HANDOFF_MEETING_ORCHESTRATION.md`. This is the explicit handoff for Project Solo to hook up to P0 Core’s **multi-agent meeting** APIs: how to call them, what was added, how it works, why we chose this direction, and what it unlocks.

**Pre-requisite:** Solo already uses Core for single-agent runs via `POST /api/v1/agents/run/simple` (see Core’s `INTEGRATION_SOLO_CORE.md`). Same auth, same `P0_CORE_BASE_URL`, same env pattern.

---

## 1. Quick reference: what to call from Solo

| Action | Method / URL | When to use |
|--------|--------------|-------------|
| Create a meeting | `POST {P0_CORE_BASE_URL}/api/v1/meetings` | When user starts a "meeting" (multi-agent round) with a fixed set of agents. |
| Run one turn (N agents, one message) | `POST {P0_CORE_BASE_URL}/api/v1/agents/run/meeting` | Each time the user sends a message in that meeting. |
| Load meeting history | `GET {P0_CORE_BASE_URL}/api/v1/meetings/:id/turns?limit=100` | When opening/resuming a meeting to show prior turns. |
| Get meeting details | `GET {P0_CORE_BASE_URL}/api/v1/meetings/:id` | To show participants, status, etc. |
| Close meeting | `POST {P0_CORE_BASE_URL}/api/v1/meetings/:id/close` | When user ends the meeting. |

**Auth:** Same as run/simple: `Authorization: Bearer {API_KEY or JWT}` or `x-dev-bypass` in dev. No new env vars required beyond `P0_CORE_BASE_URL` and existing auth.

---

## 2. Hook-up steps (explicit)

### Step 1: Create a meeting when the user starts a multi-agent round

- **Request:** `POST /api/v1/meetings`
- **Body (JSON):**
  - `participantAgentIds`: `string[]` — Core agent ids for the agents in this meeting (e.g. from Solo's `P0_CORE_AGENT_TONI`, etc.).
  - `runId`: `string` (optional) — Solo run/chapter id for correlation (e.g. your board run id).
- **Response (201):** `{ "ok": true, "meetingId": "<id>", "meeting": { ... } }`. Store `meetingId` in Solo's state for this meeting/thread.

### Step 2: For each user message in that meeting, call run/meeting

- **Request:** `POST /api/v1/agents/run/meeting`
- **Body (JSON):**
  - `message`: `string` (required) — The user's message.
  - `meetingId`: `string` (required for this flow) — The id from Step 1. Core will use the meeting's participants and **persist this turn** (user message + agent replies).
  - `routing`: `"completion_time"` | `"round_robin"` | `"role_priority"` (optional, default `"completion_time"`). See **Routing** below.
  - `agentOrder`: `string[]` (required only if `routing === "role_priority"`) — Order of agent ids for speak order (e.g. facilitator first).
  - `memoryScope`: `"working"` | `"core"` (optional, default `"working"`).
  - `runId`: `string` (optional).
  - `humanAck`: `boolean` (optional).
- **Response (200):** `{ "ok": true, "replies": [ { "agentId", "reply", "completedAt", "actions?", "trace?" }, ... ] }`. Display each reply in the order given (order respects `routing`).

**Important:** When you send `meetingId`, Core **persists the turn** (user message + replies) on that meeting. You do not need to persist that history yourself for the "official" record; Core is the source of truth. You can still keep local UI state.

### Step 3: Load meeting history when (re)opening the meeting

- **Request:** `GET /api/v1/meetings/:id/turns?limit=100`
- **Response (200):** `{ "ok": true, "turns": [ { "turnIndex", "userMessage", "replies": [ ... ], "createdAt" }, ... ] }`. Use this to render prior turns in the thread/board.

### Step 4: Close the meeting when the user ends it

- **Request:** `POST /api/v1/meetings/:id/close`
- **Response (200):** `{ "ok": true, "meeting": { ... } }`. Meeting status becomes `closed`; no further turns should be run for it.

---

## 3. Routing (order of agent replies)

Solo can control **how** replies are ordered so the board/thread matches your product (e.g. "facilitator always first," or "deterministic round-robin").

| Value | Behavior | Use when |
|-------|----------|----------|
| `completion_time` (default) | All agents run in parallel; replies ordered by who finished first. | You want speed and don't care about order. |
| `round_robin` | Agents run **one after another** in `participantAgentIds` order. Reply order = agent order. | You want a fixed, predictable order (e.g. Agent A, then B, then C every time). |
| `role_priority` | Agents run **one after another** in the order given by `agentOrder`. Agents not in `agentOrder` run after, in participant order. | You want "facilitator first," "PM then engineer," etc. Send `agentOrder: ["facilitator_ag_id", "pm_ag_id", ...]`. |

**Solo mode → Core routing:**

| Solo mode | Core `routing` | Notes |
|-----------|----------------|--------|
| `race` | `completion_time` | Parallel; order by who finished first. |
| `eco` | `round_robin` | Sequential in participant order; deterministic. |
| `smart` | `role_priority` | Sequential in `agentOrder`; send `agentOrder: [agentId, ...]` for speak order. |

For **sales motion / demos**, `round_robin` or `role_priority` give a consistent, presentable order. Omit `routing` (or set `completion_time`) for fastest response when order doesn't matter.

---

## 4. What was added in Core (summary)

- **Contracts (Core `src/core/contracts/meetings.ts`):**  
  `Meeting`, `MeetingStatus`, `MeetingTurnRecord`, `MeetingTurnReply`, `MeetingRouting`, `MeetingStore` (including `appendTurn`, `listTurns`).

- **Meeting store (Firebase):**  
  Meetings in `meetings` collection; turns in subcollection `meetings/{id}/turns`. Each turn has `turnIndex`, `userMessage`, `replies[]`, `createdAt`. Meeting doc has `turnCount` for safe append.

- **APIs:**
  - `POST /api/v1/meetings` — create meeting.
  - `GET /api/v1/meetings` — list by project (auth), optional `status`, `limit`.
  - `GET /api/v1/meetings/:id` — get one meeting.
  - `GET /api/v1/meetings/:id/turns?limit=100` — list turns (full history).
  - `POST /api/v1/meetings/:id/close` — close meeting.
  - `POST /api/v1/agents/run/meeting` — one user message → N agents, ordered replies, optional turn persistence when `meetingId` is set.

- **Meeting run behavior:**  
  Supports `agentIds` (ad-hoc) or `meetingId` (first-class meeting). With `meetingId`, Core loads participants, runs agents (parallel or sequential by `routing`), returns ordered `replies`, and **appends one turn** (user message + replies) to that meeting. Solo can then load history via `GET .../turns`.

---

## 5. How it works (flow)

1. **Create meeting** → Core creates a meeting record, returns `meetingId`.
2. **User sends message** → Solo calls `POST .../agents/run/meeting` with `meetingId` and `message`. Core: resolves participants from the meeting, runs each agent (same engine as run/simple: Brain memory, LLM, actions), orders replies by `routing`, returns `replies`, and **persists one turn** (user message + replies) in `meetings/{id}/turns`.
3. **Load / resume** → Solo calls `GET .../meetings/:id/turns` and renders `turns[]` in order.
4. **Close** → Solo calls `POST .../meetings/:id/close`; Core sets status to `closed`.

Single-agent runs are unchanged: Solo continues to use `POST .../agents/run/simple` when only one agent is involved. Use meeting APIs only for **multi-agent** meetings where you want shared state and history in Core.

---

## 6. Why this direction

- **Core as control plane:** Core is the service that runs all surfaces (Solo, P1, Ledger, etc.). Putting meeting run, state, and turn persistence in Core gives one contract, one place for audit, and the same behavior for every product. (See Core’s `CORE_VS_SURFACES.md`.)

- **Full orchestration out of the gate:** Fancier routing (`round_robin`, `role_priority`) and persisting every turn when `meetingId` is set are **in scope from day one**, so Solo’s sales motion and boards can rely on deterministic order and durable history without workarounds.

- **Solo stays thin:** Solo does not need to run N× run/simple, sort replies, or persist meeting history itself. Core owns "who speaks when" and "what was said"; Solo owns UX, board state, and display names.

- **Same auth and env:** No new secrets or URLs; reuse `P0_CORE_BASE_URL` and existing Bearer/JWT or dev bypass.

---

## 7. What this unlocks

- **Multi-agent threads with history:** One meeting id, many turns; each turn stored in Core. Solo can show full thread and resume later.
- **Deterministic reply order:** Use `round_robin` or `role_priority` so demos and boards always show the same order (e.g. facilitator → PM → engineer).
- **Single source of truth:** Meeting and turn data live in Core; Ledger/audit and future surfaces (e.g. P1) can align on the same meeting and turn model.
- **ENT API:** Any client (not just Solo) can use the same meeting and run/meeting APIs for multi-agent flows without reimplementing orchestration. Same `P0_CORE_BASE_URL` and routes; no separate endpoint.

---

## 8. Contract details (for implementers)

- **Meeting run request:** See Core’s `MEETING_RUN.md` for full request/response and routing table.
- **Errors:** Same as rest of Core: `400` (e.g. missing `message`, or `role_priority` without `agentOrder`), `403` (wrong project), `404` (meeting not found), `409` (meeting closed), `429` (rate limit), `500` with `ok: false` and `error`.
- **Rate limit:** Meeting run is rate-limited per project (e.g. 60/min); same style as other agent routes.

---

## 9. Checklist for Solo

- [ ] When user starts a multi-agent meeting: call `POST /api/v1/meetings` with `participantAgentIds` (and optional `runId`); store `meetingId`.
- [ ] On each user message in that meeting: call `POST /api/v1/agents/run/meeting` with `message`, `meetingId`, and optionally `routing` / `agentOrder`; render `replies` in order.
- [ ] When opening/resuming a meeting: call `GET /api/v1/meetings/:id/turns` and render `turns`.
- [ ] When user ends the meeting: call `POST /api/v1/meetings/:id/close`.
- [ ] Reuse existing auth and `P0_CORE_BASE_URL`; no new env vars.

---

## 10. Status

- **Lint / build / audit:** Core repo has been run with `npm run lint`, `npm run build`, and `npm audit`; lint and build pass, and audit is clean after `npm audit fix`. Safe to integrate against.

If anything is ambiguous or you want a small addition (e.g. an extra field on the run/meeting request), extend the contract in Core and document it there and in MEETING_RUN.md.

---

## 11. Solo Q&A (answers for integration)

**Doc location**  
The full handoff lives only in the Core repo. Solo’s copy is this file. For a minimal snippet (Quick reference + routing + checklist), Core also has `SOLO_MEETING_INTEGRATION_SNIPPET.md`.

**Meeting ID ownership**  
Core returns `meetingId` (and `meeting`) from create. Solo must store that id and send it on every subsequent call: run/meeting, list turns, get meeting, close. That id is the canonical meeting id. In the Solo UI you can show that id or a Solo display label (e.g. "Meeting XYZ"); the value you send in API calls is always Core’s `meetingId`.

**Routing: Solo modes vs Core**  
Map Solo’s modes to Core’s `routing` (and `agentOrder` when needed): **race** → `completion_time`, **eco** → `round_robin`, **smart** → `role_priority` (and send `agentOrder` with the desired speak order). Core doesn’t replace your modes; you map them and send the corresponding `routing` (and optionally `agentOrder`) on run/meeting.

**Turns in Solo UI**  
`GET .../meetings/:id/turns` returns a chronological list of turns (`turns: [{ turnIndex, userMessage, replies, createdAt }, ...]`, ordered by turnIndex asc). Solo should render that as the meeting transcript. Core is the source of truth; you don’t need to merge with Solo-local state for the canonical history. You can still keep local UI state (e.g. optimistic updates) if you want.

**Fallback when Core is down**  
The designed expectation is: multi-agent meetings with persistence and history go through Core ("no multi-agent meetings without Core" for the full experience). If Solo has a direct-LLM path today, you can keep it as a degraded fallback when Core is unreachable (no persistence in Core, no shared history). That’s a Solo product decision; the handoff doesn’t require it.

**ENT API**  
"ENT API" means Core’s API when used as an Enterprise API (control plane without a UI). It is not a separate endpoint or base URL. Same Core base URL and same routes (e.g. `/api/v1/meetings`, `/api/v1/agents/run/meeting`). No placeholder or `entApi` needed in Solo’s client; just use `P0_CORE_BASE_URL` and the same endpoints.
