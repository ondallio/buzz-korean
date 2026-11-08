# Desktop Korean localization

## Contract

Localize all app-owned desktop UI, including onboarding, navigation, chat, search, settings, agents, projects, workflows, gated/admin features, accessible labels, errors, dates/numbers and native notifications/menus. Preserve user content, protocol fields, storage values, commands and identifiers. English and Korean are selectable, durable device preferences; absent preference follows OS language. Missing Korean falls back to English and remains incomplete.

## Workflow

- [x] Read the Principles section of poteto-mode.
- [x] Phase A: Frame.
- [x] Phase B: Design the workflow.
- [x] Phase C: Run the implementation → verification → independent review → repair loops.
- [x] Phase D: Keep the audit trail and independently review repaired scope.
- [ ] Phase E: Full release readiness: native IME/OS behavior, original Git differential gate and human confirmation remain pending. Agent implementation/automated verification is handed back with explicit limits.

Concrete units: source baseline and backup; locale store/catalog validation; AST extraction and migration; screen partition catalogs; date/number and native integration; fresh user journeys; independent review and fixes; full checks and handoff.

Each unit records hypothesis, actual changes, verification and remaining gaps. No prior screenshot or log proves a new change. Independent review inherits the parent model; no cross-provider assurance is claimed.

## Baseline and recovery

This directory has no `.git` and no verified source commit. Existing package version is desktop 0.5.28. Do not initialize or connect a guessed repository. Pre-change archive `/private/tmp/buzz-korean-backup-20261108/baseline.tar.gz` and SHA-256 manifest beside it cover 3,258 files including desktop source, Rust source, tests, scripts, manifests and existing verification driver. Restore only specifically selected files, preserving later user work. Hash comparison supplies a change inventory.

Existing proof-20261108 logs cover four English mock journeys only, not Korean/native/relay execution. Preliminary AST inventory found at least 3,282 straightforward display literals; this excludes templates and many notification/error paths and is not the final denominator.

## Ownership

Root owns migration tooling, integration, work records and consolidation. Workers own explicitly assigned disjoint files. Locale changes must notify subscribed components even behind memoization. Do not remount the root to change language. Module-time labels must not freeze translations.

## Done predicate

Every screen family has an audited inventory, extracted app-owned copy is translated or specifically excluded with rationale, catalog parameters validate, locale switching/persistence works, fresh changed user journeys and checks pass, independent material review findings are resolved. Native IME and relay behavior require actual matching runtime evidence. Unreachable paths and checks that cannot run remain explicitly unverified. Human self-testing is never marked complete by an agent.

## Throughput checkpoint

This is a migration across roughly 1,748 production JS/TS modules. Deterministic AST extraction handles repeated source edits; workers translate exclusive catalog partitions. Coverage numbers refer to extraction classes, never a claim that all possible user-facing English has been found. Sweep dynamic paths, module data and Rust separately. Current desktop is legacy per AGENTS; scope is this checkout, with no mobile design migration.

## Final agent checkpoint

See [README.md](README.md) for the verified result, runnable commands and user checklist. Desktop7018 unit+285 mounted tests, native3533 passed/20 ignored, browser11 passed; real OSS/internal production artifacts pass the unchanged boundary guard. Latest just ci reaches the differential file-size gate and fails because this source directory has no Git metadata. Earlier missing-mobile-dependency and Rust-lint/build issues were repaired, not waived. Original source commit remains unknown. Native IME, delivered OS behavior, live relay branches and human self-testing remain explicitly unverified. No PR or release was created.
