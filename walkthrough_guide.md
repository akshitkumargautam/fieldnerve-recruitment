# 🎬 FieldNerve v1 — Video Walkthrough Guide

## Before You Record

### Start the server
```bash
cd v1
npx prisma db push && npx prisma generate
npx tsx prisma/seed.ts   # re-seed to get fresh data
npm run dev              # server on http://localhost:3000
```

### Tools to have open
- **Terminal** (server running)
- **Postman** or any API client (to fire requests)
- Optionally: your code editor to briefly flash the folder structure

---

## Suggested Script (~5–10 minutes)

### 🟢 Act 1: Quick Architecture Intro (1 min)

Flash the **folder structure** in your editor and narrate:

> "This is a Node.js + TypeScript backend built with Express and Prisma ORM against a local SQLite database. The code follows a layered architecture — routes, controllers, services — with the recommendation engine isolated into pure functions for testability."

Key folders to point at:
- `src/modules/vendors/` — Vendor CRUD
- `src/modules/vendor-documents/` — Document CRUD
- `src/modules/work-requirements/` — Work Requirement CRUD + assignment
- `src/modules/recommendations/` — The recommendation engine (filters, scoring, weights)
- `src/ai/` — AI summarizer (interface + 2 implementations)
- `prisma/schema.prisma` — The data model

---

### 🟢 Act 2: Show the Seeded Data (1 min)

Fire these GET requests to show the pre-loaded data:

| # | Request | What to say |
|---|---------|-------------|
| 1 | `GET /vendors` | "The system has 12 seeded vendors across 5 categories — contractors, subcontractors, equipment rental, inspectors, and consultants. Some are ACTIVE, one is SUSPENDED, one is BLACKLISTED." |
| 2 | `GET /vendors/<apex_id>` | "Each vendor has nested documents. Apex Civil Works has all 5 document types with VALID status." |
| 3 | `GET /work-requirements` | "We have 4 work requirements covering different categories and priorities — MEDIUM, CRITICAL, HIGH, and LOW — each designed to exercise a different aspect of the recommendation engine." |

> **Tip:** Copy the IDs from these responses. You'll need them for the next steps.

---

### 🟢 Act 3: Recommendation A — Highway Bridge Retrofit (2 min)

**This is the core demo.** It shows the basic recommendation flow.

| Step | Request |
|------|---------|
| 1 | `POST /work-requirements/<reqA_id>/recommendations` |

**What happens behind the scenes (narrate this):**
> "When I trigger recommendations, the engine evaluates ALL 12 vendors against this requirement in two stages."

**Stage 1 — Eligibility:** Point out in the response:
- ✅ **Apex Civil Works** — eligible (CIVIL_CONSTRUCTION, ACTIVE, all docs valid)
- ✅ **Deccan Structures** — eligible (CIVIL_CONSTRUCTION, ACTIVE, all docs valid)
- ❌ **Bharat Infra Builders** — disqualified: `"TRADE_LICENSE is expired"` — show this in the `ineligible` array
- ❌ **Blacklisted Builders** — disqualified: `"Vendor status is BLACKLISTED, not ACTIVE"` — despite having **perfect scores** (4.9 rating, 4.9 safety, all docs valid)
- ❌ All other vendors — `"Category mismatch"` (they're in different categories)

**Stage 2 — Scoring:** Point at the `ranked` array:
- **Apex Civil Works: rank #1, score 93.5**
- **Deccan Structures: rank #2, score 68.6**

> "Apex wins because it's in Maharashtra (location match = 1.0), while Deccan is in Gujarat (location match = 0.0). Under MEDIUM priority, location carries a 30% weight."

**AI Summary:** Show the `aiSummary` field:
> "The fallback summarizer produces a deterministic, human-readable sentence referencing the actual computed data."

---

### 🟢 Act 4: Recommendation B — Emergency Bridge Repair / CRITICAL Priority (1.5 min)

**This is the money shot — demonstrates the priority-weight mechanic.**

| Step | Request |
|------|---------|
| 1 | `POST /work-requirements/<reqB_id>/recommendations` |

**What to highlight:**
- Same eligible vendors (Apex and Deccan), but **different scores**
- **Apex: 90.5** (was 93.5 under MEDIUM)
- **Deccan: 83.3** (was 68.6 under MEDIUM)

> "The gap narrowed from 24.9 points to 7.2 points! Under CRITICAL priority, Safety weight goes from 0.20 to 0.35, and Location weight drops from 0.30 to 0.15. Deccan has a 4.9 safety rating vs Apex's 4.0 — so Deccan gains a lot. And the reduced location penalty means Deccan's Gujarat location hurts less. Apex still wins, but a genuinely excellent distant vendor now has a fighting chance on critical jobs."

This is the **single most impressive thing to demo** — it shows the recommendation logic isn't just a static sort, it dynamically adapts to business context.

---

### 🟢 Act 5: Recommendation C — Near-Expiry Warning (1 min)

| Step | Request |
|------|---------|
| 1 | `POST /work-requirements/<reqC_id>/recommendations` |

**What to highlight:**
- This is `ELECTRICAL_INSTRUMENTATION`, `HIGH` priority
- **VoltLine Electricals** and **PowerGrid Systems** are eligible
- The `aiSummary` should **flag PowerGrid's SAFETY_CERTIFICATE** as expiring within 30 days

> "The AI summary proactively warns about compliance risks — PowerGrid's safety certificate is expiring soon. This is the kind of insight that prevents last-minute scrambles on active contracts."

---

### 🟢 Act 6: Recommendation D — Single-Vendor Shortlist (30 sec)

| Step | Request |
|------|---------|
| 1 | `POST /work-requirements/<reqD_id>/recommendations` |

**What to highlight:**
- `HSE_COMPLIANCE_TESTING`, `LOW` priority
- **Only SafetyFirst Inspections** is eligible
- **ComplyCheck Consultants** is disqualified: `"Missing required document: SAFETY_CERTIFICATE"`

> "Even when there's only one eligible vendor, the system still runs the full evaluation. ComplyCheck has insurance but is missing a required safety certificate for HSE work."

---

### 🟢 Act 7: Assignment Flow (1 min)

Now assign a vendor to requirement A:

| Step | Request | Body |
|------|---------|------|
| 1 | `POST /work-requirements/<reqA_id>/assign` | `{ "vendorId": "<apex_id>" }` |

**Show the response** — status changed to `ASSIGNED`, `assignedVendorId` and `assignedAt` are populated.

Then try to assign again:

| Step | Request | Body |
|------|---------|------|
| 2 | `POST /work-requirements/<reqA_id>/assign` | `{ "vendorId": "<deccan_id>" }` |

**Show the 409 error:** `"Work requirement is not OPEN"`

> "Business rules are enforced — you can't re-assign once it's assigned. You also can't assign a vendor that wasn't eligible in the latest recommendation run."

---

### 🟢 Act 8: CRUD Quick Demo (1 min, optional)

Quickly show one create + update + delete cycle:

| Step | Request |
|------|---------|
| 1 | `POST /vendors` — create a new vendor with a JSON body |
| 2 | `PATCH /vendors/<new_id>` — update its rating |
| 3 | `POST /vendors/<new_id>/documents` — add a document |
| 4 | `DELETE /vendors/<new_id>` — delete it (cascades to docs) |

> "Full CRUD for all entities, with Zod validation on inputs and consistent error envelopes."

---

## Key Talking Points to Weave In

| Topic | What to say |
|-------|-------------|
| **Determinism** | "Given the same data, the engine always produces the same scores and rankings. Tie-breaking uses safety rating then alphabetical name." |
| **Explainability** | "Every disqualified vendor gets a specific reason. Every score has a full breakdown stored in the database." |
| **Auditability** | "Each run persists results for ALL vendors, not just the top 5. You can always query why a vendor was excluded." |
| **AI fallback** | "Without an LLM API key, the system uses a deterministic template that still references real computed data — not placeholder text." |
| **Weight mechanic** | "The priority-based weight shift is the core design insight. It lets the same algorithm produce meaningfully different rankings based on business urgency." |

---

## Common Pitfalls to Avoid

- ❌ Don't forget to **re-seed** before recording — stale data from earlier testing can produce unexpected IDs
- ❌ Don't try to assign **before** running recommendations — you'll get a 409 ("No recommendation run exists yet")
- ❌ Don't rush through the numbers — **pause on the score comparison** between Req A (MEDIUM) and Req B (CRITICAL). That's the most compelling part.
- ❌ Don't forget to **show the ineligible array** — the disqualification reasons are a key feature
