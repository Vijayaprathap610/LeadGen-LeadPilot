# Browser check

`browser_check.py` drives the real app in Chromium: empty state, import, duplicate and rejected-row reports,
dashboard numbers, search, filters, status updates, the detail panel, export, upload errors, and horizontal-overflow
checks at 320, 768 and 1280 px. It is **not** part of `npm test`.

It expects an **empty database**, because it imports `client/public/sample-leads.csv` and asserts exact counts.

```bash
pip install playwright && playwright install chromium
# terminal 1: API (use a throwaway database)
cd server && MONGO_URI=mongodb://127.0.0.1:27017/leadpilot_e2e CLIENT_URL=http://localhost:4173 npm start
# terminal 2: client
cd client && npm run build && npx vite preview --port 4173 --strictPort
# terminal 3
python e2e/browser_check.py     # LEADPILOT_URL overrides http://localhost:4173
```

Screenshots are written to `e2e/screenshots/` (git-ignored).
