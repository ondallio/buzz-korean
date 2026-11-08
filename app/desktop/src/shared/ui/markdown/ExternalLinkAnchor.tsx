import { useLocaleCallback } from "@/shared/i18n";
import { useTranslation as useAppTranslation } from "@/shared/i18n";
import * as React from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";

import { cn } from "@/shared/lib/cn";
import { copyTextToClipboard } from "@/shared/lib/clipboard";

import { MaskedLinkTooltip } from "./MaskedLinkTooltip";
import {
  MediaContextMenu,
  type MediaContextMenuPosition,
  useDismissMediaContextMenu,
} from "./MediaContextMenu";

/**
 * An external `[text](href)` link with a custom right-click menu.
 *
 * Buzz renders inside a native webview whose default context menu has no
 * useful link actions, so a plain right-click on a link is a no-op. This adds
 * an in-app menu with "Open link" (via the OS opener, matching the anchor's
 * left-click `target="_blank"` behavior) and "Copy link" (the real href, not
 * the masked display text).
 */
export function ExternalLinkAnchor({
  anchorProps,
  children,
  href,
  isLinearLink,
  label,
}: {
  anchorProps: React.ComponentPropsWithoutRef<"a">;
  children: React.ReactNode;
  href: string | undefined;
  isLinearLink: boolean;
  label: string;
}) {
  const { t: localize } = useAppTranslation();

  const [menu, setMenu] = React.useState<MediaContextMenuPosition | null>(null);
  const closeMenu = useLocaleCallback(() => setMenu(null), []);
  useDismissMediaContextMenu(Boolean(menu), closeMenu);

  const anchor = (
    <a
      {...anchorProps}
      className={cn(
        "font-medium underline underline-offset-4 transition-colors",
        isLinearLink ? "linear-link" : "text-primary hover:text-primary/80",
      )}
      href={href}
      onContextMenuCapture={(event) => {
        if (!href) return;
        event.preventDefault();
        setMenu({ x: event.clientX, y: event.clientY });
      }}
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );

  return (
    <>
      <MaskedLinkTooltip disabled={isLinearLink} href={href} label={label}>
        {anchor}
      </MaskedLinkTooltip>
      {menu && href ? (
        <MediaContextMenu
          dataAttributes={["data-link-context-menu"]}
          items={[
            {
              label: localize("Open link"),
              onSelect: () => {
                closeMenu();
                void openUrl(href).catch(() => {
                  toast.error(localize("Failed to open link"));
                });
              },
            },
            {
              label: localize("Copy link"),
              onSelect: () => {
                closeMenu();
                copyTextToClipboard(href, "Link copied to clipboard");
              },
            },
          ]}
          position={menu}
        />
      ) : null}
    </>
  );
}
