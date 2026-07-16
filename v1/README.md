# FieldNerve Vendor Recommendation Platform v1

## 1. Architecture

- **Language/Runtime:** Node.js (v20+), TypeScript (Strict Mode).
- **Web Framework:** Express.js for RESTful routing and middleware.
- **Validation:** Zod schemas to guarantee type-safety at the boundary and automatically return structured errors for 400 Bad Request.
- **ORM:** Prisma Client (v5.x).
- **Service Layer Pattern:** The application separates the HTTP layer (controllers) from business logic (services). The recommendation logic is further decoupled into pure functions (`filters.ts`, `scoring.ts`, etc.) that the `RecommendationService` coordinates.

## 2. DB Design

- **Engine:** Built to use SQLite for the local testing environment. The spec requested PostgreSQL (Neon), but to satisfy local self-contained constraints without relying on external cloud environments or Docker dependencies, Prisma was cleanly configured to use a local SQLite instance (`dev.db`). This necessitated removing Postgres-specific decorators (like `@db.Timestamptz` and `@db.Uuid`) and replacing native enums with strings at the schema level.
- **Schema Mapping:**
  - **Vendor** to **VendorDocument** is a 1-to-many relationship with a unique composite constraint on `[vendorId, documentType]`, guaranteeing at most one document of each type.
  - **WorkRequirement** defines the project scope.
  - **RecommendationRun** and **RecommendationResult** persist the point-in-time calculation to answer the "why" question for any vendor.

## 3. API Design

- **RESTful Entities:** Pluralized resources (`/vendors`, `/work-requirements`).
- **Response Format:** All successful data responses wrap the payload in `{ "data": ... }`.
- **Error Format:** Structured error envelopes `{ "error": { "message": string, "code": string } }` via a centralized Express error handler mapping `AppError` and `ZodError` to corresponding HTTP status codes (400, 404, 409, 500).
- **Sub-resources:** Vendor documents are strictly scoped to their parent `vendorId` (`/vendors/:id/documents`). Recommendations and Assignments follow the same pattern on `/work-requirements/:id/...`.

## 4. Recommendation Logic

- **Stage 1 (Eligibility):** Evaluates exact case-insensitive matches for `category` and active `VendorStatus`. Checks against a hardcoded list of `mandatoryDocsConfig` for the specific category. If the requirement priority is `CRITICAL`, `SAFETY_CERTIFICATE` is forcibly added to the required docs array. It collects all invalid or missing docs without short-circuiting to provide comprehensive disqualification reasons.
- **Stage 2 (Scoring):** Calculates 4 normalized factors (Rating, Safety, Compliance, Location). Evaluates the weighted sum dynamically based on `Priority`.
  - For `CRITICAL`/`HIGH`, Safety weight goes up, Location weight goes down.
  - Location carries deliberately little weight overall (0.10 for LOW/MEDIUM, 0.05 for HIGH/CRITICAL) because it is a coarse binary string match, not a real distance model.
  - Generates a final score rounded to 1 decimal.

## 5. AI Usage

- Built via the Strategy Pattern using a common `Summarizer` interface.
- **llmSummarizer**: Real LLM integration over the OpenAI-compatible chat-completions protocol — works with any compatible provider (Gemini by default, or OpenAI, Groq, OpenRouter, Ollama, ...). Configured via `LLM_API_KEY`, `LLM_BASE_URL`, and `LLM_MODEL`.
- **fallbackSummarizer**: Deterministically builds an explainable summary from the same interface data: the winner and its strongest weighted factors, the runner-up and where it lost ground, the disqualified count, and a compact per-vendor near-expiry clause.
- **Selection & degradation:** If `LLM_API_KEY` is set the LLM path runs; on any LLM failure (bad key, network, timeout) the request degrades to the fallback instead of erroring. The response's `aiSummarySource` field (`"llm"` or `"fallback"`) shows which engine produced the text.

## 6. Assumptions & Trade-offs

1. **SQLite over PostgreSQL:** Due to constrained local environments in the sandbox, SQLite was favored to guarantee the application works end-to-end flawlessly locally without external DB connection issues.
2. **Single Skills & Locations:** Exact match on strings for Categories and Locations. Vendors are assumed to have a single region of operation.
3. **No Auth:** Left out per instruction scope.
4. **Score Determinism:** Fallbacks sort eligible vendors by totalScore, then safetyRating, then alphabetically by name to avoid non-deterministic rankings in tests.

## 7. How to Test

### Setup

1. Open a terminal in this `v1` folder:
   ```bash
   cd v1
   ```
2. Create your local environment file from the template (sets `DATABASE_URL` for the local SQLite database):
   ```bash
   cp .env.example .env
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Push the Prisma schema to create the local SQLite database (`dev.db`):
   ```bash
   npx prisma db push
   ```
5. Generate the Prisma Client:
   ```bash
   npx prisma generate
   ```
6. Seed the database with exact vendors and work requirements from the specification:
   ```bash
   npm run seed
   ```

### Running the Server

Start the development server (runs on `http://localhost:3000`):

```bash
npm run dev
```

*(Note: Ensure you leave this terminal open while testing the API)*

### API Testing (Postman)

1. Open **Postman**.
2. Import the collection provided at: `postman/fieldnerve.postman_collection.json`.
3. Open the imported **FieldNerve** collection.
4. Run the requests manually or use the **Collection Runner** to run them top-to-bottom sequentially.
   - *Note: The requests utilize environment variables (like `vendorId` and `workReqId`) which are automatically set during the collection run via test scripts.*
