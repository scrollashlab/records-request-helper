---
name: carbon-budget
description: Keep the pipeline's Software Carbon Intensity (SCI) low. Use when adding or changing CI jobs, rules or schedules.
---

## Carbon budget for CI changes

The pipeline reports its Software Carbon Intensity in the `sci` job using the Green Software
Foundation formula SCI = ((E x I) + M) per R, with R = one pipeline run. Constants and their sources
are in `config/sci.json`.

When you add or change a job:

1. Give it `rules:changes` so it runs only when files it checks have changed. Reuse `.on-change`.
2. Prefer `node:22-alpine` and the scripts in `scripts/ci/`; avoid installing packages at job time.
3. Add the job and its typical minutes to the right pipeline type in `config/sci.json`
   (`merge_request_event`, `push`, `schedule`). A job missing there is never counted as saved.
4. Do not add schedules more often than daily. The drift and smoke checks run once a day.
5. Mention the expected SCI change in the merge request description, for example
   "Adds about 0.4 runner-minutes to merge request pipelines that touch src/".
