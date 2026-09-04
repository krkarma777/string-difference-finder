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
