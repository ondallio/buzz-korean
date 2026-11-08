import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProjectsActivityDigest,
  formatProjectsActivityHighlight,
} from "./projectsActivityDigest.ts";
import { setLocale } from "@/shared/i18n";

test.afterEach(() => setLocale("en"));

const NOW = 2_000_000_000;

test("summarizes recent activity in a short highlighted sentence", () => {
  const project = { id: "project-a" };
  const digest = buildProjectsActivityDigest({
    issues: [
      { project, issue: { createdAt: NOW - 60 } },
      { project, issue: { createdAt: NOW - 120 } },
    ],
    nowSeconds: NOW,
    projects: [project],
    pullRequests: [{ project, pullRequest: { createdAt: NOW - 180 } }],
    snapshots: {
      "project-a": {
        commits: [
          { timestamp: NOW - 30 },
          { timestamp: NOW - 90 },
          { timestamp: NOW - 8 * 24 * 60 * 60 },
        ],
      },
    },
  });

  assert.equal(digest.kind, "week");
  assert.deepEqual(digest.highlights.map(formatProjectsActivityHighlight), [
    "2 new commits",
    "2 tasks opened",
    "1 review opened",
    "1 active project",
  ]);
  assert.ok(
    `This week: ${digest.highlights.map(formatProjectsActivityHighlight).join(", ")}.`.split(
      /\s+/,
    ).length <= 30,
  );
});

test("falls back to current totals when no recent activity is loaded", () => {
  const digest = buildProjectsActivityDigest({
    issues: [],
    nowSeconds: NOW,
    projects: [{ id: "a" }, { id: "b" }],
    pullRequests: [],
    summaries: {
      a: { issueCount: 4, prCount: 2 },
      b: { issueCount: 1, prCount: 3 },
    },
  });

  assert.equal(digest.kind, "totals");
  assert.deepEqual(digest.highlights.map(formatProjectsActivityHighlight), [
    "2 projects",
    "5 tasks",
    "5 reviews",
  ]);
});

test("digest retains structured counts independent of UI language and user titles", () => {
  const input = {
    issues: [],
    nowSeconds: NOW,
    projects: [{ id: "a", title: "DO NOT TRANSLATE API_field" }],
    pullRequests: [],
    summaries: { a: { issueCount: 2000, prCount: 1 } },
  };
  const english = buildProjectsActivityDigest(input);
  setLocale("ko");
  assert.deepEqual(buildProjectsActivityDigest(input), english);
  assert.deepEqual(english, {
    kind: "totals",
    highlights: [
      { kind: "project", count: 1 },
      { kind: "task", count: 2000 },
      { kind: "review", count: 1 },
    ],
  });
  assert.deepEqual(english.highlights.map(formatProjectsActivityHighlight), [
    "프로젝트 1개",
    "작업 2,000개",
    "리뷰 1개",
  ]);
  assert.equal(input.projects[0].title, "DO NOT TRANSLATE API_field");
});

for (const [kind, englishOne, englishMany, korean] of [
  ["new-commit", "1 new commit", "2 new commits", "새 커밋 2개"],
  ["opened-task", "1 task opened", "2 tasks opened", "새 작업 2개"],
  ["opened-review", "1 review opened", "2 reviews opened", "새 리뷰 2개"],
  [
    "active-project",
    "1 active project",
    "2 active projects",
    "활성 프로젝트 2개",
  ],
  ["project", "1 project", "2 projects", "프로젝트 2개"],
  ["task", "1 task", "2 tasks", "작업 2개"],
  ["review", "1 review", "2 reviews", "리뷰 2개"],
]) {
  test(`structured ${kind} highlight formats complete labels in both languages`, () => {
    assert.equal(
      formatProjectsActivityHighlight({ kind, count: 1 }),
      englishOne,
    );
    assert.equal(
      formatProjectsActivityHighlight({ kind, count: 2 }),
      englishMany,
    );
    setLocale("ko");
    assert.equal(formatProjectsActivityHighlight({ kind, count: 2 }), korean);
  });
}
