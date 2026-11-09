# Sidebar navigation

The left sidebar lets a user open channels, step back and forward through what they viewed, jump to Inbox and the other primary views, and browse channels they have not joined.

## Sub-features

- `nav-channel` opens a channel by clicking its sidebar row; the header shows its name and the URL is `#/channels/<id>`.
- `nav-history` moves back and forward through visited views with the toolbar arrows and with keyboard chords, including while the composer has focus.
- `nav-primary` opens Inbox and Workflows from the primary menu (Pulse, Projects, Agents sit in the same menu, not yet mapped).
- `nav-browse` opens the channel browser dialog with the keyboard shortcut and closes it with Escape.

## How to get to it (user POV)

- Click a channel name under `Channels` in the sidebar.
- Click the `<` / `>` arrows at the top of the sidebar, or press `Cmd+[` / `Cmd+]` (macOS) or `Alt+Left` / `Alt+Right` (other platforms).
- Click `Inbox` or `Workflows` at the top of the sidebar.
- Press `Cmd+Shift+O` (`Ctrl+Shift+O` elsewhere) to browse channels.

## Driving it with verify-desktop

Run: `.claude/skills/verify-desktop/scripts/verify-desktop.sh drive --run-id <id> sidebar-navigation`

Preconditions:

- Doctor passes; baseline mock bridge (channels `general`, `random` joined).

- **Open channel.** Click `random` in the sidebar. `page.getByTestId("channel-random").click()`. `getByTestId("chat-title")` has text `random`; URL matches `#/channels/`. Captured as `01-random-open`.
- **Back/forward buttons.** After visiting `general` then `random`, click back, then forward. `getByTestId("global-back").click()`, `getByTestId("global-forward").click()`. Title goes `general`, then `random`.
- **Back/forward keyboard.** Click into the composer, press the chord. `getByTestId("message-input").click()`, `page.keyboard.press("Meta+[")` then `"Meta+]"` (or `Alt+ArrowLeft/Right`). Title goes `general`, then `random`.
- **Inbox.** Click `Inbox`. `getByTestId("sidebar-primary-menu").getByRole("button", { name: "Inbox", exact: true }).click()`. `getByTestId("home-inbox-list")` is visible. Captured as `02-inbox`.
- **Workflows.** Click `Workflows`. `getByTestId("open-workflows-view").click()`. URL ends `#/workflows` and `getByTestId("workflows-view")` is visible. Captured as `03-workflows`.
- **Channel browser.** Press the shortcut. `openChannelBrowser(page)` (dispatches `Mod+Shift+O`). `getByTestId("channel-browser-dialog")` is visible with `[data-testid^="browse-channel-"]` rows; `Escape` hides it. Captured as `04-channel-browser` (dialog only) and `05-sidebar-final` (sidebar only).

## Gotchas

- `Inbox` has no test id; it is found by its English accessible name and will break when the label is translated. Prefer adding a test id over translating the locator.
- `general` is pre-seeded with unread messages, so its row always shows an unread state; use `engineering` for a neutral row in screenshots.
- The composer autofocuses on channel switch; the keyboard-history step deliberately clicks into it to prove the chords still fire inside the editor.
- The channel browser has no visible sidebar button; the shortcut is the only entry point. The repo helper dispatches the keydown on `window`, not through the OS.
- Pulse, Projects, and Agents views are reachable in the same menu but not mapped yet.
