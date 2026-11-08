import { Fragment, type ReactNode } from "react";
import { useTranslation } from "./react";

/** Translate a complete sentence while retaining interactive nodes and user data. */
export function LocalizedMessage({
  message,
  values,
}: {
  message: string;
  values: Readonly<Record<string, ReactNode>>;
}) {
  const { t } = useTranslation();
  const names = Object.keys(values);
  const tokens = Object.fromEntries(
    names.map((name, index) => [name, `\uFFF0${index}\uFFF1`]),
  );
  const sentence = t(message, tokens);
  return (
    <>
      {sentence.split(/(\uFFF0\d+\uFFF1)/).map((part, index) => {
        const match = /^\uFFF0(\d+)\uFFF1$/.exec(part);
        return (
          <Fragment
            key={match ? `value-${names[Number(match[1])]}` : `text-${index}`}
          >
            {match ? values[names[Number(match[1])]] : part}
          </Fragment>
        );
      })}
    </>
  );
}
