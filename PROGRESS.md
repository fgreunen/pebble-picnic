# Progress — Pebble Picnic

T1–T30 are complete. Play offline with `PLAY.cmd` or `index.html`.

## 12 October 2026 — online play link (complete)

- Owner: `/root`; scope: README and handoff only. Added a prominent invitation linking to the deployed game at `https://pebble-picnic.francoisvangreunen.com/`.
- Verification: Markdown destination and local README links checked; `git diff --check` passed. The external URL could not be independently reached from the available web inspection tool. No runtime files changed, so gameplay tests were not run.
- Remaining/running jobs: none.

## 12 October 2026 — public README refresh (complete)

- Owner: `/root`; scope: public-facing documentation only. Reworked `README.md` into a GitHub landing page with a concise pitch, launch path, highlights, screenshots, compact controls, privacy/accessibility notes, development entry points and license/attribution. Curated three visually inspected gameplay captures into `docs/images/` (1,265×712, 975×948 and 700×820; 137,273 bytes total) and documented that narrow public-documentation exception in `DEVELOPMENT.md`; raw/development captures still belong in temp. Generalized two user-specific temp paths in this handoff before publication.
- Input: branch `main`, HEAD `72f2040`, with all pre-existing shared changes and historical capture deletions preserved. Read-only helper `readme_audit` checked README facts, licensing, public hygiene and level/ammo counts; no files changed by the helper.
- Verification: README check found all nine local links/image references present, eight headings and balanced fences; all three images decoded with their expected dimensions; `git diff --check` has no errors. Live localhost Chrome inspection matched the selected game presentation. At 700×820, document `scrollWidth`/`clientWidth` were both 700 and `scrollHeight`/`clientHeight` both 820; browser warning/error log was empty; temporary viewport was reset. No runtime files changed, so the gameplay suite was not rerun.
- Remaining: repository metadata such as GitHub description/topics can be added after the remote is available. Historical technical documents still contain old `D:\codex\gameboy` command examples; README and current handoff do not depend on them.
- Running jobs: none after stopping the owned preview server; helper finished.

## 12 October 2026 — generated artifacts outside Git (complete)

- Owner: `/root`; scope: move generated screenshots, test runs and audit reports to the system temp folder; update their writers, ignore rules and documentation references. Owns artifact helper, runner/self-test, audit output and relevant documentation. Game assets, source and solution fixtures stay in the project.
- Changes: ten tracked preview screenshots and generated `tests/physics-report.json` removed from the checkout; 1,601 old test-artifact files moved out. All generated output now uses `tools/artifacts.cjs` under system temp, with isolated batch audit paths and guarded publication of the latest temp report. Added ignore rules and a standing artifact policy; replaced 25 repository artifact links with historical references. Source, runtime assets and solution fixtures remain intact.
- Storage: the first move passed hash checks, then the tool sandbox cleared its temp folder. The ten unchanged tracked screenshots were recovered from Git HEAD into the project's system-temp `screenshots` directory, with hashes verified again and `screenshot-migration.json` alongside them. Old untracked logs/snapshots are no longer retained. Normal developer runs use the normal system temp folder; sandbox runs may have shorter-lived storage.
- Verification: `node tools/test-runner.test.cjs` exit 0, 10/10 including output isolation, retention and publication; `npm run physics:check` exit 0, 16/16, report outside checkout. Final normal-temp `npm test` exit 0, 154/154 in 13.60s suite time (14.02s total), 39-input SHA-256 `c8f2c0704b78527d7977f1087823cffd80496dc80bf867f27f3ff40bfeade729`. Results were stored in the project's system-temp `test-results` directory. Final source hash matches, latest audit published outside checkout, successful snapshot removed. The preceding sandbox full run also passed 154/154; normal-temp rerun verifies persistent external output.
- Repository checks: zero image files, no `test-results` directory or generated audit report; both solution fixtures byte-identical to HEAD. Artifact ignore checks, 22 documentation links and offline runtime references pass. No gameplay/UI change; no browser run required. File deletions are ready for the next Git commit; existing history is untouched.
- Running jobs: none.

## 12 October 2026 — code and development simplification (complete)

- Owner: `/root`; files: `src/game.js`, runner/self-test, README/DEVELOPMENT/AGENTS and this handoff. Read-only helper `simplification_scan` (Luna/high) finished with three small cleanup candidates; no other writers.
- Scope: preserve gameplay, physics, fixtures and all regression suites. Consolidate repeated UI cleanup and handlers; discard temporary test copies after successful matching runs; keep logs/manifests and failure copies. `--keep-snapshot` retains successful copies when needed.
- Documentation: current handoff here; past entries preserved in [history](docs/history/PROGRESS-2026-10-12.md). DEVELOPMENT is the command/architecture reference. No requirement changes.
- Baseline: `node tests/lifecycle.test.cjs` 15/15; `node tools/test-runner.test.cjs` 9/9, both exit 0 before edits.
- Verification: focused lifecycle 15/15, controls 10/10, Easy Mode 16/16 and toddler 16/16; runner self-test 10/10, including successful-copy cleanup, explicit retention and failed-run retention. Final `npm test` exit 0: 154/154 in 14.24s suite time (14.71s total), logs/results (temporary artifact: `test-results/2026-10-12T18-06-23-528Z-18988-116384/results.json`), input SHA-256 `b6dd208a97b1f9d771c4049196615f6b4f30bd1d3d332e67014ba758fd110d61`. Final source manifest matches; audit published; copied inputs removed and manifest/logs retained. Checked 23 local documentation links and balanced fences before this final handoff update.
- Browser: localhost in-app browser verified Easy launch 3→2 balls, Undo 2→3 with Undo disabled, repeat launch/restart, and level-menu open/close. At 700×820: no horizontal overflow; compact layout inspected. Console warnings/errors empty. Mouse mode and viewport restored; temporary tab and owned preview server closed. The sandbox preview was unreachable; the localhost-only server worked outside the sandbox.
- Result: shared transient cleanup, grouped launch handling, one visibility handler and one retry handler. No physics/layout/fixture changes. Four working docs reduced from 51,947 bytes to about 21 KB; history preserved. Existing test artifacts remain untouched. No new gameplay requirement or TODO completion claim.
- Remaining/next action: none for this pass. Runtime reduction is intentionally small; no dead physics subsystem was identified.
- Running jobs: none.

## Previous gameplay evidence

The final T25–T30 build passed 154/154 gameplay checks and nine runner checks; browser checks covered normal and 700×820 windows. See [the original handoff](docs/history/PROGRESS-2026-10-12.md) and [TESTING.md](TESTING.md) for the dated evidence and limitations. It predates this refactor.

Future entries belong above the previous evidence. Keep only current work and its latest verification here; archive older handoffs without discarding their evidence or links.
