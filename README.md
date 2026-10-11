# Records Request Helper

A free web page that tells a veteran or a family member how to request a military personnel file
from the National Archives. Two GitLab Duo flows and a GitLab CI/CD pipeline keep the page correct
after release. They turn issues into merge requests, review and merge them, deploy, and open a new
issue when production or the National Archives guidance changes.

## The problem

The National Personnel Records Center in St. Louis holds the personnel files of millions of
veterans and receives about 4,000 to 5,000 requests a day. Families need these files for burial
honors, VA benefits, replacement medals and family history. Requests often stall on mistakes that
are easy to avoid:

- **Who may ask, and the fee.** A veteran or next of kin gets the file free. Anyone else gets only
  limited information until the record becomes archival, 62 years after the veteran left service.
  Archival records cost $25 for five pages or less and $70 for six or more.
- **The 1973 fire.** The fire destroyed an estimated 16 to 18 million files: about 80% of Army
  records for discharges from November 1, 1912 to January 1, 1960, and about 75% of Air Force
  records for discharges from September 25, 1947 to January 1, 1964, for surnames after
  "Hubbard, James E." Requests for those files need extra detail so the Archives can rebuild them.

These rules are spread across several archives.gov pages and they change over time. A guide with
out-of-date rules sends families the wrong way, so most of the work in this project goes into
keeping the facts current after release.

## What the page does

The visitor answers four questions: who is asking, the branch, the separation date and, if they
want, the name used in service. The page then shows:

- whether the file is open to them, and the fee
- the date the record becomes archival
- whether the 1973 fire likely affected the file
- what to gather and where to send it
- a cover letter to print and sign

Everything runs in the browser. There is no server or tracking, and nothing the visitor types is
stored or sent anywhere.

## How the automation works

1. Someone opens an issue, for example "Fee for archival records changed to $30."
2. The **Issue-to-MR** flow reads it. Its `scope_check` agent declines anything an agent should not
   change on its own, such as collecting visitor data or editing security jobs, and explains why on
   the issue.
3. Its `builder` agent creates a branch, makes the change, adds tests, runs `npm test` and
   `npm run check`, commits with a DCO sign-off and opens a merge request that says "Closes #N".
4. The merge request pipeline runs lint, unit tests, an accessibility audit, GitLab SAST, secret
   detection, a security gate, config and policy checks, a build, a review app and a smoke test of
   the review app.
5. The **Pipeline Medic** flow starts when the pipeline finishes.
   - If it failed, the `fixer` agent reads the job logs, pushes a fix and comments on the cause. After
     two failed attempts it labels the merge request `needs-human` and stops.
   - If it passed, the `gatekeeper` agent reviews the diff against the project rules, posts a summary
     with the carbon figures for the pipeline, and merges.
6. The `main` pipeline packages the site, deploys it to GitLab Pages, smoke-tests production and
   creates a release when the version changes. Pipeline Medic's `reporter` agent then posts a
   "Live in production" note on the closed issue.
7. A daily scheduled pipeline smoke-tests production and checks that the archives.gov pages still
   contain the exact phrases the rules depend on. If either check fails, Pipeline Medic's `incident`
   agent opens an issue quoting the old and new wording, and step 1 starts again.

When the National Archives changes a fee or a date, the daily check catches it, and the change is
made, reviewed, merged and deployed by the flows.

| DevSecOps stage | What runs |
| --- | --- |
| Plan | `scope_check` agent triages each issue |
| Create | `builder` agent writes the change and opens the merge request |
| Verify | lint, unit tests, accessibility audit, review app smoke test |
| Secure | GitLab SAST and secret detection; `security-gate` fails on High or Critical findings |
| Package | static bundle published to the generic package registry |
| Release | tagged release and a summary on the issue |
| Configure | flag and facts validation |
| Monitor | daily production smoke test and archives.gov drift check; failures become issues |
| Govern | license, DCO, issue-link, facts and credential checks; `gatekeeper` review |

Deploys go to a review app for each merge request and to GitLab Pages for production.

## Carbon reporting

Every pipeline ends with an `sci` job that reports its Software Carbon Intensity, using the Green
Software Foundation formula (ISO/IEC 21031:2024): SCI = ((E × I) + M) per R, where R is one
pipeline run.

- **E** is runner energy, from each job's measured duration and Cloud Carbon Footprint
  coefficients for a GitLab-hosted Linux runner with 2 vCPUs and 8 GB of memory (0.71 W idle to
  4.26 W at full load per vCPU, averaged at an assumed 50% load; 0.000392 kWh per GB-hour of memory;
  PUE 1.1).
- **I** is 576 gCO2e per kWh, Google's published grid intensity for us-east1, where GitLab's hosted
  runners run.
- **M** is embodied emissions: 1,000 kgCO2e per server over four years, shared by vCPU.

Each job has `rules:changes`, so a merge request that only edits documentation skips the tests,
scanners, build and deploy. The `sci` job compares the jobs that ran with a pipeline of the same
type that runs every job, and reports the grams and the percentage saved. The gatekeeper posts that
figure on each merge request and the reporter posts it on each closed issue. The constants and their
sources are in `config/sci.json`, and the calculation is in `scripts/ci/sci.mjs`.

The page itself is about 20 KB of HTML, CSS and JavaScript with no framework and no third-party
requests.

## Repository layout

| Path | Contents |
| --- | --- |
| `src/rules.js` | Decision logic as pure functions |
| `config/facts.json` | Every fact the rules use, with the archives.gov pages and phrases it comes from |
| `public/` | The web page |
| `.gitlab-ci.yml` | The pipeline |
| `scripts/ci/` | One script for each pipeline check |
| `.gitlab/duo/flows/` | The Issue-to-MR and Pipeline Medic flow definitions |
| `.gitlab/duo/mr-review-instructions.yaml` | Review rules for GitLab Duo code review |
| `AGENTS.md`, `skills/` | Instructions and skills the agents load |
| `docs/setup.md` | How to turn on the flows and triggers |

## Run it locally

You need Node.js 20 or later. There are no packages to install.

```sh
npm test          # unit tests
npm run check     # lint, tests, accessibility and config checks
npm run build     # build the site into dist/
npx serve dist    # or any static file server
```

## Sources

The page explains public National Archives guidance. It is not legal advice and is not affiliated
with the National Archives.

- https://www.archives.gov/veterans/military-service-records
- https://www.archives.gov/personnel-records-center/ompf-access-public
- https://www.archives.gov/personnel-records-center/fire-1973
- https://www.archives.gov/veterans/military-service-records/standard-form-180.html

## License

MIT. Contributions are accepted under the Developer Certificate of Origin 1.1. Sign off each commit
with `git commit -s`.
