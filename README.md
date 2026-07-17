# FieldNerve — Intelligent Vendor Recommendation Platform

An internal backend platform that helps operations teams maintain vendor/contractor data and receive **deterministic, explainable** recommendations for upcoming work across industrial and EPC sectors (construction, railways, mining, oil & gas, power & utility).

---

## Table of Contents

1. [Project Architecture](#1-project-architecture)
2. [Database Design](#2-database-design)
3. [API Endpoints](#3-api-endpoints)
4. [Recommendation Logic](#4-recommendation-logic)
5. [AI Usage](#5-ai-usage)
6. [Assumptions](#6-assumptions)
7. [Trade-offs](#7-trade-offs)
8. [Setup & Testing](#8-setup--testing)

---

## 1. Project Architecture

### Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+, TypeScript |
| Framework | Express.js |
| ORM | Prisma Client v5 |
| Database | SQLite (local, zero-config) |
| Validation | Zod (runtime schema validation) |
| AI | Strategy-pattern Summarizer (LLM / deterministic fallback) |

### Folder Structure

```
v1/
├── prisma/
│   ├── schema.prisma            # Data model definition
│   ├── seed.ts                  # Seeds 12 vendors + 4 work requirements
│   └── migrations/              # Auto-generated migration files
├── src/
│   ├── server.ts                # Express app entry point, route registration
│   ├── db/
│   │   └── prismaClient.ts      # Singleton Prisma client
│   ├── modules/
│   │   ├── vendors/             # Vendor CRUD (routes, controller, service, validation)
│   │   ├── vendor-documents/    # Document CRUD (routes, controller, service, validation)
│   │   ├── work-requirements/   # Work Requirement CRUD + assignment (routes, controller, service, validation)
│   │   └── recommendations/     # Recommendation engine
│   │       ├── filters.ts           # Stage 1: Eligibility evaluation
│   │       ├── scoring.ts           # Stage 2: Multi-factor scoring
│   │       ├── weights.config.ts    # Priority-driven weight tables
│   │       ├── mandatoryDocs.config.ts  # Category → required document mapping
│   │       ├── recommendation.service.ts  # Orchestration: eligibility → scoring → ranking → AI summary
│   │       ├── recommendation.controller.ts
│   │       └── recommendation.routes.ts
│   ├── ai/
│   │   ├── summarizer.ts        # Summarizer interface contract
│   │   ├── llmSummarizer.ts     # LLM-backed implementation (when LLM_API_KEY is set)
│   │   └── fallbackSummarizer.ts  # Deterministic template-based fallback
│   └── shared/
│       ├── errors.ts            # AppError class + centralized error handler
│       └── asyncHandler.ts      # Express async wrapper to catch promise rejections
├── postman/
│   └── fieldnerve.postman_collection.json  # Full API test collection
├── .env.example                 # Template for .env (DATABASE_URL for local SQLite)
└── package.json
```

### Layered Architecture

The application follows a strict **Routes → Controller → Service** layering:

- **Routes** define HTTP method + path combinations and attach middleware (validation, async error handling).
- **Controllers** parse and validate incoming requests via Zod schemas, then delegate to services. They are responsible for HTTP semantics (status codes, response envelopes).
- **Services** contain business logic and interact with Prisma. They throw typed `AppError` exceptions that the centralized error handler maps to HTTP responses.
- **Pure functions** (`filters.ts`, `scoring.ts`) are kept stateless and side-effect-free so the recommendation algorithm can be unit-tested independently of the database.

### Error Handling

A centralized Express error handler in `shared/errors.ts` catches all errors and returns consistent envelopes:

- **Success**: `{ "data": <object | array> }`
- **Error**: `{ "error": { "message": string, "code": string } }`

| HTTP Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod schema validation failure |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Business rule violation (e.g., duplicate document, assignment to non-OPEN requirement) |

---

## 2. Database Design

### Entity-Relationship Diagram

```
┌──────────────┐       1:N       ┌──────────────────┐
│    Vendor     │───────────────▶│  VendorDocument   │
│              │                │                  │
│ id (PK, UUID)│                │ id (PK, UUID)    │
│ name         │                │ vendorId (FK)    │
│ vendorType   │                │ documentType     │
│ category     │                │ documentNumber   │
│ contactPerson│                │ issuedDate       │
│ phone        │                │ expiryDate       │
│ email        │                │ status           │
│ opLocation   │                │                  │
│ rating       │                │ @@unique(vendorId,│
│ safetyRating │                │  documentType)   │
│ currentStatus│                └──────────────────┘
│ createdAt    │
│ updatedAt    │       1:N       ┌──────────────────┐
│              │◀───────────────│ WorkRequirement  │
└──────────────┘  (assignedVendor)│                  │
       │                        │ id (PK, UUID)    │
       │                        │ title            │
       │          1:N           │ category         │
       │    ┌──────────────────▶│ location         │
       │    │                   │ estimatedValue   │
       │    │                   │ priority         │
       │    │                   │ expectedStartDate│
       │    │                   │ status           │
       │    │                   │ assignedVendorId │
       │    │                   │ assignedAt       │
       │    │                   └──────┬───────────┘
       │    │                          │ 1:N
       │    │                          ▼
       │    │                   ┌──────────────────┐
       │    │                   │ RecommendationRun│
       │    │                   │                  │
       │    │                   │ id (PK, UUID)    │
       │    │                   │ workRequirementId│
       │    │                   │ generatedAt      │
       │    │                   │ aiSummary        │
       │    │                   └──────┬───────────┘
       │    │                          │ 1:N
       │    │                          ▼
       │    │                   ┌────────────────────┐
       │    │                   │RecommendationResult│
       └────┼──────────────────▶│                    │
            │                   │ id (PK, UUID)      │
                                │ recommendationRunId│
                                │ vendorId (FK)      │
                                │ eligible           │
                                │ disqualReason      │
                                │ totalScore         │
                                │ scoreBreakdown     │
                                │ rank               │
                                └────────────────────┘
```

### Key Design Decisions

- **UUID primary keys** across all tables for globally unique, non-sequential identifiers.
- **Composite unique constraint** `@@unique([vendorId, documentType])` on `VendorDocument` ensures at most one document per type per vendor, eliminating ambiguity in compliance checks.
- **Cascade delete** from `Vendor` to `VendorDocument` — deleting a vendor automatically removes its documents.
- **RecommendationRun + RecommendationResult** split: Each recommendation invocation creates a `Run` (point-in-time snapshot) with `Result` rows for **every** vendor in the system — both eligible and ineligible — so the full "why was this vendor excluded?" reasoning is always queryable, not just the top picks.
- **scoreBreakdown** is stored as a JSON string containing the normalized per-factor scores and the weights used, enabling full auditability and reproducibility of any past recommendation.

### Enums (Application-Level)

Since SQLite does not support native enums, enum values are stored as strings and validated at the application boundary via Zod schemas:

| Enum | Values |
|---|---|
| VendorType | `CONTRACTOR`, `SUBCONTRACTOR`, `EQUIPMENT_RENTAL`, `MATERIAL_SUPPLIER`, `INSPECTION_AGENCY`, `CONSULTANT` |
| Category | `CIVIL_CONSTRUCTION`, `ELECTRICAL_INSTRUMENTATION`, `MECHANICAL_FABRICATION`, `LOGISTICS_EQUIPMENT`, `HSE_COMPLIANCE_TESTING` |
| VendorStatus | `ACTIVE`, `INACTIVE`, `SUSPENDED`, `BLACKLISTED` |
| DocumentType | `TAX_REGISTRATION`, `INSURANCE`, `TRADE_LICENSE`, `SAFETY_CERTIFICATE`, `AGREEMENT` |
| DocumentStatus | `VALID`, `EXPIRED`, `PENDING_VERIFICATION` |
| Priority | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| RequirementStatus | `OPEN`, `ASSIGNED`, `CLOSED` |

---

## 3. API Endpoints

All endpoints follow RESTful conventions. Base URL: `http://localhost:3000`. Every request body is JSON (`Content-Type: application/json`) and validated with Zod - an invalid or missing field returns `400 VALIDATION_ERROR` naming the offending field. Success responses are wrapped in `{ "data": ... }`, errors in `{ "error": { "message", "code" } }`.

The tables below list every endpoint, and for each `POST`/`PATCH`, exactly which body fields exist, which values they accept, and what they actually do in the system - so any request can be populated without reading the source.

### Vendor Endpoints

| Method | Path | Description | Status |
|---|---|---|---|
| `POST` | `/vendors` | Create a new vendor | 201 |
| `GET` | `/vendors` | List vendors (filter by `category`, `vendorType`, `currentStatus`, `operatingLocation`) | 200 |
| `GET` | `/vendors/:id` | Get vendor by ID (includes nested `documents`) | 200 / 404 |
| `PATCH` | `/vendors/:id` | Update vendor fields (any subset of the create fields) | 200 / 404 |
| `DELETE` | `/vendors/:id` | Delete vendor (cascades to documents) | 204 / 404 |

**Body fields for `POST /vendors`** (PATCH accepts any subset of the same):

| Field | Required | Type / allowed values | What it does |
|---|---|---|---|
| `name` | Yes | string | Display name. Returned as `vendorName` everywhere the vendor appears in other responses. |
| `vendorType` | Yes | `CONTRACTOR` \| `SUBCONTRACTOR` \| `EQUIPMENT_RENTAL` \| `MATERIAL_SUPPLIER` \| `INSPECTION_AGENCY` \| `CONSULTANT` | Kind of business. Descriptive only - no effect on eligibility or scoring. |
| `category` | Yes | `CIVIL_CONSTRUCTION` \| `ELECTRICAL_INSTRUMENTATION` \| `MECHANICAL_FABRICATION` \| `LOGISTICS_EQUIPMENT` \| `HSE_COMPLIANCE_TESTING` | Work domain. Hard eligibility gate: the vendor is only considered for requirements in the same category. |
| `contactPerson` | Yes | string | Contact info, no business logic. |
| `phone` | Yes | string | Contact info, no business logic. |
| `email` | Yes | valid email string | Contact info, validated format. |
| `operatingLocation` | Yes | string (e.g. `"Maharashtra"`) | Home region. Compared case-insensitively against a requirement's `location` for the location score (1.0 exact match, else 0.0). Deliberately low weight in scoring. |
| `rating` | Yes | number 0-5 | Overall performance. Weighted 0.35 (LOW/MEDIUM) or 0.30 (HIGH/CRITICAL) in scoring. |
| `safetyRating` | Yes | number 0-5 | Safety record. Weighted 0.25 (LOW/MEDIUM) or 0.40 (HIGH/CRITICAL) - heaviest factor on urgent jobs. Also the ranking tie-breaker. |
| `currentStatus` | No (default `ACTIVE`) | `ACTIVE` \| `INACTIVE` \| `SUSPENDED` \| `BLACKLISTED` | Compliance gate: any value other than `ACTIVE` disqualifies the vendor from every recommendation run regardless of scores. |

Example body:

```json
{
  "name": "Sunrise Constructions",
  "vendorType": "CONTRACTOR",
  "category": "CIVIL_CONSTRUCTION",
  "contactPerson": "R. Sharma",
  "phone": "+91-9800000000",
  "email": "contact@sunrise.example.com",
  "operatingLocation": "Maharashtra",
  "rating": 4.2,
  "safetyRating": 4.6
}
```

### Vendor Document Endpoints

| Method | Path | Description | Status |
|---|---|---|---|
| `POST` | `/vendors/:id/documents` | Add a document to a vendor | 201 / 409 |
| `GET` | `/vendors/:id/documents` | List all documents for a vendor | 200 |
| `PATCH` | `/vendors/:id/documents/:docId` | Update a document (all fields except `documentType`) | 200 / 404 |
| `DELETE` | `/vendors/:id/documents/:docId` | Remove a document | 204 / 404 |

**Body fields for `POST /vendors/:id/documents`:**

| Field | Required | Type / allowed values | What it does |
|---|---|---|---|
| `documentType` | Yes | `TAX_REGISTRATION` \| `INSURANCE` \| `TRADE_LICENSE` \| `SAFETY_CERTIFICATE` \| `AGREEMENT` | One of five compliance document types. A vendor can hold at most ONE of each type - posting a duplicate type returns `409 CONFLICT`. |
| `documentNumber` | Yes | string | Reference number, metadata only. |
| `issuedDate` | No | ISO date string (`"2025-01-15"`) | Informational. |
| `expiryDate` | No | ISO date string | Drives two behaviors: an expired mandatory document disqualifies the vendor, and a `VALID` document expiring within 30 days triggers the near-expiry warning in the AI summary. |
| `status` | Yes | `VALID` \| `EXPIRED` \| `PENDING_VERIFICATION` | Only `VALID` documents count toward the compliance score (valid docs / 5) and satisfy mandatory-document checks. |

Which document types are *mandatory* depends on the requirement's `category` (see `mandatoryDocs.config.ts`); a `CRITICAL`-priority requirement additionally forces `SAFETY_CERTIFICATE` into the required list.

Example body:

```json
{
  "documentType": "SAFETY_CERTIFICATE",
  "documentNumber": "SC-2026-0042",
  "issuedDate": "2026-01-10",
  "expiryDate": "2027-01-10",
  "status": "VALID"
}
```

### Work Requirement Endpoints

| Method | Path | Description | Status |
|---|---|---|---|
| `POST` | `/work-requirements` | Create a work requirement (defaults to `OPEN`) | 201 |
| `GET` | `/work-requirements` | List requirements (filter by `status`, `category`, `priority`) | 200 |
| `GET` | `/work-requirements/:id` | Get requirement by ID | 200 / 404 |
| `PATCH` | `/work-requirements/:id` | Update requirement fields (any subset of the create fields) | 200 / 404 |
| `POST` | `/work-requirements/:id/assign` | Assign a vendor to the requirement | 200 / 409 |

All work-requirement responses include `assignedVendorName` alongside `assignedVendorId` (both `null` while unassigned).

**Body fields for `POST /work-requirements`:**

| Field | Required | Type / allowed values | What it does |
|---|---|---|---|
| `title` | Yes | string | Job name. Fed to the AI summary so it can anchor its explanation ("for the emergency bridge repair..."). |
| `category` | Yes | same five values as vendor `category` | Only vendors in this exact category are eligible. |
| `location` | Yes | string | Where the work is. Matched against vendor `operatingLocation` for the location score. |
| `estimatedValue` | Yes | positive number | Budget / contract value. Stored and returned, but not used by the recommendation engine. |
| `priority` | Yes | `LOW` \| `MEDIUM` \| `HIGH` \| `CRITICAL` | Selects the scoring weight profile (safety 0.25 → 0.40 and location 0.10 → 0.05 as priority rises) and, at `CRITICAL`, adds `SAFETY_CERTIFICATE` to the mandatory documents. |
| `expectedStartDate` | Yes | ISO date string | When work should begin. Informational. |

Example body:

```json
{
  "title": "Warehouse Foundation Repair",
  "category": "CIVIL_CONSTRUCTION",
  "location": "Maharashtra",
  "estimatedValue": 2500000,
  "priority": "HIGH",
  "expectedStartDate": "2026-09-01"
}
```

**Body for `POST /work-requirements/:id/assign`:**

```json
{ "vendorId": "<uuid of the vendor>" }
```

Assignment enforces three business rules, each returning `409 CONFLICT` if violated: the requirement must still be `OPEN` (no double assignment), a recommendation run must already exist for it, and the vendor must have been **eligible in the latest run**. On success the requirement flips to `ASSIGNED` with `assignedVendorId`, `assignedVendorName`, and `assignedAt` populated.

### Recommendation Endpoints

| Method | Path | Description | Status |
|---|---|---|---|
| `POST` | `/work-requirements/:id/recommendations` | Run recommendation engine against all vendors (no body) | 201 |
| `GET` | `/work-requirements/:id/recommendations` | Get latest persisted run (or all runs with `?all=true`) | 200 / 404 |

`POST` takes no body - just fire it at a requirement's id. The response contains:

| Response field | What it is |
|---|---|
| `runId`, `generatedAt` | Identity and timestamp of this persisted run. |
| `aiSummary` | Plain-language explanation of the result. |
| `aiSummarySource` | `"llm"` if an LLM wrote it, `"fallback"` if the deterministic template did (also the automatic result whenever the LLM call fails). |
| `ranked` | Top 5 eligible vendors: `vendorId`, `vendorName`, `totalScore`, `rank`, and the full `scoreBreakdown` (all four normalized factors plus the exact weights used). |
| `ineligible` | Every disqualified vendor with `vendorName` and a human-readable `disqualificationReason`. |

`GET` returns the same shape from the database (vendor names included); it returns `404` until at least one run has been triggered.

---

## 4. Recommendation Logic

The recommendation engine is **fully deterministic** — given the same data, it always produces the same output. It operates in two stages.

### Stage 1: Eligibility Filtering

For each vendor in the system, the following checks run **in order**:

1. **Category match** — Vendor's `category` must exactly match (case-insensitive) the work requirement's `category`. Failure reason: `"Category mismatch: vendor is X, requirement needs Y"`

2. **Active status** — Vendor's `currentStatus` must be `ACTIVE`. Failure reason: `"Vendor status is BLACKLISTED, not ACTIVE"`

3. **Mandatory document compliance** — Each work category has a defined set of required documents:

   | Category | Required Documents |
   |---|---|
   | CIVIL_CONSTRUCTION | TRADE_LICENSE, INSURANCE |
   | ELECTRICAL_INSTRUMENTATION | TRADE_LICENSE, INSURANCE, SAFETY_CERTIFICATE |
   | MECHANICAL_FABRICATION | TRADE_LICENSE, INSURANCE |
   | LOGISTICS_EQUIPMENT | INSURANCE |
   | HSE_COMPLIANCE_TESTING | SAFETY_CERTIFICATE, INSURANCE |

   **CRITICAL priority rule**: If the work requirement has priority `CRITICAL`, `SAFETY_CERTIFICATE` is always added to the mandatory set (union, not replacement).

   For each mandatory document type, the vendor must have a document row with status `VALID` or `PENDING_VERIFICATION`. Missing documents or `EXPIRED` status cause disqualification. All document issues are collected (not short-circuited) to give a comprehensive reason string.

**Important**: Location is deliberately **not** an eligibility filter — it is a scoring factor only (see Stage 2). This ensures an excellent non-local vendor is not hard-excluded from a critical job.

### Stage 2: Weighted Scoring (Eligible Vendors Only)

Four normalized factors (each 0–1) are computed:

| Factor | Formula |
|---|---|
| `ratingScore` | `vendor.rating / 5` |
| `safetyScore` | `vendor.safetyRating / 5` |
| `complianceScore` | `(count of VALID documents across all 5 document types) / 5` |
| `locationScore` | `1.0` if location matches (case-insensitive), `0.0` otherwise |

These are combined using **priority-dependent weights**:

| Priority | Rating | Safety | Compliance | Location |
|---|---|---|---|---|
| LOW, MEDIUM | 0.35 | 0.25 | 0.30 | **0.10** |
| HIGH, CRITICAL | 0.30 | **0.40** | 0.25 | 0.05 |

**Final score** = `round((ratingScore × w_rating + safetyScore × w_safety + complianceScore × w_compliance + locationScore × w_location) × 100, 1 decimal)`

Location carries deliberately little weight: it is a binary, exact-string signal (see Assumptions), which is too coarse to justify a large influence on ranking. Until location is modeled properly (structured fields, distance tiers), it acts as a mild local-vendor bonus only.

This weight shift creates meaningful behavior: under `CRITICAL` priority, safety gets more weight and location gets less, allowing a high-quality distant vendor to outrank a good local one.

### Ranking & Tie-Breaking

Eligible vendors are sorted by:
1. `totalScore` descending
2. `safetyRating` descending (tie-breaker)
3. `name` ascending alphabetically (final tie-breaker for determinism)

The **top 5** ranked vendors are returned in the primary response. All vendors (eligible and ineligible) are persisted as `RecommendationResult` rows for auditability.

### Worked Example

For a `CIVIL_CONSTRUCTION` requirement in `Maharashtra`:

| Vendor | Rating | Safety | Docs Valid | Location Match | MEDIUM Score | CRITICAL Score |
|---|---|---|---|---|---|---|
| Apex Civil Works | 4.5 | 4.0 | 5/5 | ✅ Maharashtra | **91.5** | **89.0** |
| Deccan Structures | 4.8 | 4.9 | 5/5 | ❌ Gujarat | **88.1** | **93.0** |

Under MEDIUM priority, Apex wins by 3.4 points on the strength of its location match. Under CRITICAL, **the ranking flips**: safety weight rises to 0.40 and location drops to 0.05, so Deccan's superior safety record (4.9 vs 4.0) outweighs its distance and it takes rank #1 by 4.0 points. The same algorithm produces a different winner depending on business urgency, and every step of that is visible in the persisted score breakdown.

---

## 5. AI Usage

The platform includes an **AI-assisted recommendation summary** feature, implemented using the Strategy pattern.

### Architecture

```
┌─────────────────────────────┐
│    Summarizer (interface)   │
│  summarize(input) → string  │
└──────────┬──────────────────┘
           │
     ┌─────┴──────┐
     │             │
┌────▼────┐  ┌────▼──────────┐
│  LLM    │  │  Fallback     │
│Summarizer│  │  Summarizer   │
│(API key) │  │(deterministic)│
└─────────┘  └───────────────┘
```

### Selection Logic

The choice is made **per request**, with graceful degradation:

- If `LLM_API_KEY` is set, the `LLMSummarizer` is used.
- If it is unset, **or the LLM call fails for any reason** (bad key, network error, timeout), the deterministic `FallbackSummarizer` runs instead — the request never fails because of the LLM.
- The `POST .../recommendations` response includes `aiSummarySource: "llm" | "fallback"` so it is always visible which engine produced the text.

### LLM Summarizer (Bring Your Own Provider)

The LLM path speaks the OpenAI-compatible chat-completions protocol, so **any compatible provider works** — Gemini (default), OpenAI, Anthropic, Groq, OpenRouter, local Ollama, etc.:

```bash
LLM_API_KEY="<your key>"                                                  # enables the LLM path
LLM_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai/"  # default: Gemini
LLM_MODEL="gemini-flash-latest"                                              # default
```

Swapping providers is two env-var edits, zero code. The model receives the full run result (score breakdowns, disqualification reasons, warnings) and is instructed to explain the ranking in 3–5 plain-language sentences without ever contradicting it — the ranking is computed deterministically first and is final.

### Input Contract

Both implementations receive identical structured data:

```typescript
{
  requirementTitle: string,
  requirementPriority: string,
  requirementCategory: string,
  requirementLocation: string,
  rankedVendors: [{ name, rank, totalScore, breakdown }],           // top 5
  ineligibleVendors: [{ name, reason }],                            // disqualified before scoring
  nearExpiryWarnings: [{ vendorName, documentType, expiryDate }]    // VALID docs expiring within 30 days
}
```

### Fallback Summarizer (Deterministic)

When no LLM API key is configured (or the LLM call fails), a deterministic template generates a human-readable summary from the real computed data: the winner and the factors that drove its score, the runner-up and where it lost ground, how many vendors were disqualified, and a single compact trailing clause for near-expiry documents (aggregated per vendor, so it never dominates the summary):

- Output example: `"Deccan Structures ranks #1 for Emergency Bridge Repair (CRITICAL priority) with a score of 93, driven mainly by safety record and overall rating. Apex Civil Works follows at 89, 4 points behind, losing ground mostly on safety record. 10 vendor(s) were disqualified during eligibility checks before scoring."`

This ensures the AI feature is always functional and explainable, even without external API dependencies.

### Near-Expiry Warnings

The system automatically flags any `VALID` document among the top 5 ranked vendors that expires within **30 days** from the current date. This proactive compliance warning is surfaced in the AI summary.

---

## 6. Assumptions

1. **Single category per vendor** — Each vendor operates in one category. Real-world vendors may be multi-skilled; this simplification keeps matching logic straightforward within the project scope.

2. **Single operating location per vendor** — Vendors have one location string. Multi-region operations are deferred.

3. **No authentication or user model** — The platform is an internal tool; auth is out of scope per the assignment brief.

4. **Category and location matching is exact-string** (case-insensitive, trimmed whitespace) — no fuzzy, partial, or hierarchical matching. `"Maharashtra"` matches `"Maharashtra"` but not `"Western Maharashtra"`.

5. **One document per (vendor, documentType)** — The unique composite constraint means a vendor can have at most one `INSURANCE` document, one `TRADE_LICENSE`, etc. Document version history is not tracked.

6. **Metadata only for documents** — As specified, actual file upload is not implemented. Documents store type, number, dates, and status.

7. **12 seed vendors and 4 work requirements** — The seed data is designed to exercise all edge cases: blacklisted vendors with perfect scores, expired documents, near-expiry warnings, single-vendor shortlists, and priority-weight shifts.

---

## 7. Trade-offs

1. **SQLite instead of PostgreSQL** — The spec preferred PostgreSQL (Neon/Supabase/Railway), but to ensure the project is fully self-contained and runs on any machine without requiring cloud credentials, Docker, or external database setup, SQLite was chosen. The trade-off: no native enum support (validated in application layer via Zod), no `JSONB` (stored as stringified JSON), and no `timestamptz` (DateTime used directly). The Prisma schema can be switched to PostgreSQL by changing the `provider` and connection URL.

2. **Location as a scoring factor, not a hard filter** — Making location a Stage-1 eligibility filter **and** a Stage-2 scoring factor would create dead weight (all eligible vendors would have locationScore = 1.0, making that weight meaningless). By keeping it as scoring-only, the priority-based weight shift actually has a real effect on rankings.

3. **AI feature is explanatory only** — The AI summary is generated **after** deterministic scoring. It never influences ranking or eligibility. This ensures the recommendation logic remains fully auditable and reproducible regardless of the LLM provider's output.

4. **Persisting all vendors per run** — Each recommendation run persists results for **every** vendor (not just eligible ones). This costs more storage but enables full "why was vendor X excluded?" queries without re-running the algorithm.

5. **No pagination** — List endpoints return all matching records. Acceptable for an internal tool with bounded data (12 vendors, 4 requirements) but would need cursor-based pagination at scale.

6. **No soft deletes** — `DELETE` operations permanently remove records (with cascade for vendor documents). A production system would likely use soft deletes to maintain audit trails.

---

## 8. Setup & Testing

### Prerequisites

- Node.js 20+ installed
- npm installed

### Installation

```bash
cd v1
npm install
```

### Environment Setup

```bash
# Create your local .env from the template (sets DATABASE_URL for the local SQLite database)
cp .env.example .env
```

### Database Setup

```bash
# Push schema to create local SQLite database (dev.db)
npx prisma db push

# Generate Prisma Client
npx prisma generate

# Seed with test data (12 vendors + 4 work requirements)
npx tsx prisma/seed.ts
```

### Start the Server

```bash
npm run dev
```

The server starts at `http://localhost:3000`. Verify with:

```bash
curl http://localhost:3000/health
# → {"status":"ok"}
```

### Testing with Postman

1. Import `v1/postman/fieldnerve.postman_collection.json` into Postman.
2. Run the collection sequentially — test scripts automatically set environment variables (`vendorId`, `workReqId`, `docId`) between requests.

### Quick Smoke Test (curl)

```bash
# List all vendors
curl http://localhost:3000/vendors

# Get seeded work requirements
curl http://localhost:3000/work-requirements

# Run recommendations for the first work requirement (Highway Bridge Retrofit)
# Replace <id> with the actual ID from the GET response above
curl -X POST http://localhost:3000/work-requirements/<id>/recommendations
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Database connection string (default: `file:./dev.db`) |
| `PORT` | No | Server port (default: `3000`) |
| `LLM_API_KEY` | No | If set, enables LLM-backed AI summaries (falls back to the deterministic summarizer on any LLM error) |
| `LLM_BASE_URL` | No | OpenAI-compatible endpoint of any provider (default: Gemini's `https://generativelanguage.googleapis.com/v1beta/openai/`) |
| `LLM_MODEL` | No | Model name at the chosen provider (default: `gemini-flash-latest`) |
