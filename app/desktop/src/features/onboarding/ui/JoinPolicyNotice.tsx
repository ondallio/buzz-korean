import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { LocalizedMessage } from "@/shared/i18n/LocalizedMessage";
import * as React from "react";
import { openUrl } from "@tauri-apps/plugin-opener";

import { joinPolicyDocumentUrl, type JoinPolicy } from "@/shared/api/invites";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";

type JoinPolicyNoticeProps = {
  ageConfirmed: boolean;
  agreementConfirmed: boolean;
  onAgeConfirmedChange: (confirmed: boolean) => void;
  onAgreementConfirmedChange: (confirmed: boolean) => void;
  policy: JoinPolicy;
  /** Relay hosting the policy documents the links below point at. */
  relayWsUrl: string;
};

/**
 * Join-policy consent block shown on every join surface.
 *
 * The Terms/Privacy links open the relay-hosted document pages
 * (`/api/join-policy/terms|privacy`) in the system browser via the OS
 * opener. They must NOT navigate or render in-app: these surfaces exist
 * before onboarding completes, where the router (required by the message
 * Markdown component) is not mounted — an in-app render tears down the
 * whole React tree.
 */
export function JoinPolicyNotice({
  ageConfirmed,
  agreementConfirmed,
  onAgeConfirmedChange,
  onAgreementConfirmedChange,
  policy,
  relayWsUrl,
}: JoinPolicyNoticeProps) {
  const { t: localize } = useAppTranslation();

  const ageConfirmationId = React.useId();
  const agreementConfirmationId = React.useId();

  const termsLink = policy.termsMarkdown ? (
    <Button
      className="h-auto p-0 align-baseline text-xs no-underline hover:underline focus-visible:no-underline"
      onClick={(event) => {
        event.preventDefault();
        void openUrl(joinPolicyDocumentUrl(relayWsUrl, "terms"));
      }}
      type="button"
      variant="link"
    >
      {localize("Terms of Service")}
    </Button>
  ) : null;
  const privacyLink = policy.privacyMarkdown ? (
    <Button
      className="h-auto p-0 align-baseline text-xs no-underline hover:underline focus-visible:no-underline"
      onClick={(event) => {
        event.preventDefault();
        void openUrl(joinPolicyDocumentUrl(relayWsUrl, "privacy"));
      }}
      type="button"
      variant="link"
    >
      {localize("Privacy Policy")}
    </Button>
  ) : null;

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4 text-left">
      {policy.ageAttestationRequired ? (
        <div className="flex items-start gap-3">
          <Checkbox
            checked={ageConfirmed}
            className="mt-0.5"
            id={ageConfirmationId}
            onCheckedChange={(checked) =>
              onAgeConfirmedChange(checked === true)
            }
          />
          <label
            className="cursor-pointer text-xs leading-5 text-muted-foreground"
            htmlFor={ageConfirmationId}
          >
            {localize("I am 18 years of age or older.")}
          </label>
        </div>
      ) : null}

      {policy.termsMarkdown || policy.privacyMarkdown ? (
        <div className="flex items-start gap-3">
          <Checkbox
            checked={agreementConfirmed}
            className="mt-0.5"
            id={agreementConfirmationId}
            onCheckedChange={(checked) =>
              onAgreementConfirmedChange(checked === true)
            }
          />
          <label
            className="cursor-pointer text-xs leading-5 text-muted-foreground"
            htmlFor={agreementConfirmationId}
          >
            <LocalizedMessage
              message={
                policy.termsMarkdown && policy.privacyMarkdown
                  ? "I agree to the Buzz {terms} and {privacy}."
                  : policy.termsMarkdown
                    ? "I agree to the Buzz {terms}."
                    : "I agree to the Buzz {privacy}."
              }
              values={{ terms: termsLink, privacy: privacyLink }}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
