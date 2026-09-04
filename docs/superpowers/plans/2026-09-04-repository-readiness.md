# Repository Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop generated coverage and SDD scratch files from dirtying the repository and provide complete contribution, issue, and pull-request guidance.

**Architecture:** This change is repository infrastructure only. Generated c8 output becomes ignored and untracked, while Markdown files under the conventional GitHub paths define the contributor workflow without adding runtime code or dependencies.

**Tech Stack:** Git ignore rules, npm scripts, c8, GitHub Markdown templates

## Global Constraints

- Keep the package and demo at zero runtime dependencies.
- Preserve Node.js 16 compatibility for the published library.
- Preserve direct `file://` execution of `demo/index.html` after `npm run demo`.
- Keep the existing unified inline diff result; side-by-side rendering is deferred.
- Keep the existing dark visual direction; this work adds controls and hierarchy without redesigning the page.
- Do not change the public library API in this work.
- Do not publish externally or implement issue #17 as part of these changes.

## PR Boundary

- Suggested branch: `chore/repository-readiness`
- PR title: `chore: prepare repository for contributors`
- Base: the commit containing `docs/superpowers/specs/2026-09-04-adoption-readiness-design.md`

---

### Task 1: Ignore and remove generated coverage artifacts

**Files:**
- Modify: `.gitignore:1-5`
- Delete: `coverage/tmp/coverage-16633-1788143345429-0.json`
- Delete: `coverage/tmp/coverage-16634-1788143344987-0.json`
- Delete: `coverage/tmp/coverage-16660-1788143345135-0.json`
- Delete: `coverage/tmp/coverage-16661-1788143345416-0.json`
- Delete: `coverage/tmp/coverage-16662-1788143345169-0.json`
- Delete: `coverage/tmp/coverage-16663-1788143345168-0.json`
- Delete: `coverage/tmp/coverage-16664-1788143345125-0.json`
- Delete: `coverage/tmp/coverage-16665-1788143345177-0.json`
- Delete: `coverage/tmp/coverage-16666-1788143345163-0.json`
- Delete: `coverage/tmp/coverage-16667-1788143345169-0.json`
- Delete: `coverage/tmp/coverage-16668-1788143345161-0.json`
- Delete: `coverage/tmp/coverage-16669-1788143345131-0.json`

**Interfaces:**
- Consumes: `npm run test:coverage`, which lets c8 write transient data under `coverage/`.
- Produces: a stable working tree where no path under `coverage/` is tracked or reported by Git and `.superpowers/` remains local scratch state.

- [ ] **Step 1: Reproduce the current failure**

Run:

```sh
npm run test:coverage
git status --short -- coverage
```

Expected: the coverage command passes, then Git reports deleted old PID/timestamp files and newly generated `coverage/tmp/*.json` files. This is the behavioral failure this task fixes.

- [ ] **Step 2: Add the exact ignore rule**

Insert `coverage/` after `dist/` and ignore the local SDD ledger so the top of `.gitignore` becomes:

```gitignore
node_modules/
dist/
coverage/
demo/string-diff.min.js
*.tsbuildinfo
.superpowers/
```

- [ ] **Step 3: Delete every tracked c8 temporary file**

Delete the twelve `coverage/tmp/coverage-*.json` paths listed in this task. Do not delete source, test, benchmark, or hand-authored report files.

- [ ] **Step 4: Verify the behavior is fixed**

Run:

```sh
npm run test:coverage
git status --short -- coverage
git ls-files coverage
git check-ignore .superpowers/sdd/progress.md
```

Expected: coverage passes with the configured thresholds; the two coverage-oriented Git commands print nothing; the final command prints `.superpowers/sdd/progress.md`.

- [ ] **Step 5: Commit the coverage cleanup**

```sh
git add .gitignore
git add -u coverage/tmp
git commit -m "chore: ignore generated coverage artifacts"
```

Expected: one commit containing the ignore rule and twelve deletions.

---

### Task 2: Add the contributor guide

**Files:**
- Create: `CONTRIBUTING.md`

**Interfaces:**
- Consumes: scripts declared in `package.json` and compatibility behavior declared in `.github/workflows/ci.yml`.
- Produces: the canonical local setup, test, performance, and pull-request workflow linked from `README.md` in the adoption-documentation plan.

- [ ] **Step 1: Create `CONTRIBUTING.md` with the complete workflow**

Use this exact content:

````markdown
# Contributing

Thanks for helping improve `@krkarma777/string-diff`.

## Development setup

Source tests use Node.js 24 because the test runner executes TypeScript files directly. The published ESM and CommonJS bundles support Node.js 16 and later; CI smoke-tests the built output on Node.js 16, 18, 20, and 22.

```sh
npm ci
```

## Development workflow

Use test-driven development for behavior changes:

1. Add the smallest test that demonstrates the expected behavior.
2. Run it and confirm it fails for the expected reason.
3. Implement the smallest change that makes it pass.
4. Run the complete verification gate.

The suite includes seeded fuzz round-trips, shortest-edit-script optimality checks against a reference dynamic program, and an oracle that compares the optimized scanner with the generic token pipeline. Preserve those invariants when changing tokenization or the Myers core.

## Verification

Run the full local gate before opening a pull request:

```sh
npm run typecheck
npm test
npm run build
```

For performance-sensitive changes, also run:

```sh
npm run perf:smoke
npm run bench
```

Benchmark comparisons must use the existing scenarios and report the environment, command, and median results. Do not replace measured results with theoretical estimates.

## Pull requests

- Keep each pull request focused on one behavior or repository concern.
- Include tests for behavior changes and regression fixes.
- Update `CHANGELOG.md` for user-visible changes.
- Include benchmark results when changing tokenization, allocation behavior, search logic, or heuristic thresholds.
- Do not add runtime dependencies without first discussing the bundle-size and compatibility impact in an issue.

## Reporting bugs

Include both input strings, the complete options object, the package and runtime versions, and the expected and actual entries. A minimal executable reproduction is the fastest way to make a report actionable.
````

- [ ] **Step 2: Verify every required instruction is present**

Run:

```sh
node -e "const s=require('node:fs').readFileSync('CONTRIBUTING.md','utf8'); for(const x of ['Node.js 24','Node.js 16, 18, 20, and 22','npm run typecheck','npm test','npm run build','npm run perf:smoke','npm run bench','test-driven development','CHANGELOG.md']) if(!s.includes(x)) throw new Error('missing: '+x)"
```

Expected: exit code 0 with no output.

- [ ] **Step 3: Commit the contributor guide**

```sh
git add CONTRIBUTING.md
git commit -m "docs: add contribution guide"
```

Expected: one documentation-only commit.

---

### Task 3: Add issue and pull-request templates

**Files:**
- Create: `.github/ISSUE_TEMPLATE/bug_report.md`
- Create: `.github/ISSUE_TEMPLATE/feature_request.md`
- Create: `.github/pull_request_template.md`

**Interfaces:**
- Consumes: the contribution requirements defined in `CONTRIBUTING.md`.
- Produces: structured GitHub issue input and a pull-request checklist that mirrors the existing CI gate.

- [ ] **Step 1: Create the bug report template**

Use this exact content in `.github/ISSUE_TEMPLATE/bug_report.md`:

````markdown
---
name: Bug report
about: Report incorrect diff output, an error, or a regression
title: ''
labels: ''
assignees: ''
---

## What happened?

<!-- Describe the incorrect behavior and its impact. -->

## Minimal reproduction

```ts
import { diff } from '@krkarma777/string-diff';

const a = '';
const b = '';
const options = {};

console.log(diff(a, b, options));
```

## Expected entries

```ts
[]
```

## Actual entries or error

```text
Paste the complete output or stack trace here.
```

## Environment

- Package version:
- Node.js or browser version:
- Operating system:
- Module format: ESM / CommonJS / IIFE

## Additional context

<!-- Include whether the problem is input-dependent, intermittent, or performance-related. -->
````

- [ ] **Step 2: Create the feature request template**

Use this exact content in `.github/ISSUE_TEMPLATE/feature_request.md`:

````markdown
---
name: Feature request
about: Propose a use case or improvement
title: ''
labels: enhancement
assignees: ''
---

## Problem and use case

<!-- Describe the user problem first. Include representative input when useful. -->

## Desired behavior

<!-- Describe what a successful result would make possible. -->

## API idea (optional)

```ts
// Show a possible call and result only when an API shape helps explain the request.
```

## Alternatives considered

<!-- Describe current workarounds or existing libraries you evaluated. -->

## Compatibility and performance

<!-- Note expected bundle-size, runtime, Unicode, or Node.js compatibility implications. -->
````

- [ ] **Step 3: Create the pull-request template**

Use this exact content in `.github/pull_request_template.md`:

```markdown
## Summary

<!-- Explain the user-visible behavior or repository problem this changes. -->

## Verification

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Added or updated tests for behavior changes
- [ ] Ran `npm run perf:smoke` and `npm run bench`, or performance is not affected
- [ ] Updated `CHANGELOG.md`, or the change is not user-visible

## Evidence

<!-- Include before/after output, benchmark results, or screenshots when they help reviewers verify the change. -->
```

- [ ] **Step 4: Verify GitHub can discover the files and required fields exist**

Run:

```sh
node -e "const fs=require('node:fs'); const files=['.github/ISSUE_TEMPLATE/bug_report.md','.github/ISSUE_TEMPLATE/feature_request.md','.github/pull_request_template.md']; for(const f of files) if(!fs.existsSync(f)) throw new Error('missing: '+f); const bug=fs.readFileSync(files[0],'utf8'); for(const x of ['Package version:','Node.js or browser version:','Expected entries','Actual entries or error']) if(!bug.includes(x)) throw new Error('bug template missing: '+x); const pr=fs.readFileSync(files[2],'utf8'); for(const x of ['npm run typecheck','npm test','npm run build','CHANGELOG.md']) if(!pr.includes(x)) throw new Error('PR template missing: '+x)"
```

Expected: exit code 0 with no output.

- [ ] **Step 5: Run the complete PR gate**

Run:

```sh
npm run typecheck
npm test
npm run build
git status --short -- coverage
```

Expected: type checking, all tests, and the build pass; the final command prints nothing.

- [ ] **Step 6: Commit the templates**

```sh
git add .github/ISSUE_TEMPLATE/bug_report.md .github/ISSUE_TEMPLATE/feature_request.md .github/pull_request_template.md
git commit -m "chore: add GitHub contribution templates"
```

Expected: one commit containing the three templates. The branch is ready for the `chore: prepare repository for contributors` PR.
