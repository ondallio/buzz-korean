import { t as translateInterfaceText } from "@/shared/i18n";
import type { PersonaSharePublicationResult } from "@/shared/api/tauriPersonas";

/**
 * The confirmation shown after a persona edit is saved.
 *
 * `publicationStatus` is null when the edit did not promise publication, so
 * the copy stays silent about the catalog. When it did, the copy must
 * distinguish a relay-accepted publish from a queued one — a "published"
 * message for an edit still sitting in the outbox is the promise the
 * "Save and publish" button was making falsely.
 */
export function personaSaveNotice(
  displayName: string,
  publicationStatus: PersonaSharePublicationResult["publicationStatus"] | null,
): string {
  switch (publicationStatus) {
    case "published":
      return translateInterfaceText(
        "Updated {value1} and published it to the community catalog.",
        { value1: String(displayName) },
      );
    case "queued":
      return translateInterfaceText(
        "Updated {value1}. Publishing to the community catalog is queued and will appear after the relay accepts the update.",
        { value1: String(displayName) },
      );
    default:
      return translateInterfaceText("Updated {value1}.", {
        value1: String(displayName),
      });
  }
}
