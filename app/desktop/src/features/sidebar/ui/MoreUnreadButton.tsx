import {
  t as translateInterfaceText,
  useLocale as useInterfaceLocale,
} from "@/shared/i18n";
import { topChromeInset } from "@/shared/layout/chromeLayout";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { UnreadPill } from "@/shared/ui/UnreadPill";

export type UnreadDmPreview = {
  accessibleLabel: string;
  avatarUrl: string | null;
  channelId: string;
  label: string;
  isAgent?: boolean;
};

export function canPreviewUnreadDm(
  participantPubkeyCount: number,
  resolvedParticipantCount: number,
) {
  return participantPubkeyCount === 2 && resolvedParticipantCount === 1;
}

export function visibleUnreadDmPreviews(dmPreviews: UnreadDmPreview[]) {
  return dmPreviews.slice(0, 3);
}

export function unreadDmAccessibleLabel({
  count,
  dmPreviews,
  label,
  position,
  targetChannelId,
}: {
  count: number;
  dmPreviews: UnreadDmPreview[];
  label?: string;
  position: "top" | "bottom";
  targetChannelId?: string;
}) {
  const resolvedLabel =
    label ?? translateInterfaceText("{count} unread", { count });
  const targetPreview = dmPreviews.find(
    ({ channelId }) => channelId === targetChannelId,
  );
  return targetPreview
    ? translateInterfaceText(
        position === "top"
          ? "Go to unread direct message from {value1}. {value2} above."
          : "Go to unread direct message from {value1}. {value2} below.",
        {
          value1: String(targetPreview.accessibleLabel),
          value2: String(resolvedLabel),
        },
      )
    : translateInterfaceText(
        position === "top" ? "{label} above" : "{label} below",
        { label: resolvedLabel },
      );
}

export function preferredUnreadTarget(
  unreadChannelIds: string[],
  dmChannelIds: ReadonlySet<string>,
) {
  return (
    unreadChannelIds.find((channelId) => dmChannelIds.has(channelId)) ??
    unreadChannelIds[0]
  );
}

export function MoreUnreadButton({
  bottomClassName = "bottom-0",
  count,
  dmPreviews = [],
  emphasis,
  label,
  onClick,
  position,
  targetChannelId,
  testId,
}: {
  bottomClassName?: string;
  count: number;
  dmPreviews?: UnreadDmPreview[];
  emphasis: "default" | "primary";
  label?: string;
  onClick: () => void;
  position: "top" | "bottom";
  targetChannelId?: string;
  testId: string;
}) {
  useInterfaceLocale();

  const positionClassName =
    position === "top" ? topChromeInset.top : bottomClassName;
  const visibleDmPreviews = visibleUnreadDmPreviews(dmPreviews);
  const resolvedLabel =
    label ?? translateInterfaceText("{count} unread", { count });
  const accessibleLabel = unreadDmAccessibleLabel({
    count,
    dmPreviews,
    label: resolvedLabel,
    position,
    targetChannelId,
  });

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 z-10 flex justify-center px-2 py-1 ${positionClassName}`}
    >
      <UnreadPill
        accessibleLabel={accessibleLabel}
        className="max-w-full overflow-hidden text-xs"
        direction={position === "top" ? "up" : "down"}
        emphasis={emphasis}
        label={resolvedLabel}
        leading={
          visibleDmPreviews.length > 0 ? (
            <span
              aria-hidden="true"
              className="flex shrink-0 items-center gap-1.5"
            >
              <span className="flex -space-x-1.5">
                {visibleDmPreviews.map((preview, index) => (
                  <span
                    className="relative"
                    key={preview.channelId}
                    style={{ zIndex: visibleDmPreviews.length - index }}
                  >
                    <UserAvatar
                      avatarUrl={preview.avatarUrl}
                      className="ring-2 ring-primary"
                      displayName={preview.label}
                      shape={preview.isAgent ? "squircle" : "circle"}
                      fallbackDelayMs={0}
                      size="xs"
                      testId={`sidebar-unread-dm-avatar-${preview.channelId}`}
                    />
                  </span>
                ))}
              </span>
              <span>·</span>
            </span>
          ) : undefined
        }
        onClick={onClick}
        testId={testId}
      />
    </div>
  );
}
