# Buzz Korean automatic updates implementation plan

> For agentic workers: execute each unit with production-bound tests and an independent review. Ownership is explicit; no shared-file concurrent edits.

Goal: detect stable Buzz releases and deliver verified Korean Mac updates without replacing the user's existing app or exposing credentials.

Architecture: trusted management repository at `ondallio/buzz-korean`, verified localized source under `app/`, explicit-snapshot three-way integration, isolated verification, dedicated signer and versioned release feed. Tech: Git, Node built-ins, GitHub Actions/CLI, pinned Hermit toolchain, Tauri updater. Spec: `design.md`.

## Global constraints

- Canonical source baseline ff6ab96e42b1fc64bfc1236104478a84e11b5abd; last stable desktop-v0.5.28 is older. No downgrade.
- Public source/release repository ondallio/buzz-korean, initial darwin-aarch64 only, channel1.0.N.
- Existing folder, running app, official credentials and user content remain intact. No production secrets in source/logs/PR jobs.
- Update and manual URLs must remain Korean; no upstream workflows at management root.

## Unit1: recover source provenance and isolated management checkout

- [x] Verify archive/current-source Git blob identities and distinguish adjacent official commits.
- [x] Import the exact official tree under app/, overlay approved Korean source, export required audit inputs without local archives or credentials.
- [x] Commit with DCO sign-off and preserve original commit/tree in upstream.lock.json; inspect full staged paths and secret candidates.
- [x] Create/publish only the approved ondallio/buzz-korean repository with its trusted workflow allowlist.

## Unit2: deterministic stable-release integration

- [x] Add real temporary-repository tests for exact snapshot merge, unrelated side-history candidates, conflicts leaving main intact, malformed/untrusted/retargeted releases and numeric versions.
- [x] Implement canonical release selection, bounded Git/API calls, pinned lock data and explicit merge-base tree generation.
- [x] Exercise current official latest and prove it does not downgrade the newer source snapshot.

## Unit3: persistent native channel identity

- [x] Add production Rust/JS tests showing separate keyring/nest/CLI/link/OAuth roots and Korean download URL; reject incompatible demo/channel flags.
- [x] Implement the named Korean identity and release overlay without changing ordinary official/dev defaults.
- [ ] Verify type/lint/native tests and the actual bundled updater configuration, public key and architecture.

## Unit4: isolated validation, signing and publication

- [x] Add tests for strict artifacts, immutable same-version retry, version monotonicity and rejection of stale/foreign/invalid manifests.
- [x] Implement six-hour sync, candidate validation/build without secrets, and separate trusted signer/publisher workflow jobs.
- [x] Generate and back up a dedicated signing key outside source, configure only the approved repository secrets, and verify public/private separation.
- [ ] Run and inspect a real workflow; repair failures until a real channel release and valid manifest exist or an external prerequisite is proven.

## Unit5: native update and final independent review

- [ ] Inspect published asset checksums/signature/architecture and test the actual updater endpoint from a channel-enabled app.
- [ ] Exercise native N-to-N+1 replacement when the current desktop tools can do so; otherwise state the exact missing evidence.
- [ ] Resolve independent review blockers, record commands/URLs/source hashes, preserve user's human confirmation pending, and hand back installation instructions.

No plan-only stopping point is intended. Material policy choices and validation receipts go in `decisions.tsv` and `STATUS.md` beside this plan.
