# FieldNerve Vendor Recommendation Platform — Project Context

## What is this?

A backend system that helps operations teams in heavy industries (construction, railways, mining,
oil & gas, power & utilities) choose the right vendor/contractor for upcoming work. Instead of
manually reviewing spreadsheets and compliance documents, ops users submit a work requirement, get
a deterministic ranked list of eligible vendors with explainable scores, and assign one to the job.

Example workflow: Operations receives a notice that a power plant needs emergency electrical work
in the next 3 days. They:
1. Create a work requirement: "Substation Automation Upgrade", category `ELECTRICAL_INSTRUMENTATION`,
   location `Maharashtra`, priority `CRITICAL`.
2. Trigger a recommendation: the system runs through all vendors in the database, filters by category
   + active status + valid compliance documents, scores the eligible ones by rating + safety +
   compliance completeness + location match (with priority shifting the weight toward safety for
   urgent jobs), and returns a ranked list.
3. See an AI-generated summary of the top pick: *"VoltLine Electricals ranks #1 with strong ratings
   and full compliance. Note: their insurance expires in 18 days."*
4. Assign the work to VoltLine.

---

## Why does this exist?

This is a live recruitment assignment for FieldNerve (a DeepTech infrastructure AI company). It's
graded on: architecture, database design, API design, recommendation logic, AI usage, and stated
assumptions/trade-offs. The assignment is 4-5 hours, single-developer build.

---

## Key design principles

### Deterministic & explainable (not a black box)
The recommendation algorithm is a two-stage pipeline:
- **Stage 1 (Eligibility)**: Hard filters. A vendor either passes all gates or is disqualified with
  a reason (expired document, wrong category, non-active status). No fuzzy matching.
- **Stage 2 (Scoring)**: Weighted sum of normalized factors (rating, safety, compliance, location).
  Every score returns a per-factor breakdown so ops can see *why* vendor A ranked above vendor B.

The system never relies on learned models or opaque scoring. Same inputs always produce the same
ranked list.

### Industry-aware
Compliance documents (insurance, safety certificates, trade licenses) are hard business gates in
this industry, not nice-to-haves. Safety rating is a distinct axis from overall quality (a vendor
can do good work but have a poor safety record, which disqualifies them for high-risk sites).
Priority drives trade-offs explicitly: a CRITICAL job can surface a non-local vendor if they're
substantially better, because speed/quality > proximity when downtime costs money.

### Scoped for 4-5 hours
- No auth/user model (not required by the assignment).
- Postman collection + screen recording instead of a full frontend.
- Local deployment only (no managed infrastructure, no CI/CD setup).
- Single category per vendor, single location per vendor (multi-skilled/multi-region deferred to v2).

---

## How it's organized

### IMPLEMENTATION_SPEC.md
The executable spec. Anyone (human or LLM) can implement from this without guessing. Sections:
1. **Global conventions**: stack (Express/Prisma/SQLite/zod), ID types, error envelopes, folder structure.
2. **Data model**: exact Prisma schema (Vendor, VendorDocument, WorkRequirement, RecommendationRun, RecommendationResult).
3. **Business rules**: eligibility algorithm, scoring formula with worked numeric examples, assignment rules.
4. **API contract**: every endpoint, request/response shapes, status codes.
5. **AI feature**: Summarizer interface, LLM vs. fallback implementations.
6. **Seed data**: 12 vendors + 4 work requirements, each engineered to test a specific rule.
7. **Implementation phases**: 9-phase build plan with strict dependency order (Phase 0 → 1 → ... → 9).
8. **Assumptions & trade-offs**: stated explicitly for the README.

### PLANNING.md
The design journey. Why these decisions were made, what was corrected during exploration, open
questions resolved, trade-offs explained. Useful for understanding the reasoning if you want to
question or extend a decision.

### CONTEXT.md (this file)
High-level orientation. What the project is, why it exists, how the pieces fit together, where to
look for what.

---

## Key entities & relationships

**Vendor**: A contractor/supplier. Fields: name, type (CONTRACTOR/SUBCONTRACTOR/etc.), category
(CIVIL_CONSTRUCTION/ELECTRICAL_INSTRUMENTATION/etc.), location (state/region), ratings (overall
+ separate safety), status (ACTIVE/SUSPENDED/BLACKLISTED).

**VendorDocument**: Compliance paperwork attached to a vendor. One per (vendor, document type)
pair. Document types: TAX_REGISTRATION, INSURANCE, TRADE_LICENSE, SAFETY_CERTIFICATE, AGREEMENT.
Status: VALID, EXPIRED, or PENDING_VERIFICATION.

**WorkRequirement**: A job that needs a vendor. Fields: title, category (must match a vendor),
location, estimated value, priority (LOW/MEDIUM/HIGH/CRITICAL), expected start date, status
(OPEN/ASSIGNED/CLOSED).

**RecommendationRun**: A computed recommendation for a work requirement. Stores the AI-generated
summary. Has many RecommendationResult child rows (one per vendor in the system).

**RecommendationResult**: Per-vendor result in a recommendation run. Stores: whether eligible,
disqualification reason if not, total score and per-factor breakdown if eligible, rank.

---

## Critical flows

### Recommending vendors for a job
1. Receive a work requirement (category, location, priority).
2. **Stage 1 (Eligibility)**: For each vendor in the database:
   - Check category matches
   - Check status is ACTIVE
   - Check all mandatory documents (per category, plus SAFETY_CERTIFICATE if CRITICAL priority) are not EXPIRED
   - If all pass → eligible; else → disqualified with reason
3. **Stage 2 (Scoring)**: For each eligible vendor:
   - Compute ratingScore = rating/5, safetyScore = safetyRating/5
   - complianceScore = (count of VALID documents) / 5
   - locationScore = 1.0 if location matches, else 0.0
   - totalScore = sum of (factor * weight) where weights depend on priority
   - Weight shift: HIGH/CRITICAL jobs increase safety weight (35% instead of 20%), decrease location
     weight (15% instead of 30%), to prioritize quality/safety over proximity when urgent
4. **Ranking**: Sort eligible vendors by totalScore descending (tie-break: higher safetyRating, then alphabetical).
5. **AI summary**: Call Summarizer.summarize() with top 5 vendors + any near-expiry documents. Returns
   natural-language explanation of the top pick.
6. **Persist**: Store RecommendationRun + all RecommendationResult rows (eligible and ineligible) for
   audit trail / re-viewing past runs.

### Assigning a vendor
1. Receive an assignment request (workRequirementId, vendorId).
2. Validate: requirement status is OPEN, vendorId appeared in the most recent recommendation run with
   eligible=true, a recommendation run exists at all.
3. On success: set requirement.status = ASSIGNED, set assignedVendorId and assignedAt.

---

## What's implemented vs. deferred

**In scope (build these)**:
- Full CRUD for vendors, documents, work requirements
- Recommendation engine (filter + score + persist + AI summary)
- Assignment flow
- Postman collection + seed data
- README explaining architecture/design/logic/assumptions

**Out of scope (v2 or later)**:
- Multi-category vendors (single category per vendor in v1, keep filter logic simple)
- Multi-region service areas (single operatingLocation per vendor in v1)
- Document version history (one doc per type per vendor)
- Auth/user model (not required; out of scope explicitly)
- Frontend (Postman-only for this assignment)
- Live deployment
- Fuzzy/hierarchical location matching
- LLM-driven ranking (AI is explanatory only, never influences scores)

---

## Getting started

1. **Read IMPLEMENTATION_SPEC.md** — sections 0-3 give you the data model + algorithms. Section 6 is
   the seed data you'll populate.
2. **Follow the phases in Section 7** — build Phase 0 (scaffold) → Phase 1 (schema) → Phase 2 (seed)
   → ... → Phase 9 (README + recording). Each phase only depends on earlier phases.
3. **Use Section 3.4 (worked example) to verify** — when Phase 5 is done, POST to recommendations for
   requirement A and confirm you get Apex at 91.5 and Deccan at 88.1. Exact numbers. (On requirement B,
   CRITICAL priority, the ranking flips: Deccan 93.0 over Apex 89.0.)
4. **Reference PLANNING.md if you want reasoning** — why location is scoring-only, why status is explicit,
   why these weights, etc.

---

## Assignment deliverables

1. Source code (all phases implemented)
2. README (explains architecture, DB design, API design, recommendation logic, AI usage, assumptions, trade-offs)
3. Screen recording (5-10 mins, walking through work requirements A-D, showing the recommendation flow)
4. Optional: live deployment (not required)
5. Optional: basic frontend (not required; Postman is acceptable)

---

## Technical stack

- **Language**: Node.js 20+, TypeScript (strict mode)
- **Framework**: Express (lightweight, no DI overhead for a single-dev 4-5 hour build)
- **Database**: SQLite (local file via Prisma — zero provisioning, fully self-contained repo)
- **ORM**: Prisma (fast schema + type-safe client + excellent seed support)
- **Validation**: zod (declarative, colocated with routes)
- **Config**: dotenv (.env files, no build-time config)
- **AI**: LLM provider agnostic via the OpenAI-compatible protocol (Gemini default; any compatible provider via `LLM_API_KEY`/`LLM_BASE_URL`/`LLM_MODEL`); graceful fallback to a deterministic template on missing key or LLM failure, with `aiSummarySource` exposing which engine ran

---

## Questions to keep in mind

- **Why is location not a hard filter?** Because then Stage-2 location scoring would be a constant
  (all eligible vendors already matched location), making that weight dead. Scoring-only + priority
  weight-shift makes the trade-off explicit: urgent jobs can surface non-local vendors.
- **Why is document status stored explicitly?** To support the real-world case of "renewed but not
  yet reflected in the system" (PENDING_VERIFICATION override). Also makes eligibility checks a
  one-line status lookup, not date math scattered through code.
- **Why these specific scoring weights?** Rating (25%) + Safety (20% base) are non-negotiable. Safety
  rises to 35% on urgent jobs because in this industry, downtime/safety costs money. Compliance (25%)
  matches rating because document posture is a major decision gate. Location (30% base, 15% on urgent)
  is a trade-off: proximity matters, but not when the job is critical and a non-local vendor is
  substantially better.
- **Why is the AI layer explanatory-only?** Keeps the core logic deterministic (explicitly required).
  Keeps hallucination risk low (summarizing existing data, not deciding facts). Makes the fallback
  path (no API key) still meaningful.
- **Why no auth?** Assignment doesn't require multi-user access. Adding even minimal auth costs
  30-45 minutes for zero credit toward graded criteria. Stated explicitly as an assumption instead.

---

## Files in this repo

- `CONTEXT.md` — This file. High-level orientation.
- `PLANNING.md` — Design journey, decision rationale, open questions resolved.
- `IMPLEMENTATION_SPEC.md` — Executable spec (data model, algorithms, API contract, seed data, phases).
- `INSTALLATION_SPEC.pdf` — The original assignment document (confidential, for reference only).
- `src/` — Source code (populated during build phases 0-7).
- `prisma/` — Prisma schema + seed script (phases 1-2).
- `postman/` — Postman collection (phase 8).
- `README.md` — Architecture, DB design, API design, recommendation logic, AI usage, assumptions, trade-offs (phase 9).

---

## One more thing

This spec is intentionally self-contained and unambiguous. If something seems missing, it has been
made explicit rather than left to inference. Read IMPLEMENTATION_SPEC.md as the contract — anyone
implementing from it should not need to guess or assume anything.
