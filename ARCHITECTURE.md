# LeadPilot architecture

Status key: everything below describes what is implemented unless it sits under **Not implemented**.

## Overview

```
Browser (React SPA, hash routing)
   |  Axios, JSON + multipart, CORS allow-list
   v
Express API  ->  routes -> controllers -> services -> Mongoose models  ->  MongoDB
   |                         |
   |                         +-- pure logic (parse, normalize, score) with no database access
   +-- helmet, CORS, rate limits, upload limits, centralized error handler
```

The frontend and backend are separate packages (`client/`, `server/`) with no shared code. The browser only knows the
API URL (`VITE_API_URL`, public). Secrets exist only in `server/.env`.

## Backend (`server/`)

| Folder | Responsibility |
|---|---|
| `config/` | `env.js` reads and validates environment variables (fails fast on bad values); `db.js` connects |
| `routes/` | URL to controller mapping. Fixed paths (`/export`, `/import`, `/rescore`) are registered before `/:id` |
| `controllers/` | HTTP concerns only: validate ids and bodies, call services or models, shape responses |
| `services/` | `csvParser` (file-level parsing and header mapping), `leadBuilder` (row validation, normalization, warnings, scoring), `importService` (in-file and database de-duplication, inserts), `scoring`, `leadQuery` (query-string validation to Mongo filter and sort) |
| `models/` | `Lead`, `ImportBatch` |
| `middleware/` | `errorHandler` (maps errors to statuses), `requireDb` (503 when disconnected), `upload` (multer, memory storage) |
| `utils/` | `normalize` (names, domains, sizes, revenue, email), `ApiError` |
| `tests/` | Vitest: unit, no-database and database-backed API suites |

`app.js` exports `createApp(config)` so tests can build an app with any configuration; `server.js` connects, listens and
handles shutdown signals. Unhandled promise rejections are logged and terminate the process.

## Data flow: CSV import

1. **Upload:** multer receives one `.csv` field into memory, enforcing the size limit. Nothing is written to disk.
2. **Parse (`csvParser`):** reject empty, binary or malformed files; detect the delimiter; map headers to canonical fields;
   reject a missing company column (422) and files over the row limit (413).
3. **Build (`leadBuilder`), per row:** clean text; reject rows with no company name or over-long values; normalize name and
   domain; collect data-quality warnings; compute the `dedupeKey`; score.
4. **De-duplicate in file:** first occurrence of a key wins; later ones become reported issues.
5. **De-duplicate against the database:** look up keys in chunks of 1,000; matches become reported issues and the stored
   record is left untouched.
6. **Insert:** unordered `insertMany` in chunks of 500. If another import creates the same key concurrently, the unique
   index rejects it (error code 11000) and it is reported as a duplicate while the other inserts succeed.
7. **Record and respond:** save an `ImportBatch` with the counts and return the summary plus up to 1,000 issues.

Import is **not atomic** for the whole file. If the database fails partway through, earlier chunks remain stored; re-running
the same file is safe because duplicates are detected.

## Database schema

`leads`

| Field | Notes |
|---|---|
| `companyName` (required, 200), `normalizedCompanyName` | Display and normalized forms |
| `website`, `normalizedDomain` | Domain is `null` when absent or unparseable |
| `industry`, `location`, `companySize`, `revenueRange`, `contactName`, `contactEmail`, `source` | Optional; omitted when the CSV has no value. Raw text is kept, parsed values are not stored |
| `dedupeKey` (required, **unique**) | `d:<domain>` or `n:<normalized name>` |
| `score` (0-100), `priority`, `provisional`, `scoreBreakdown[]` | Breakdown entries: criterion, label, points, max, detail |
| `status` | new, contacted, qualified, disqualified |
| `dataQualityWarnings[]`, `hasWarnings` | Warning code and message |
| `importBatchId`, `createdAt`, `updatedAt` | |

Indexes: unique `dedupeKey`; `{priority, score desc, _id}`; `{score desc, _id}`; `{status, score desc}`; `{hasWarnings}`;
`{normalizedDomain}`; `{normalizedCompanyName}`; `{importBatchId}`. The `_id` tie-breaker keeps pagination stable.

`importbatches`: one document per import with counts (total, imported, duplicates, invalid, incomplete), file name and
ignored columns. The dashboard's duplicate and rejected totals are sums over these, because duplicates are not stored as
leads.

Why MongoDB: optional fields and embedded explanation arrays map naturally to documents, and queries are single-collection
filters, sorts and counts. Pagination is skip/limit with a stable sort. Database failures surface as HTTP 503 (connection
errors) or 500 (anything else, details hidden in production).

## Scoring

Rule-based, not machine learning. See the README for the rules. `scoreLead` is a pure function of the stored fields and
configuration, which is why `POST /api/leads/rescore` can recompute every lead without re-importing. Each result carries
its own explanation, which the UI shows verbatim.

## Frontend (`client/src/`)

| Folder | Responsibility |
|---|---|
| `pages/` | `DashboardPage`, `LeadsPage`, `ImportPage` |
| `components/` | Presentational pieces: `ScoreMeter`, `PriorityBadge`, `StatStrip`, `PriorityMix`, `LeadFilters`, `LeadTable`, `Pager`, `LeadDetail`, `ImportDropzone`, `ImportResult`, `ErrorAlert`, `EmptyState`, `ToastHost` |
| `hooks/` | `useLeads` (fetch with cancellation), `useStats`, `useDebounce`, `useHashRoute` |
| `services/api.js` | One Axios instance; converts every failure into a user-readable `ApiRequestError`, including errors hidden inside blob responses |
| `utils/` | CSV report building (formula-safe), downloads, formatting |

State is local React state plus two hooks; there is no state-management library. `App` owns the stats (refreshed after an
import or status change) and the shortcut from a dashboard number to a pre-filtered table. Hash routing avoids a router
dependency and needs no server rewrite rules. Every request has loading, error (with retry), empty and success (toast)
states.

Layout: a table on wide screens; below 768 px each row becomes a two-column block, so nothing scrolls sideways (checked at
320, 768 and 1280 px). The score meter draws the real thresholds as ticks. Motion is one meter-grow animation, disabled by
`prefers-reduced-motion`.

## Security

Implemented: helmet headers; CORS limited to `CLIENT_URL`; global and import-specific rate limits; upload size, type and
row limits; in-memory uploads; JSON body limit of 10 KB; validated ids, enums and pagination; escaped search input;
formula-neutralized CSV exports (cells beginning with `=`, `+`, `-`, `@`); no secrets in the client; internal error
details hidden when `NODE_ENV=production`.

Not implemented: authentication and authorization, per-user data, audit logging, CSRF protection (not needed without
cookies, but also untested), virus scanning of uploads. Installing common middleware does not make this production-secure.

## Performance

Implemented: indexes for the default list, priority and status filters; paging with a 100-row cap; a single-pass
aggregation for dashboard counts; streamed exports (no full-dataset buffering); debounced search and cancelled stale
requests; a gzip-friendly production build (JS about 112 KB gzipped, measured).

Not implemented: caching of any kind, load testing, or performance measurements of the API. Substring search scans the
collection and skip-based paging slows on deep pages.

## Hosting (proposed, not deployed)

Atlas for MongoDB, Render for the API, Vercel for the static client. See the README for the configuration.
