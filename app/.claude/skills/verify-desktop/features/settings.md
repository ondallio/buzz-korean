# Settings

Settings opens from the profile card at the bottom of the sidebar and replaces the app with a settings view: a left nav grouped into Personal, Communities, and App, a panel per section, and `Back to app`. Appearance changes such as Dark color mode apply immediately and persist.

## Sub-features

- `settings-open` opens the profile menu and then the settings view.
- `settings-nav` shows the three groups and switches the panel for every rendered nav section (active button has `aria-pressed="true"`).
- `settings-appearance` switches Color mode to Dark (or Light/System); the `<html>` element gets the `dark` class and `localStorage["buzz-theme"]` becomes `buzz-dark`; it survives a reload.
- `settings-close` returns to the app with `Back to app`.

## How to get to it (user POV)

- Click your name/avatar card at the bottom-left of the sidebar, then `Settings` in the popover.
- Inside settings, click a section in the left nav; click `Back to app` at the top of the nav to leave.

## Driving it with verify-desktop

Run: `.claude/skills/verify-desktop/scripts/verify-desktop.sh drive --run-id <id> settings`

Preconditions:

- Doctor passes; baseline mock bridge; default (light) theme.

- **Profile menu.** Click the profile card. `getByTestId("open-settings").click()`. `getByTestId("profile-popover")` is visible. Captured as `01-profile-menu`.
- **Open settings.** Choose `Settings`. `getByTestId("profile-popover-settings").click()`. `getByTestId("settings-view")` is visible.
- **Nav groups.** Read the group lists. `locator('[aria-label$=" settings sections"]')`. Labels include `Personal settings sections`, `Communities settings sections`, `App settings sections` (recorded in `steps.jsonl`).
- **Every section.** For each rendered `[data-testid^="settings-nav-"]`, click it. `getByTestId("settings-nav-<section>").click()`. It gets `aria-pressed="true"` and `getByTestId("settings-panel-<section>")` is visible. Must include `profile`, `appearance`, `notifications`, `shortcuts`, `hosted-communities`, `experimental`, `updates`. Visible labels are saved to `nav-labels.json` (use it as the before/after table when translating). Captured as `02-nav-last-section`.
- **Dark mode.** Open Appearance and choose Dark. `getByTestId("settings-nav-appearance").click()`, `getByTestId("appearance-mode-dark").click()`. `document.documentElement` has class `dark`; `theme-localstorage.json` shows `buzz-dark`. Captured as `03-appearance-dark`.
- **Persistence.** `page.reload()`. `<html>` still has class `dark`.
- **Back to app.** Reopen settings, click `Back to app`. `getByTestId("settings-back-to-app").click()`. `settings-view` is hidden and `app-sidebar` is visible.
- **Restore.** Reopen Appearance and choose `appearance-mode-light`; `dark` class is gone.

## Gotchas

- The rendered sections depend on data and gates: `Invites` (`community-members`) does not render in mock mode, so it is unverified here; `Admin`, `Agents`, `Custom emoji`, `Channel templates` appear because the bridge enables preview features. Do not hard-code the full list.
- Group labels (`Personal`, `Communities`, `App`) are also baked into the nav's `aria-label` (`"<label> settings sections"`); translating the label changes the accessible name this journey asserts.
- The settings nav scrolls; a full-page screenshot after visiting the last section may hide `Profile` at the top. Screenshots are evidence of state, not of nav order; use `nav-labels.json` for order.
- `open-settings` is the sidebar profile card, not a gear icon; the test id name is historical.
- Color mode buttons are a segmented control with test ids `appearance-mode-system|light|dark`; their visible labels are English copy.
