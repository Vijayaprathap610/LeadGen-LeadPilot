# LeadPilot - Smart Lead Prioritization Tool

LeadPilot turns a messy CSV of companies into a ranked, de-duplicated lead list. It tells you which leads to contact
first, why each one scored the way it did, and which records need cleaning. It is a proposed enhancement concept for the
Caprae Capital Full-Stack Developer AI-Readiness Challenge, not a Caprae product.

> **Verification status (read this first).** Unit tests, API tests and a browser check all pass in the development
> environment, but the API tests ran against **FerretDB 1.24 (SQLite)**, a MongoDB-compatible server, **not real
> MongoDB**. The app has **not been deployed**. See [Testing](#testing) and [Known limitations](#known-limitations).

## Business problem

Lead lists exported from different tools contain duplicates, missing websites, inconsistent company names and values such
as "about fifty" in a size column. Sales teams waste time on repeat records and on leads with too little data to judge.
LeadPilot targets that step: import, clean, flag, rank, then export.

## What it does

- **CSV import and data quality:** parses CSV (comma, semicolon or tab delimited), maps common header names, validates,
  normalizes company names and website domains, and reports every row that was rejected or skipped, with a reason.
- **Duplicate detection:** within the file and against stored leads. Existing records are never changed.
- **Explainable prioritization:** a 0-100 rule-based score with configurable high/medium thresholds. Each lead shows a
  per-criterion breakdown. Scores based on too little data are labelled provisional.
- **Working view:** dashboard, searchable/filterable/sortable paginated table, status updates, per-lead detail,
  CSV export of the current filters. Responsive down to 320 px.

All dashboard figures are computed from stored data. Nothing is scraped, enriched or invented.

## Stack and verified versions

| Area | Packages (pinned exactly) |
|---|---|
| Frontend | React 19.3.0, Vite 8.3.4, @vitejs/plugin-react 6.1.1, React Bootstrap 2.10.10, Bootstrap 5.3.8, Axios 1.20.0, React Icons 5.7.0 |
| Backend | Node.js >= 22.12, Express 5.2.1, Mongoose 9.10.2, dotenv 18.0.4, cors 2.8.6, helmet 8.3.0, express-rate-limit 8.7.0, multer 2.4.0, csv-parse 7.0.3, csv-stringify 6.9.0 |
| Testing | Vitest 5.0.4, Supertest 7.3.0, React Testing Library 16.3.3, jest-dom 7.0.1, user-event 14.6.7, jsdom 30.1.1 |

Versions were checked against the npm registry on 2026-10-13. Both packages report 0 vulnerabilities from `npm audit`.
Choices that differ from "newest of everything": most pins are the newest release that was at least 14 days old; Vitest is
5.0.4 (1 day old) because 5.0.2 and 5.0.3 crash npm's resolver; Jest was not used because its dependency chain carries an
advisory with no patched release. Mongoose 9 is listed in the Mongoose compatibility table as compatible with MongoDB
server 6.x, 7.x and 8.x.

MongoDB is used because leads are documents with optional fields and nested explanation data, and the access patterns
are simple filters, sorts and counts.

## Quick start

Prerequisites: Node.js 22.12 or newer and a MongoDB server (local, Docker or Atlas).

```bash
# 1. API
cd server
cp .env.example .env        # edit MONGO_URI if needed
npm ci
npm run dev                 # http://localhost:5000

# 2. Web app (second terminal)
cd client
cp .env.example .env
npm ci
npm run dev                 # http://localhost:5173
```

Open http://localhost:5173, go to **Import**, and upload `client/public/sample-leads.csv` (also downloadable from the
empty dashboard). The sample uses fictional companies on reserved `.example` domains.

### MongoDB setup

- **Local install:** start `mongod` and keep the default `MONGO_URI=mongodb://127.0.0.1:27017/leadpilot`.
- **Docker:** `docker run -d -p 27017:27017 --name leadpilot-mongo mongo:7` (not run in the development environment).
- **Atlas:** create a cluster, add a database user and your IP to the access list, then set `MONGO_URI` to the
  `mongodb+srv://...` string in `server/.env`. Never commit that file.

The server exits with a clear message if it cannot connect at start-up. Indexes are created automatically on connect.

## Configuration

`server/.env` (see `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 5000 | API port |
| `NODE_ENV` | development | `production` hides internal error details |
| `MONGO_URI` | mongodb://127.0.0.1:27017/leadpilot | Database connection |
| `CLIENT_URL` | http://localhost:5173 | Comma-separated allowed browser origins (CORS) |
| `MAX_FILE_SIZE_MB` | 5 | Upload limit |
| `MAX_IMPORT_ROWS` | 20000 | Maximum data rows per import |
| `SCORE_HIGH_THRESHOLD` / `SCORE_MEDIUM_THRESHOLD` | 70 / 40 | Priority cut-offs (medium must be lower) |
| `TARGET_INDUSTRIES` | empty | Comma-separated keywords; leave empty to skip industry scoring |
| `RATE_LIMIT_MAX` / `IMPORT_RATE_LIMIT_MAX` | 300 / 20 | Requests per 15 minutes per IP |
| `TRUST_PROXY` | false | Set `true` behind one proxy (Render, Heroku) |

`client/.env`: `VITE_API_URL=http://localhost:5000/api`. This value is baked in at build time and is public.

After changing thresholds or target industries, call `POST /api/leads/rescore` to apply them to stored leads.

## CSV format

Only a company name column is required. Headers are matched loosely (case and punctuation ignored).

| Field | Accepted headers |
|---|---|
| Company name (required) | Company Name, Company, Name, Organization, Account Name, Business Name |
| Website | Website, Domain, URL, Company Website, Site |
| Industry | Industry, Sector, Vertical |
| Location | Location, Headquarters, HQ, Address, Region (or City + State + Country) |
| Size | Employees, Company Size, Employee Count, Headcount (examples: `51-200`, `1,000+`, `<10`, `2k-5k`) |
| Revenue | Revenue, Annual Revenue, Revenue Range (USD only: `$1M-$5M`, `500k`, `5M+`, `Under $1M`) |
| Contact | Contact Name (or First Name + Last Name), Contact Email |

Unrecognised columns are ignored and listed in the import summary.

## API

All responses are JSON: `{ "success": true, ... }` or `{ "success": false, "error": { "message", "details?" } }`.

| Method and path | Description |
|---|---|
| `GET /api/health` | 200 when the database is connected, otherwise 503 |
| `GET /api/leads` | Query: `page`, `limit` (1-100, default 25), `search` (company or domain), `priority` (high, medium, low), `status` (new, contacted, qualified, disqualified), `dataQuality` (complete, incomplete), `sort` (score_desc, score_asc, newest, oldest, name_asc). Returns `data` and `pagination` |
| `GET /api/leads/:id` | One lead with score breakdown and warnings |
| `POST /api/leads/import` | Multipart field `file` (.csv). 201 if any lead was imported, 200 if none; returns the import summary and per-row issues |
| `PATCH /api/leads/:id/status` | Body `{ "status": "contacted" }` |
| `GET /api/leads/export` | Streams a CSV of every lead matching the same filters (no pagination) |
| `POST /api/leads/rescore` | Recomputes scores and priorities with the current configuration |
| `GET /api/dashboard/stats` | Totals, priority and status counts, import totals, latest import, scoring settings |

Error statuses: 400 invalid input or unreadable file, 404 unknown lead, 413 file or row limit exceeded, 422 missing
company column, 429 rate limited, 503 database unavailable.

## Scoring methodology

Scoring is **rule-based and explainable. It is not a machine-learning model.** The score is
`round(100 x points earned / points available)`, counting only criteria that apply.

| Criterion | Max | Rule |
|---|---|---|
| Data completeness | 30 | 30 x (fields present / 7): website, industry, location, size, revenue, contact name, valid contact email |
| Company size | 25 | Midpoint of the stated range: up to 10 employees = 10, up to 50 = 20, up to 500 = 25, up to 5,000 = 15, above = 8. Unreadable or missing = 0 |
| Industry relevance | 25 | Only when `TARGET_INDUSTRIES` is set: full points if the industry text contains (or is contained in) a target keyword, otherwise 0. Skipped entirely otherwise |
| Revenue | 20 | Midpoint: up to $250K = 5, up to $1M = 10, up to $5M = 16, up to $100M = 20, above = 14. Unreadable or missing = 0 |

Priority: high at or above 70, medium at or above 40, otherwise low (configurable). A score is **provisional** when fewer
than two of {size, revenue, industry} could be read.

The bands are illustrative defaults and should be tuned to a real ideal customer profile. With no target industries set,
9 of the 12 sample leads score "high", so the default bands do not discriminate strongly.

## Duplicate detection

Every lead gets a `dedupeKey`: `d:<domain>` when a valid website domain exists (lower-cased, scheme, `www.`, path, query
and port removed), otherwise `n:<normalized company name>` (lower-cased, accents and punctuation removed, trailing legal
suffixes such as Inc, LLC, Ltd, GmbH removed). The key has a unique index, so a missing website can never collide with an
unrelated record. The first occurrence wins; later ones and any already-stored matches are reported with a reason.

Not detected: same company with and without a website, spelling variants, and the same business on different domains.

## Testing

```bash
cd server && npm test                                            # 85 tests; 21 database tests are skipped
cd server && MONGO_TEST_URI=mongodb://127.0.0.1:27017 npm test  # all 106; uses a throwaway database
cd client && npm test                                            # 35 tests, API mocked
```

`e2e/browser_check.py` is a separate Chromium check (33 assertions); see `e2e/README.md`.

Results from the development environment: server 106/106 (the 21 API tests ran against **FerretDB 1.24, not real
MongoDB**), client 35/35, browser check 33/33. **Not yet run:** the suite against real MongoDB or Atlas, any deployed
instance, and other browsers. FerretDB lacks `$facet`, `$avg` and multiple accumulators per `$group`, so dashboard queries
use one accumulator per group; this is valid MongoDB too but slightly less efficient.

## Deployment (not performed)

Suggested, not required: MongoDB Atlas for the database, Render for `server/`, Vercel for `client/`.

1. Atlas: create a cluster and user, allow the host's outbound addresses, copy the connection string.
2. Render web service, root `server`, build `npm ci`, start `npm start`, health check `/api/health`. Set `NODE_ENV=production`,
   `MONGO_URI`, `CLIENT_URL` (the exact Vercel origin, no trailing slash), `TRUST_PROXY=true`.
3. Vercel project, root `client`, set `VITE_API_URL` to the Render URL plus `/api`, then deploy. The app uses hash routing,
   so no rewrite rules are needed.
4. Verify: open the site, import the sample file, confirm counts, then check `/api/health`.

## Known limitations

- **No authentication or multi-user separation.** Anyone who can reach the API can read and change all leads.
- **Not verified on real MongoDB.** See Testing.
- **Import is not atomic across a whole file** (no multi-document transaction, so it works on standalone MongoDB).
  Each record is safe, existing records are never modified, and re-importing is harmless.
- **No caching.** Every request queries the database.
- **Search is a case-insensitive substring match** on company name and domain, which cannot use an index and scans the
  collection; pagination uses skip/limit, which slows on very deep pages. Neither has been load-tested.
- **Revenue is read as USD only**; other currencies are flagged as unreadable.
- **Fonts:** the UI loads Instrument Sans from Google Fonts and falls back to system fonts offline. It was reviewed
  only with the fallback font.
- Reviewed in Chromium only. Accessibility work (labels, roles, focus styles, a skip link, focus moved to the page after
  navigation) was verified through role and label queries in tests and visual review. **No keyboard walkthrough, contrast
  audit or screen-reader testing was done.**
- The hosted demo, the two-minute video and the written business answers are not part of this repository.
