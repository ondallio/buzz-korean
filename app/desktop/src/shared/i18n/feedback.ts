import { useCallback, useState } from "react";
import { t, type TranslationValues } from "./messages";
import { useLocale } from "./react";

/** An app-owned sentence retained without freezing its rendered language. */
export type FeedbackMessage = Readonly<{
  type: "buzz.localized-feedback";
  source: string;
  values?: TranslationValues;
}>;

/** Mark app-owned feedback explicitly; external strings never receive this tag. */
export function feedbackMessage(
  source: string,
  values?: TranslationValues,
): FeedbackMessage {
  return {
    type: "buzz.localized-feedback",
    source,
    ...(values ? { values: { ...values } } : {}),
  };
}

type FeedbackInput = string | FeedbackMessage | null;
type FeedbackSetter<T extends string | null> = (
  value: T | FeedbackMessage | ((previous: T) => T | FeedbackMessage),
) => void;
function display(value: FeedbackInput): string | null {
  return value !== null && typeof value === "object"
    ? t(value.source, value.values)
    : value;
}

/** Store source+values for app copy, preserving server/user strings verbatim. */
export function useLocalizedFeedback(
  initial: string | null,
): [string | null, FeedbackSetter<string | null>] {
  useLocale();
  const [stored, setStored] = useState<FeedbackInput>(initial);
  const setFeedback = useCallback<FeedbackSetter<string | null>>((next) => {
    setStored((previous) =>
      typeof next === "function"
        ? (() => {
            const rendered = display(previous);
            const result = next(rendered);
            return result === rendered ? previous : result;
          })()
        : next,
    );
  }, []);
  return [display(stored), setFeedback];
}
