# Pebble Picnic — agent guide

An offline children's slingshot game: plain JavaScript, Canvas, Web Audio and vendored Matter.js. Keep `PLAY.cmd` / `index.html` playable without a server, installation or internet. Node is development-only; no `npm install` is needed.

## Start with current context

- Read the relevant items and later amendments in [TODO.md](TODO.md), plus the status and latest handoff in [PROGRESS.md](PROGRESS.md). Work on the requested scope; a backlog is not an instruction to implement everything.
- New user requirements supersede older plans and tests. In particular, T12 replaces T3's impact-triggered bombs. Code shows implemented behavior; unchecked TODOs describe intended changes.
- Read the relevant sections of [DEVELOPMENT.md](DEVELOPMENT.md) for architecture, test side effects and parallel work. Treat old pass counts/screenshots as dated evidence.

## Make focused changes

- Keep simulation/rules in `src/physics.js`, layouts/ammo in `src/levels.js`, and input/rendering/audio in `src/game.js`. Preserve browser globals and CommonJS exports used by tests, and script order in `index.html`.
- Preserve finite typed ammo, cancellation without a shot, continued simulation after reload, bounded outcomes, and reset/pause cleanup. Keep physics deterministic and separate simulation time from active real time.
- Keep assets local and preserve vendor attribution. Avoid unrelated dependency, formatting or architecture changes.

## Verify efficiently

- Run the affected standalone Node suites first; see the test table in `DEVELOPMENT.md`. Use simulated time instead of sleeps. Run `npm test` once on the final integrated code for runtime/test changes; rerun only when subsequent changes or failures warrant it.
- UI changes also need focused browser checks via `npm run serve` at `http://127.0.0.1:8080`. DOM-host tests do not establish visual or audible quality. Documentation-only edits need link/content checks, not a full gameplay run.
- The audit writes `tests/physics-report.json`; solution searches overwrite `tests/solutions.json`. Diagnose failures before deliberately updating fixtures; never regenerate them just to make tests pass.

## Subagents

- For substantial tasks, use 1–2 subagents when independent testing, investigation or review can improve turnaround or coverage. Keep small edits and tightly dependent work with the lead; use parallel processes for routine test commands.
- Give each helper a bounded goal, acceptance criteria, input version/path and explicit file ownership. Test frozen checkpoints; keep one writer per file/fixture. The lead continues independent work, reconciles findings and verifies the integrated result. See `DEVELOPMENT.md` for the workflow.
- Model defaults: `gpt-6-luna` / `high` for narrow read-only scans and log triage; `gpt-6.1-sol` / `medium` for implementation and regression-test design, `/high` for independent review. Use `gpt-6-astra` / `high` only for difficult unresolved physics/lifecycle reasoning. These are starting choices, not measured speed guarantees.
- Use models/efforts supported by the current session; otherwise inherit the parent and report the fallback. Supply a focused context brief when overriding models. Return findings, file references, commands/results and the tested version; do not duplicate another agent's work.

## Coordinate and hand off

- Other chats may share this folder. Record substantial work's owner/scope/files in `PROGRESS.md`; reread shared files immediately before small edits and preserve others' entries. One writer per overlapping file or generated artifact. Do not assume Git/worktrees exist.
- At checkpoints, record changes, exact checks/results, tested version, remaining issues and next action in `PROGRESS.md`. Mark TODOs complete only with evidence. Update linked guidance when its architecture or commands change; keep this file short.
