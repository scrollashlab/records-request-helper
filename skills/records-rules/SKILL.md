---
name: records-rules
description: How to change who-can-request, fee, fire-risk or cover-letter logic in src/rules.js and the facts in config/facts.json without breaking accuracy.
---

## Changing records rules

The app's answers must match what the National Archives publishes. Follow these steps:

1. Find the archives.gov page that states the rule. Main sources:
   - Request process and who may ask: https://www.archives.gov/veterans/military-service-records
   - Archival (public) records, 62 years after separation: https://www.archives.gov/personnel-records-center/ompf-access-public
   - The 1973 fire: https://www.archives.gov/personnel-records-center/fire-1973
   - Form SF-180 and next-of-kin definition: https://www.archives.gov/veterans/military-service-records/standard-form-180.html
2. Put the fact in `config/facts.json`, set `lastChecked` to today's date and bump `version` (`YYYY.MM.DD`).
   `src/rules.js` reads facts; never hard-code a number or year in the rules.
3. Add or update a test in `test/rules.test.js` that pins the new behavior, including the edge years
   (for example the exact 62-year boundary and the fire's affected separation-date ranges).
4. If the change alters text the user sees, keep sentences short and avoid jargon.
5. Add the exact phrase you relied on to that page's `mustContain` list under `sources` in `config/facts.json`,
   so the daily drift check notices if NARA changes it.
