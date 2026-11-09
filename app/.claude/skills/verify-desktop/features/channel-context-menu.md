# Channel context menu

Right-clicking a channel in the sidebar opens a menu to copy the channel's name or ID, move it to a custom section, mark it read or unread, mute it, star it, and leave it. Star moves the channel into a `Starred` section and both star and mute survive a reload.

## Sub-features

- `ctx-open` opens the menu on a channel row and lists `Copy`, `Move to section`, `Mark unread` (or `Mark as read`), `Mute channel`, `Star channel`, `Leave channel`.
- `ctx-copy` opens the `Copy` submenu with `Copy channel name` and `Copy channel ID`.
- `ctx-star` stars the channel: it appears in `starred-list`, the item flips to `Unstar channel`, state persists in `localStorage["buzz-channel-stars.v1:<pubkey>"]`.
- `ctx-mute` mutes the channel: the item flips to `Unmute channel`, state persists in `localStorage["buzz-channel-mutes.v1:<pubkey>"]`.
- `ctx-move` (mapped, not driven) assigns the channel to a custom section or creates one with `New section...`.
- `ctx-owner` (mapped, not driven) shows `Archive channel` / `Delete channel` (`archive-channel-<name>`, `delete-channel-<name>`) when the user can manage the channel.

## How to get to it (user POV)

- Right-click any channel name in the sidebar (including inside `Starred` or a custom section).
- There is no keyboard or button entry point (see Gotchas).

## Driving it with verify-desktop

Run: `.claude/skills/verify-desktop/scripts/verify-desktop.sh drive --run-id <id> channel-context-menu`

Preconditions:

- Doctor passes; baseline mock bridge; `engineering` is joined, not starred, not muted.
- Open menus are located with `menu = page.locator('[role="menu"][data-state="open"]').first()`.

- **Open menu.** Right-click `engineering`. `getByTestId("channel-engineering").click({ button: "right" })`. `menu` shows menuitems `Copy`, `Move to section`, `Mute channel`, `Star channel`; the full item list is recorded in `steps.jsonl`. Captured as `01-menu-open`.
- **Copy submenu.** Hover `Copy`. `menu.getByRole("menuitem", { name: "Copy" }).hover()`. Menuitems `Copy channel name` and `Copy channel ID` are visible. Captured as `02-copy-submenu`. Two `Escape`s close both levels (no open menu remains).
- **Star.** Right-click `engineering`, choose `Star channel`. `getByRole("menuitem", { name: "Star channel" }).click()`. `getByTestId("starred-list").getByTestId("channel-engineering")` is visible; star localStorage contains the engineering channel id (`star-localstorage.json`). Captured as `03-starred` (sidebar).
- **Mute.** Right-click the row again, choose `Mute channel`. `getByRole("menuitem", { name: "Mute channel" }).click()`. Mute localStorage contains the channel id (`mute-localstorage.json`).
- **Toggled labels.** Right-click again. `menu` shows `Unmute channel` and `Unstar channel`. Captured as `04-menu-after-toggle`.
- **Persistence.** Reload. `page.reload()`, then right-click `engineering`. Still in `starred-list`; menu still shows `Unmute channel`. Captured as `05-after-reload`.
- **Restore.** Choose `Unmute channel`, then right-click and `Unstar channel`. `starred-list` disappears.

## Gotchas

- Every menu item is located by its English label (no test ids except owner actions). Translating these labels breaks this journey and repo specs such as `desktop/tests/e2e/channel-star.spec.ts` and `channel-mute.spec.ts`; update names here in the same change.
- After starring, `channel-engineering` exists twice (Starred and Channels). Use `.first()` or scope to `starred-list`.
- Closed Radix menus stay mounted while animating out, so a bare `getByRole("menu")` hits two nodes. Use the `data-state="open"` scope.
- No keyboard path: rows have no "more" button and Playwright's `Shift+F10` does not raise `contextmenu`. Keyboard access is unverified; report it, do not fake it.
- `Mark unread` vs `Mark as read` depends on the row's unread state; `general` always has unread messages in mock mode.
- Leave/Archive/Delete change mock membership for the rest of the context; drive them last or in their own journey.
