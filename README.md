# Records Request Helper

A free, private web app that tells a veteran or family member exactly how to request a military
personnel file from the National Archives, kept correct by GitLab Duo agents that ship, monitor and
fix it with no person in the loop.

## The problem

The National Personnel Records Center in St. Louis holds millions of military personnel files.
Families need them for burial honors, VA benefits, replacement medals and family history, and
requests stall on avoidable mistakes:

- **Who may ask.** A veteran or next of kin gets the file free. Anyone else gets only limited
  information until the record becomes archival, 62 years after the veteran left service.
- **What it costs.** Archival records cost $25 for five pages or less and $70 for six or more.
- **The 1973 fire.** It destroyed an estimated 16 to 18 million files: about 80% of Army records
  for discharges from November 1, 1912 to January 1, 1960, and about 75% of Air Force records for discharges from September 25, 1947 to
  January 1, 1964 (surnames after "Hubbard, James E."). Those requests need extra detail so the
  Archives can rebuild the file.

The rules live on several archives.gov pages, and they change. A helper that is wrong is worse than
none, so the hard part is not the app. It is keeping the app true after the code is written.

## What it does

The visitor answers four questions (who is asking, branch, separation date, optional name). The app
returns whether the file is open to them, the fee, archival status, whether the 1973 fire likely
touched it, what to gather, where to send it, and a ready-to-sign cover letter. Everything runs in
the browser. There is no server, no tracking and no storage of what anyone types.

## Life after code: hands-off

Two custom GitLab Duo flows and a nine-stage pipeline take a change from an issue to production and
keep production honest afterwards.

```
issue created ─► Issue-to-MR: scope_check ─► builder (branch, change, tests, signed-off commit, MR)
                                                    │
                    merge request pipeline ◄────────┘
   verify ─ secure ─ configure ─ govern ─ package ─ review app ─ smoke ─ SCI report
                    │                                     │
              failed ▼                              passed ▼
   Pipeline Medic: fixer pushes a fix         Pipeline Medic: gatekeeper reviews,
   (two tries, then needs-human)              posts carbon line, merges
                                                    │
                    main pipeline ◄─────────────────┘
          package ─ Pages deploy ─ smoke ─ release ─ SCI report
                    │                                     │
              failed ▼                              passed ▼
   Pipeline Medic: incident opens an issue    Pipeline Medic: reporter posts
   (which starts Issue-to-MR again)           "Live in production" on the issue

daily schedule: smoke test + National Archives source-drift check ─► incident on failure
```

The loop closes on itself. When the National Archives changes a fee or a phrase the rules depend
on, the daily `source-drift` job fails, Pipeline Medic opens an issue quoting the old and new NARA
wording, Issue-to-MR updates `config/facts.json` and the tests, the gatekeeper merges, and the
reporter confirms the fix is live. Nobody touches it.

| Stage | Automation |
| --- | --- |
| Plan | `scope_check` agent triages each issue and declines anything unsafe for an agent |
| Create | `builder` agent implements, tests and opens a signed-off merge request |
| Verify | lint, unit tests, accessibility audit, review app smoke test |
| Secure | GitLab SAST and secret detection, then `security-gate` blocks High and Critical findings |
| Configure | flag and facts validation |
| Govern | MIT, DCO, issue-link, sourced-facts and credential policy; gatekeeper agent review |
| Package | static bundle to the generic package registry |
| Release | tagged release with notes; release summary posted on the issue |
| Deploy | review app per merge request, GitLab Pages for production |
| Monitor | production smoke test and NARA source-drift check daily; failures become issues |

## Carbon: measured, then cut

Every pipeline ends with an `sci` job that reports its Software Carbon Intensity using the Green
Software Foundation formula (ISO/IEC 21031:2024):

SCI = ((E × I) + M) per R, with R = one pipeline run.

- **E**: runner energy from each job's measured duration, using Cloud Carbon Footprint coefficients
  for a 2 vCPU, 8 GB GitLab-hosted Linux runner (CPU 0.71 to 4.26 W per vCPU at 50% load, memory
  0.000392 kWh per GB-hour, PUE 1.1).
- **I**: 576 gCO2e/kWh, Google's published grid intensity for us-east1, where GitLab's hosted
  runners run.
- **M**: embodied emissions, 1,000 kgCO2e per server over four years, shared by vCPU.

Every job carries `rules:changes`, so a merge request that only edits documentation skips tests,
scanners, builds and deploys. The `sci` job compares what ran with a run-everything pipeline of the
same type and reports the grams and percent saved. The gatekeeper puts that line on every merge
request and the reporter puts it on every closed issue. Constants and sources are in
`config/sci.json`; the method is in `scripts/ci/sci.mjs`.

The app itself is a static bundle of about 20 KB with no framework, no server and no third-party
requests, so a visit costs one small page load.

## Repository

| Path | What it is |
| --- | --- |
| `src/rules.js` | Decision logic, pure functions |
| `config/facts.json` | Every fact the rules use, with the archives.gov pages and phrases they come from |
| `public/` | The web page |
| `.gitlab-ci.yml` | The pipeline |
| `scripts/ci/` | One small script per gate |
| `.gitlab/duo/flows/` | The Issue-to-MR and Pipeline Medic flow definitions |
| `.gitlab/duo/mr-review-instructions.yaml` | Review standards for Duo code review |
| `AGENTS.md`, `skills/` | Instructions and skills the agents load |
| `docs/setup.md` | Turning on the flows and triggers |

## Run it locally

Requires Node.js 20 or later. No packages to install.

```sh
npm test          # unit tests
npm run check     # lint, tests, accessibility, config checks
npm run build     # assemble dist/
npx serve dist    # or any static file server
```

## Accuracy

The app explains public National Archives guidance. It is not legal advice and is not affiliated
with the National Archives. Sources:

- https://www.archives.gov/veterans/military-service-records
- https://www.archives.gov/personnel-records-center/ompf-access-public
- https://www.archives.gov/personnel-records-center/fire-1973
- https://www.archives.gov/veterans/military-service-records/standard-form-180.html

## License

MIT. Contributions are accepted under the Developer Certificate of Origin 1.1; sign off every
commit with `git commit -s`.
