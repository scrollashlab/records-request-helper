# Turning on the agents

The pipeline works as soon as the repository is on GitLab. The two Duo flows need a one-time
setup in the project, because flows and triggers are created in the GitLab UI.

You need the Maintainer or Owner role on the project. In the Transcend hackathon subgroup you have
the Developer role on the subgroup; a project you create inside it gives you Maintainer.

## 1. Create the flows

For each file in `.gitlab/duo/flows/`:

1. Go to **AI > Flows** and select **New flow**.
2. Display name: `Issue-to-MR` or `Pipeline Medic`. Description: the comment at the top of the file.
3. Visibility: **Private**.
4. Paste the file's contents into the configuration editor and select **Create flow**.

## 2. Enable them with triggers

1. Open the flow, select **Enable**, and pick this project.
2. Add triggers:
   - **Issue-to-MR**: Work item (Created), Mention, Assign.
   - **Pipeline Medic**: Pipeline events (Passed, Failed).
3. Select **Enable**. GitLab creates a service account for each flow and adds it to the project as a Developer.

## 3. Project settings

- **Settings > Merge requests**: turn on "Pipelines must succeed" and "All threads must be resolved".
- **Settings > Repository > Protected branches**: `main` allows merges by Developers and Maintainers,
  pushes by no one, and force push off. The flows merge through merge requests only.
- **Build > Pipeline schedules**: add a daily schedule on `main` (for example 06:00 in your time zone).
  It runs the production smoke test and the National Archives source-drift check.
- **Deploy > Pages**: after the first `main` pipeline, the site is live at the URL shown there.
- **Labels**: create `auto-merge`, `needs-human` and `incident`.

## What runs where

| Lifecycle stage | Where |
| --- | --- |
| Plan | Issue-to-MR `scope_check` agent triages each new issue |
| Create | Issue-to-MR `builder` agent writes the change, runs tests, opens the merge request |
| Verify | `lint`, `test`, `a11y` jobs; review app smoke test |
| Secure | GitLab SAST and secret detection, then `security-gate` fails on High or Critical |
| Configure | `config-check` validates runtime flags and the facts file |
| Govern | `policy-check` (MIT, DCO sign-off, issue link, fresh sourced facts, no credentials); Pipeline Medic `gatekeeper` review |
| Package | `build`, then `package` to the generic package registry |
| Release | `release` job tags and publishes notes when the version changes; Pipeline Medic `reporter` posts the release summary on the issue |
| Deploy | Review app per merge request; GitLab Pages for production |
| Monitor | `smoke` after every deploy and daily; `source-drift` daily; Pipeline Medic `incident` opens an issue on failure |
