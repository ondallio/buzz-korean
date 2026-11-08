import { t as translateInterfaceText } from "@/shared/i18n";
const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;

export function formatRelativeTime(unixSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const delta = Math.max(0, now - unixSeconds);

  if (delta < MINUTE) {
    return translateInterfaceText("just now");
  }

  if (delta < HOUR) {
    const minutes = Math.floor(delta / MINUTE);
    return translateInterfaceText("{value1}m ago", { value1: String(minutes) });
  }

  if (delta < DAY) {
    const hours = Math.floor(delta / HOUR);
    return translateInterfaceText("{value1}h ago", { value1: String(hours) });
  }

  const days = Math.floor(delta / DAY);
  return translateInterfaceText("{value1}d ago", { value1: String(days) });
}
