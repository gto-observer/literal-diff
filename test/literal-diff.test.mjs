import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
const run = promisify(execFile); const cli = join(process.cwd(), "literal-diff.mjs");
async function cliRun(args) { try { const result = await run(process.execPath, [cli, ...args]); return { ...result, code: 0 }; } catch (error) { return { ...error, code: error.status ?? error.code }; } }
async function fixture(before, after) { const root = await mkdtemp(join(tmpdir(), "literal-diff-")); const beforeDir = join(root, "before"); const afterDir = join(root, "after"); await mkdir(beforeDir); await mkdir(afterDir); await writeFile(join(beforeDir, "sample.js"), before); await writeFile(join(afterDir, "sample.js"), after); return { root, beforeDir, afterDir }; }
async function compare(before, after) { const f = await fixture(before, after); try { return await cliRun([f.beforeDir, f.afterDir]); } finally { await rm(f.root, { recursive: true, force: true }); } }
test("detects changed error messages", async () => { const r = await compare('throw new Error("old error");', 'throw new Error("new error");'); assert.equal(r.code, 3); assert.match(r.stdout, /Missing string literals: 1/); });
test("ignores variable-only changes", async () => { const r = await compare('const first = "same";', 'const renamed = "same";'); assert.equal(r.code, 0); });
test("ignores comment strings", async () => { const r = await compare('// "gone"\nconst value = "same";', '// "gone"\nconst value = "same";'); assert.equal(r.code, 0); });
test("detects removed template fixed parts", async () => { const r = await compare('const value = `hello ${name} world`;', 'const value = `hello ${name}`;'); assert.equal(r.code, 3); });
test("ignores Python and PowerShell hash comments", async () => { const f = await fixture("", ""); try { await writeFile(join(f.beforeDir, "sample.py"), '# "gone"\nvalue = "same"'); await writeFile(join(f.afterDir, "sample.py"), '# "changed"\nvalue = "same"'); await writeFile(join(f.beforeDir, "sample.ps1"), '# "gone"\n$value = "same"'); await writeFile(join(f.afterDir, "sample.ps1"), '# "changed"\n$value = "same"'); const r = await cliRun([f.beforeDir, f.afterDir]); assert.match(r.stdout, /Missing string literals: 0/); } finally { await rm(f.root, { recursive: true, force: true }); } });
test("snapshot compare matches direct compare", async () => { const f = await fixture('const value = "old";', 'const value = "new";'); try { const direct = await compare('const value = "old";', 'const value = "new";'); await cliRun(["--snapshot", f.beforeDir, join(f.root, "snapshot.json")]); const saved = await cliRun(["--compare", join(f.root, "snapshot.json"), f.afterDir]); assert.equal(saved.code, direct.code); assert.equal(saved.stdout, direct.stdout); } finally { await rm(f.root, { recursive: true, force: true }); } });
test("ignores node_modules", async () => { const f = await fixture('const value = "same";', 'const value = "same";'); try { await mkdir(join(f.beforeDir, "node_modules")); await mkdir(join(f.afterDir, "node_modules")); await writeFile(join(f.beforeDir, "node_modules", "x.js"), 'const value = "gone";'); await writeFile(join(f.afterDir, "node_modules", "x.js"), 'const value = "changed";'); const r = await cliRun([f.beforeDir, f.afterDir]); assert.match(r.stdout, /Missing string literals: 0/); } finally { await rm(f.root, { recursive: true, force: true }); } });
test("records unquoted object key limitation", async () => { const r = await compare('const object = { entry_id: "same" };', 'const object = { other_id: "same" };'); assert.equal(r.code, 0); });
