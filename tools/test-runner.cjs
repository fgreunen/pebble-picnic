'use strict';
// Development only. Every child reads a verified copy, never the live working tree.
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { performance } = require('node:perf_hooks');

const DEFAULT_SUITES = Object.freeze([
  'tests/physics.test.cjs', 'tests/controls.test.cjs',
  'tests/physics-audit.test.cjs', 'tests/upgrade.test.cjs',
  'tests/lifecycle.test.cjs', 'tests/damage-art.test.cjs',
  'tests/easy-mode.test.cjs', 'tests/landing-damage.test.cjs', 'tests/projectile-routes.test.cjs',
  'tests/toddler-play.test.cjs', 'tests/quick-scenes.test.cjs'
]);
const ROOT_FILES = Object.freeze(['index.html', 'styles.css', 'PLAY.cmd', 'package.json']);
const CONTEXT_FILES = Object.freeze(['AGENTS.md', 'DEVELOPMENT.md', 'LICENSE', 'ATTRIBUTION.md']);
const INPUT_DIRS = Object.freeze(['src', 'vendor', 'tests', 'tools']);
const GENERATED = new Set(['tests/physics-report.json']);
const slash = value => value.split(path.sep).join('/');
const sha = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const same = (a, b) => a.hash === b.hash && JSON.stringify(a.files) === JSON.stringify(b.files);

async function inputFiles(root) {
  const found = new Set();
  async function visit(relative) {
    const normalized = slash(relative);
    if (GENERATED.has(normalized)) return;
    const entry = await fsp.lstat(path.join(root, relative));
    if (entry.isSymbolicLink()) throw new Error(`Snapshot inputs must be real files: ${normalized}`);
    if (entry.isDirectory()) {
      for (const name of (await fsp.readdir(path.join(root, relative))).sort()) await visit(path.join(relative, name));
    } else if (entry.isFile()) found.add(normalized);
  }
  for (const name of [...ROOT_FILES, ...INPUT_DIRS]) await visit(name);
  for (const name of CONTEXT_FILES) {
    try { await visit(name); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  // Capture additional local assets referenced by HTML, including future root assets.
  const html = await fsp.readFile(path.join(root, 'index.html'), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const ref = match[1];
    if (/^(?:data:|#)/i.test(ref)) continue;
    if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) throw new Error(`Offline input references a remote resource: ${ref}`);
    const resolved = path.resolve(root, ref);
    const relative = path.relative(root, resolved);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Asset escapes project: ${ref}`);
    await visit(relative);
  }
  return [...found].sort();
}

async function manifestFor(root) {
  const files = [];
  for (const name of await inputFiles(root)) {
    const bytes = await fsp.readFile(path.join(root, name));
    files.push({ path: name, bytes: bytes.length, sha256: sha(bytes) });
  }
  return { algorithm: 'sha256', hash: sha(JSON.stringify(files)), files };
}

async function freezeInputs(root, output, options = {}) {
  const attempts = options.attempts || 3;
  await fsp.mkdir(output, { recursive: true });
  const diagnostics = [];
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const directory = path.join(output, `attempt-${attempt}`), snapshot = path.join(directory, 'snapshot');
    await fsp.mkdir(snapshot, { recursive: true });
    try {
      const before = await manifestFor(root);
      for (const dir of INPUT_DIRS) await fsp.mkdir(path.join(snapshot, dir), { recursive: true });
      for (const file of before.files) {
        const destination = path.join(snapshot, file.path);
        await fsp.mkdir(path.dirname(destination), { recursive: true });
        await fsp.copyFile(path.join(root, file.path), destination);
      }
      // Injectable hook is used only by the runner's focused race regression.
      if (options.afterCopy) await options.afterCopy(attempt, snapshot);
      const [after, copied] = await Promise.all([manifestFor(root), manifestFor(snapshot)]);
      const accepted = same(before, after) && same(before, copied);
      const record = { attempt, accepted, beforeHash: before.hash, afterHash: after.hash, snapshotHash: copied.hash };
      diagnostics.push(record);
      await fsp.writeFile(path.join(directory, 'copy-check.json'), JSON.stringify(record, null, 2) + '\n');
      if (accepted) {
        await fsp.writeFile(path.join(output, 'manifest.json'), JSON.stringify(before, null, 2) + '\n');
        return { snapshot, manifest: before, attempts: diagnostics };
      }
    } catch (error) {
      diagnostics.push({ attempt, accepted: false, error: error.message });
    }
  }
  await fsp.writeFile(path.join(output, 'snapshot-failures.json'), JSON.stringify(diagnostics, null, 2) + '\n');
  throw new Error(`Could not freeze unchanged inputs after ${attempts} attempts; see ${output}`);
}

async function runSuite(snapshot, suite, logs, timeoutMs) {
  const normalized = slash(suite), resolved = path.resolve(snapshot, normalized);
  if (!normalized.startsWith('tests/') || !normalized.endsWith('.cjs') ||
      path.relative(snapshot, resolved).startsWith('..')) throw new Error(`Invalid suite: ${suite}`);
  await fsp.access(resolved);
  const name = normalized.replace(/[^a-zA-Z0-9._-]/g, '_');
  const stdoutPath = path.join(logs, `${name}.stdout.log`), stderrPath = path.join(logs, `${name}.stderr.log`);
  const out = fs.createWriteStream(stdoutPath), err = fs.createWriteStream(stderrPath);
  const start = performance.now();
  const child = spawn(process.execPath, [resolved], { cwd: snapshot, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(out); child.stderr.pipe(err);
  let timedOut = false, spawnError = null;
  const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
  const code = await new Promise(resolve => {
    child.on('error', error => { spawnError = error.message; });
    child.on('close', value => { clearTimeout(timer); resolve(value); });
  });
  await Promise.all([
    new Promise(resolve => out.end(resolve)), new Promise(resolve => err.end(resolve))
  ]);
  const stdout = await fsp.readFile(stdoutPath, 'utf8');
  return { suite: normalized, passed: code === 0 && !timedOut && !spawnError,
    exitCode: code, timedOut, spawnError, durationMs: performance.now() - start,
    checksPassed: (stdout.match(/^PASS /gm) || []).length,
    stdout: stdoutPath, stderr: stderrPath };
}

async function runBatch(snapshot, suites, output, mode, options = {}) {
  if (!['serial', 'parallel'].includes(mode)) throw new Error(`Invalid execution mode: ${mode}`);
  await fsp.mkdir(output, { recursive: true });
  const timeoutMs = options.timeoutMs || 120000, start = performance.now();
  let results;
  if (mode === 'parallel') results = await Promise.all(suites.map(suite => runSuite(snapshot, suite, output, timeoutMs)));
  else {
    results = [];
    for (const suite of suites) results.push(await runSuite(snapshot, suite, output, timeoutMs));
  }
  const batch = { mode, passed: results.every(result => result.passed), durationMs: performance.now() - start,
    checksPassed: results.reduce((total, result) => total + result.checksPassed, 0), results };
  // Preserve each successful audit output separately. Never treat a leftover report as a pass.
  if (results.some(result => result.suite === 'tests/physics-audit.test.cjs' && result.passed)) {
    const report = path.join(snapshot, 'tests/physics-report.json');
    try { await fsp.copyFile(report, path.join(output, 'physics-report.json')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await fsp.writeFile(path.join(output, 'results.json'), JSON.stringify(batch, null, 2) + '\n');
  return batch;
}

async function publishReport(root, snapshot, manifest, batch, output) {
  if (!batch.passed || !batch.results.some(result => result.suite === 'tests/physics-audit.test.cjs' && result.passed)) return false;
  if (!same(manifest, await manifestFor(root)) || !same(manifest, await manifestFor(snapshot))) return false;
  await fsp.copyFile(path.join(output, 'physics-report.json'), path.join(root, 'tests/physics-report.json'));
  return true;
}

async function discardSnapshots(output, attempts) {
  const directory = path.resolve(output);
  for (const { attempt } of attempts) {
    if (!Number.isInteger(attempt) || attempt < 1) throw new Error('Invalid snapshot attempt');
    const target = path.resolve(directory, `attempt-${attempt}`, 'snapshot');
    if (!target.startsWith(directory + path.sep)) throw new Error('Snapshot escapes output directory');
    await fsp.rm(target, { recursive: true, force: true });
  }
}

function parseArgs(args) {
  const options = { mode: 'parallel', compare: false, publish: false, timeoutMs: 120000, attempts: 3, suites: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--serial') options.mode = 'serial';
    else if (arg === '--parallel') options.mode = 'parallel';
    else if (arg === '--compare') options.compare = true;
    else if (arg === '--publish-report') options.publish = true;
    else if (arg === '--keep-snapshot') options.keepSnapshot = true;
    else if (arg === '--suite') options.suites.push(args[++i]);
    else if (arg === '--timeout') options.timeoutMs = Number(args[++i]);
    else if (arg === '--attempts') options.attempts = Number(args[++i]);
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1 ||
      !Number.isInteger(options.attempts) || options.attempts < 1 || options.attempts > 20) throw new Error('Invalid timeout or attempts');
  if (options.suites.some(suite => !suite)) throw new Error('--suite needs a tests/*.cjs path');
  if (!options.suites.length) options.suites = [...DEFAULT_SUITES];
  options.suites = [...new Set(options.suites)];
  return options;
}

async function main(args, root = path.resolve(__dirname, '..')) {
  const options = parseArgs(args);
  if (options.help) {
    console.log('node tools/test-runner.cjs [--parallel|--serial] [--compare] [--suite tests/name.test.cjs]');
    console.log('  [--timeout 120000] [--attempts 3] [--publish-report] [--keep-snapshot]');
    console.log(`Default: ${DEFAULT_SUITES.length} suites in separate parallel Node processes, on SHA-256-verified frozen inputs.`);
    console.log('Successful runs discard temporary input copies; logs/manifests remain. Use --keep-snapshot to retain copies.');
    console.log('--compare: serial then parallel on the SAME snapshot. Reports remain in test-results unless published explicitly.');
    return 0;
  }
  const tag = new Date().toISOString().replace(/[:.]/g, '-') + `-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
  const output = path.join(root, 'test-results', tag), start = performance.now();
  const frozen = await freezeInputs(root, output, options);
  console.log(`Frozen ${frozen.manifest.files.length} inputs: ${frozen.manifest.hash}`);
  console.log(`Snapshot: ${frozen.snapshot}`);
  const batches = [];
  for (const mode of options.compare ? ['serial', 'parallel'] : [options.mode]) {
    const batch = await runBatch(frozen.snapshot, options.suites, path.join(output, mode), mode, options);
    batches.push(batch);
    console.log(`${mode}: ${batch.passed ? 'PASS' : 'FAIL'}, ${batch.checksPassed} checks, ${(batch.durationMs / 1000).toFixed(2)}s`);
    for (const result of batch.results) console.log(`  ${result.passed ? 'PASS' : 'FAIL'} ${result.suite}: ${(result.durationMs / 1000).toFixed(2)}s${result.timedOut ? ' (timeout)' : ''}`);
  }
  const [sourceAfter, snapshotAfter] = await Promise.all([manifestFor(root), manifestFor(frozen.snapshot)]);
  let sourceMatchesSnapshot = same(frozen.manifest, sourceAfter);
  const snapshotUnchanged = same(frozen.manifest, snapshotAfter);
  const lastBatch = batches[batches.length - 1];
  const reportPublished = options.publish && sourceMatchesSnapshot && snapshotUnchanged ?
    await publishReport(root, frozen.snapshot, frozen.manifest, lastBatch, path.join(output, lastBatch.mode)) : false;
  // Publishing performs another live-input check; record the latest state, including
  // an edit that arrived after the initial end-of-test comparison.
  if (options.publish) sourceMatchesSnapshot = same(frozen.manifest, await manifestFor(root));
  const result = { inputHash: frozen.manifest.hash, snapshot: frozen.snapshot, node: process.version,
    attempts: frozen.attempts, sourceMatchesSnapshot, snapshotUnchanged, reportPublished,
    durationMs: performance.now() - start, batches };
  if (options.compare) {
    result.comparison = { serialMs: batches[0].durationMs, parallelMs: batches[1].durationMs,
      savedPercent: 100 * (1 - batches[1].durationMs / batches[0].durationMs),
      speedup: batches[0].durationMs / batches[1].durationMs };
    console.log(`Same-snapshot comparison: ${result.comparison.speedup.toFixed(2)}x, ${result.comparison.savedPercent.toFixed(1)}% time saved (one sample).`);
  }
  const passed = batches.every(batch => batch.passed);
  result.snapshotRetained = true;
  if (passed && sourceMatchesSnapshot && snapshotUnchanged && !options.keepSnapshot) {
    await discardSnapshots(output, frozen.attempts);
    result.snapshotRetained = false;
  }
  await fsp.writeFile(path.join(output, 'results.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(`Results and complete logs: ${output}`);
  if (!sourceMatchesSnapshot || !snapshotUnchanged) {
    console.error('Inputs changed: results identify the frozen version only; verify the final integrated source before claiming completion.');
    return 2;
  }
  if (options.publish) console.log(reportPublished ? 'Matching audit report published.' : 'Audit report not published (no successful matching audit).');
  return passed ? 0 : 1;
}

module.exports = { DEFAULT_SUITES, inputFiles, manifestFor, freezeInputs, runBatch, publishReport, parseArgs, same, main };
if (require.main === module) main(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(error => {
  console.error(`Test runner: ${error.message}`); process.exitCode = 2;
});
