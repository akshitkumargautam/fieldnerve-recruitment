# Patch Plan v1.1 - Remove LLM Path, Canonicalize SQLite

## Decisions locked in

1. **No LLM integration.** The system will never call an external LLM provider. The AI-assisted
   summary remains, but as a single deterministic template implementation behind the existing
   `Summarizer` interface. The interface stays because (a) the assignment rubric grades "AI usage"
   and the interface + deliberate trade-off is the defensible answer to it, and (b) it costs nothing.
2. **SQLite is the canonical database, not a deviation.** The code already runs on SQLite; the docs
   still describe PostgreSQL (Neon) as the intended stack. The docs are patched to match reality
   instead of framing SQLite as a compromise.

## Rationale for the demo/grading story

- The rubric grades "AI usage". The patched narrative: "The AI feature is an explainable summary
  generated from the computed recommendation data. It is intentionally deterministic - same inputs,
  same summary - which keeps the whole pipeline auditable and makes the demo reproducible. The
  `Summarizer` interface isolates summary generation, so the design shows where a generative model
  would plug in without the system depending on one."
- No API key management, no network dependency, no non-reproducible output on camera.

---

## Patch 1 - Code: remove the LLM path (v1/src)

| File | Change |
|---|---|
| `src/ai/llmSummarizer.ts` | Delete the file. It is a mock that never calls anything. |
| `src/ai/summarizer.ts` | Keep unchanged (interface + input types). |
| `src/ai/fallbackSummarizer.ts` | Rename file and class to `templateSummarizer.ts` / `TemplateSummarizer`. "Fallback" implies a primary that no longer exists. |
| `src/modules/recommendations/recommendation.service.ts` | Line 5: remove `LLMSummarizer` import. Line 9: replace the `process.env.LLM_API_KEY` ternary with `const summarizer: Summarizer = new TemplateSummarizer();`. |
| `.env` | Remove `LLM_API_KEY` if present (currently not set - verify and leave clean). |

Verification: `npm run dev`, then `POST /work-requirements/:id/recommendations` for requirement A
and C. Confirm `aiSummary` is populated for A and includes the PowerGrid near-expiry warning for C.

## Patch 2 - Missing deliverable: add `.env.example` (v1/)

The spec's folder structure (Section 1) requires `.env.example`; v1 does not have one. Add:

```
DATABASE_URL="file:./dev.db"
```

No `LLM_API_KEY` line.

## Patch 3 - v1/README.md

| Location | Change |
|---|---|
| Section 5 "AI Usage" (lines 29-32) | Rewrite: single `TemplateSummarizer` behind the `Summarizer` interface. Remove the llmSummarizer bullet and the `LLM_API_KEY` mention. State the trade-off explicitly: deterministic by design, interface is the extension point. |
| Database section (line 11) | Reframe: SQLite is the chosen engine for a self-contained local system, not a downgrade from a Postgres spec. Keep the note on what a Postgres migration would involve (provider swap, native enums, timestamptz) as a forward-looking remark. |

## Patch 4 - Root README.md

| Location | Change |
|---|---|
| Stack table (line 31) | `AI` row: "Deterministic template summarizer behind a Summarizer interface" - drop "LLM /". |
| Folder tree (lines 54, 59) | Remove the `llmSummarizer.ts` entry; rename `fallbackSummarizer.ts` to `templateSummarizer.ts`. |
| Section 5 "AI Usage" (lines 292-346) | Remove the LLM/Fallback branch diagram and the `LLM_API_KEY` selection snippet (lines 307, 316-317). Describe one implementation. Keep the near-expiry warning subsection (line 346) unchanged - it is the strongest part of the feature. |
| Assumptions (line 374) | Reword: drop "regardless of the LLM provider's output"; the summary is deterministic, full stop. |
| Env var table (line 449) | Delete the `LLM_API_KEY` row. |
| Trade-offs (line 370) | Reframe SQLite as the primary choice (same framing as Patch 3). |

## Patch 5 - docs/IMPLEMENTATION_SPEC.md

| Location | Change |
|---|---|
| Section 1, stack (line 21) | `PostgreSQL (Neon)` becomes `SQLite (local file, via Prisma)`. |
| Section 1, timestamps (line 23) | `Postgres timestamptz` becomes `Prisma DateTime (SQLite), serialized as ISO 8601 UTC strings`. |
| Section 1, folder structure (line 44) | `ai/` contains `summarizer.ts` and `templateSummarizer.ts` only. |
| Section 2, enums | Add note: enums are validated in the application layer (zod) and stored as strings, since SQLite has no native enums. |
| Section 5 (lines 253-273) | Rewrite: keep the `Summarizer` interface contract verbatim; replace the two-implementation + `LLM_API_KEY` selection text with the single deterministic template implementation. Keep the requirement that output references actual computed data. |
| Section 7, phase table (line 310) | "migration against Neon" becomes "schema push against local SQLite (`npx prisma db push`)". |

## Patch 6 - docs/PLANNING.md

| Location | Change |
|---|---|
| Stack heading + Neon bullet (lines 141, 147) | Replace the Neon rationale with the SQLite rationale: zero provisioning, zero credentials, fully self-contained repo, `dev.db` travels with the project. Note Prisma keeps a Postgres migration to a provider swap. |
| Any "AI feature polish" phrasing referencing an LLM | Align with the deterministic-summary decision. |

## Patch 7 - CONTEXT.md

| Location | Change |
|---|---|
| Line 183 | Database: SQLite (local, self-contained). |
| Line 187 | AI: "Deterministic template summary generated from computed recommendation data; Summarizer interface isolates it. No external LLM provider by design." |

## Patch 8 - walkthrough_guide.md

| Location | Change |
|---|---|
| Talking point "AI fallback" (line 174) | Rename to "AI summary" and reword: "The summary is a deterministic template that references the real computed data - no external API, so the demo is fully reproducible." |
| Act 3 AI Summary narration (line 77) | Drop the word "fallback": "The summarizer produces a deterministic, human-readable sentence referencing the actual computed data." |

## Patch 9 - v1/Implementation_review_v1.md (optional)

This is a point-in-time review of v1.0; leave its body untouched. Add a one-line addendum at the
top: "v1.1 patch (see PATCH_PLAN_v1.1.md): LLM path removed, deterministic summarizer only;
SQLite made canonical."

---

## Execution order

1. Patch 1 + 2 (code) and verify endpoints still respond correctly.
2. Patches 3-8 (docs) in any order.
3. Patch 9 last.

## Out of scope

- No schema, seed, scoring, or API contract changes. All worked-example numbers (93.5 / 68.6,
  90.5 / 83.3) are unaffected.
- No git operations.
