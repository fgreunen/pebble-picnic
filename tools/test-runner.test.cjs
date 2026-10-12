'use strict';
// Small synthetic workspaces exercise orchestration without repeating gameplay suites.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const runner = require('./test-runner.cjs');
const artifactDirectory = require('./artifacts.cjs');

async function main() {
  const output = path.join(artifactDirectory(), 'test-results', `runner-self-test-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`);
  const root = path.join(output, 'source');
  for (const dir of ['src', 'vendor', 'tests', 'tools', 'test-results']) await fs.mkdir(path.join(root, dir), { recursive: true });
  const files = {
    'index.html': '<link href="styles.css"><script src="src/game.js"></script><img src="local.svg">',
    'styles.css': 'canvas {}', 'PLAY.cmd': 'start "" "%~dp0index.html"', 'package.json': '{}',
    'src/game.js': '/* fixture */', 'src/physics.js': '/* fixture */',
    'vendor/MATTER-LICENSE.txt': 'Permission is hereby granted', 'local.svg': '<svg/>',
    'tests/solutions.json': '[]', 'tests/physics-report.json': '{"old":true}',
    'test-results/do-not-copy.txt': 'old output',
    'tests/one.test.cjs': 'console.log(JSON.stringify({pid:process.pid,start:Date.now()})); setTimeout(() => {console.log("PASS one"); console.log(JSON.stringify({end:Date.now()}));}, 200);',
    'tests/two.test.cjs': 'console.log(JSON.stringify({pid:process.pid,start:Date.now()})); setTimeout(() => {console.log("PASS two"); console.log(JSON.stringify({end:Date.now()}));}, 200);',
    'tests/fail.test.cjs': 'console.error("expected fixture failure"); process.exitCode=1;',
    'tests/hang.test.cjs': 'setInterval(() => {}, 1000);',
    'tests/physics-audit.test.cjs': 'require("node:fs").writeFileSync(process.env.PICNIC_AUDIT_REPORT, "{\\"checksPassed\\":1}\\n"); console.log("PASS synthetic audit");'
  };
  for (const [name, value] of Object.entries(files)) await fs.writeFile(path.join(root, name), value);
  let passed = 0;
  async function test(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
  let frozen;
  await test('manifest includes local assets and excludes generated reports/recursive test-results', async () => {
    const manifest = await runner.manifestFor(root), names = manifest.files.map(file => file.path);
    assert.ok(names.includes('local.svg')); assert.ok(names.includes('PLAY.cmd'));
    assert.ok(!names.includes('tests/physics-report.json')); assert.ok(!names.some(name => name.startsWith('test-results/')));
    const other = await runner.manifestFor(root); assert.ok(runner.same(manifest, other));
  });
  await test('snapshot verifies both source manifests and copied bytes', async () => {
    frozen = await runner.freezeInputs(root, path.join(output, 'fixed'));
    assert.ok(runner.same(frozen.manifest, await runner.manifestFor(root)));
    assert.ok(runner.same(frozen.manifest, await runner.manifestFor(frozen.snapshot)));
    assert.equal(frozen.attempts.length, 1);
    await assert.rejects(fs.access(path.join(frozen.snapshot, 'tests/physics-report.json')));
  });
  await test('a concurrent edit rejects the copy and retries a coherent version', async () => {
    const result = await runner.freezeInputs(root, path.join(output, 'retry'), {
      afterCopy: async attempt => { if (attempt === 1) await fs.writeFile(path.join(root, 'src/game.js'), '/* updated */'); }
    });
    assert.equal(result.attempts.length, 2); assert.equal(result.attempts[0].accepted, false); assert.equal(result.attempts[1].accepted, true);
    assert.equal(await fs.readFile(path.join(result.snapshot, 'src/game.js'), 'utf8'), '/* updated */');
  });
  await test('continuously edited inputs fail after a bounded number of attempts', async () => {
    await assert.rejects(runner.freezeInputs(root, path.join(output, 'unstable'), {
      attempts: 2, afterCopy: attempt => fs.writeFile(path.join(root, 'src/game.js'), `/* race ${attempt} */`)
    }), /after 2 attempts/);
  });
  await test('parallel suites overlap in separate processes and keep separate logs', async () => {
    const batch = await runner.runBatch(frozen.snapshot, ['tests/one.test.cjs', 'tests/two.test.cjs'], path.join(output, 'parallel'), 'parallel');
    assert.equal(batch.passed, true); assert.equal(batch.checksPassed, 2);
    const logs = await Promise.all(batch.results.map(result => fs.readFile(result.stdout, 'utf8')));
    const intervals = logs.map(log => log.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line)));
    assert.notEqual(intervals[0][0].pid, intervals[1][0].pid);
    assert.ok(Math.max(...intervals.map(row => row[0].start)) < Math.min(...intervals.map(row => row[1].end)), 'Child intervals overlap');
    assert.notEqual(batch.results[0].stdout, batch.results[1].stdout);
    assert.ok(runner.same(frozen.manifest, await runner.manifestFor(frozen.snapshot)));
  });
  await test('serial comparison reuses precisely the same frozen inputs', async () => {
    const serial = await runner.runBatch(frozen.snapshot, ['tests/one.test.cjs', 'tests/two.test.cjs'], path.join(output, 'serial'), 'serial');
    assert.equal(serial.passed, true); assert.equal(serial.checksPassed, 2);
    const logs = await Promise.all(serial.results.map(result => fs.readFile(result.stdout, 'utf8')));
    const intervals = logs.map(log => log.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line)));
    assert.ok(intervals[0][1].end <= intervals[1][0].start);
    assert.ok(runner.same(frozen.manifest, await runner.manifestFor(frozen.snapshot)));
  });
  await test('failed children and bounded timeouts are reported as failures', async () => {
    const batch = await runner.runBatch(frozen.snapshot, ['tests/fail.test.cjs', 'tests/hang.test.cjs'], path.join(output, 'failures'), 'parallel', { timeoutMs: 500 });
    assert.equal(batch.passed, false); assert.equal(batch.results[0].exitCode, 1);
    assert.equal(batch.results[0].timedOut, false); assert.equal(batch.results[1].timedOut, true);
  });
  await test('audit output is isolated and publishing requires matching live inputs', async () => {
    const current = await runner.freezeInputs(root, path.join(output, 'current'));
    const logs = path.join(output, 'audit');
    const batch = await runner.runBatch(current.snapshot, ['tests/physics-audit.test.cjs'], logs, 'parallel');
    assert.equal(batch.passed, true);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(logs, 'physics-report.json'), 'utf8')), { checksPassed: 1 });
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, 'tests/physics-report.json'), 'utf8')), { old: true });
    const latest = path.join(output, 'physics-report.json');
    assert.equal(await runner.publishReport(root, current.snapshot, current.manifest, batch, logs, latest), true);
    assert.deepEqual(JSON.parse(await fs.readFile(latest, 'utf8')), { checksPassed: 1 });
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, 'tests/physics-report.json'), 'utf8')), { old: true });
    await fs.writeFile(path.join(root, 'src/game.js'), '/* newer source */');
    assert.equal(await runner.publishReport(root, current.snapshot, current.manifest, batch, logs, latest), false);
  });
  await test('CLI validates options, deduplicates suites and preserves the serial fallback', async () => {
    assert.equal(runner.parseArgs([]).mode, 'parallel'); assert.equal(runner.parseArgs(['--serial']).mode, 'serial');
    assert.equal(runner.parseArgs(['--compare']).compare, true);
    assert.deepEqual(runner.parseArgs(['--suite', 'tests/one.test.cjs', '--suite', 'tests/one.test.cjs']).suites, ['tests/one.test.cjs']);
    assert.throws(() => runner.parseArgs(['--timeout', '0']), /Invalid/);
    assert.throws(() => runner.parseArgs(['--suite']), /needs/);
    assert.throws(() => runner.parseArgs(['--unknown']), /Unknown/);
    await assert.rejects(runner.runBatch(frozen.snapshot, ['../escape.cjs'], path.join(output, 'invalid'), 'parallel'), /Invalid suite/);
  });
  await test('successful CLI runs discard copies but keep logs and manifests; failures and opt-in retain copies', async () => {
    const artifacts = path.join(output, 'cli-artifacts'), results = path.join(artifacts, 'test-results');
    await fs.mkdir(results, { recursive: true });
    for (const [suite, args, expectedCode, retained] of [
      ['one', [], 0, false], ['one', ['--keep-snapshot'], 0, true], ['fail', [], 1, true]
    ]) {
      const before = new Set(await fs.readdir(results));
      assert.equal(await runner.main(['--suite', `tests/${suite}.test.cjs`, ...args], root, artifacts), expectedCode);
      const added = (await fs.readdir(results)).filter(name => !before.has(name));
      assert.equal(added.length, 1);
      const directory = path.join(results, added[0]);
      const result = JSON.parse(await fs.readFile(path.join(directory, 'results.json'), 'utf8'));
      assert.equal(result.snapshotRetained, retained);
      if (retained) await fs.access(result.snapshot);
      else await assert.rejects(fs.access(result.snapshot), { code: 'ENOENT' });
      await fs.access(path.join(directory, 'manifest.json'));
      await fs.access(result.batches[0].results[0].stdout);
    }
    assert.deepEqual(await fs.readdir(path.join(root, 'test-results')), ['do-not-copy.txt']);
    assert.ok(!path.relative(path.resolve(__dirname, '..'), output).startsWith('test-results' + path.sep));
  });
  const boundary = path.resolve(artifactDirectory(), 'test-results') + path.sep;
  if (!output.startsWith(boundary)) throw new Error('Synthetic workspace escapes test-results');
  await fs.rm(output, { recursive: true, force: true });
  console.log(`\n${passed} runner checks passed. Synthetic workspace removed.`);
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
