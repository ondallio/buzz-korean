import assert from "node:assert/strict";
import test from "node:test";
import { setLocale } from "./index.ts";
import {
  getEphemeralChannelDisplay,
  formatTtlDuration,
  parseTtlDuration,
} from "../../features/channels/lib/ephemeralChannel.ts";
import { formatInboxFullTimestamp } from "../../features/home/lib/inbox.ts";
import {
  formatTranscriptTime,
  formatTranscriptTimestampTitle,
} from "../../features/agents/ui/agentSessionUtils.ts";
import { formatDraftCreatedAt } from "../../features/messages/ui/DraftsPanel.tsx";
import {
  formatAnimatedCount,
  getAnimatedCountSlots,
} from "../ui/animatedCountParts.ts";

const date = new Date(2026, 6, 30, 9, 5);
const seconds = date.getTime() / 1000;
test.afterEach(() => setLocale("en"));

test("inbox and draft timestamps use Korean months and periods after a live language switch", () => {
  assert.match(formatInboxFullTimestamp(seconds), /Jul 30/);
  setLocale("ko");
  for (const value of [
    formatInboxFullTimestamp(seconds),
    formatDraftCreatedAt({ createdAt: date.toISOString() }),
  ]) {
    assert.match(value, /7월 30일/);
    assert.match(value, /오전 9:05/);
    assert.doesNotMatch(value, /AM|PM/);
  }
  setLocale("en");
  assert.match(
    formatDraftCreatedAt({ createdAt: date.toISOString() }),
    /Jul 30/,
  );
});

test("transcript clock and title keep the same local hour in both languages", () => {
  assert.equal(formatTranscriptTime(date.toISOString()), "9:05 AM");
  setLocale("ko");
  assert.equal(formatTranscriptTime(date.toISOString()), "오전 9:05");
  assert.match(
    formatTranscriptTimestampTitle(date.toISOString()),
    /2026년 7월 30일/,
  );
  assert.match(formatTranscriptTimestampTitle(date.toISOString()), /오전 9:05/);
  assert.equal(formatTranscriptTime("invalid"), null);
  assert.equal(formatTranscriptTimestampTitle("invalid"), "invalid");
});

test("ephemeral deadline prose uses the selected language without changing TTL machine syntax", () => {
  const channel = {
    ttlSeconds: 60,
    ttlDeadline: new Date(date.getTime() + 60000).toISOString(),
  };
  assert.match(
    getEphemeralChannelDisplay(channel, date.getTime()).tooltipLabel,
    /in 1 minute/,
  );
  setLocale("ko");
  assert.match(
    getEphemeralChannelDisplay(channel, date.getTime()).tooltipLabel,
    /1분 후/,
  );
  assert.match(
    getEphemeralChannelDisplay(channel, date.getTime()).tooltipLabel,
    /7월 30일/,
  );
  assert.equal(formatTtlDuration(5400), "1h30m");
  assert.equal(parseTtlDuration("1h30m"), 5400);
});

test("Korean numeric counts retain grouped ASCII digits and rollover slot alignment", () => {
  setLocale("ko");
  assert.equal(formatAnimatedCount(1234567.9), "1,234,567");
  const slots = getAnimatedCountSlots(
    formatAnimatedCount(999),
    formatAnimatedCount(1000),
  );
  assert.equal(slots.map((slot) => slot.current).join(""), "1,000");
  assert.equal(slots.filter((slot) => slot.isDigit).length, 4);
  setLocale("en");
  assert.equal(formatAnimatedCount(1234567.9), "1,234,567");
});

test("a locale formatter created in English switches compact notation and number parts", async () => {
  const { createLocaleNumberFormatter } = await import("./formatters.ts");
  const formatter = createLocaleNumberFormatter({
    notation: "compact",
    maximumFractionDigits: 0,
  });
  assert.equal(formatter.format(120000), "120K");
  setLocale("ko");
  assert.equal(formatter.format(120000), "12만");
  assert.deepEqual(formatter.formatToParts(120000), [
    { type: "integer", value: "12" },
    { type: "compact", value: "만" },
  ]);
  setLocale("en");
  assert.equal(formatter.format(120000), "120K");
});
