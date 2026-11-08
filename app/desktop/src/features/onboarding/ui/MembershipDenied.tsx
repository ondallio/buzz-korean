import {
  feedbackMessage as localizedFeedback,
  useLocalizedFeedback,
} from "@/shared/i18n";
import { t as localizeConstant } from "@/shared/i18n";
import { useLocaleMemo, useLocaleCallback } from "@/shared/i18n";
import { useTranslation as useAppTranslation } from "@/shared/i18n";
import * as React from "react";
import { Check, Copy, KeyRound, ShieldX, Ticket } from "lucide-react";

import { useCommunityOnboarding } from "@/features/onboarding/communityOnboarding";
import { nsecToNpub } from "@/shared/lib/nostrUtils";
import { canonicalNpub, UNAVAILABLE_KEY_LABEL } from "@/shared/lib/pubkey";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Spinner } from "@/shared/ui/spinner";
import { StartupWindowDragRegion } from "@/shared/ui/StartupWindowDragRegion";
import { InviteRedeemForm } from "./InviteRedeemForm";
import { writeTextToClipboard } from "@/shared/lib/clipboard";

type MembershipDeniedProps = {
  /** The relay that denied membership — used as the target for bare-code invites. */
  activeRelayUrl: string;
  onBack: () => void;
  onChangeCommunity: () => void;
  onImportKey: (nsec: string) => Promise<void>;
  onRetry: () => void;
  pubkey: string;
};

export function MembershipDenied({
  activeRelayUrl,
  onBack,
  onChangeCommunity,
  onImportKey,
  onRetry,
  pubkey,
}: MembershipDeniedProps) {
  const { t: localize } = useAppTranslation();

  // Full canonical npub; an unencodable identity renders the neutral label
  // (never raw hex) and is never copyable.
  const identityNpub = useLocaleMemo(
    () => (pubkey ? canonicalNpub(pubkey) : null),
    [pubkey],
  );
  const npub =
    identityNpub ??
    (pubkey ? localizeConstant(UNAVAILABLE_KEY_LABEL) : "Unknown public key");
  const [copied, setCopied] = React.useState(false);
  const [importError, setImportError] = useLocalizedFeedback(null);
  const [isImportFormOpen, setIsImportFormOpen] = React.useState(false);
  const [isImportingKey, setIsImportingKey] = React.useState(false);
  const [nsecInput, setNsecInput] = React.useState("");
  const previewNpub = useLocaleMemo(() => nsecToNpub(nsecInput), [nsecInput]);
  const trimmedNsec = nsecInput.trim();
  const isValidNsec = previewNpub !== null;

  const [isInviteFormOpen, setIsInviteFormOpen] = React.useState(false);
  const communityOnboarding = useCommunityOnboarding();

  const handleCopy = useLocaleCallback(async () => {
    if (!identityNpub) return;
    try {
      await writeTextToClipboard(npub);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text so the user can copy manually
    }
  }, [identityNpub, npub]);

  const handleImportKey = useLocaleCallback(async () => {
    if (!previewNpub) {
      setImportError(
        localizedFeedback(
          "That doesn't look like a valid nsec. Paste an nsec1 key.",
        ),
      );
      return;
    }

    setImportError(null);
    setIsImportingKey(true);

    try {
      await onImportKey(trimmedNsec);
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : localizedFeedback("Failed to import key."),
      );
    } finally {
      setIsImportingKey(false);
    }
  }, [onImportKey, previewNpub, trimmedNsec]);

  const handleInviteRedeem = useLocaleCallback(
    (relayWsUrl: string, code: string, policyReceipt?: string) => {
      communityOnboarding.start({
        source: "membership-recovery",
        relayUrl: relayWsUrl,
        inviteCode: code,
        policyReceipt,
      });
    },
    [communityOnboarding],
  );

  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.14),transparent_48%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.55))] px-4 py-8"
      data-testid="membership-denied"
    >
      <StartupWindowDragRegion />
      <div className="w-full max-w-md rounded-[28px] border border-border/70 bg-background/92 p-8 shadow-2xl backdrop-blur-sm">
        <div className="space-y-3">
          <Badge variant="warning">{localize("Membership required")}</Badge>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <ShieldX className="h-4 w-4 text-destructive" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {localize("Not a member yet")}
            </h1>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {localize(
              "This relay requires an invitation. Ask a relay admin to add you as a member, then come back and try again.",
            )}
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {localize("Your public key (npub)")}
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5 font-mono text-xs text-foreground">
                {npub}
              </code>
              <Button
                className="shrink-0"
                disabled={!identityNpub}
                onClick={() => {
                  void handleCopy();
                }}
                size="icon"
                title={localize("Copy npub")}
                type="button"
                variant="outline"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {localize(
              "This is your public identity — it's safe to share. Send it to the relay admin so they can invite you.",
            )}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {isInviteFormOpen ? (
            <InviteRedeemForm
              defaultRelayUrl={activeRelayUrl}
              error={null}
              isRedeeming={false}
              onCancel={() => setIsInviteFormOpen(false)}
              onRedeem={handleInviteRedeem}
            />
          ) : isImportFormOpen ? (
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleImportKey();
              }}
            >
              <div className="space-y-1.5 text-left">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="membership-denied-nsec"
                >
                  {localize("Private key")}
                </label>
                <Input
                  autoComplete="off"
                  autoCorrect="off"
                  data-testid="membership-denied-nsec-input"
                  disabled={isImportingKey}
                  id="membership-denied-nsec"
                  onChange={(event) => {
                    setNsecInput(event.target.value);
                    setImportError(null);
                  }}
                  placeholder={localize("nsec1...")}
                  spellCheck={false}
                  type="password"
                  value={nsecInput}
                />
              </div>

              {previewNpub ? (
                <div
                  className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs"
                  data-testid="membership-denied-npub-preview"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium text-foreground">
                      {localize("This will use this Nostr identity:")}
                    </p>
                    <p className="break-all font-mono text-2xs text-muted-foreground">
                      {previewNpub}
                    </p>
                  </div>
                </div>
              ) : null}

              {importError ? (
                <p className="text-center text-sm text-destructive">
                  {importError}
                </p>
              ) : null}

              <Button
                className="w-full"
                data-testid="membership-denied-import-key"
                disabled={!isValidNsec || isImportingKey}
                type="submit"
              >
                {isImportingKey ? (
                  <Spinner
                    aria-label={localize("Importing key")}
                    className="h-4 w-4 border-2"
                  />
                ) : (
                  "Import key"
                )}
              </Button>
              <Button
                className="w-full text-muted-foreground hover:text-accent-foreground"
                disabled={isImportingKey}
                onClick={() => {
                  setImportError(null);
                  setIsImportFormOpen(false);
                  setNsecInput("");
                }}
                type="button"
                variant="ghost"
              >
                {localize("Back")}
              </Button>
            </form>
          ) : (
            <>
              <Button className="w-full" onClick={onRetry} type="button">
                {localize("Try again")}
              </Button>
              <div className="flex gap-2">
                <Button
                  className="flex-1 text-muted-foreground hover:text-accent-foreground"
                  onClick={onBack}
                  type="button"
                  variant="ghost"
                >
                  {localize("Back")}
                </Button>
                <Button
                  className="flex-1 text-muted-foreground hover:text-accent-foreground"
                  onClick={onChangeCommunity}
                  type="button"
                  variant="ghost"
                >
                  {localize("Change community")}
                </Button>
              </div>
              <button
                className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                data-testid="membership-denied-redeem-invite"
                onClick={() => setIsInviteFormOpen(true)}
                type="button"
              >
                <Ticket className="h-4 w-4" />
                {localize("Have an invite?")}
              </button>
              <button
                className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                data-testid="membership-denied-change-key"
                onClick={() => {
                  setImportError(null);
                  setIsImportFormOpen(true);
                }}
                type="button"
              >
                <KeyRound className="h-4 w-4" />
                {localize("Use a different key")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
