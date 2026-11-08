import { t as translateInterfaceText } from "@/shared/i18n";
import {
  createLocaleDateTimeFormatter,
  createLocaleRelativeTimeFormatter,
} from "@/shared/i18n/formatters";
import type { Channel } from "@/shared/api/types";

const relativeTimeFormatter = createLocaleRelativeTimeFormatter({
  numeric: "auto",
});
const absoluteTimeFormatter = createLocaleDateTimeFormatter({
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type EphemeralChannelLike = Pick<Channel, "ttlSeconds" | "ttlDeadline">;

export const EPHEMERAL_CHANNEL_LABEL = "Ephemeral";

/** Default TTL for ephemeral channels: 7 days of inactivity. */
export const DEFAULT_EPHEMERAL_TTL_SECONDS = 7 * 24 * 60 * 60;

export type EphemeralChannelDisplay = {
  detailLabel: string | null;
  tooltipLabel: string;
};

export function isEphemeralChannel(channel: EphemeralChannelLike): boolean {
  return channel.ttlSeconds !== null || channel.ttlDeadline !== null;
}

function resolveRemainingSeconds(
  ttlDeadline: string | null,
  nowMs: number,
): number | null {
  if (!ttlDeadline) {
    return null;
  }

  const deadlineMs = Date.parse(ttlDeadline);
  if (Number.isNaN(deadlineMs)) {
    return null;
  }

  return Math.ceil((deadlineMs - nowMs) / 1_000);
}

function formatCompactRemaining(remainingSeconds: number): string {
  if (remainingSeconds <= 0) {
    return translateInterfaceText("Cleanup due");
  }

  if (remainingSeconds <= 60) {
    return translateInterfaceText("1m left");
  }

  if (remainingSeconds < 60 * 60) {
    return translateInterfaceText("{value1}m left", {
      value1: String(Math.max(1, Math.ceil(remainingSeconds / 60))),
    });
  }

  if (remainingSeconds < 60 * 60 * 24) {
    return translateInterfaceText("{value1}h left", {
      value1: String(Math.max(1, Math.ceil(remainingSeconds / (60 * 60)))),
    });
  }

  return translateInterfaceText("{value1}d left", {
    value1: String(Math.max(1, Math.ceil(remainingSeconds / (60 * 60 * 24)))),
  });
}

function formatVerboseRemaining(remainingSeconds: number): string {
  if (remainingSeconds <= 0) {
    return translateInterfaceText("now");
  }

  if (remainingSeconds <= 60) {
    return relativeTimeFormatter.format(1, "minute");
  }

  if (remainingSeconds < 60 * 60) {
    return relativeTimeFormatter.format(
      Math.max(1, Math.ceil(remainingSeconds / 60)),
      "minute",
    );
  }

  if (remainingSeconds < 60 * 60 * 24) {
    return relativeTimeFormatter.format(
      Math.max(1, Math.ceil(remainingSeconds / (60 * 60))),
      "hour",
    );
  }

  return relativeTimeFormatter.format(
    Math.max(1, Math.ceil(remainingSeconds / (60 * 60 * 24))),
    "day",
  );
}

function formatCompactTtl(ttlSeconds: number): string {
  if (ttlSeconds < 60) {
    return translateInterfaceText("{value1}s TTL", {
      value1: String(Math.max(1, ttlSeconds)),
    });
  }

  if (ttlSeconds < 60 * 60) {
    return translateInterfaceText("{value1}m TTL", {
      value1: String(Math.max(1, Math.ceil(ttlSeconds / 60))),
    });
  }

  if (ttlSeconds < 60 * 60 * 24) {
    return translateInterfaceText("{value1}h TTL", {
      value1: String(Math.max(1, Math.ceil(ttlSeconds / (60 * 60)))),
    });
  }

  return translateInterfaceText("{value1}d TTL", {
    value1: String(Math.max(1, Math.ceil(ttlSeconds / (60 * 60 * 24)))),
  });
}

function formatVerboseTtl(ttlSeconds: number): string {
  if (ttlSeconds < 60) {
    const seconds = Math.max(1, ttlSeconds);
    return translateInterfaceText(
      seconds === 1 ? "{value1} second" : "{value1} seconds",
      { value1: String(seconds) },
    );
  }

  if (ttlSeconds < 60 * 60) {
    const minutes = Math.max(1, Math.ceil(ttlSeconds / 60));
    return translateInterfaceText(
      minutes === 1 ? "{value1} minute" : "{value1} minutes",
      { value1: String(minutes) },
    );
  }

  if (ttlSeconds < 60 * 60 * 24) {
    const hours = Math.max(1, Math.ceil(ttlSeconds / (60 * 60)));
    return translateInterfaceText(
      hours === 1 ? "{value1} hour" : "{value1} hours",
      { value1: String(hours) },
    );
  }

  const days = Math.max(1, Math.ceil(ttlSeconds / (60 * 60 * 24)));
  return translateInterfaceText(days === 1 ? "{value1} day" : "{value1} days", {
    value1: String(days),
  });
}

export function getEphemeralChannelDisplay(
  channel: EphemeralChannelLike,
  nowMs = Date.now(),
): EphemeralChannelDisplay | null {
  if (!isEphemeralChannel(channel)) {
    return null;
  }

  const remainingSeconds = resolveRemainingSeconds(channel.ttlDeadline, nowMs);
  const absoluteDeadlineLabel =
    channel.ttlDeadline && !Number.isNaN(Date.parse(channel.ttlDeadline))
      ? absoluteTimeFormatter.format(new Date(channel.ttlDeadline))
      : null;
  if (remainingSeconds === null) {
    return {
      detailLabel:
        channel.ttlSeconds === null
          ? null
          : formatCompactTtl(channel.ttlSeconds),
      tooltipLabel:
        channel.ttlSeconds === null
          ? translateInterfaceText(
              "Ephemeral channel. Cleans up automatically after inactivity.",
            )
          : translateInterfaceText(
              "Ephemeral channel. Cleans up after {duration} of inactivity.",
              {
                duration: formatVerboseTtl(channel.ttlSeconds),
              },
            ),
    };
  }

  const compactRemaining = formatCompactRemaining(remainingSeconds);
  const verboseRemaining = formatVerboseRemaining(remainingSeconds);

  return {
    detailLabel: compactRemaining,
    tooltipLabel:
      remainingSeconds <= 0
        ? translateInterfaceText("Ephemeral channel. Cleanup is due now.")
        : absoluteDeadlineLabel
          ? translateInterfaceText(
              "Ephemeral channel. Cleans up {remaining}. Scheduled for {deadline}.",
              {
                remaining: verboseRemaining,
                deadline: absoluteDeadlineLabel,
              },
            )
          : translateInterfaceText(
              "Ephemeral channel. Cleans up {remaining}.",
              { remaining: verboseRemaining },
            ),
  };
}

const TTL_UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
};

const TTL_TOKEN_RE = /(\d+)([smhd])/giy;

/**
 * Parse a friendly duration string (`30m`, `12h`, `1d`, or combinations like
 * `1d12h`) into a positive number of seconds.
 *
 * Whitespace is tolerated, units are case-insensitive, and a bare number is
 * rejected (a unit is always required). Returns `null` for empty or malformed
 * input, or for a total of zero. The same unit may not appear twice.
 */
export function parseTtlDuration(input: string): number | null {
  const cleaned = input.trim().toLowerCase().replace(/\s+/g, "");
  if (cleaned === "") {
    return null;
  }

  TTL_TOKEN_RE.lastIndex = 0;
  const seen = new Set<string>();
  let total = 0;
  let consumed = 0;
  for (
    let match = TTL_TOKEN_RE.exec(cleaned);
    match !== null;
    match = TTL_TOKEN_RE.exec(cleaned)
  ) {
    const [token, amount, unit] = match;
    if (seen.has(unit)) {
      return null;
    }
    seen.add(unit);
    total += Number(amount) * TTL_UNIT_SECONDS[unit];
    consumed += token.length;
  }

  // Reject leftover characters (e.g. "1x", "1d!", "abc") and zero totals.
  if (consumed !== cleaned.length || total <= 0) {
    return null;
  }
  return total;
}

/**
 * Format a number of seconds back into a compact friendly string (`30m`,
 * `12h`, `1d`, `1d12h`) — the inverse of `parseTtlDuration` for the common
 * cases. Components that are zero are omitted; a non-positive input yields `""`.
 */
export function formatTtlDuration(ttlSeconds: number): string {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    return "";
  }
  let remaining = Math.floor(ttlSeconds);
  const parts: string[] = [];
  for (const unit of ["d", "h", "m", "s"] as const) {
    const size = TTL_UNIT_SECONDS[unit];
    const count = Math.floor(remaining / size);
    if (count > 0) {
      parts.push(`${count}${unit}`);
      remaining -= count * size;
    }
  }
  return parts.join("");
}
