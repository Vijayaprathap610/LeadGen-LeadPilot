# Two-minute demo script

Use an empty database and `client/public/sample-leads.csv`. Show only what is implemented.

**0:00-0:20 The problem.** "Lead lists arrive with duplicates, missing websites and unusable values. LeadPilot cleans a CSV,
ranks the leads, and explains every decision." Show the empty dashboard.

**0:20-0:45 Import.** Open Import, choose the sample file, click Import leads. Point at the summary: 15 rows, 12 imported,
2 duplicates, 1 rejected, 6 need review. Scroll the report: a duplicate caught by website domain, one by company name,
and a row rejected for a missing company name. Click Download report.

**0:45-1:15 Quality and priority.** Open the dashboard: priority mix, "Need review", duplicates caught. Click the High
priority number to land on the filtered table. Clear filters. Show a score meter and its two ticks (the medium and high
cut-offs), then open Quartz Manufacturing: the weighted breakdown and the invalid-email warning. Open Orchid Software to
show a provisional score. State that scoring is rule-based, not machine learning.

**1:15-1:40 Working the list.** Search "apex" (two companies, different domains, kept separate). Filter to Low priority.
Change a status and show the confirmation. Click Export CSV and open the file.

**1:40-2:00 How it is built and why it matters.** React with React Bootstrap on an Express and MongoDB API; CSV parsing,
validation and de-duplication on the server; indexed, paginated queries; automated unit, API and browser tests. Close on
the business value: less time on repeat or thin records, more on leads worth calling. Do not claim deployment, real-MongoDB
test results or scoring accuracy.
