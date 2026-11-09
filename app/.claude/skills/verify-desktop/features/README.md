# Buzz desktop verification map

This directory is the maintained source for verifying user-facing behavior of the Buzz desktop app (`desktop/`). Read this index before driving the app, then use the matching feature file as the recipe. Each feature has a journey at `../journeys/<feature>.spec.ts` that executes the recipe.

## Baseline preconditions

- Launch a private instance: `.claude/skills/verify-desktop/scripts/verify-desktop.sh launch [--port N]` (default port 4317, never 4173). Require the final `READY http://127.0.0.1:<port>` line.
- `verify-desktop.sh doctor` passes all three checks (pid owns port, build newer than `desktop/src`, app boots with mock bridge).
- Every journey starts from a fresh browser context with `installMockBridge(page)`: community `E2E Test`, onboarding complete, identity `npub1mock...` (pubkey `deadbeef` x8), preview features on, mock channels `general`, `random`, `design`, `sales`, `engineering`, `agents`, `watercooler`, `announcements` and DMs.
- Never drive an instance this skill did not start (anything on 4173, a `just desktop-dev` server, the Tauri app).

## Driving conventions

- Run journeys with `verify-desktop.sh drive [--run-id ID] <feature>`; write one-off probes as new specs under `../journeys/` importing `./_support`.
- Prefer `data-testid` handles. Use `getByRole(..., { name })` only where no test id exists and say so in the feature file, because those names change under localization.
- Seed preconditions with `page.addInitScript` before `installMockBridge`; never write the state you are proving.
- Each journey restores what it toggles, but contexts are fresh per journey anyway.

## Proof and skip reporting

- Capture the user action and the resulting state with `Evidence.capture(label, action, scope?)` (PNG + ARIA snapshot + `steps.jsonl` line).
- Mutation proof includes a JSON readback (`Evidence.writeJson`) and a second view (reload, or navigate away and back).
- Evidence lives in `desktop/test-results/verify-desktop/<run-id>/<feature>/`; the Playwright log is `<run-id>/<feature>.playwright.log`.
- Report an unreachable entry point with the attempted step and the unmet precondition. Do not report it as verified through another path.
- State that mock-bridge proof stops at the Tauri/relay boundary.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior, then exactly four H2 sections in this order:

1. `Sub-features` lists short IDs with one line each.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with verify-desktop` starts with `Preconditions:` and uses labeled bullets pairing each user action with the exact Playwright call and the observable result.
4. `Gotchas` lists traps that waste or invalidate a run.

## Features

- [Sidebar navigation](./sidebar-navigation.md) covers channel rows, back/forward (buttons and keyboard), Inbox and Workflows, and the channel browser.
- [Channel context menu](./channel-context-menu.md) covers the right-click menu on a sidebar channel: items, Copy submenu, Star and Mute with persistence.
- [Send a message](./send-message.md) covers composing and sending in a channel by button, Enter, and Shift+Enter, with the signed kind-9 event as side effect.
- [Settings](./settings.md) covers opening settings from the profile menu, every rendered nav section, Dark color mode persistence, and Back to app.
