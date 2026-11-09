/**
 * Route an app-generated share link to this installed distribution. Canonical
 * links used in event content and internal navigation remain unchanged.
 */
export function toDistributionLink(link: string): string {
  if (
    import.meta.env?.VITE_BUZZ_BUILD_CHANNEL === "korean" &&
    link.startsWith("buzz://")
  ) {
    return `buzz-korean://${link.slice("buzz://".length)}`;
  }
  return link;
}
