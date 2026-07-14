# FieldNerve Vendor Recommendation Platform — Self-Contained Implementation Spec

## 0. Context

Internal platform for FieldNerve-style operations teams to maintain vendor/contractor data and
get deterministic, explainable recommendations for upcoming work, plus one AI-assisted summary
capability. Theme: cross-sector industrial/EPC (construction, railways, mining, oil & gas,
power & utility). Single-sided internal tool — no vendor-facing login, no auth, no live
deployment required. 4-5 hour build; graded on architecture, DB design, API design,
recommendation logic, AI usage, and stated assumptions/trade-offs.

**This document is self-contained.** Anyone (human or LLM) implementing from this spec should not
need to infer or assume anything not stated here. If a decision seems missing, it has been made
explicit below rather than left implicit.

---

## 1. Global Conventions (apply everywhere, stated once)

- **Language/runtime**: Node.js 20+, TypeScript (strict mode on).
- **Stack**: Express, Prisma ORM, PostgreSQL (Neon), zod for validation, dotenv for config.
- **IDs**: UUID v4, generated via `@default(uuid())` in Prisma. All FK references use this same id.
- **Timestamps**: stored as Postgres `timestamptz`, serialized as ISO 8601 UTC strings in JSON.
- **String matching** (category, location, enums): case-insensitive exact match after trimming
  whitespace. No fuzzy/partial/hierarchical matching anywhere in this system.
- **JSON field naming**: camelCase everywhere, matching the field names given in Section 2.
- **Success response envelope**: `{ "data": <object or array> }` for every 2xx response.
- **Error response envelope**: `{ "error": { "message": string, "code": string } }`.
  Codes used: `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `CONFLICT` (409).
- **Status codes**: 200 (GET, PATCH, and action-POSTs like `/assign`), 201 (POST that creates a
  new resource, including a recommendation run), 204 (DELETE, empty body), 400/404/409 as above.
- **Folder structure**:
  ```
  src/
    server.ts
    db/prismaClient.ts
    modules/
      vendors/{vendor.routes.ts, vendor.controller.ts, vendor.service.ts, vendor.validation.ts}
      vendor-documents/{document.routes.ts, document.controller.ts, document.service.ts, document.validation.ts}
      work-requirements/{workRequirement.routes.ts, workRequirement.controller.ts, workRequirement.service.ts, workRequirement.validation.ts}
      recommendations/
        {recommendation.routes.ts, recommendation.controller.ts, recommendation.service.ts,
         filters.ts, scoring.ts, weights.config.ts, mandatoryDocs.config.ts}
    ai/{summarizer.ts (interface), llmSummarizer.ts, fallbackSummarizer.ts}
    shared/{errors.ts, asyncHandler.ts}
  prisma/{schema.prisma, seed.ts}
  postman/fieldnerve.postman_collection.json
  .env.example
  README.md
  ```

---

## 2. Data Model (exact — this is the Prisma schema in table form)

### Enums
```
VendorType:      CONTRACTOR | SUBCONTRACTOR | EQUIPMENT_RENTAL | MATERIAL_SUPPLIER | INSPECTION_AGENCY | CONSULTANT
Category:        CIVIL_CONSTRUCTION | ELECTRICAL_INSTRUMENTATION | MECHANICAL_FABRICATION | LOGISTICS_EQUIPMENT | HSE_COMPLIANCE_TESTING
VendorStatus:     ACTIVE | INACTIVE | SUSPENDED | BLACKLISTED
DocumentType:     TAX_REGISTRATION | INSURANCE | TRADE_LICENSE | SAFETY_CERTIFICATE | AGREEMENT
DocumentStatus:   VALID | EXPIRED | PENDING_VERIFICATION
Priority:         LOW | MEDIUM | HIGH | CRITICAL
RequirementStatus: OPEN | ASSIGNED | CLOSED
```

### Vendor
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| name | string | required |
| vendorType | VendorType | required |
| category | Category | required |
| contactPerson | string | required |
| phone | string | required |
| email | string | required |
| operatingLocation | string | required |
| rating | decimal(2,1) | required, 0.0–5.0 |
| safetyRating | decimal(2,1) | required, 0.0–5.0 |
| currentStatus | VendorStatus | required, default ACTIVE |
| createdAt, updatedAt | timestamptz | auto |

Relation: one Vendor → many VendorDocument.

### VendorDocument
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| vendorId | uuid | FK → Vendor.id |
| documentType | DocumentType | required |
| documentNumber | string | required |
| issuedDate | date | nullable |
| expiryDate | date | nullable |
| status | DocumentStatus | required |

**Constraint**: at most one VendorDocument per `(vendorId, documentType)` pair — enforce with a
unique composite constraint. This removes any ambiguity about "which document counts" if a vendor
has multiple documents of the same type; the system does not support document history/versioning
in v1 (stated trade-off, see Section 8).

### WorkRequirement
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| title | string | required |
| category | Category | required |
| location | string | required |
| estimatedValue | decimal(12,2) | required |
| priority | Priority | required |
| expectedStartDate | date | required |
| status | RequirementStatus | required, default OPEN |
| assignedVendorId | uuid | nullable, FK → Vendor.id |
| assignedAt | timestamptz | nullable |
| createdAt, updatedAt | timestamptz | auto |

### RecommendationRun
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| workRequirementId | uuid | FK → WorkRequirement.id |
| generatedAt | timestamptz | auto |
| aiSummary | text | nullable |

### RecommendationResult (child of RecommendationRun)
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| recommendationRunId | uuid | FK → RecommendationRun.id |
| vendorId | uuid | FK → Vendor.id |
| eligible | boolean | required |
| disqualificationReason | string | nullable — required to be non-null when `eligible = false` |
| totalScore | decimal(5,1) | nullable — null when `eligible = false` |
| scoreBreakdown | jsonb | nullable — shape: `{ ratingScore, safetyScore, complianceScore, locationScore, weightsUsed: { rating, safety, compliance, location } }`, all numbers 0–1 except weightsUsed which are the decimal weights used |
| rank | int | nullable — null when `eligible = false`; 1-based among eligible vendors only |

---

## 3. Business Rules (exact algorithm, zero ambiguity)

### 3.1 Mandatory document config (code constant, not a DB table)
```
CIVIL_CONSTRUCTION         → [TRADE_LICENSE, INSURANCE]
ELECTRICAL_INSTRUMENTATION → [TRADE_LICENSE, INSURANCE, SAFETY_CERTIFICATE]
MECHANICAL_FABRICATION     → [TRADE_LICENSE, INSURANCE]
LOGISTICS_EQUIPMENT        → [INSURANCE]
HSE_COMPLIANCE_TESTING     → [SAFETY_CERTIFICATE, INSURANCE]
```
Additional rule: if the WorkRequirement's `priority == CRITICAL`, add `SAFETY_CERTIFICATE` to the
mandatory list for that run if not already present (union, not replace).

### 3.2 Eligibility algorithm (Stage 1 — run once per vendor per requirement)
For a given `(vendor, requirement)` pair, evaluate in this exact order, stopping at the first failure:
1. `vendor.category == requirement.category` (case-insensitive exact) — else disqualify:
   `"Category mismatch: vendor is {vendor.category}, requirement needs {requirement.category}"`
2. `vendor.currentStatus == ACTIVE` — else disqualify: `"Vendor status is {currentStatus}, not ACTIVE"`
3. For each `documentType` in the mandatory list from 3.1 (with CRITICAL-priority union applied):
   - Find the vendor's VendorDocument row for that type (at most one exists, per the unique constraint).
   - If no row exists → disqualify: `"Missing required document: {documentType}"`
   - If row exists and `status == EXPIRED` → disqualify: `"{documentType} is expired"`
   - If row exists and `status` is `VALID` or `PENDING_VERIFICATION` → this document type passes.
   - Check all mandatory document types before disqualifying on documents (i.e. don't stop at the
     first missing doc — collect all missing/expired ones and join into one reason string,
     comma-separated, e.g. `"Missing required document: SAFETY_CERTIFICATE; TRADE_LICENSE is expired"`).
4. If all checks pass → `eligible = true`, `disqualificationReason = null`.

**Location is NOT a Stage-1 filter** — it is a Stage-2 scoring factor only (see 3.3). This is a
deliberate correction: making location a hard filter and then also scoring it in Stage 2 would make
that scoring factor constant across all eligible vendors (dead weight), and it would hard-exclude a
genuinely excellent non-local vendor even on a CRITICAL job where speed/quality might matter more
than proximity — the priority-based weight shift in 3.3 is how that trade-off gets expressed
instead.

### 3.3 Scoring algorithm (Stage 2 — eligible vendors only)

Per-factor normalized scores (all 0–1):
- `ratingScore = vendor.rating / 5`
- `safetyScore = vendor.safetyRating / 5`
- `complianceScore = (count of the 5 DocumentType values for which the vendor has a VendorDocument row with status == VALID) / 5`
- `locationScore = 1.0 if vendor.operatingLocation == requirement.location (case-insensitive exact), else 0.0`

Weights (must sum to 1.0 in both rows):
| Priority | rating | safety | compliance | location |
|---|---|---|---|---|
| LOW, MEDIUM | 0.25 | 0.20 | 0.25 | 0.30 |
| HIGH, CRITICAL | 0.25 | 0.35 | 0.25 | 0.15 |

`totalScore = round( (ratingScore*w.rating + safetyScore*w.safety + complianceScore*w.compliance + locationScore*w.location) * 100, 1 decimal )`

**Ranking**: sort eligible vendors by `totalScore` descending. **Tie-break** (must be applied for
determinism): if `totalScore` is equal, higher `safetyRating` wins; if still equal, alphabetical by
`name` ascending. Assign `rank` 1..N over eligible vendors only. Return top 5 ranked vendors in the
API response's primary list; still persist `RecommendationResult` rows for every vendor in the
system (eligible and ineligible) so the full "why" is queryable, not just the top 5.

### 3.4 Worked example (use this to verify your implementation is correct — see Section 6 seed data for these exact vendors)

Work Requirement: category `CIVIL_CONSTRUCTION`, location `Maharashtra`.

**Vendor "Apex Civil Works"**: rating 4.5, safetyRating 4.0, all 5 document types VALID, location
`Maharashtra` (matches).
- ratingScore=0.9, safetyScore=0.8, complianceScore=1.0, locationScore=1.0
- MEDIUM priority: `(0.9*0.25 + 0.8*0.20 + 1.0*0.25 + 1.0*0.30)*100 = 93.5`
- CRITICAL priority: `(0.9*0.25 + 0.8*0.35 + 1.0*0.25 + 1.0*0.15)*100 = 90.5`

**Vendor "Deccan Structures"**: rating 4.8, safetyRating 4.9, all 5 document types VALID, location
`Gujarat` (does not match).
- ratingScore=0.96, safetyScore=0.98, complianceScore=1.0, locationScore=0.0
- MEDIUM priority: `(0.96*0.25 + 0.98*0.20 + 1.0*0.25 + 0*0.30)*100 = 68.6`
- CRITICAL priority: `(0.96*0.25 + 0.98*0.35 + 1.0*0.25 + 0*0.15)*100 = 83.3`

Expected outcome: Apex outranks Deccan under both priorities (93.5 > 68.6, and 90.5 > 83.3), but
the gap narrows sharply under CRITICAL (24.9 points → 6.6 points) — this is the priority-weight
mechanic working correctly. If your implementation produces different numbers, the bug is in your
scoring/weights code, not in this spec.

### 3.5 Assignment rule (for `POST /work-requirements/:id/assign`)
1. `requirement.status` must be `OPEN` — else 409, message `"Work requirement is not OPEN"`.
2. The given `vendorId` must appear in the **most recent** RecommendationRun for this requirement
   with `eligible == true` — else 409, message `"Vendor was not eligible in the latest recommendation run"`.
3. If no RecommendationRun exists yet for this requirement at all → 409, message
   `"No recommendation run exists yet for this work requirement"`.
4. On success: set `status = ASSIGNED`, `assignedVendorId = vendorId`, `assignedAt = now()`.

---

## 4. API Contract

Every route below returns the envelopes from Section 1. Only non-obvious request/response
specifics are listed; CRUD fields match Section 2 exactly (all Vendor fields are both accepted on
POST and returned on GET, etc.).

| Method & Path | Request body | Response | Notes |
|---|---|---|---|
| `POST /vendors` | all Vendor fields except id/timestamps | 201, created Vendor | |
| `GET /vendors` | query params: `category`, `vendorType`, `currentStatus`, `operatingLocation` (all optional, exact match) | 200, array of Vendor | |
| `GET /vendors/:id` | — | 200, Vendor including nested `documents: VendorDocument[]` | 404 if missing |
| `PATCH /vendors/:id` | partial Vendor fields | 200, updated Vendor | 404 if missing |
| `DELETE /vendors/:id` | — | 204 | 404 if missing; cascades to delete its VendorDocument rows |
| `POST /vendors/:id/documents` | documentType, documentNumber, issuedDate, expiryDate, status | 201, created VendorDocument | 409 if `(vendorId, documentType)` already exists — use PATCH instead |
| `GET /vendors/:id/documents` | — | 200, array of VendorDocument | |
| `PATCH /vendors/:id/documents/:docId` | partial fields | 200, updated VendorDocument | |
| `DELETE /vendors/:id/documents/:docId` | — | 204 | |
| `POST /work-requirements` | all WorkRequirement fields except id/status/assigned*/timestamps | 201, created WorkRequirement (status defaults OPEN) | |
| `GET /work-requirements` | query params: `status`, `category`, `priority` (optional) | 200, array | |
| `GET /work-requirements/:id` | — | 200, WorkRequirement | 404 if missing |
| `PATCH /work-requirements/:id` | partial fields (not status/assigned* — those only change via `/assign`) | 200, updated | |
| `POST /work-requirements/:id/recommendations` | — (no body) | 201, `{ runId, generatedAt, aiSummary, ranked: RecommendationResult[] (eligible, top 5, ordered by rank), ineligible: RecommendationResult[] (all disqualified vendors with reasons) }` | Runs Stage 1 + Stage 2 for every vendor in the system against this requirement, persists the run, generates aiSummary (Section 5), returns it all |
| `GET /work-requirements/:id/recommendations` | query param `?all=true` for full history, else latest only | 200, same shape as above (array of runs if `all=true`) | 404 if none exist yet |
| `POST /work-requirements/:id/assign` | `{ vendorId }` | 200, updated WorkRequirement | Rules in 3.5 |

---

## 5. AI-Assisted Feature (exact contract)

**Interface**:
```
interface Summarizer {
  summarize(input: {
    requirementTitle: string,
    requirementPriority: Priority,
    rankedVendors: { name: string, rank: number, totalScore: number, breakdown: ScoreBreakdown }[],  // top 5
    nearExpiryWarnings: { vendorName: string, documentType: DocumentType, expiryDate: string }[]  // any VALID doc expiring within 30 days from today, among ranked vendors only
  }): Promise<string>
}
```
- `llmSummarizer`: calls the configured LLM provider with the above data serialized into the
  prompt; used when env var `LLM_API_KEY` is set.
- `fallbackSummarizer`: no LLM call. Deterministic template, e.g.:
  `"{rank1.name} ranks #1 with a score of {rank1.totalScore}. {if nearExpiryWarnings.length > 0: 'Note: ' + vendorName + '\'s ' + documentType + ' expires on ' + expiryDate + '.'}"`
  Must reference the actual data passed in, not generic placeholder text — this is what makes the
  fallback still meaningfully "explainable" rather than a filler sentence.
- Selection: `process.env.LLM_API_KEY ? llmSummarizer : fallbackSummarizer`, decided once at the
  top of `recommendation.service.ts`, not duplicated per-call.

---

## 6. Seed Data (exact — remove all ambiguity about what to seed)

### Vendors (12 total)
| # | Name | Type | Category | Location | Rating | SafetyRating | Status | Documents (all types not listed = not created) |
|---|---|---|---|---|---|---|---|---|
| 1 | Apex Civil Works | CONTRACTOR | CIVIL_CONSTRUCTION | Maharashtra | 4.5 | 4.0 | ACTIVE | all 5 types, all VALID |
| 2 | Bharat Infra Builders | CONTRACTOR | CIVIL_CONSTRUCTION | Maharashtra | 4.0 | 3.5 | ACTIVE | TAX_REGISTRATION VALID, INSURANCE VALID, TRADE_LICENSE EXPIRED, SAFETY_CERTIFICATE VALID |
| 3 | Deccan Structures | SUBCONTRACTOR | CIVIL_CONSTRUCTION | Gujarat | 4.8 | 4.9 | ACTIVE | all 5 types, all VALID |
| 4 | VoltLine Electricals | CONTRACTOR | ELECTRICAL_INSTRUMENTATION | Maharashtra | 4.2 | 4.5 | ACTIVE | all 5 types, all VALID |
| 5 | PowerGrid Systems | SUBCONTRACTOR | ELECTRICAL_INSTRUMENTATION | Maharashtra | 3.8 | 3.0 | ACTIVE | all 5 types VALID, except SAFETY_CERTIFICATE expiryDate = today+20 days (status still VALID) |
| 6 | IronForge Fabricators | CONTRACTOR | MECHANICAL_FABRICATION | Rajasthan | 4.0 | 4.0 | ACTIVE | all 5 types, all VALID |
| 7 | Precision Metal Works | SUBCONTRACTOR | MECHANICAL_FABRICATION | Rajasthan | 3.5 | 3.5 | SUSPENDED | all 5 types, all VALID (status is the disqualifier) |
| 8 | Swift Logistics | EQUIPMENT_RENTAL | LOGISTICS_EQUIPMENT | Maharashtra | 4.1 | 3.8 | ACTIVE | INSURANCE VALID, TAX_REGISTRATION VALID |
| 9 | HeavyHaul Equipment Co | EQUIPMENT_RENTAL | LOGISTICS_EQUIPMENT | Maharashtra | 3.9 | 3.6 | ACTIVE | INSURANCE EXPIRED, TAX_REGISTRATION VALID |
| 10 | SafetyFirst Inspections | INSPECTION_AGENCY | HSE_COMPLIANCE_TESTING | Maharashtra | 4.7 | 5.0 | ACTIVE | all 5 types, all VALID |
| 11 | ComplyCheck Consultants | CONSULTANT | HSE_COMPLIANCE_TESTING | Maharashtra | 3.2 | 3.0 | ACTIVE | INSURANCE VALID only — no SAFETY_CERTIFICATE row at all |
| 12 | Blacklisted Builders | CONTRACTOR | CIVIL_CONSTRUCTION | Maharashtra | 4.9 | 4.9 | BLACKLISTED | all 5 types, all VALID (status is the disqualifier despite best raw scores) |

### Work Requirements (4 total)
| # | Title | Category | Location | Est. Value | Priority | Expected Start | Expected demo outcome |
|---|---|---|---|---|---|---|---|
| A | Highway Bridge Retrofit | CIVIL_CONSTRUCTION | Maharashtra | 5,000,000 | MEDIUM | +30 days | Eligible: 1, 3 (2, 12 disqualified). Apex (1) ranks #1 at 93.5, Deccan (3) at 68.6. |
| B | Emergency Bridge Repair | CIVIL_CONSTRUCTION | Maharashtra | 5,000,000 | CRITICAL | +3 days | Same eligible set as A. Apex still #1 (90.5) but Deccan closes to 83.3 — demonstrates priority-weight shift without flipping the winner. |
| C | Substation Automation Upgrade | ELECTRICAL_INSTRUMENTATION | Maharashtra | 2,000,000 | HIGH | +14 days | Eligible: 4, 5. AI summary must flag vendor 5's near-expiry SAFETY_CERTIFICATE. |
| D | Site HSE Compliance Audit | HSE_COMPLIANCE_TESTING | Maharashtra | 500,000 | LOW | +7 days | Eligible: 10 only (11 disqualified for missing SAFETY_CERTIFICATE). Demonstrates a single-vendor shortlist. |

---

## 7. Implementation Phases (strict dependency order — each phase only needs artifacts from earlier phases)

| Phase | Deliverable | Depends on | Definition of done |
|---|---|---|---|
| 0 | Project scaffold: package.json, tsconfig, folder structure (Section 1), `.env.example`, Express app with `GET /health` | nothing | `npm run dev` starts; `GET /health` → 200 |
| 1 | Prisma schema (Section 2) + migration against Neon | Phase 0 | `npx prisma migrate dev` succeeds; tables match Section 2 exactly |
| 2 | `prisma/seed.ts` implementing Section 6 exactly | Phase 1 | seed runs clean; spot-check via `psql`/Prisma Studio that vendor 2's TRADE_LICENSE is EXPIRED, vendor 12 is BLACKLISTED, etc. |
| 3 | Vendor + VendorDocument CRUD (routes/controller/service/validation) | Phase 1 (schema); Phase 2 recommended for manual testing | every Vendor/document endpoint in Section 4 works against seeded data |
| 4 | WorkRequirement CRUD | Phase 1 (schema) | every WorkRequirement endpoint in Section 4 works |
| 5 | Recommendation engine: `filters.ts`, `scoring.ts`, `weights.config.ts`, `mandatoryDocs.config.ts`, service orchestration, persistence | Phase 1 (schema), Phase 2 (seed data to test against) | `POST /work-requirements/A/recommendations` reproduces the exact numbers in Section 3.4/6 table for requirement A; requirement B reproduces the CRITICAL-priority numbers |
| 6 | Assignment endpoint | Phase 4 (WorkRequirement), Phase 5 (RecommendationRun must exist to validate against) | rules in 3.5 all verified (reject non-OPEN, reject ineligible vendorId, reject no-run-yet) |
| 7 | AI summary: `Summarizer` interface + both implementations, wired into Phase 5's trigger endpoint | Phase 5 (needs RecommendationResult data to summarize) | requirement C's summary output explicitly mentions vendor 5's near-expiry document, with `LLM_API_KEY` unset (fallback path) |
| 8 | Postman collection covering every Section 4 endpoint | Phases 3, 4, 5, 6 | collection runs top-to-bottom without manual edits between requests |
| 9 | README (Architecture, DB Design, API Design, Recommendation Logic, AI Usage, Assumptions, Trade-offs) + screen recording | everything | recording walks through requirements A–D live, showing the numbers above |

No phase requires editing a file that a later phase was supposed to create — Phase 7 appends a
call at the end of Phase 5's existing service function rather than restructuring it, so it is
additive, not a rebuild.

---

## 8. Stated Assumptions & Trade-offs (for README, already locked)

- Single category per vendor, single operating location per vendor — real vendors are often
  multi-skilled/multi-region; deferred to keep matching logic simple within the time box.
- No auth/user model — out of scope per assignment intent, stated explicitly.
- Category/location matching is exact-string (case-insensitive), not fuzzy or hierarchical.
- At most one document per `(vendor, documentType)` — no document version history in v1.
- Location is a scored factor, not a hard filter (see 3.2) — a deliberate correction so the
  priority-based weight shift has a real effect instead of scoring a constant.
- AI feature is explanatory only, generated from already-computed deterministic scores; it never
  influences ranking or eligibility.
- No live deployment; local run + Postman + recording satisfies the deliverable, per the
  assignment's own "optional" framing.
