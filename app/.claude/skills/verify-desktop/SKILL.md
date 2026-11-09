---
name: verify-desktop
description: >
  Drive the Buzz desktop app (desktop/, Tauri 2 + React 19) the way a user does
  and capture proof: launch a private mock-bridge build in headless Chromium,
  check it is healthy, run scripted journeys (sidebar navigation, channel
  right-click menu, sending a message, settings), and save screenshots, ARIA
  snapshots, and side-effect JSON. Use when you must confirm a desktop UI
  change actually works (for example after translating menus to Korean),
  before handing a desktop change to a human, or when asked to "verify",
  "drive", or "prove" desktop behavior. Not for PR screenshot hosting (that is
  the desktop-screenshot skill).
---

# verify-desktop

One helper does everything: `.claude/skills/verify-desktop/scripts/verify-desktop.sh`.
Run it from anywhere; it activates Hermit itself. All paths below are relative
to the repo root `/Users/stan/orca/buzz-main-kor`.

What you are driving: the desktop React frontend, built with `vite --mode e2e`
so the **mock Tauri bridge** (`desktop/src/testing/e2eBridge.ts`) stands in for
the Rust backend and the relay. It runs in headless Chromium through
Playwright. No Postgres, Redis, relay, or Tauri shell is needed. The mock bridge
is the production IPC boundary (`window.__TAURI_INTERNALS__`), so everything
above it (React, routing, menus, local persistence) is real code.

## Launch

```bash
.claude/skills/verify-desktop/scripts/verify-desktop.sh launch            # port 4317
.claude/skills/verify-desktop/scripts/verify-desktop.sh launch --port 4318 # second instance
```

Launch, from a fresh checkout:

1. Runs `pnpm install --frozen-lockfile` if `desktop/node_modules/@playwright/test` is missing, then `pnpm exec playwright install chromium` (no-op when present). `--skip-install` skips both.
2. Builds `vite build --mode e2e` into a **private** dir `/tmp/verify-desktop-<port>/dist` (never `desktop/dist`, which the repo's 4173 server may be serving), and refuses the build if the mock-bridge marker `__BUZZ_E2E_SIGNED_EVENTS__` is missing from the bundle (that means it was not an e2e build).
3. Serves it with `python3 -m http.server <port> --bind 127.0.0.1`, records the pid in `/tmp/verify-desktop-<port>/server.pid`.
4. Runs **doctor** (below). Ready = the last line is `READY http://127.0.0.1:<port>`. A 200 from the server is not enough; doctor must see the app boot.

Launch refuses a port that has any listener, and refuses 4173 outright (it
belongs to `desktop/playwright.config.ts` and `just desktop-screenshot`). Each
port is an independent instance, so parallel agents use different `--port`s.
Each journey runs in a fresh browser context (empty localStorage), so journeys
do not leak state into each other.

Build takes ~5 s, launch end to end ~10 s with deps present.

## Doctor

```bash
.claude/skills/verify-desktop/scripts/verify-desktop.sh doctor [--port N]
```

Read-only. Prints one line per check, exit 0 only if all pass:

- `ok server pid N owns http://127.0.0.1:<port>`: our pid file exists, the pid is alive, and it is the port's listener (`lsof`).
- `ok build is newer than every file under desktop/src`: otherwise `STALE ...` and exit 2. Run `cleanup` then `launch` to rebuild. Driving a stale build verifies old code.
- `ok app boots with mock bridge`: runs `journeys/_doctor.spec.ts`, which installs the mock bridge, loads `/`, and waits for `[data-testid=app-sidebar]` and `[data-testid=channel-general]`.

Run doctor first whenever anything looks off (blank page, "Community connection failed", timeouts).

## Drive

```bash
.claude/skills/verify-desktop/scripts/verify-desktop.sh list
.claude/skills/verify-desktop/scripts/verify-desktop.sh drive [--port N] [--run-id ID] [--headed] <journey>...
# e.g.
.claude/skills/verify-desktop/scripts/verify-desktop.sh drive --run-id ko-menus sidebar-navigation channel-context-menu settings
```

Journeys are Playwright specs in `.claude/skills/verify-desktop/journeys/`, one
per feature file in `features/`. They run with
`playwright.verify.config.ts` (baseURL = our port, no `webServer`, so a stale
server can never be silently reused). Exit code is non-zero if any journey
failed. The feature files are the recipe: read `features/README.md`, then the
feature you need.

Writing a new journey or a one-off probe:

- Put it in `journeys/<name>.spec.ts` and import from `./_support`:
  `installMockBridge`, `openSettings`, `openChannelBrowser` (re-exported from
  `desktop/tests/helpers/`), `bootApp(page)`, `MOCK_PUBKEY`, `CHANNEL_IDS`, and
  `new Evidence(page, testInfo, "<feature-id>")`.
- Call `installMockBridge(page)` (and any `page.addInitScript` localStorage seeding **before** it) before `page.goto`.
- Prefer `getByTestId` handles (`channel-<name>`, `chat-title`, `message-input`, `send-message`, `message-timeline`, `open-settings`, `profile-popover-settings`, `settings-nav-<section>`, `settings-panel-<section>`, `starred-list`, `global-back`, `global-forward`, `open-workflows-view`). Menu items have no test ids; use `getByRole("menuitem", { name })`.
- Live messages from other users: navigate to the channel first, poll `window.__BUZZ_E2E_HAS_MOCK_LIVE_SUBSCRIPTION__({channelName})`, then call `window.__BUZZ_E2E_EMIT_MOCK_MESSAGE__({channelName, content, pubkey?})`. Emits before a subscription exists are dropped silently.
- Mock channels: `general` (pre-seeded messages, always unread), `random`, `design`, `sales` (not joined), `engineering`, `agents`, `watercooler`, `announcements`, DMs `alice-tyler`, `bob-tyler`. Use `engineering` for a clean "no unread" row.
- `--headed` shows a real window. Headless Chromium mis-renders `backdrop-filter` inside rounded clips (cyan blocks); that is a capture artifact, not a bug.

## Evidence

Every drive writes to `desktop/test-results/verify-desktop/<run-id>/`
(default run id `run-YYYYMMDD-HHMMSS`; `desktop/test-results/` is gitignored):

- `<journey>.playwright.log`: full Playwright output, pass/fail per journey.
- `<feature>/NN-<label>.png` + `NN-<label>.aria.txt`: screenshot and ARIA snapshot after each proof step, taken after `waitForAnimations` so Radix menus are not mid-fade.
- `<feature>/steps.jsonl`: the user action behind each capture, plus notes (URLs, menu item lists).
- `<feature>/*.json`: side effects read back from the app's real persistence or the mock relay boundary (`localStorage` star/mute/theme keys, `window.__BUZZ_E2E_SIGNED_EVENTS__` kind-9 messages with their `h` channel tag).

Failure artifacts (failure screenshot, `error-context.md` with the page's ARIA
tree, `trace.zip`) go to `/tmp/verify-desktop-<port>/pw-output/<run-id>/` and
are deleted by cleanup. Copy them into the evidence dir if you need to keep them.
`npx playwright show-trace <trace.zip>` (from `desktop/`) opens a trace.

Proof standards:

- Drive the user path: clicks, right-clicks, typing, keyboard chords on real elements. Never call React setters, router APIs, or write the localStorage you are trying to prove; seeding preconditions via `addInitScript` is fine and must be stated.
- Capture the action and the resulting state, not only the final screen.
- Prove side effects through a second view: reload or navigate away and back, plus the JSON readback.
- The mock bridge replaces only the Tauri/relay boundary. Anything that depends on the real relay (other users' clients receiving a message, server-side membership, NIP-29 enforcement) is **not** proven by this skill; say so in your report or use the relay-backed path below.
- A skipped entry point is reported as skipped, never as verified through another path.

## Cleanup

```bash
.claude/skills/verify-desktop/scripts/verify-desktop.sh cleanup [--port N]
```

Kills only the pid recorded in `/tmp/verify-desktop-<port>/server.pid`
(TERM, then KILL after 2 s), deletes `/tmp/verify-desktop-<port>/` (private
dist, logs, Playwright failure output), and **keeps**
`desktop/test-results/verify-desktop/`. It never kills by name and leaves any
foreign listener on the port alone (it prints a note instead). Run cleanup
after every failed attempt too, then `launch` again.
`.claude/skills/verify-desktop/node_modules` is a symlink to
`desktop/node_modules` (created on demand so journeys resolve the same
`@playwright/test` as the repo helpers); leave it.

## Relay-backed path (secondary, not proven by this skill)

For behavior that needs a real relay, the repo's own integration project uses
`installRelayBridge` (`desktop/tests/helpers/bridge.ts`) against a local relay
at `BUZZ_E2E_RELAY_URL` (default `http://localhost:3000`):

```bash
. ./bin/activate-hermit
# Docker must be running (Postgres + Redis)
just desktop-e2e-seed          # services, migrations, deterministic channels
just relay                     # ws://localhost:3000, leave running
cd desktop && pnpm test:e2e:integration   # uses port 4173 with reuseExistingServer
```

This path shares port 4173 and `desktop/dist` with other users of the repo
config, so kill a stale 4173 server you started before rerunning. It was not
exercised when this skill was generated (Docker daemon was not running), so
treat these steps as unverified.

## Gotchas

- **English-text locators vs. Korean localization.** Many handles are English UI copy, not test ids: the sidebar `Inbox` button (no test id at all), every channel context-menu item (`Copy`, `Move to section`, `Mark unread`, `Mute channel`, `Star channel`, `Leave channel`, `Copy channel name`, `Copy channel ID`, `Unmute channel`, `Unstar channel`), and the settings nav group lists (`aria-label="Personal settings sections"` etc.). Across `desktop/tests/e2e/`, 134 of 186 spec files use `getByRole(..., { name })`/`getByText`/`getByLabel` (about 2,700 call sites). After translating, update the names in these journeys (and expect repo specs to fail) or locate by test id/position. Test ids (`settings-nav-<section>`, `channel-<name>`, `appearance-mode-dark`) are language-independent; channel names like `general` are data, not UI copy.
- **Never `pnpm run build` for this.** A non-e2e build has no mock bridge; the app shows "Community connection failed", which looks like a product bug. Launch guards against it with the bundle marker check.
- **Stale server.** `desktop/playwright.config.ts` reuses any server on 4173 (`reuseExistingServer`). This skill avoids that by owning its own port and private dist, and doctor flags source edits newer than the build.
- **Radix menus linger while closing.** A closed `[role=menu]` stays mounted during its exit animation; `getByRole("menu")` then matches two nodes. Scope to `[role="menu"][data-state="open"]`.
- **No keyboard path to the channel context menu.** Rows have no "more" button, and Playwright's `Shift+F10` does not raise `contextmenu`. Keyboard access to this menu is unverified (and may be an accessibility gap worth raising).
- **Settings nav is data-dependent.** `Invites` (`community-members`) does not render in mock mode; `Admin`, `Agents`, `Custom emoji`, `Channel templates` depend on gates the bridge enables by default. Journeys enumerate the rendered `settings-nav-*` buttons and require a core set.
- **Platform chords.** History is `Meta+[`/`Meta+]` on macOS and `Alt+ArrowLeft/Right` elsewhere; global shortcuts (`Mod+Shift+O` channel browser, `Mod+K` search) are dispatched as `window` keydown events by the repo helpers.
- **PR images.** To post evidence PNGs on a PR use `scripts/post-screenshots.sh` (see the desktop-screenshot skill), never relay media URLs.
