# Send a message

A user types in a channel's composer and sends with the send button or Enter; Shift+Enter adds a line break. The message appears in the timeline, the draft clears, and a signed kind-9 event tagged with the channel's `h` id reaches the relay boundary.

## Sub-features

- `send-button` sends the draft with the round send button.
- `send-enter` sends with Enter; `Shift+Enter` inserts a newline into the same message.
- `send-empty` does nothing when the draft is empty.
- `send-persist` keeps the sent message in the channel after navigating away and back.

## How to get to it (user POV)

- Open a channel in the sidebar, click the composer at the bottom (`Message #<channel>`), type, then click the send arrow or press Enter.

## Driving it with verify-desktop

Run: `.claude/skills/verify-desktop/scripts/verify-desktop.sh drive --run-id <id> send-message`

Preconditions:

- Doctor passes; baseline mock bridge; `random` is joined.
- Side effects are read from `window.__BUZZ_E2E_SIGNED_EVENTS__` filtered to `kind === 9`, the mock relay's record of events the app signed and published.

- **Empty guard.** Click the composer and press Enter with nothing typed. `getByTestId("message-input").click()`, `page.keyboard.press("Enter")`. The kind-9 count is unchanged.
- **Type draft.** `getByTestId("message-input").fill("verify button <stamp>")`. Captured as `01-draft`.
- **Send by button.** `getByTestId("send-message").click()`. `getByTestId("message-timeline")` contains the text and the composer is empty. Captured as `02-sent-button`.
- **Send by Enter, multiline.** `page.keyboard.type("verify enter <stamp>")`, `press("Shift+Enter")`, `type("second line")`, `press("Enter")`. Timeline contains both lines.
- **Relay side effect.** Read signed kind-9 events containing `<stamp>`. Exactly two, contents `verify button <stamp>` and `verify enter <stamp>\nsecond line`, each with an `h` tag (`signed-kind9-events.json`).
- **Second view.** Click `general` (timeline no longer shows the text), then `random`. `getByTestId("channel-general").click()`, `getByTestId("channel-random").click()`. Both messages are back in the timeline. Captured as `03-after-revisit`.

## Gotchas

- Proof stops at the mock relay. Delivery to other clients, relay acceptance, and server-side ordering need the relay-backed path.
- `fill()` on the TipTap/ProseMirror composer can race with the app's own focus handling in edit mode; use `replaceComposerText` / `clearComposer` from `desktop/tests/helpers/composer.ts` when editing an existing draft.
- Other signed events (read markers, presence) interleave with messages; always filter by `kind === 9` and a unique stamp.
- Pasting a URL triggers link-preview preparation, which changes send timing; keep proof messages URL-free unless link previews are the subject.
- The composer placeholder (`Message #general`) is English UI copy; locate the composer by `message-input`, not by placeholder.
