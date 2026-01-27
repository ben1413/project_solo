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

## Known Gaps (Active Focus)

- Work / Chat lane needs unmistakable “alive” empty state
- Verify end-to-end flow:
  topic → chapter → run → message → refresh → persists
- Optional: default “scratch” run when no topic selected

---

## Timeline & Remaining Work

Phase 1 — Chapters  
DONE

Phase 2 — Runs + Messages  
IN PROGRESS
- createRun helper
- appendMessage helper
- realtime subscriptions
- auto-create run
- message list
- message composer
- visual clarity + persistence verification

Phase 3 — Promote  
NOT STARTED

Phase 4 — Tasks  
NOT STARTED

Phase 5 — Stabilization  
NOT STARTED

Phase 5.5 — Mobile Packaging (PWA)  
NOT STARTED

Phase 6 — Guardrails  
NOT STARTED

Phase 7 — Freeze  
NOT STARTED

---

## Engineering Invariants

- Append-only where memory matters
- Never delete chapters
- Work lane always visible
- Small commits, always green

---

## Standard Commands

npm run dev  
npm run lint && npm run build  
npm run seed:topics  
npm run seed:chapters

