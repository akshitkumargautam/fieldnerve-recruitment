# FieldNerve Vendor Recommendation Platform — Design Planning Document

This document captures the design journey and decision rationale. For the executable spec, see
IMPLEMENTATION_SPEC.md.

---

## Design Journey

### Problem Statement & Theme
- **Assignment**: Build a backend for an internal vendor recommendation platform helping ops teams
  pick contractors for upcoming work, replacing manual spreadsheet review.
- **Theme chosen**: Cross-sector industrial/EPC marketplace (construction, railways, mining,
  oil & gas, power & utility). Rationale: FieldNerve's stated target customers span these sectors,
  and a unified taxonomy is realistic since many contractors serve multiple sectors. Single-sector
  narrowing would simplify the category list but reduce breadth; rejected.
- **Scope**: Internal, single-sided tool (no vendor login, no auth, no live deployment required).
  4-5 hour build window. Graded on: architecture, DB design, API design, recommendation logic,
  AI usage, and stated assumptions/trade-offs.

### Critical Design Corrections (locked after exploration)

#### Correction 1: Location as a scoring factor, not a hard filter
**Initial sketch**: Made location a Stage-1 hard filter (vendor.location == requirement.location).
**Problem discovered**: This made location a constant across all eligible vendors (all had location=X),
so scoring it in Stage 2 was dead weight — that 30% weight factor did nothing.
**Correction**: Moved location entirely out of Stage-1 eligibility. It's now purely a scoring factor
in Stage 2 (1.0 exact match, 0.0 otherwise). This makes the priority-driven weight shift (HIGH/CRITICAL
shifts weight from location to safety) actually meaningful — a superior non-local vendor can now
rank higher on a time-critical job where safety/quality matter more than proximity.

#### Correction 2: VendorDocument status as explicit field, not derived
**Initial sketch**: Derive document status on-the-fly from `expiryDate < today ? EXPIRED : VALID`.
**Problem with derivation**: Ignores the real-world case where a document is renewed at a government
office but that reflects in the system with a delay. Ops needs a `PENDING_VERIFICATION` override state.
**Choice**: Store status explicitly. Makes eligibility checks a one-line status lookup ("show me all
expired docs") and supports the override case. Trade-off: status can go stale if someone updates
expiryDate but forgets to set status. Addressed by stating this explicitly in trade-offs.

#### Correction 3: Single score factor per vendor-requirement pair
**Initial sketch**: A vendor could match multiple categories (many-to-many join table).
**Decision**: Single category per vendor for v1. Rationale: keeps filter logic deterministic/simple
within the 4-5 hour window. Multi-category is the natural v2 extension (involves adding a join
table, and changing all category-filter queries). Stated as a trade-off.

---

## Scoring Logic — Full Derivation

The assignment says: "You are free to decide how vendors are shortlisted, how recommendations are
ranked, how scores are calculated. The only requirement is that your logic should be explainable
and deterministic."

### Two-stage pipeline
**Stage 1 (Eligibility)**: Hard filters that disqualify vendors. A vendor either passes all or is
out. This is the "explainable" mechanism — every "no" has a documented reason (expired doc, wrong
category, non-ACTIVE status). Reasons are returned in the response so the ops person can see *why*
vendor X was excluded.

**Stage 2 (Scoring)**: Weighted sum over eligible vendors only. Per-factor scores are normalized
0-1, multiplied by weights that sum to 1.0, then scaled to 0-100. This is the "deterministic"
mechanism — same inputs always produce the same ranked list, with no randomness or learned
coefficients.

### Weight choices (why these specific numbers)
- **Rating (25%)**: A vendor's historical quality. Non-negotiable baseline.
- **Safety (20% base, 35% when HIGH/CRITICAL)**: In this industry (mining, oil & gas, power, 
  construction), safety record is a distinct axis from general quality. When a job is urgent or
  critical, safety matters more than local proximity — hence the priority-driven shift.
- **Compliance (25%)**: Count of valid documents. In heavy industry, "do you have your paperwork in
  order" is a major decision gate (liability, insurance, site access). Equal footing with rating
  to reflect the theme.
- **Location (30% base, 15% when HIGH/CRITICAL)**: Proximity matters, but not when the job is
  urgent and a non-local vendor is substantially better. The weight shift makes this trade-off
  explicit.

The weights sum to 1.0 in both tiers (0.25 + 0.20 + 0.25 + 0.30 = 1.0, and
0.25 + 0.35 + 0.25 + 0.15 = 1.0), and the shift is symmetric (safety +15%, location -15%), so the
priority mechanic is balanced.

### Worked numeric example (Section 3.4 of IMPLEMENTATION_SPEC.md)
Two vendors, same requirement:
- **Apex Civil Works** (local, high rating, high safety, full compliance): 93.5 (MEDIUM), 90.5 (CRITICAL)
- **Deccan Structures** (non-local, excellent rating/safety, full compliance): 68.6 (MEDIUM), 83.3 (CRITICAL)

Apex wins in both, but gap narrows from 24.9 to 6.6 points under CRITICAL priority. This
demonstrates the weight shift working without flipping the winner (which would only happen if the
non-local vendor was *dramatically* better). The exact numbers are in the spec so implementers can
verify their scoring code produces the right arithmetic.

---

## AI Feature — Why "recommendation summary" over the alternatives

The assignment offered four options:
1. AI-generated recommendation summary
2. Vendor risk summary
3. Compliance observations
4. Vendor comparison summary

**Chosen: AI-generated recommendation summary** (with embedded risk callouts).

**Rationale**:
- It lives naturally on top of the already-computed deterministic scores — not a separate feature,
  not a new data model, not an orthogonal endpoint.
- The AI layer is explanatory only (summarizes existing data), never influences ranking — this
  keeps the core logic deterministic as required, and keeps hallucination risk low.
- It satisfies the "AI-assisted feature" requirement without being decorative — the fallback
  (deterministic template filling in the same breakdown) still produces a meaningful summary
  when the LLM API key is unavailable.
- "Vendor comparison" would require either: two-vendor endpoint (adds API surface), or comparing
  every pair in the full results (combinatorial overhead, new data model). "Risk summary" and
  "Compliance observations" are interesting but orthogonal to the recommendation flow (useful as
  separate audit tools, not as part of "here are your ranked vendors"). Recommendation summary
  maps directly to the product moment (user gets a job, sees ranked vendors, gets a natural-language
  explanation of the top pick).

---

## Scope Boundaries (Why these cuts)

### No auth/user model
- Assignment does not require multi-user or role-based access.
- Adding even minimal auth (login, session/JWT, User table) costs 30-45 minutes for zero credit
  toward graded criteria (architecture, DB design, API design, recommendation logic, AI, assumptions).
- Stated explicitly as an assumption in the README rather than silently omitted.

### Postman only, no frontend
- Every graded README section is demonstrable via API calls (architecture, API design, logic all
  visible in a Postman collection and the spec).
- Frontend is explicitly marked optional in the assignment.
- If time remains *after* everything else is solid, build a single "enter work requirement → see
  ranked vendors + AI summary" screen — never before. This is the one product moment worth
  visualizing; full CRUD UI is effort with zero credit.

### Local deployment only
- Also explicitly optional in the assignment.
- Local run + README with setup steps + screen recording satisfies the deliverable fully.
- Time saved goes to recommendation logic depth and AI feature polish, not infra plumbing.

### Stack: Express, Prisma, PostgreSQL (Neon), zod
- **Express over NestJS**: NestJS's DI, modules, decorators pay off on long-lived codebases with
  multiple contributors. In a single-developer 4-5 hour window, that structure is overhead.
- **Prisma over TypeORM/Sequelize**: Migrate + seed + type-safe client workflow is the fastest path
  to a demoable schema. The `.prisma` file is also the single source of truth for schema design
  (readable by anyone, no separate documentation needed).
- **Neon** (PostgreSQL): Free, near-instant provisioning. Doubles as a real database for local dev
  without a separate deployment step.
- **zod**: Declarative request validation, colocated with routes, zero boilerplate.

---

## Seed Data — Why these 12 vendors & 4 requirements

Every vendor is engineered to exercise a specific rule:
1. **Apex Civil Works**: baseline eligible, all docs valid, local, high ratings → #1 for requirement A/B
2. **Bharat Infra Builders**: missing mandatory TRADE_LICENSE (expired) → disqualified for A/B
3. **Deccan Structures**: excellent ratings but non-local → lower score under MEDIUM, closer under CRITICAL
4. **VoltLine Electricals**: eligible, all valid docs → normal scenario
5. **PowerGrid Systems**: safety cert expires in 20 days (still VALID, but near-expiry for AI callout)
6. **IronForge Fabricators**: eligible for category not in requirements (demonstrates no match)
7. **Precision Metal Works**: same docs/ratings as 6, but SUSPENDED status → hard-block despite good paper
8. **Swift Logistics**: eligible for equipment rental (limited mandatory docs)
9. **HeavyHaul Equipment Co**: insurance EXPIRED → disqualified for category that requires it
10. **SafetyFirst Inspections**: highest safety rating, all valid docs → #1 for requirement D
11. **ComplyCheck Consultants**: missing SAFETY_CERTIFICATE row entirely → disqualified for D
12. **Blacklisted Builders**: excellent raw ratings/docs, but BLACKLISTED status → hard-block despite best scores

Work requirements:
- **A (Highway Bridge Retrofit, MEDIUM priority)**: Tests baseline scoring with location match/mismatch
- **B (Emergency Bridge Repair, CRITICAL priority)**: Same vendors as A, demonstrates weight shift narrows gap
- **C (Substation Automation Upgrade, HIGH priority)**: Tests the near-expiry document warning in AI summary
- **D (Site HSE Compliance Audit, LOW priority)**: Single-eligible-vendor outcome (tests the "only one option" case)

No vendor/requirement can be seeded without a clear reason to test something.

---

## Implementation Phases — Strict Dependency Order

Phases 0-9 are ordered so each phase only requires artifacts from earlier phases. Phase 7 (AI
summary) appends to Phase 5's existing service function (additive, not a rebuild). No circular
dependencies, no "scaffolding you'll throw away." Each phase's output is the input to the next.

| Phase | Why this order |
|---|---|
| 0 | Scaffold first; everything depends on the folder structure. |
| 1 | Prisma schema; everything downstream depends on the DB. |
| 2 | Seed data; Phase 3/4/5 need data to test against. |
| 3, 4 | CRUD endpoints; Phase 5 orchestrates these as part of recommendation flow. |
| 5 | Recommendation engine; the core business logic. Phase 6/7 depend on its output. |
| 6 | Assignment endpoint; uses the most recent recommendation run (Phase 5 creates). |
| 7 | AI summary; reads from Phase 5's RecommendationResult rows. |
| 8 | Postman; tests everything from Phases 3-6. |
| 9 | README + recording; documents the whole system. |

---

## Trade-offs Summary (for README)

- **Single category per vendor**: Scalability trade-off; a join table handles multi-skilled vendors in v2.
- **Single operating location**: Same; multi-region service areas deferred to v2.
- **Exact-string matching** (no fuzzy location, no hierarchical categories): Keeps the logic deterministic,
  at the cost of missing near-matches; trade-off made explicit rather than silent.
- **No auth**: Out of scope; stated.
- **No document version history**: At most one document per (vendor, documentType). Real audit systems
  track history; deferred to v2.
- **AI is explanatory only**: Never influences ranking. Keeps core logic deterministic.
- **Local deployment only**: Optional per assignment; time budget prioritizes logic over infra.

---

## Open Questions Resolved During Design

**Q: Should location be a hard filter or a scoring factor?**
A: Originally hard filter (stage-1). Revised to scoring-only after recognizing that made the weight
dead (all eligible vendors had location=X). Scoring-only + priority-weight-shift makes the
trade-off between locality and quality explicit.

**Q: Should document status be derived or explicit?**
A: Derived (simpler). Revised to explicit to support the real-world "renewed but not yet reflected"
override case, and to make eligibility checks a one-line status lookup.

**Q: Which AI feature?**
A: Recommendation summary (not vendor comparison, risk summary, or compliance observations). Rationale:
it's additive to the core flow (not orthogonal), keeps AI explanatory (not decision-making), and the
fallback is still meaningful.

---

## Verification Checklist (before screen recording)

1. Requirement A: Apex (93.5) > Deccan (68.6) — exact numbers.
2. Requirement B: Apex (90.5) > Deccan (83.3) — priority shift verified.
3. Requirement C: AI summary flags vendor 5's near-expiry document.
4. Requirement D: Only vendor 10 eligible; vendor 11 disqualified for missing SAFETY_CERTIFICATE.
5. Assignment endpoint: rejects non-OPEN, rejects ineligible vendorId, creates audit trail.
6. Fallback summarizer (LLM_API_KEY unset): produces coherent text referencing actual data, not placeholder.
7. Postman collection: runs top-to-bottom without manual edits between requests.

All of these are concrete, reproducible assertions — not "does it feel right" checks.
