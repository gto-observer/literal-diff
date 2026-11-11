#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { extname, relative, resolve, join } from "node:path";
const extensions = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".ps1"]);
const excluded = new Set(["node_modules", ".git", "dist", "build", ".venv", "__pycache__"]);
function files(root, dir = root) { return readdirSync(dir, { withFileTypes: true }).flatMap((e) => { if (e.isDirectory() && !excluded.has(e.name)) return files(root, join(dir, e.name)); return e.isFile() && extensions.has(extname(e.name)) ? [join(dir, e.name)] : []; }); }
function literals(text, pyps = false) { let src = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1"); if (pyps) src = src.replace(/(^|\s)#.*$/gm, "$1"); const found = [...src.matchAll(/(['"])(\\.|(?!\1)[^\\])*\1|`([^`]*)`/g)].flatMap((m) => m[1] ? [m[0]] : m[3].split(/\$\{[^}]*\}/).filter(Boolean).map((p) => `\`${p}\``)); return found.filter((v) => !/^['"]\.\/?[^'"\n]+['"]$/.test(v)); }
function snapshot(dir) { const out = {}; for (const file of files(dir)) for (const value of new Set(literals(readFileSync(file, "utf8"), /\.(py|ps1)$/.test(extname(file))))) { (out[value] ??= []).push(relative(dir, file)); } return out; }
function compare(old, dir) { const now = snapshot(dir); const gone = Object.keys(old).filter((v) => !(v in now)); for (const value of gone) console.log(`${value} (${old[value].join(", ")})`); console.log(`Lost string literals: ${gone.length}`); process.exitCode = gone.length ? 3 : 0; }
function usage() { return "Usage: literal-diff --snapshot <dir> <out.json> | --compare <snapshot.json> <dir> | <before-dir> <after-dir>"; }
const a = process.argv.slice(2);
if (a[0] === "--help" || a[0] === "-h") console.log(usage());
else if (a[0] === "--snapshot" && a.length === 3) writeFileSync(a[2], JSON.stringify(snapshot(resolve(a[1])), null, 2));
else if (a[0] === "--compare" && a.length === 3) compare(JSON.parse(readFileSync(a[1], "utf8")), resolve(a[2]));
else if (a.length === 2) compare(snapshot(resolve(a[0])), resolve(a[1]));
else { console.error(usage()); process.exit(1); }
