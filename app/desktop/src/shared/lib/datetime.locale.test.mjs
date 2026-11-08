import assert from "node:assert/strict";
import test from "node:test";

import { setLocale } from "../i18n/index.ts";
import { formatDayGroupLabel, formatItemTimestamp } from "./datetime.ts";
import {
  formatFullDateTime,
  formatShortMonthDay,
  formatThreadSummaryLastReplyTime,
  formatTime,
} from "../../features/messages/lib/dateFormatters.ts";

const at = (year, month, day, hour = 12, minute = 0) =>
  new Date(year, month, day, hour, minute).getTime() / 1_000;

test.afterEach(() => setLocale("en"));

test("Korean day headings follow local calendar boundaries rather than elapsed hours", () => {
  setLocale("ko");
  const now = at(2026, 6, 30, 1);
  assert.equal(formatDayGroupLabel(at(2026, 6, 30, 0, 1), now), "오늘");
  assert.equal(formatDayGroupLabel(at(2026, 6, 29, 23, 59), now), "어제");
  assert.equal(formatDayGroupLabel(at(2026, 6, 28), now), "화요일");
  assert.equal(formatDayGroupLabel(at(2025, 5, 20), now), "2025년 6월 20일");
});

test("formatters change language after import without changing the local clock", () => {
  const timestamp = at(2026, 6, 30, 9, 5);
  assert.equal(formatTime(timestamp), "9:05 AM");
  setLocale("ko");
  assert.equal(formatTime(timestamp), "오전 9:05");
  assert.equal(formatShortMonthDay(timestamp), "7월 30일");
  assert.equal(
    formatFullDateTime(timestamp),
    "2026년 7월 30일 목요일 오전 9:05",
  );
  setLocale("en");
  assert.equal(formatTime(timestamp), "9:05 AM");
});

test("Korean inbox timestamps join the whole localized date and time message", () => {
  setLocale("ko");
  const now = at(2026, 6, 30, 14, 30);
  assert.equal(
    formatItemTimestamp(at(2026, 6, 29, 9, 5), {
      nowSeconds: now,
      withTime: true,
    }),
    "어제 오전 9:05",
  );
});

test("Korean thread summaries localize every relative unit and older dates", () => {
  setLocale("ko");
  const now = at(2026, 6, 30);
  for (const [seconds, expected] of [
    [30, "방금"],
    [60, "1분 전"],
    [180, "3분 전"],
    [3600, "1시간 전"],
    [10800, "3시간 전"],
    [86400, "1일 전"],
    [345600, "4일 전"],
  ]) {
    assert.equal(
      formatThreadSummaryLastReplyTime(now - seconds, now),
      expected,
    );
  }
  assert.equal(
    formatThreadSummaryLastReplyTime(at(2026, 4, 19), now),
    "5월 19일",
  );
});
