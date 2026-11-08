import { t as localize } from "@/shared/i18n";
import { isMacPlatform } from "@/shared/lib/platform";

export const HUDDLE_SHORTCUT_EVENT = "buzz:huddle-shortcut";

export type HuddleShortcutDetail = {
  channelId: string;
};

export type ShortcutCategory =
  | "Navigation"
  | "Messages"
  | "Formatting"
  | "Zoom";

export type KeyboardShortcut = {
  id: string;
  label: string;
  description: string;
  keys: string;
  keysWindows: string;
  category: ShortcutCategory;
};

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  // Navigation
  {
    id: "quick-search",
    get label() {
      return localize("Quick search");
    },
    get description() {
      return localize("Open the search dialog");
    },
    keys: "⌘K",
    keysWindows: "Ctrl+K",
    category: "Navigation",
  },
  {
    id: "browse-channels",
    get label() {
      return localize("Browse channels");
    },
    get description() {
      return localize("Open the channel browser");
    },
    keys: "⇧⌘O",
    keysWindows: "Shift+Ctrl+O",
    category: "Navigation",
  },
  {
    id: "browse-dms",
    get label() {
      return localize("New direct message");
    },
    get description() {
      return localize("Open the new message composer");
    },
    keys: "⇧⌘K",
    keysWindows: "Shift+Ctrl+K",
    category: "Navigation",
  },
  {
    id: "new-channel",
    get label() {
      return localize("New channel");
    },
    get description() {
      return localize("Open the create channel dialog");
    },
    keys: "⇧⌘N",
    keysWindows: "Shift+Ctrl+N",
    category: "Navigation",
  },
  {
    id: "open-settings",
    get label() {
      return localize("Settings");
    },
    get description() {
      return localize("Open or close settings");
    },
    keys: "⌘,",
    keysWindows: "Ctrl+,",
    category: "Navigation",
  },
  {
    id: "go-back",
    get label() {
      return localize("Go back");
    },
    get description() {
      return localize("Navigate to the previous page");
    },
    keys: "⌘[",
    keysWindows: "Alt+←",
    category: "Navigation",
  },
  {
    id: "go-forward",
    get label() {
      return localize("Go forward");
    },
    get description() {
      return localize("Navigate to the next page");
    },
    keys: "⌘]",
    keysWindows: "Alt+→",
    category: "Navigation",
  },
  {
    id: "find-in-channel",
    get label() {
      return localize("Find in channel");
    },
    get description() {
      return localize("Search messages in current channel");
    },
    keys: "⌘F",
    keysWindows: "Ctrl+F",
    category: "Navigation",
  },
  {
    id: "go-home",
    get label() {
      return localize("Home");
    },
    get description() {
      return localize("Navigate to the home feed");
    },
    keys: "⇧⌘A",
    keysWindows: "Shift+Ctrl+A",
    category: "Navigation",
  },
  {
    id: "toggle-sidebar",
    get label() {
      return localize("Toggle sidebar");
    },
    get description() {
      return localize("Show or hide the sidebar");
    },
    keys: "⌘S",
    keysWindows: "Ctrl+S",
    category: "Navigation",
  },
  {
    id: "mark-current-read",
    get label() {
      return localize("Mark as read");
    },
    get description() {
      return localize("Mark the current conversation as read");
    },
    keys: "Escape",
    keysWindows: "Escape",
    category: "Navigation",
  },
  {
    id: "mark-all-read",
    get label() {
      return localize("Mark all as read");
    },
    get description() {
      return localize("Mark all conversations as read");
    },
    keys: "⇧Escape",
    keysWindows: "Shift+Escape",
    category: "Navigation",
  },

  // Zoom
  {
    id: "zoom-in",
    get label() {
      return localize("Zoom in");
    },
    get description() {
      return localize("Increase the zoom level");
    },
    keys: "⌘+",
    keysWindows: "Ctrl+=",
    category: "Zoom",
  },
  {
    id: "zoom-out",
    get label() {
      return localize("Zoom out");
    },
    get description() {
      return localize("Decrease the zoom level");
    },
    keys: "⌘-",
    keysWindows: "Ctrl+-",
    category: "Zoom",
  },
  {
    id: "zoom-reset",
    get label() {
      return localize("Reset zoom");
    },
    get description() {
      return localize("Reset zoom to default level");
    },
    keys: "⌘0",
    keysWindows: "Ctrl+0",
    category: "Zoom",
  },

  // Messages
  {
    id: "send-message",
    get label() {
      return localize("Send message");
    },
    get description() {
      return localize("Send the current message");
    },
    keys: "Enter",
    keysWindows: "Enter",
    category: "Messages",
  },
  {
    id: "new-line",
    get label() {
      return localize("New line");
    },
    get description() {
      return localize("Insert a line break in the composer");
    },
    keys: "Shift+Enter",
    keysWindows: "Shift+Enter",
    category: "Messages",
  },
  {
    id: "always-address-agent",
    get label() {
      return localize("Always address agent");
    },
    get description() {
      return localize(
        "Address the default agent, or toggle the highlighted agent",
      );
    },
    keys: "⇧⌘M",
    keysWindows: "Ctrl+Shift+M",
    category: "Messages",
  },
  {
    id: "publish-note",
    get label() {
      return localize("Publish note");
    },
    get description() {
      return localize("Publish a Pulse note");
    },
    keys: "⌘Enter",
    keysWindows: "Ctrl+Enter",
    category: "Messages",
  },
  {
    id: "close-dialog",
    get label() {
      return localize("Close dialog");
    },
    get description() {
      return localize("Close the current dialog or settings");
    },
    keys: "Escape",
    keysWindows: "Escape",
    category: "Messages",
  },
  {
    id: "toggle-huddle",
    get label() {
      return localize("Start or leave huddle");
    },
    get description() {
      return localize(
        "Start or join a huddle in the current channel; leave when connected",
      );
    },
    keys: "Ctrl+Shift+Space",
    keysWindows: "Ctrl+Shift+Space",
    category: "Messages",
  },
  {
    id: "push-to-talk",
    get label() {
      return localize("Push to talk");
    },
    get description() {
      return localize("Hold to unmute in a huddle");
    },
    keys: "Ctrl+Space",
    keysWindows: "Ctrl+Space",
    category: "Messages",
  },

  // Formatting
  {
    id: "format-bold",
    get label() {
      return localize("Bold");
    },
    get description() {
      return localize("Toggle bold formatting");
    },
    keys: "⌘B",
    keysWindows: "Ctrl+B",
    category: "Formatting",
  },
  {
    id: "format-italic",
    get label() {
      return localize("Italic");
    },
    get description() {
      return localize("Toggle italic formatting");
    },
    keys: "⌘I",
    keysWindows: "Ctrl+I",
    category: "Formatting",
  },
  {
    id: "format-strikethrough",
    get label() {
      return localize("Strikethrough");
    },
    get description() {
      return localize("Toggle strikethrough formatting");
    },
    keys: "⌘⇧X",
    keysWindows: "Ctrl+Shift+X",
    category: "Formatting",
  },
  {
    id: "format-code",
    get label() {
      return localize("Inline code");
    },
    get description() {
      return localize("Toggle inline code formatting");
    },
    keys: "⌘E",
    keysWindows: "Ctrl+E",
    category: "Formatting",
  },
  {
    id: "format-link",
    get label() {
      return localize("Insert link");
    },
    get description() {
      return localize(
        "Link the selected composer text, or edit the link under the caret",
      );
    },
    keys: "⌘K",
    keysWindows: "Ctrl+K",
    category: "Formatting",
  },
];

const CATEGORY_ORDER: ShortcutCategory[] = [
  "Navigation",
  "Messages",
  "Formatting",
  "Zoom",
];

export function getShortcutsByCategory(): Map<
  ShortcutCategory,
  KeyboardShortcut[]
> {
  const map = new Map<ShortcutCategory, KeyboardShortcut[]>();
  for (const cat of CATEGORY_ORDER) {
    map.set(
      cat,
      KEYBOARD_SHORTCUTS.filter((s) => s.category === cat),
    );
  }
  return map;
}

export function getPlatformKeys(shortcut: KeyboardShortcut): string {
  return isMacPlatform() ? shortcut.keys : shortcut.keysWindows;
}

/**
 * Platform-appropriate key hint for a shortcut in {@link KEYBOARD_SHORTCUTS},
 * or null when the id is unknown. Use this for inline hints (menus, tooltips)
 * so they stay in sync with the canonical shortcut registry.
 */
export function getPlatformKeysById(id: string): string | null {
  const shortcut = KEYBOARD_SHORTCUTS.find((s) => s.id === id);
  return shortcut ? getPlatformKeys(shortcut) : null;
}
