import { t as localize } from "@/shared/i18n";
export const CRON_FIELD_DEFINITIONS = [
  {
    id: "minute",
    get label() {
      return localize("Minute");
    },
    max: 59,
    min: 0,
  },
  {
    id: "hour",
    get label() {
      return localize("Hour");
    },
    max: 23,
    min: 0,
  },
  {
    id: "day",
    get label() {
      return localize("Day");
    },
    max: 31,
    min: 1,
  },
  {
    aliases: [
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL",
      "AUG",
      "SEP",
      "OCT",
      "NOV",
      "DEC",
    ],
    id: "month",
    get label() {
      return localize("Month");
    },
    max: 12,
    min: 1,
  },
  {
    aliases: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"],
    id: "weekday",
    get label() {
      return localize("Weekday");
    },
    max: 7,
    min: 0,
  },
] as const;

export type CronFields = [string, string, string, string, string];

export function cronFieldsFromExpression(expression: string): CronFields {
  const values = expression.trim() ? expression.trim().split(/\s+/) : [];
  return [
    values[0] ?? "",
    values[1] ?? "",
    values[2] ?? "",
    values[3] ?? "",
    values[4] ?? "",
  ];
}

export function cronExpressionFromFields(fields: CronFields): string {
  return fields.join(" ");
}

export function normalizeCronExpression(expression: string): string {
  return expression.trim().replace(/\s+/g, " ");
}

export function cronFieldsFromPaste(
  pastedValue: string,
): { fields: CronFields; ok: true } | { error: string; ok: false } {
  const values = pastedValue.trim().split(/\s+/);
  if (values.length !== CRON_FIELD_DEFINITIONS.length) {
    return {
      error: localize(
        values.length === 1
          ? "Paste a 5-field cron expression. Found {count} field."
          : "Paste a 5-field cron expression. Found {count} fields.",
        { count: values.length },
      ),
      ok: false,
    };
  }
  return { fields: values as CronFields, ok: true };
}

type CronFieldDefinition = (typeof CRON_FIELD_DEFINITIONS)[number];

function atomError(
  atom: string,
  definition: CronFieldDefinition,
): string | null {
  const upperAtom = atom.toUpperCase();
  if (
    "aliases" in definition &&
    definition.aliases.includes(upperAtom as never)
  ) {
    return null;
  }
  if (!/^\d+$/.test(atom)) {
    return localize(
      "{field} contains “{value}”, which is not a supported value.",
      { field: definition.label, value: atom },
    );
  }

  const value = Number(atom);
  if (value < definition.min || value > definition.max) {
    return localize("{field} must be between {min} and {max}.", {
      field: definition.label,
      min: definition.min,
      max: definition.max,
    });
  }
  return null;
}

function segmentError(
  segment: string,
  definition: CronFieldDefinition,
): string | null {
  const stepParts = segment.split("/");
  if (stepParts.length > 2 || stepParts.some((part) => !part)) {
    return localize("{field} has an invalid step.", {
      field: definition.label,
    });
  }

  const [base, step] = stepParts;
  if (step !== undefined) {
    if (!/^\d+$/.test(step) || Number(step) < 1) {
      return localize("{field} step must be a positive whole number.", {
        field: definition.label,
      });
    }
  }

  if (base === "*") return null;

  const rangeParts = base.split("-");
  if (rangeParts.length > 2 || rangeParts.some((part) => !part)) {
    return localize("{field} has an invalid range.", {
      field: definition.label,
    });
  }

  const startError = atomError(rangeParts[0], definition);
  if (startError) return startError;
  if (rangeParts.length === 1) return null;

  const endError = atomError(rangeParts[1], definition);
  if (endError) return endError;

  const start = Number(rangeParts[0]);
  const end = Number(rangeParts[1]);
  if (Number.isFinite(start) && Number.isFinite(end) && start > end) {
    return localize("{field} range must go from lower to higher.", {
      field: definition.label,
    });
  }
  return null;
}

export function validateCronField(
  value: string,
  definition: CronFieldDefinition,
): string | null {
  if (!value)
    return localize("{field} is required.", { field: definition.label });

  const segments = value.split(",");
  if (segments.some((segment) => !segment)) {
    return localize("{field} has an empty list item.", {
      field: definition.label,
    });
  }

  for (const segment of segments) {
    const error = segmentError(segment, definition);
    if (error) return error;
  }
  return null;
}

export function validateCronFields(fields: CronFields): Array<string | null> {
  return fields.map((field, index) =>
    validateCronField(field, CRON_FIELD_DEFINITIONS[index]),
  );
}

export function cronExpressionError(expression: string): string | null {
  const parsed = cronFieldsFromPaste(expression);
  if (!parsed.ok) return parsed.error;
  return validateCronFields(parsed.fields).find(Boolean) ?? null;
}
