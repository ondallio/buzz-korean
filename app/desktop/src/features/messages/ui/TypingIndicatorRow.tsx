import {
  t as translateInterfaceText,
  useLocale as useInterfaceLocale,
} from "@/shared/i18n";
import * as React from "react";

import {
  resolveUserLabel,
  type UserProfileLookup,
} from "@/features/profile/lib/identity";
import { ProfileAvatar } from "@/features/profile/ui/ProfileAvatar";
import type { Channel } from "@/shared/api/types";
import { cn } from "@/shared/lib/cn";
import { Shimmer } from "@/shared/ui/Shimmer";
import { truncateNpub } from "@/shared/lib/pubkey";

type TypingIndicatorRowProps = {
  channel: Channel | null;
  className?: string;
  currentPubkey?: string;
  profiles?: UserProfileLookup;
  typingPubkeys: string[];
  variant?: "default" | "activity";
};

function resolveFallbackName(channel: Channel | null, pubkey: string) {
  if (channel?.channelType !== "dm") {
    return null;
  }

  const participantIndex = channel.participantPubkeys.findIndex(
    (candidate) => candidate.toLowerCase() === pubkey.toLowerCase(),
  );

  if (participantIndex < 0) {
    return null;
  }

  return channel.participants[participantIndex] ?? null;
}

function formatTypingLabel(names: string[]) {
  if (names.length === 1) {
    return translateInterfaceText("{value1} is typing...", {
      value1: String(names[0]),
    });
  }

  if (names.length === 2) {
    return translateInterfaceText("{value1} and {value2} are typing...", {
      value1: String(names[0]),
      value2: String(names[1]),
    });
  }

  if (names.length === 3) {
    return translateInterfaceText(
      "{value1}, {value2}, and {value3} are typing...",
      {
        value1: String(names[0]),
        value2: String(names[1]),
        value3: String(names[2]),
      },
    );
  }

  return translateInterfaceText(
    "{value1}, {value2}, and {value3} others are typing...",
    {
      value1: String(names[0]),
      value2: String(names[1]),
      value3: String(names.length - 2),
    },
  );
}

export function TypingIndicatorRow({
  channel,
  className,
  currentPubkey,
  profiles,
  typingPubkeys,
  variant = "default",
}: TypingIndicatorRowProps) {
  useInterfaceLocale();

  const isActivityVariant = variant === "activity";
  const labels = React.useMemo(
    () =>
      typingPubkeys.map((pubkey) =>
        resolveUserLabel({
          pubkey,
          currentPubkey,
          fallbackName: resolveFallbackName(channel, pubkey),
          profiles,
          preferResolvedSelfLabel: true,
        }),
      ),
    [channel, currentPubkey, profiles, typingPubkeys],
  );

  return (
    <div
      aria-live="polite"
      className={cn(
        "shrink-0 bg-transparent",
        isActivityVariant ? "flex items-center px-0 py-0" : "px-4 py-2 sm:px-6",
        className,
      )}
      {...(labels.length > 0
        ? { "data-testid": "message-typing-indicator" }
        : {})}
    >
      {labels.length > 0 && (
        <div
          className={cn(
            "flex min-w-0 w-full items-center",
            isActivityVariant ? "h-full gap-1.5" : "gap-2",
          )}
        >
          <div className="flex shrink-0 items-center">
            {typingPubkeys.map((pubkey, index) => {
              const profile = profiles?.[pubkey.toLowerCase()];
              const label = labels[index] ?? truncateNpub(pubkey);
              return (
                <div
                  key={pubkey}
                  className={cn(
                    "relative shrink-0 ring-1 ring-background",
                    profile?.isAgent ? "rounded-squircle" : "rounded-full",
                    isActivityVariant ? "h-4 w-4" : "h-5 w-5",
                    index > 0 && "-ml-1.5",
                  )}
                  data-testid="message-typing-avatar"
                >
                  <ProfileAvatar
                    avatarUrl={profile?.avatarUrl ?? null}
                    label={label}
                    className={cn(
                      isActivityVariant
                        ? "h-4 w-4 text-3xs"
                        : "h-5 w-5 text-3xs",
                    )}
                    iconClassName={
                      isActivityVariant ? "h-2.5 w-2.5" : "h-4 w-4"
                    }
                    shape={profile?.isAgent ? "squircle" : "circle"}
                  />
                </div>
              );
            })}
          </div>
          <p
            className={cn(
              "min-w-0 translate-y-px truncate text-muted-foreground",
              isActivityVariant
                ? "text-2xs font-medium leading-3"
                : "text-xs font-medium leading-4",
            )}
            data-testid="message-typing-indicator-label"
          >
            <Shimmer>{formatTypingLabel(labels)}</Shimmer>
          </p>
        </div>
      )}
    </div>
  );
}
