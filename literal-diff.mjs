#!/usr/bin/env node
// Detects removed string literals between two directory snapshots.
// Usage 1: create a snapshot, usage 2: compare a snapshot, usage 3: compare two directories.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { extname, relative, resolve, join } from "node:path";

const extensions = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".ps1"]);
const excluded = new Set(["node_modules", ".git", "dist", "build", ".venv", "__pycache__"]);

// Recursively collects source files that the tool checks.
function files(root, dir = root) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory() && !excluded.has(e.name)) {
      return files(root, join(dir, e.name));
    }
    return e.isFile() && extensions.has(extname(e.name))
      ? [join(dir, e.name)]
      : [];
  });
}

// Extracts quoted strings and fixed parts of template literals from source text.
function literals(text, pyps = false) {
  // Matches block comments so they can be removed before literal extraction.
  let src = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
  if (pyps) {
    // Matches Python and PowerShell hash comments.
    src = src.replace(/(^|\s)#.*$/gm, "$1");
  }
  // Matches quoted strings and complete template literals.
  const found = [...src.matchAll(/(['"])(\\.|(?!\1)[^\\])*\1|`([^`]*)`/g)].flatMap((m) =>
    m[1]
      ? [m[0]]
      : m[3]
          .split(/\$\{[^}]*\}/)
          .filter(Boolean)
          .map((p) => `\`${p}\``),
  );
  // Matches relative path literals that should not be reported.
  return found.filter((v) => !/^['"]\.\/?[^'"\n]+['"]$/.test(v));
}

// Builds a map of each literal to the files where it appears.
function snapshot(dir) {
  const out = {};
  for (const file of files(dir)) {
    for (const value of new Set(literals(readFileSync(file, "utf8"), /\.(py|ps1)$/.test(extname(file))))) {
      (out[value] ??= []).push(relative(dir, file));
    }
  }
  return out;
}

// Reports literals present in the old snapshot but absent from the current directory.
function compare(old, dir) {
  const now = snapshot(dir);
  const gone = Object.keys(old).filter((v) => !(v in now));
  for (const value of gone) {
    console.log(`${value} (${old[value].join(", ")})`);
  }
  console.log(`Missing string literals: ${gone.length}`);
  process.exitCode = gone.length ? 3 : 0;
}

// Returns the command line usage text.
function usage() {
  return "Usage: literal-diff --snapshot <dir> <out.json> | --compare <snapshot.json> <dir> | <before-dir> <after-dir>";
}

const a = process.argv.slice(2);
if (a[0] === "--help" || a[0] === "-h") {
  console.log(usage());
} else if (a[0] === "--snapshot" && a.length === 3) {
  writeFileSync(a[2], JSON.stringify(snapshot(resolve(a[1])), null, 2));
} else if (a[0] === "--compare" && a.length === 3) {
  compare(JSON.parse(readFileSync(a[1], "utf8")), resolve(a[2]));
} else if (a.length === 2) {
  compare(snapshot(resolve(a[0])), resolve(a[1]));
} else {
  console.error(usage());
  process.exit(1);
}
