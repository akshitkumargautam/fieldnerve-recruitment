# FieldNerve — Intelligent Vendor Recommendation Platform

An internal backend platform that helps operations teams maintain vendor/contractor data and receive **deterministic, explainable** recommendations for upcoming work across industrial and EPC sectors (construction, railways, mining, oil & gas, power & utility).

---

## Table of Contents

1. [Project Architecture](#1-project-architecture)
2. [Database Design](#2-database-design)
3. [API Design](#3-api-design)
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
├── .env                         # DATABASE_URL for local SQLite
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

## 3. API Design

All endpoints follow RESTful conventions with consistent response envelopes.

### Vendor Endpoints

| Method | Path | Description | Status |
|---|---|---|---|
| `POST` | `/vendors` | Create a new vendor | 201 |
| `GET` | `/vendors` | List vendors (filter by `category`, `vendorType`, `currentStatus`, `operatingLocation`) | 200 |
| `GET` | `/vendors/:id` | Get vendor by ID (includes nested `documents`) | 200 / 404 |
| `PATCH` | `/vendors/:id` | Update vendor fields | 200 / 404 |
| `DELETE` | `/vendors/:id` | Delete vendor (cascades to documents) | 204 / 404 |

### Vendor Document Endpoints

| Method | Path | Description | Status |
|---|---|---|---|
| `POST` | `/vendors/:id/documents` | Add a document to a vendor | 201 / 409 |
| `GET` | `/vendors/:id/documents` | List all documents for a vendor | 200 |
| `PATCH` | `/vendors/:id/documents/:docId` | Update a document | 200 / 404 |
| `DELETE` | `/vendors/:id/documents/:docId` | Remove a document | 204 / 404 |

### Work Requirement Endpoints

| Method | Path | Description | Status |
|---|---|---|---|
| `POST` | `/work-requirements` | Create a work requirement (defaults to `OPEN`) | 201 |
| `GET` | `/work-requirements` | List requirements (filter by `status`, `category`, `priority`) | 200 |
| `GET` | `/work-requirements/:id` | Get requirement by ID | 200 / 404 |
| `PATCH` | `/work-requirements/:id` | Update requirement fields | 200 / 404 |
| `POST` | `/work-requirements/:id/assign` | Assign a vendor to the requirement | 200 / 409 |

### Recommendation Endpoints

| Method | Path | Description | Status |
|---|---|---|---|
| `POST` | `/work-requirements/:id/recommendations` | Run recommendation engine against all vendors | 201 |
| `GET` | `/work-requirements/:id/recommendations` | Get latest recommendation (or all with `?all=true`) | 200 / 404 |

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
| LOW, MEDIUM | 0.25 | 0.20 | 0.25 | **0.30** |
| HIGH, CRITICAL | 0.25 | **0.35** | 0.25 | 0.15 |

**Final score** = `round((ratingScore × w_rating + safetyScore × w_safety + complianceScore × w_compliance + locationScore × w_location) × 100, 1 decimal)`

This weight shift creates meaningful behavior: under `CRITICAL` priority, safety gets more weight and location gets less, allowing a high-quality distant vendor to compete with a mediocre local one.

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
| Apex Civil Works | 4.5 | 4.0 | 5/5 | ✅ Maharashtra | **93.5** | **90.5** |
| Deccan Structures | 4.8 | 4.9 | 5/5 | ❌ Gujarat | **68.6** | **83.3** |

Under MEDIUM priority, the gap is 24.9 points. Under CRITICAL, it narrows to 7.2 points — demonstrating that the priority-weight mechanism meaningfully impacts ranking without flipping the winner in this scenario.

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

```typescript
const summarizer = process.env.LLM_API_KEY
  ? new LLMSummarizer()
  : new FallbackSummarizer();
```

This decision is made once at module load, not per-request.

### Input Contract

Both implementations receive identical structured data:

```typescript
{
  requirementTitle: string,
  requirementPriority: string,
  rankedVendors: [{ name, rank, totalScore, breakdown }],  // top 5
  nearExpiryWarnings: [{ vendorName, documentType, expiryDate }]  // VALID docs expiring within 30 days
}
```

### Fallback Summarizer (Deterministic)

When no LLM API key is configured, a deterministic template generates human-readable summaries referencing real computed data:

- Output example: `"Apex Civil Works ranks #1 with a score of 93.5. Note: PowerGrid Systems's SAFETY_CERTIFICATE expires on 2026-08-03."`

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
| `LLM_API_KEY` | No | If set, enables LLM-backed AI summaries; otherwise uses deterministic fallback |
