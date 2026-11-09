# Buzz Korean update channel

The user approved official stable-release detection, Korean integration in a separate checkout, verification, signed channel publication, and user-triggered in-app installation. The user explicitly selected public `ondallio/buzz-korean`. This is an independent distribution, not a Block-signed official release.

## Source and repository

Keep `/Users/stan/orca/buzz-main-kor` and its running app untouched. Create `/Users/stan/orca/buzz-korean` as a real management repository. Its `app/` directory contains the verified official snapshot `ff6ab96e42b1fc64bfc1236104478a84e11b5abd` plus the existing Korean changes. The original workflows live below `app/.github` and cannot run as management workflows. Only newly reviewed root `.github/workflows` control synchronization, verification and release. Original license and source SHA are retained. Public export excludes `.env`, credentials, caches, build outputs, local recovery archives, private logs and unrelated user files.

The baseline is newer than current stable `desktop-v0.5.28` at `f87c10895ea35a9a2cea629fef1d7532a3fecbc5`. Do not replace it with that older release. Record both the applied source commit and last observed stable release. Select only newer stable `desktop-vX.Y.Z` versions from `block/buzz`; never treat relay/mobile/rolling/draft/prerelease releases as desktop updates. Fetch and peel the exact tag, verify the release commit identity, and reject retargeting of a recorded tag. Verify source manifests match declared upstream versions.

Future release candidates use side history, so merge using the exact previously applied source tree as an explicit merge base. Build synthetic comparison trees with only `app/` replaced; use Git's real three-way merge, not text replacement or inferred ancestry. A conflict leaves main, current artifacts and the original folder unchanged and records failure. The root management files are never merged from upstream source.

## Native distribution

Initial supported platform is this user's Apple Silicon Mac, `darwin-aarch64`. Distribution identity is fixed: `io.github.ondallio.buzz-korean`, product `Buzz Korean`, keyring `buzz-korean-desktop`, nest `.buzz-korean`, CLI/scheme `buzz-korean`, scoped agent OAuth/config cache. All migration/reset paths respect the boundary. Existing official/dev credentials are not automatically copied. Do not reuse a disposable demo identity. Use independent monotonically increasing channel versions `1.0.N`; keep official source version/commit separately in release metadata.

The release overlay pins the Korean channel endpoint and public key. Manual download links point to the same Korean repository. Clipboard links retain the canonical `buzz://` format so they remain readable in existing Buzz clients, composers and previews. The Korean app declares both `buzz://` and its dedicated `buzz-korean://` scheme; both normalize to the same canonical navigation payload. The OS/user selects the external default handler. The app does not explicitly change that preference. Its app identifier, keyring, data folders and CLI remain isolated.

No Apple Developer signing identity is available in the current keychain. Ad-hoc signing is an explicit initial limitation, not notarization. Do not disable Gatekeeper or remove quarantine automatically. Independently verify update signatures with a dedicated Tauri key. Initial install and native N-to-N+1 replacement remain actual validation tasks; a mocked update is not sufficient.

## Automation and trust

Check stable upstream releases every six hours and on manual dispatch. Keep one candidate at a time. Build and test candidate code without release secrets or persisted push credentials. Root workflow definitions and signer code come from the trusted management revision. Validate all inputs, pin action commits and source SHA, bound subprocess time/output and retries. Never interpolate release titles, refs or PR text into shell programs.

Only after successful current candidate verification may a separate signer/publisher job obtain the signing key and write releases. It must not execute candidate code while holding that key. Use a pinned trusted signer, same-run artifact identity, strict artifact names/digests and architecture checks. Use one publishing concurrency group, compare the current public channel version immediately before publication, and reject stale/downgrading jobs. GitHub token-triggered follow-up behavior must be exercised rather than assumed; explicitly dispatch trusted validation when needed.

Stage the complete versioned draft release including `.app.tar.gz`, `.sig`, DMG, checksums, provenance and `latest.json`. Verify all assets before publishing and making it latest. The endpoint `https://github.com/ondallio/buzz-korean/releases/latest/download/latest.json` follows only complete Korean releases. Do not overwrite versioned public assets. On failure, keep the previous valid latest release. Same-version retry is allowed only for identical source and artifact digests. Keep failure logs durable in Actions.

## Acceptance and limits

Run automation unit/CLI tests against real temporary Git repositories, including side-history merge, conflicting translations, retargeted tags, version ordering and failed/stale publication. Exercise the real upstream check with current official state. Run Korean static checks, type/lint/tests, OSS/internal artifact checks and native identity/build tests in the new checkout; original passing receipts are not new evidence. Publish and inspect a real signed test release only after independent review. Preserve the human/native IME limitations from the localization handoff. Never claim the current debug app automatically updates; the first channel-enabled app must be installed separately.
