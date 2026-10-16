"""Browser check for LeadPilot. Needs: Python Playwright with Chromium, the API running, the client built and served,
and an EMPTY database (the script imports the sample file and expects exact counts). See e2e/README.md."""
import os, re, sys
from playwright.sync_api import sync_playwright, expect

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.environ.get("LEADPILOT_URL", "http://localhost:4173")
SHOTS = os.path.join(HERE, "screenshots")
os.makedirs(SHOTS, exist_ok=True)
SAMPLE = os.path.join(HERE, "..", "client", "public", "sample-leads.csv")
results, console_errors = [], []

def check(name, cond, extra=""):
    results.append((name, bool(cond), extra))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""))

def overflow(page):
    return page.evaluate("() => ({sw: document.documentElement.scrollWidth, iw: window.innerWidth})")

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1280, "height": 900}, accept_downloads=True)
    page = ctx.new_page()
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append(str(e)))

    # 1. Empty dashboard
    page.goto(BASE); page.wait_for_selector("h1")
    page.get_by_role("heading", name="No leads yet").wait_for(timeout=10000)
    check("empty state shown before any import", page.get_by_role("heading", name="No leads yet").is_visible())
    page.screenshot(path=SHOTS + "/01-empty-desktop.png")

    # 2. Import flow
    page.get_by_role("link", name="Import").first.click()
    page.set_input_files("#csv-input", SAMPLE)
    page.get_by_role("button", name="Import leads").click()
    page.wait_for_selector("text=Imported 12 leads")
    txt = page.inner_text("#result-title ~ dl")
    nums = re.findall(r"\n?(\d[\d,]*)\n", "\n" + txt + "\n")
    check("import summary shows 12 imported / 15 rows", "15" in txt and "12" in txt, txt.replace("\n", " | ")[:150])
    check("issue report lists 3 rows", page.locator(".issues-table tbody tr").count() == 3)
    check("duplicate and rejected reasons are explained",
          page.locator(".issues-table").inner_text().count("Duplicate") >= 2 and "Company name is missing" in page.inner_text(".issues-table"))
    page.screenshot(path=SHOTS + "/02-import-result-desktop.png", full_page=True)
    with page.expect_download() as dl:
        page.get_by_role("button", name="Download report").click()
    report = open(dl.value.path()).read()
    check("issue report downloads as CSV", report.startswith('"Row","Company","Result","Reason"') and report.count("\n") == 4, f"{report.count(chr(10))} lines")

    # 3. Dashboard with data
    page.get_by_role("link", name="Dashboard").first.click()
    page.wait_for_selector(".strip")
    strip = page.inner_text(".strip")
    check("dashboard shows 12 unique leads", re.search(r"Unique leads\s*\n?\s*12", strip) is not None, strip.replace("\n", " ")[:120])
    check("dashboard shows duplicates caught = 2", re.search(r"Duplicates caught\s*\n?\s*2", strip) is not None)
    page.screenshot(path=SHOTS + "/03-dashboard-desktop.png", full_page=True)

    # 4. Strip shortcut -> filtered leads
    page.get_by_role("button", name="score 70 or more").click()
    page.wait_for_selector(".lead-table tbody tr")
    check("high-priority shortcut filters the table", page.locator(".lead-table tbody tr").count() == 9, f"{page.locator('.lead-table tbody tr').count()} rows")
    check("priority filter reflects shortcut", page.locator("#filter-priority").input_value() == "high")

    # 5. Leads: clear, search, filters
    page.get_by_role("button", name="Clear filters").click()
    page.wait_for_function("document.querySelectorAll('.lead-table tbody tr').length === 12")
    check("12 leads listed after clearing", True)
    scores = [int(s) for s in page.locator(".lead-table tbody .meter-value").all_inner_texts()]
    check("default sort is score descending", scores == sorted(scores, reverse=True), str(scores))
    page.fill("#filter-search", "apex")
    page.wait_for_function("document.querySelectorAll('.lead-table tbody tr').length === 2")
    check("search 'apex' returns 2 leads", True)
    page.fill("#filter-search", "zzzz")
    page.wait_for_selector("text=No leads match these filters")
    check("empty search shows a helpful empty state", True)
    page.get_by_role("button", name="Clear filters").first.click()
    page.select_option("#filter-priority", "low")
    page.wait_for_function("document.querySelectorAll('.lead-table tbody tr').length === 1")
    check("priority=low returns 1 lead (provisional)", "Provisional" in page.inner_text(".lead-table tbody"))
    page.get_by_role("button", name="Clear filters").first.click()
    page.wait_for_function("document.querySelectorAll('.lead-table tbody tr').length === 12")

    # 6. Status update persists
    sel = page.get_by_label("Status for Harbor Dental Group")
    sel.select_option("contacted")
    page.wait_for_selector("text=Harbor Dental Group marked contacted.")
    check("status change shows confirmation toast", True)
    page.reload(); page.wait_for_selector(".lead-table tbody tr")
    check("status persists after reload", page.get_by_label("Status for Harbor Dental Group").input_value() == "contacted")

    # 7. Detail panel
    page.get_by_role("button", name="Quartz Manufacturing", exact=True).click()
    page.wait_for_selector(".detail-panel .why-list")
    detail = page.inner_text(".detail-panel")
    check("detail panel explains the score", "How this score was calculated" in detail and "Data completeness" in detail)
    check("detail panel shows the invalid-email warning", "not valid and was not saved" in detail)
    page.screenshot(path=SHOTS + "/04-detail-desktop.png")
    page.keyboard.press("Escape")

    # 8. Export respects filters
    page.select_option("#filter-priority", "low")
    page.wait_for_function("document.querySelectorAll('.lead-table tbody tr').length === 1")
    with page.expect_download() as dl:
        page.get_by_role("button", name="Export CSV").click()
    exp = open(dl.value.path()).read().strip().split("\n")
    check("export contains header + 1 filtered row", len(exp) == 2 and "Orchid Software" in exp[1], f"{len(exp)} lines")
    page.get_by_role("button", name="Clear filters").first.click()

    # 9. Import validation errors
    page.get_by_role("link", name="Import").first.click()
    page.set_input_files("#csv-input", {"name": "notes.txt", "mimeType": "text/plain", "buffer": b"hi"})
    check("non-CSV is rejected in the browser", page.get_by_text("is not a CSV file").is_visible())
    page.set_input_files("#csv-input", {"name": "bad.csv", "mimeType": "text/csv", "buffer": b"Website,Industry\nacme.example,Software\n"})
    page.get_by_role("button", name="Import leads").click()
    page.wait_for_selector("text=The file was not imported")
    check("missing company column explains how to fix it", "Add a column headed" in page.inner_text("[role=alert]"))
    page.set_input_files("#csv-input", SAMPLE)
    page.get_by_role("button", name="Import leads").click()
    page.wait_for_selector("text=No new leads were imported")
    check("re-import adds nothing and reports duplicates", "14" in page.inner_text("#result-title ~ dl"))

    # 10. Responsive: no horizontal overflow, screenshots
    for w, h, tag in [(320, 700, "mobile320"), (768, 900, "tablet768"), (1280, 900, "desktop1280")]:
        page.set_viewport_size({"width": w, "height": h})
        for route in ["dashboard", "leads", "import"]:
            page.goto(f"{BASE}/#/{route}"); page.wait_for_selector("h1")
            if route == "leads": page.wait_for_selector(".lead-table tbody tr")
            page.wait_for_timeout(900)
            o = overflow(page)
            check(f"no horizontal overflow: {route} @ {w}px", o["sw"] <= o["iw"], f"scrollWidth {o['sw']} / viewport {o['iw']}")
            page.screenshot(path=fSHOTS + "/{tag}-{route}.png", full_page=(route != "import"))
    # open detail panel at 320
    page.set_viewport_size({"width": 320, "height": 700}); page.goto(f"{BASE}/#/leads"); page.wait_for_selector(".lead-table tbody tr")
    page.locator(".company-link").first.click(); page.wait_for_selector(".detail-panel .why-list"); page.wait_for_timeout(500)
    o = overflow(page); check("no horizontal overflow: detail panel @ 320px", o["sw"] <= o["iw"], f"{o}")
    page.screenshot(path=SHOTS + "/mobile320-detail.png")

    unexpected = [e for e in console_errors if "ERR_NAME_NOT_RESOLVED" not in e and "status of 422" not in e]
    check("no unexpected browser console errors", not unexpected, "; ".join(unexpected)[:300] or f"{len(console_errors)} expected: font requests that fail offline, and the deliberate bad-CSV test returns 422")
    browser.close()

fails = [r for r in results if not r[1]]
print(f"\n{len(results) - len(fails)}/{len(results)} checks passed")
sys.exit(1 if fails else 0)
