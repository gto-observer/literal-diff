# literal-diff

Finds when an AI coding agent silently changes error messages, output keys, or other string literals during a refactor.

## Why

If tests match messages with regular expressions, the tests can pass even when the wording changes. This tool only asks whether string literals that existed before are missing afterward.

## Usage

```text
literal-diff --snapshot <dir> <out.json>
literal-diff --compare <snapshot.json> <dir>
literal-diff <before-dir> <after-dir>
```

Example output:

```text
"old error" (src/example.js)
Missing string literals: 1
```

Exit code `3` means at least one literal is missing. Exit code `0` means none are missing. Invalid arguments use exit code `1`.

Before an agent refactor, copy the project and compare the copy afterward:

```text
literal-diff before after
```

Or save a snapshot first, then compare later:

```text
literal-diff --snapshot . before.json
literal-diff --compare before.json .
```

## GitHub Actions

To compare a pull request base and head, check out each revision into a separate folder:

```yaml
name: Check string literals
on: [pull_request]
jobs:
  literal-diff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.base.sha }}
          path: before
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          path: after
      - uses: actions/checkout@v4
        with:
          repository: gto-observer/literal-diff
          path: tool
      - run: node tool/literal-diff.mjs before after
```


The same workflow is in `examples/github-action.yml`.

## Limits

- Renaming an unquoted object key such as `entry_id:` is not detected.
- A string changed intentionally and correctly is also reported as missing. Treat a warning as a prompt to read the diff, not as proof of a bug.
- Files are scanned only when their extension is `.js`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.jsx`, `.py`, or `.ps1`.

## Measured results

We ran 460 delegated refactors (two rename tasks, with the run counts and pass criteria fixed before running) and checked each result with this tool.

- The agent broke behavior in 90 runs. The tool warned on 89 of them.
- 87 of those were silent breaks: the visible tests still passed. The tool warned on all 87.
- In the 370 runs that passed the hidden tests, it raised no warning.

Most breaks were bulk rewrites of error-message text, such as a prefix inside `throw new Error("...")`, that regex-based tests did not notice.

These numbers come from two tasks and one agent setup. Expect different rates on other code. In particular, a refactor that is supposed to change strings will always produce warnings.
 
