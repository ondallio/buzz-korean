/** Manual installation stays on the distribution selected at build time. */
export function manualReleaseUrl(): string {
  return import.meta.env?.VITE_BUZZ_BUILD_CHANNEL === "korean"
    ? "https://github.com/ondallio/buzz-korean/releases/latest"
    : "https://github.com/block/buzz/releases/latest";
}
