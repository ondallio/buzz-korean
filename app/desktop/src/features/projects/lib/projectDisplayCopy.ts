import { t } from "@/shared/i18n";
import { createLocaleNumberFormatter } from "@/shared/i18n/formatters";

const numbers = createLocaleNumberFormatter({});

/** Format complete count labels without translating canonical nouns or stored counts. */
export function formatProjectCount(
  kind: "message" | "member" | "repository",
  count: number,
  truncated = false,
): string {
  const values = { count: numbers.format(count) };
  switch (kind) {
    case "message":
      return t(
        truncated
          ? count === 1
            ? "{count}+ message"
            : "{count}+ messages"
          : count === 1
            ? "{count} message"
            : "{count} messages",
        values,
      );
    case "member":
      return t(count === 1 ? "{count} member" : "{count} members", values);
    case "repository":
      return t(
        count === 1 ? "{count} repository" : "{count} repositories",
        values,
      );
  }
}
