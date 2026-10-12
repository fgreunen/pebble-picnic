# Frozen test runs and turnaround

T15 implementation, 11 October 2026. The gameplay suites retain their assertions and simulation lengths. `tools/test-runner.cjs` changes orchestration only; it requires Node 18 or newer and no packages. It does not affect offline play.

Latest integrated run, 12 October 2026: T25–T30 additions plus the small-window result-card fix pass **154/154 checks in eleven parallel suites**, **24.80s** batch / **25.39s** including snapshot orchestration. All 38 input hashes match, SHA-256 `1072d4ff374ae53c09a75b52ed94f504c1dee88c2726cc21cb518e10534a5e17`; [results](test-results/2026-10-12T16-30-05-823Z-16640-e97c95/results.json). This supersedes the 18.92s pre-CSS-fix checkpoint; browser testing was active during the final run, so the times are not a controlled speed comparison. Nine synthetic runner checks separately pass on unchanged runner code. No new serial comparison was needed; older benchmark evidence below is historical. Browser acceptance is complete as recorded in TESTING.md.

## Commands

Run from `D:\codex\gameboy`:

```powershell
npm test
npm run test:serial
node tools/test-runner.cjs --suite tests/upgrade.test.cjs --suite tests/controls.test.cjs
node tools/test-runner.test.cjs
```

The default runs eleven gameplay suites in parallel Node processes: physics, controls, physics audit, upgrades, lifecycle, damage art, Easy Mode/trajectory, landing damage, projectile routes, toddler play and quick scenes. Use selected suites while implementing a feature, then the full batch on the integrated version. `--serial` is a fallback for a resource-constrained PC. Each suite has a120-second failure timeout, configurable with `--timeout`; successful processes return immediately. No polling delay or idle wait is inserted between suites. The npm commands publish a successful matching audit; direct `node tools/test-runner.cjs` leaves it isolated.

To measure both modes and deliberately publish the matching audit report:

```powershell
npm run test:benchmark
```

This is equivalent to `node tools/test-runner.cjs --compare --publish-report`. `--compare` runs serial first and parallel second on the **same frozen snapshot**. It reports wall-clock batch time, each suite's elapsed time, percentage saved and speedup. It performs twice the normal verification work, so use it for the benchmark rather than routine iteration. One sample can vary with processor contention and cache warm-up; report the observed measurement rather than claiming a universal speedup.

## Input identity and output ownership

Every invocation creates a unique `test-results/<timestamp>-<pid>-<random>/` directory. It captures `src`, `vendor`, `tests`, `tools`, root launch/runtime/package files, the standing instruction files and license/attribution. Additional local HTML asset references are captured too. It never traverses `test-results` or copies the generated `tests/physics-report.json`.

The source manifest before copying, source manifest after copying and copied-file manifest must have identical path lists, byte counts and SHA-256 hashes. A racing edit rejects that attempt; the runner immediately retries up to three times. Failed attempts remain available for diagnosis. `manifest.json` identifies every accepted input, and the combined input hash appears in the console and final `results.json`.

Each suite runs from the snapshot, with separate stdout/stderr logs and recorded exit status. Only the audit writes its report in that snapshot. Each batch archives that report only after its audit passes; a failed run cannot inherit an older report. Serial and parallel comparison outputs have separate directories. The runner checks the snapshot and live source again at completion. A successful frozen run on subsequently changed source exits **2**, clearly distinguishing evidence for an older version from a final integrated pass.

Reports stay in `test-results` by default, avoiding a shared-report race with another chat. `--publish-report` copies the successful final batch's audit to the working tree only after verifying live inputs still match; the final result records whether publication occurred. Keep runtime and fixture writers idle during the final integrated command. Exit codes: **0** all suites passed with matching inputs; **1** suite failure; **2** input drift, snapshot/setup failure or invalid command.

## Verification and benchmark status

**Current 1.3.0:** final `npm test` exited0 on 11 October 2026, Node 18.12.0, with **115 checks in nine suites**, parallel batch **10.89s**. 35 source/copy inputs matched on the first attempt and remained unchanged through completion; matching audit published. Hash: `24f9f66d07205da1db8bb8a6039fe9d99d892e9f8f93ea09e8b4f27463f8f261`. [Results/log paths](test-results/2026-10-11T17-27-45-651Z-17924-ad0f17/results.json) and [manifest](test-results/2026-10-11T17-27-45-651Z-17924-ad0f17/manifest.json) identify the build. The audit dominates at 10.86s. All 9 runner self-checks also passed in this continuation.

The 1.3.0 run did not repeat a serial timing benchmark; the following comparison is historical 1.2.0 evidence for scheduling, not a current speedup claim.

`node tools/test-runner.test.cjs` passed **9 focused orchestration checks** in about 2.49 seconds. They verify exclusion of generated outputs, asset capture, exact snapshot hashes, retry after a concurrent edit, bounded failure for continuous edits, parallel process overlap and isolated logs, identical-input serial execution, failure/timeout handling, guarded report publication and CLI validation. All checks use generated synthetic workspaces; they do not repeat gameplay audits while another agent edits the runtime.

The synthetic overlap control measured **595 ms serial versus 324 ms parallel**, about **46% less elapsed time**. This proves concurrent scheduling; its two deliberately delayed child fixtures are **not a gameplay performance measurement**. The small timers are necessary to observe process overlap and timeout behavior; production physics tests use synchronous simulated time.

The **historical 1.2.0 gameplay benchmark passed** on 11 October 2026, using Node **v18.12.0** and `node tools/test-runner.cjs --compare --publish-report` (exit **0**). Each mode passed **89 checks across six suites**. Serial took **10.36s** and parallel **8.42s**: **1.23x speedup /18.7% less elapsed time**, one local sample. Source/copy manifests matched; snapshot stayed unchanged, final live inputs matched and audit published. No fixtures were regenerated for that benchmark.

Accepted input SHA-256: `d37bd4bae0948810ad1eb0b25c5367e7b9fbc76b71cd5d3e12886aad11924599`.

The [complete results and timings](test-results/2026-10-11T16-31-53-187Z-11852-6eecf7/results.json) and [input manifest](test-results/2026-10-11T16-31-53-187Z-11852-6eecf7/manifest.json) identify the exact build. Full suite logs are in that result folder's `serial/` and `parallel/` directories; the verified copy is in `attempt-1/snapshot/`. This document is excluded from the input manifest, so recording these measurements does not invalidate the tested version.

The audit was the dominant suite: **6.59 seconds alone in the serial batch, 8.41 seconds in the parallel batch**. Concurrent CPU work slowed individual suites while reducing total elapsed time. Coverage was retained; the measured improvement comes from scheduling independent work rather than shortening simulated stability or collapse checks.

## What remains intentionally unchanged

Physics stability and collapse waits are simulated ticks, not wall-clock sleeps. Their durations provide coverage and should remain. Solution searches are separate development operations that rewrite fixtures and replay many candidate shots; do not run them automatically as part of verification or compete over the same fixture file. Parallelism reduces the sequential suite sum toward the longest suite's duration, but cannot shorten that dominant suite by itself. Browser visual/audio checks remain separate and cannot be replaced by a fast Node batch.

The runner uses approximate elapsed timing on the local PC. Benchmark CPU contention can inflate physics timing metrics even when the game is unchanged; use serial audit mode for controlled performance diagnosis. Test artifacts are retained rather than recursively deleted, so remove old `test-results` folders manually when no longer needed.
